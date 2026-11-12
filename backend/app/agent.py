"""The agent loop.

    classify repo (code) -> [LLM picks tools -> we run them -> results go back to LLM]* -> submit_plan
    -> validate -> enrich (real URLs, final scores, drop hallucinated files/issues) -> cache

`run_agent` is an async generator of events, so the CLI can print them and the API can stream
them as Server-Sent Events without either knowing how the agent works.
"""

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any, Protocol

from pydantic import ValidationError

from .cache import Cache
from .config import Settings
from .github import GitHubClient, GitHubError, parse_repo_url
from .llm import FunctionCall, LLMTurn
from .schemas import (
    Classification, OnboardingPlan, PlanSubmission, Profile, RankedIssue,
)
from .scoring import final_score
from .tools import TOOL_DECLARATIONS, ToolBox

PLAN_CACHE_VERSION = "v1"

SYSTEM_PROMPT = """\
You are an onboarding agent that helps a newcomer make their first contribution to an open-source GitHub repo.
You investigate the repo with tools, then call submit_plan once.

Process:
1. Read the provided overview (classification, top-level folders, notable files).
2. Read the docs that matter: README, CONTRIBUTING (and any docs it links to inside the repo), the PR template.
   Skim the code of conduct only if it contains contribution rules. Use list_repo_tree to understand layout.
   For setup steps, also check config files (package.json scripts, pyproject.toml, Makefile, .nvmrc, etc.).
3. Call get_merged_prs_by_first_timers to see what successful first PRs looked like.
4. Call list_issues. Pick 3-6 issues that fit the user's languages and level. For the top picks, use
   search_code or list_repo_tree to find the files likely involved.
5. Call submit_plan.

Rules:
- Ground everything in what you read. Setup commands must come from the docs or config files; if you infer a
  step that is not written down, set inferred=true. Never invent commands, scripts or file paths.
- Conventions (branch, commit, PR, code style) must come from the repo's own files. Leave a list empty rather than
  guessing, and mention missing guidance in caveats.
- Write for a student: plain English, short sentences, no hype.
- Be efficient: batch independent tool calls in one turn when possible, and stay within about 10 tool turns.
"""


class LLM(Protocol):
    def user_message(self, text: str) -> Any: ...
    def tool_results(self, results: list[tuple[FunctionCall, dict]]) -> Any: ...
    async def generate(self, history: list, system: str, tools: list[dict], force_tool: str | None = None) -> LLMTurn: ...


def plan_cache_key(full_name: str, profile: Profile) -> str:
    langs = ",".join(sorted(l.strip().lower() for l in profile.languages if l.strip()))
    return f"plan:{PLAN_CACHE_VERSION}:{full_name.lower()}:{profile.level}:{langs}"


def build_prompt(context: dict, profile: Profile) -> str:
    return (
        f"User profile: languages={profile.languages or ['not specified']}, level={profile.level}.\n\n"
        f"Repo overview (computed from GitHub metadata):\n{json.dumps(context, indent=1)}\n\n"
        "Investigate the repo and then call submit_plan."
    )


def summarize_result(name: str, args: dict, result: dict) -> str:
    """One human-readable line per tool call, for the live activity feed."""
    if "error" in result:
        return f"Error: {result['error']}"
    if name == "fetch_repo_file":
        return f"Read {result['path']} ({result['total_chars']:,} chars{', truncated' if result['truncated'] else ''})"
    if name == "list_repo_tree":
        return f"Listed {result['path']} ({result['entries'].count(chr(10)) + 1} entries)"
    if name == "list_issues":
        how = "recent unlabeled issues" if result["fallback_unlabeled"] else f"labels: {', '.join(result['labels_used'])}"
        return f"Found {len(result['issues'])} open unassigned issues ({how})"
    if name == "search_code":
        return f"Code search '{result['query']}': {len(result['results'])} files"
    if name == "get_merged_prs_by_first_timers":
        return f"Found {len(result['prs'])} merged PRs by first-time contributors"
    return "done"


def enrich(sub: PlanSubmission, classification: Classification, toolbox: ToolBox, profile: Profile) -> OnboardingPlan:
    """Turn the LLM's submission into the final plan, keeping only things that verifiably exist."""
    known_paths = {e["path"] for e in toolbox.tree}

    def real(paths: list[str]) -> list[str]:
        return [p.strip("/") for p in paths if p.strip("/") in known_paths]

    issues: list[RankedIssue] = []
    seen: set[int] = set()
    for pick in sub.issue_picks:
        data = toolbox.issues.get(pick.number)
        if data is None or pick.number in seen:  # model referenced an issue it never saw
            continue
        seen.add(pick.number)
        issues.append(RankedIssue(
            number=pick.number,
            title=data["title"],
            url=data["url"],
            labels=data["labels"],
            difficulty=pick.difficulty,
            score=final_score(data["heuristic_score"], pick.skill_match, pick.difficulty, profile.level),
            heuristic_score=data["heuristic_score"],
            skill_match=pick.skill_match,
            updated_days_ago=data["updated_days_ago"],
            comments=data["comments"],
            why=pick.why,
            approach=pick.approach,
            likely_files=real(pick.likely_files),
        ))
    issues.sort(key=lambda i: -i.score)

    return OnboardingPlan(
        classification=classification,
        architecture_summary=sub.architecture_summary,
        key_directories=[d for d in sub.key_directories if d.path.strip("/") in known_paths],
        setup_steps=sub.setup_steps,
        conventions=sub.conventions,
        issues=issues[:5],
        first_timer_insights=sub.first_timer_insights,
        caveats=sub.caveats,
    )


