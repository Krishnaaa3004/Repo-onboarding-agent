from app.agent import run_agent
from app.github import RepoRef
from app.schemas import Profile
from app.tools import ToolBox

from conftest import FakeGitHub, ScriptedLLM, valid_submission

PROFILE = Profile(languages=["Python"], level="beginner")


async def collect(gen):
    return [ev async for ev in gen]


async def test_tree_listing_skips_noise_and_respects_depth():
    tb = ToolBox(FakeGitHub(), RepoRef("o", "r"))
    await tb.overview()
    top = (await tb.list_repo_tree("", depth=1))["entries"].splitlines()
    assert "src/" in top and "node_modules/" not in top
    assert "core.py" not in "\n".join(top)
    deep = (await tb.list_repo_tree("src", depth=2))["entries"]
    assert "core.py" in deep


async def test_overview_classifies_and_finds_notable_files():
    classification, ctx = await ToolBox(FakeGitHub(), RepoRef("o", "r")).overview()
    assert classification.size == "small" and classification.activity == "active"
    assert classification.primary_language == "Python"
    assert "CONTRIBUTING.md" in ctx["notable_files"]["docs"]
    assert "pyproject.toml" in ctx["notable_files"]["setup"]


async def test_list_issues_ranks_fresh_uncrowded_first():
    tb = ToolBox(FakeGitHub(), RepoRef("o", "r"))
    res = await tb.list_issues()
    assert res["labels_used"] == ["good first issue"]
    assert [i["number"] for i in res["issues"]] == [7, 9]


async def test_missing_file_becomes_tool_error_not_crash():
    tb = ToolBox(FakeGitHub(), RepoRef("o", "r"))
    assert "error" in await tb.call("fetch_repo_file", {"path": "NOPE.md"})
    assert "error" in await tb.call("not_a_tool", {})
    assert "error" in await tb.call("fetch_repo_file", {"wrong_arg": 1})


async def test_full_loop_produces_validated_enriched_plan(settings, cache):
    llm = ScriptedLLM([
        [("fetch_repo_file", {"path": "CONTRIBUTING.md"}), ("list_issues", {})],
        [("search_code", {"query": "typo"})],
        [("submit_plan", valid_submission())],
    ])
    events = await collect(run_agent("o/r", PROFILE, settings=settings, cache=cache, llm=llm, gh=FakeGitHub()))
    types = [e["type"] for e in events]
    assert types[-3:] == ["plan", "metrics", "done"]
    plan = next(e["plan"] for e in events if e["type"] == "plan")

    # hallucinated issue 12345 and invented paths are dropped; best issue ranks first
    assert [i["number"] for i in plan["issues"]] == [7, 9]
    assert plan["issues"][0]["likely_files"] == ["src/demo/core.py"]
    assert [d["path"] for d in plan["key_directories"]] == ["src/demo"]
    assert plan["issues"][0]["url"] == "https://github.com/o/r/issues/7"

    metrics = next(e["data"] for e in events if e["type"] == "metrics")
    assert metrics["steps"] == 3 and metrics["tool_calls"] == 3
    assert metrics["input_tokens"] == 3000 and metrics["est_cost_usd"] > 0


async def test_invalid_submission_is_sent_back_for_repair(settings, cache):
    llm = ScriptedLLM([
        [("list_issues", {})],
        [("submit_plan", {"architecture_summary": "missing required fields"})],
        [("submit_plan", valid_submission())],
    ])
    events = await collect(run_agent("o/r", PROFILE, settings=settings, cache=cache, llm=llm, gh=FakeGitHub()))
    metrics = next(e["data"] for e in events if e["type"] == "metrics")
    assert metrics["invalid_submissions"] == 1
    assert any(e["type"] == "plan" for e in events)


async def test_submit_before_list_issues_is_rejected(settings, cache):
    llm = ScriptedLLM([[("submit_plan", valid_submission())], [("list_issues", {})], [("submit_plan", valid_submission())]])
    events = await collect(run_agent("o/r", PROFILE, settings=settings, cache=cache, llm=llm, gh=FakeGitHub()))
    assert next(e["data"] for e in events if e["type"] == "metrics")["steps"] == 3


async def test_last_step_forces_submit_plan(settings, cache):
    llm = ScriptedLLM([[("list_repo_tree", {})]] * 4 + [[("submit_plan", valid_submission(issue_picks=[]))]])
    events = await collect(run_agent("o/r", PROFILE, settings=settings, cache=cache, llm=llm, gh=FakeGitHub()))
    assert llm.forced[-1] == "submit_plan" and llm.forced[0] is None
    assert any(e["type"] == "plan" for e in events)


async def test_second_run_is_served_from_cache(settings, cache):
    turns = [[("list_issues", {})], [("submit_plan", valid_submission())]]
    await collect(run_agent("o/r", PROFILE, settings=settings, cache=cache, llm=ScriptedLLM(turns), gh=FakeGitHub()))
    llm2 = ScriptedLLM([])
    events = await collect(run_agent("https://github.com/O/R", PROFILE, settings=settings, cache=cache, llm=llm2, gh=FakeGitHub()))
    assert llm2.history_lengths == []  # LLM never called
    assert next(e["data"] for e in events if e["type"] == "metrics")["cached"] is True


async def test_bad_url_yields_error_event(settings, cache):
    events = await collect(run_agent("not a url", PROFILE, settings=settings, cache=cache, llm=ScriptedLLM([])))
    assert events == [{"type": "error", "message": "Not a GitHub repo URL: 'not a url'"}]
