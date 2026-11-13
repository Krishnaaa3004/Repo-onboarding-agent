"""Run the agent on every eval repo, score each plan, and write a report.

    uv run python -m evals.run_eval                 # run repos that have no saved result yet
    uv run python -m evals.run_eval --repos httpie/cli encode/httpx
    uv run python -m evals.run_eval --rerun         # run every repo again
    uv run python -m evals.run_eval --report-only   # rescore saved runs, no LLM calls

Each repo's run is saved to evals/results/runs/, so a free-tier quota can be spread over several
sessions or models without losing finished work. Runs are always fresh (plan cache bypassed) so
latency and cost are real.
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from app.agent import run_agent
from app.cache import Cache
from app.config import get_settings
from app.llm import GeminiLLM
from app.schemas import Profile

from .scoring import load_cases, score_plan, summarize

RESULTS = Path(__file__).with_name("results")
RUNS = RESULTS / "runs"


def run_path(repo: str) -> Path:
    return RUNS / f"{repo.replace('/', '__')}.json"


async def run_one(case: dict, settings, cache: Cache) -> dict:
    llm = GeminiLLM(settings.gemini_api_key, settings.gemini_model, settings.gemini_fallback_models)
    profile = Profile(languages=case["languages"], level="beginner")
    plan = metrics = error = None
    started = time.perf_counter()
    async for ev in run_agent(case["repo"], profile, settings=settings, cache=cache, llm=llm, use_cache=False):
        if ev["type"] == "plan":
            plan = ev["plan"]
        elif ev["type"] == "metrics":
            metrics = ev["data"]
        elif ev["type"] == "error":
            error = {"code": ev.get("code"), "message": ev["message"]}
        elif ev["type"] == "status" and ev.get("kind") == "fallback":
            print(f"    fallback: {ev['message']}")
    return {
        "repo": case["repo"],
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "wall_s": round(time.perf_counter() - started, 1),
        "plan": plan,
        "metrics": metrics,
        "error": error,
    }


def load_rows(cases: list[dict]) -> list[dict]:
    rows = []
    for case in cases:
        p = run_path(case["repo"])
        saved = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
        plan = saved and saved.get("plan")
        rows.append({
            "repo": case["repo"],
            "languages": case["languages"],
            "score": score_plan(plan, case) if plan else None,
            "metrics": saved and saved.get("metrics"),
            "error": (saved and saved.get("error")) or (None if saved else {"message": "not run yet"}),
        })
    return rows


def write_report(rows: list[dict]) -> dict:
    summary = summarize(rows)
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "summary.json").write_text(json.dumps({"summary": summary, "repos": rows}, indent=1), encoding="utf-8")

    pct = lambda f, t: f"{100 * f / t:.0f}%" if t else "n/a"  # noqa: E731
    s = summary
    lines = [
        "# Eval results",
        "",
        f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC. Expected facts: `evals/cases.json` "
        "(written by hand from each repo's docs before any run).",
        "",
        f"- **Accuracy: {s['facts_found']}/{s['facts_total']} facts ({pct(s['facts_found'], s['facts_total'])})** "
        f"across {s['repos_scored']} repos",
        f"- Setup facts: {s['by_kind']['setup']['found']}/{s['by_kind']['setup']['total']} "
        f"({pct(s['by_kind']['setup']['found'], s['by_kind']['setup']['total'])}) · "
        f"Convention facts: {s['by_kind']['convention']['found']}/{s['by_kind']['convention']['total']} "
        f"({pct(s['by_kind']['convention']['found'], s['by_kind']['convention']['total'])})",
        f"- Latency: median {s['latency_s']['median']}s, max {s['latency_s']['max']}s per fresh plan",
        f"- Estimated cost: mean ${s['est_cost_usd']['mean']} per plan (at the configured paid-tier rates; "
        "actual cost on the free tier is $0)",
        f"- Median per plan: {s['model_turns_median']} model turns, {s['tool_calls_median']} tool calls, "
        f"{s['tokens_median']} tokens",
        f"- Models used: {', '.join(f'{m} ×{n}' for m, n in s['models'].items()) or 'n/a'}",
    ]
    if s["repos_failed"]:
        lines.append(f"- Not scored (run failed or not run yet): {', '.join(s['repos_failed'])}")
    lines += [
        "",
        "| Repo | Language | Facts | Setup | Conventions | Latency | Cost | Model |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        if r["score"]:
            sc, m = r["score"], r["metrics"] or {}
            lines.append(
                f"| {r['repo']} | {', '.join(r['languages'])} | {sc['found']}/{sc['total']} | "
                f"{sc['by_kind']['setup']['found']}/{sc['by_kind']['setup']['total']} | "
                f"{sc['by_kind']['convention']['found']}/{sc['by_kind']['convention']['total']} | "
                f"{m.get('latency_s', '–')}s | ${m.get('est_cost_usd', '–')} | {m.get('model', '–')} |"
            )
        else:
            lines.append(f"| {r['repo']} | {', '.join(r['languages'])} | – | – | – | – | – | {(r['error'] or {}).get('message', '')[:60]} |")
    lines += ["", "## Missed facts", ""]
    for r in rows:
        missed = [f for f in (r["score"] or {}).get("facts", []) if not f["found"]]
        if missed:
            lines.append(f"- **{r['repo']}**: " + "; ".join(f["fact"] for f in missed))
    (RESULTS / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return summary


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repos", nargs="*", help="Only these repos (owner/name)")
    parser.add_argument("--rerun", action="store_true", help="Run even if a saved result exists")
    parser.add_argument("--report-only", action="store_true", help="Just rescore saved runs")
    parser.add_argument("--pause", type=float, default=8.0, help="Seconds between repos (rate limits)")
    args = parser.parse_args()

    cases = load_cases()
    if args.repos:
        wanted = {r.lower() for r in args.repos}
        cases_to_run = [c for c in cases if c["repo"].lower() in wanted]
    else:
        cases_to_run = cases

    if not args.report_only:
        settings = get_settings()
        if missing := settings.missing_keys():
            print(f"Missing in backend/.env: {', '.join(missing)}", file=sys.stderr)
            return 2
        cache = Cache(settings.cache_path)
        RUNS.mkdir(parents=True, exist_ok=True)
        todo = [c for c in cases_to_run if args.rerun or not run_path(c["repo"]).exists()
                or json.loads(run_path(c["repo"]).read_text(encoding="utf-8")).get("error")]
        for i, case in enumerate(todo):
            print(f"[{i + 1}/{len(todo)}] {case['repo']} …", flush=True)
            result = await run_one(case, settings, cache)
            run_path(case["repo"]).write_text(json.dumps(result, indent=1), encoding="utf-8")
            if result["error"]:
                print(f"    ERROR {result['error']['code']}: {result['error']['message'][:160]}")
                if result["error"]["code"] in ("llm_quota",):
                    print("    Daily quota hit; stopping. Re-run later to continue where this left off.")
                    break
            else:
                sc = score_plan(result["plan"], case)
                m = result["metrics"]
                print(f"    {sc['found']}/{sc['total']} facts · {m['latency_s']}s · {m['steps']} turns · {m['model']}")
            if i < len(todo) - 1:
                await asyncio.sleep(args.pause)

    summary = write_report(load_rows(cases))
    print(f"\nAccuracy {summary['facts_found']}/{summary['facts_total']} ({summary['accuracy']}) "
          f"over {summary['repos_scored']} repos → evals/results/report.md")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(asyncio.run(main()))