async def run_agent(
    repo_url: str,
    profile: Profile,
    *,
    settings: Settings,
    cache: Cache,
    llm: LLM,
    gh: GitHubClient | None = None,
    use_cache: bool = True,
) -> AsyncIterator[dict]:
    started = time.perf_counter()
    try:
        ref = parse_repo_url(repo_url)
    except ValueError as e:
        yield {"type": "error", "message": str(e)}
        return

    key = plan_cache_key(ref.full_name, profile)
    if use_cache and (hit := cache.get(key)):
        yield {"type": "status", "message": "Loaded a cached plan for this repo and profile"}
        yield {"type": "classification", "data": hit["plan"]["classification"]}
        yield {"type": "plan", "plan": hit["plan"]}
        yield {"type": "metrics", "data": {**hit["metrics"], "cached": True,
                                           "latency_s": round(time.perf_counter() - started, 2)}}
        yield {"type": "done"}
        return

    owns_gh = gh is None
    gh = gh or GitHubClient(settings.github_token, cache, settings.github_ttl)
    toolbox = ToolBox(gh, ref)
    m = {"steps": 0, "tool_calls": 0, "input_tokens": 0, "output_tokens": 0, "invalid_submissions": 0}

    try:
        yield {"type": "status", "message": f"Classifying {ref.full_name}"}
        try:
            classification, context = await toolbox.overview()
        except GitHubError as e:
            yield {"type": "error", "message": str(e)}
            return
        yield {"type": "classification", "data": classification.model_dump()}

        history: list = [llm.user_message(build_prompt(context, profile))]
        listed_issues = False
        plan: OnboardingPlan | None = None

        for step in range(1, settings.max_agent_steps + 1):
            m["steps"] = step
            force = "submit_plan" if step == settings.max_agent_steps else None
            yield {"type": "status", "message": "Writing the plan" if force else f"Thinking (step {step})"}
            try:
                turn = await llm.generate(history, SYSTEM_PROMPT, TOOL_DECLARATIONS, force_tool=force)
            except Exception as e:  # provider outage, bad key, quota: report it, don't crash the stream
                yield {"type": "error", "message": f"LLM call failed: {str(e)[:300]}"}
                return
            m["input_tokens"] += turn.input_tokens
            m["output_tokens"] += turn.output_tokens
            history.append(turn.content)
            if turn.text:
                yield {"type": "note", "text": turn.text[:600]}

            if not turn.function_calls:
                history.append(llm.user_message("Continue: call the tools you need, then call submit_plan."))
                continue

            tool_calls = [c for c in turn.function_calls if c.name != "submit_plan"]
            submit_calls = [c for c in turn.function_calls if c.name == "submit_plan"]
            for c in tool_calls:
                yield {"type": "tool_call", "name": c.name, "args": c.args, "step": step}
            outputs = await asyncio.gather(*(toolbox.call(c.name, c.args) for c in tool_calls))
            results: list[tuple[FunctionCall, dict]] = []
            for c, out in zip(tool_calls, outputs):
                m["tool_calls"] += 1
                listed_issues |= c.name == "list_issues" and "error" not in out
                yield {"type": "tool_result", "name": c.name, "summary": summarize_result(c.name, c.args, out), "step": step}
                results.append((c, out))

            for c in submit_calls[:1]:
                if not listed_issues and not force:
                    results.append((c, {"error": "Call list_issues before submitting so issue picks are real."}))
                    continue
                try:
                    plan = enrich(PlanSubmission.model_validate(c.args), classification, toolbox, profile)
                    results.append((c, {"ok": True}))
                except ValidationError as e:
                    m["invalid_submissions"] += 1
                    errs = [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()[:8]]
                    results.append((c, {"error": "Plan failed validation, fix and resubmit", "details": errs}))
                    yield {"type": "status", "message": "Plan failed validation, asking the model to fix it"}

            if plan is not None:
                break
            history.append(llm.tool_results(results))

        if plan is None:
            yield {"type": "error", "message": "The agent did not produce a valid plan within its step budget."}
            return

        cost = (m["input_tokens"] * settings.price_in_per_m + m["output_tokens"] * settings.price_out_per_m) / 1e6
        metrics = {
            **m,
            "model": getattr(llm, "model", "unknown"),
            "est_cost_usd": round(cost, 5),
            "latency_s": round(time.perf_counter() - started, 2),
            "github_requests": gh.requests_made,
            "github_cache_hits": gh.cache_hits,
            "cached": False,
        }
        plan_dict = plan.model_dump()
        cache.set(key, {"plan": plan_dict, "metrics": metrics}, settings.plan_ttl)
        yield {"type": "plan", "plan": plan_dict}
        yield {"type": "metrics", "data": metrics}
        yield {"type": "done"}
    finally:
        if owns_gh:
            await gh.aclose()
