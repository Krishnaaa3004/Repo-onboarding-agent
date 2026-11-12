import time

import pytest

from app.cache import Cache
from app.github import parse_repo_url
from app.schemas import PlanSubmission, gemini_json_schema
from app.scoring import final_score, freshness_score, heuristic_score, label_score


@pytest.mark.parametrize("url", [
    "https://github.com/pallets/flask",
    "github.com/pallets/flask.git",
    "pallets/flask",
    "https://github.com/pallets/flask/tree/main/src",
    "  https://www.github.com/pallets/flask/  ",
])
def test_parse_repo_url_variants(url):
    ref = parse_repo_url(url)
    assert (ref.owner, ref.name) == ("pallets", "flask")


@pytest.mark.parametrize("bad", ["", "flask", "https://gitlab.com/a", "a/b c", "../etc/passwd"])
def test_parse_repo_url_rejects(bad):
    with pytest.raises(ValueError):
        parse_repo_url(bad)


def test_cache_roundtrip_and_expiry(tmp_path):
    c = Cache(tmp_path / "x.sqlite3")
    c.set("k", {"a": [1, 2]}, ttl_seconds=60)
    assert c.get("k") == {"a": [1, 2]}
    c.set("old", 1, ttl_seconds=-1)
    assert c.get("old") is None
    assert c.get("missing") is None


def test_label_tiers():
    assert label_score(["good first issue"]) == 1.0
    assert label_score(["Good-First-Issue"]) == 1.0
    assert label_score(["beginner"]) == 0.8
    assert label_score(["help wanted"]) == 0.55
    assert label_score(["bug"]) == 0.3


def test_freshness_is_monotonic():
    scores = [freshness_score(d) for d in (0, 30, 100, 200, 364, 365, 1000)]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] == 1.0 and scores[-1] == 0.1


def test_assigned_issue_scores_zero():
    assert heuristic_score(["good first issue"], 1, 0, assigned=True) == 0.0


def test_final_score_prefers_level_appropriate_difficulty():
    h = 0.8
    assert final_score(h, 0.8, "easy", "beginner") > final_score(h, 0.8, "hard", "beginner")
    assert final_score(h, 0.8, "medium", "intermediate") > final_score(h, 0.8, "easy", "intermediate")
    assert 0 <= final_score(1.0, 5.0, "easy", "beginner") <= 100  # skill_match is clamped


def test_clean_lines_drops_leaked_json_fragments():
    from app.agent import clean_lines
    leaked = ["- No CLA is required.", "conventions:{branch:[", "],code_style:[", ",difficulty:", "},{approach:",
              "Run `pytest` before pushing (see CONTRIBUTING.md)", "  "]
    assert clean_lines(leaked) == ["No CLA is required.", "Run `pytest` before pushing (see CONTRIBUTING.md)"]


def test_gemini_schema_is_self_contained():
    schema = gemini_json_schema(PlanSubmission)
    text = str(schema)
    assert "$ref" not in text and "$defs" not in text
    assert "title" not in schema  # schema keyword stripped...
    step = schema["properties"]["setup_steps"]["items"]
    assert "title" in step["properties"] and step["required"] == ["title"]  # ...but a field named title survives
    assert "issue_picks" in schema["properties"]
