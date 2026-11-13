import re

from evals.scoring import KINDS, load_cases, procedural_text, score_plan, summarize


def test_cases_file_is_well_formed():
    cases = load_cases()
    assert len(cases) >= 10
    ids = set()
    for case in cases:
        assert re.match(r"^[\w.-]+/[\w.-]+$", case["repo"])
        assert case["facts"] and case["languages"] and case["sources"]
        for fact in case["facts"]:
            assert fact["kind"] in KINDS
            assert fact["patterns"]
            for p in fact["patterns"]:
                re.compile(p)  # every pattern must be a valid regex
            key = (case["repo"], fact["id"])
            assert key not in ids
            ids.add(key)


PLAN = {
    "architecture_summary": "uses make test everywhere",  # must NOT count: not procedural text
    "setup_steps": [
        {"title": "Install", "command": "make all", "detail": "", "source": "CONTRIBUTING.md", "inferred": False},
        {"title": "Run tests", "command": "python -m pytest", "detail": "", "source": "", "inferred": False},
    ],
    "conventions": {"branch": ["Create a topical branch"], "commit": [], "pull_request": ["Add a CHANGELOG entry"],
                    "code_style": [], "sources": []},
    "issues": [{"why": "follows PEP8"}],  # must NOT count
    "caveats": ["pep8 not mentioned"],     # must NOT count
}
CASE = {
    "repo": "httpie/cli",
    "facts": [
        {"id": "a", "kind": "setup", "fact": "make all", "patterns": ["make all"]},
        {"id": "b", "kind": "setup", "fact": "pytest", "patterns": ["make test", "pytest"]},
        {"id": "c", "kind": "convention", "fact": "pep8", "patterns": ["pep ?8"]},
        {"id": "d", "kind": "convention", "fact": "changelog", "patterns": ["changelog"]},
        {"id": "e", "kind": "convention", "fact": "branch", "patterns": ["topic\\w* branch"]},
    ],
}


def test_score_only_searches_setup_and_conventions():
    text = procedural_text(PLAN)
    assert "architecture" not in text and "pep8" not in text.lower()
    sc = score_plan(PLAN, CASE)
    assert sc["found"] == 4 and sc["total"] == 5
    assert sc["by_kind"] == {"setup": {"found": 2, "total": 2}, "convention": {"found": 2, "total": 3}}
    assert [f["id"] for f in sc["facts"] if not f["found"]] == ["c"]


def test_summary_counts_failed_repos_separately():
    m = {"latency_s": 40.0, "est_cost_usd": 0.01, "model": "m", "steps": 3, "tool_calls": 8,
         "input_tokens": 20000, "output_tokens": 1000}
    rows = [
        {"repo": "a/b", "score": score_plan(PLAN, CASE), "metrics": m, "error": None},
        {"repo": "c/d", "score": None, "metrics": None, "error": {"message": "quota"}},
    ]
    s = summarize(rows)
    assert s["accuracy"] == 0.8 and s["repos_scored"] == 1 and s["repos_failed"] == ["c/d"]
    assert s["latency_s"]["median"] == 40.0 and s["models"] == {"m": 1}
