from datetime import datetime, timedelta, timezone

import pytest

from app.cache import Cache
from app.config import Settings
from app.llm import FunctionCall, LLMTurn


def iso_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


class FakeGitHub:
    """Stands in for GitHubClient with a tiny fixed repo."""

    def __init__(self):
        self.requests_made = 0
        self.cache_hits = 0
        self.files = {
            "README.md": "# demo\nA demo project.\n",
            "CONTRIBUTING.md": "Run `pip install -e .[dev]` then `pytest`. Use conventional commits.",
        }

    async def repo(self, ref):
        return {"full_name": ref.full_name, "description": "demo", "language": "Python", "stargazers_count": 10,
                "pushed_at": iso_days_ago(2), "default_branch": "main", "topics": [], "license": None,
                "open_issues_count": 2, "archived": False}

    async def languages(self, ref):
        return {"Python": 900, "Shell": 100}

    async def tree_paths(self, ref, branch):
        paths = [("README.md", "file"), ("CONTRIBUTING.md", "file"), ("pyproject.toml", "file"),
                 ("src", "dir"), ("src/demo", "dir"), ("src/demo/core.py", "file"), ("tests", "dir"),
                 ("tests/test_core.py", "file"), ("node_modules", "dir"), ("node_modules/x.js", "file")]
        return [{"path": p, "type": t, "size": 1} for p, t in paths], False

    async def file_text(self, ref, path):
        from app.github import GitHubError
        if path not in self.files:
            raise GitHubError(f"Not found: {path}", 404)
        return self.files[path]

    async def labels(self, ref):
        return ["bug", "good first issue", "docs"]

    async def open_issues(self, ref, label=None, per_page=30):
        return [
            {"number": 7, "title": "Fix typo in core", "html_url": "https://github.com/o/r/issues/7",
             "labels": [{"name": "good first issue"}], "updated_at": iso_days_ago(3), "comments": 1,
             "assignee": None, "assignees": [], "body": "There is a typo."},
            {"number": 9, "title": "Old crowded issue", "html_url": "https://github.com/o/r/issues/9",
             "labels": [{"name": "good first issue"}], "updated_at": iso_days_ago(400), "comments": 30,
             "assignee": None, "assignees": [], "body": ""},
        ]

    async def search_code(self, ref, query, limit=10):
        return [{"path": "src/demo/core.py", "fragments": ["typo here"]}]

    async def merged_prs_by_first_timers(self, ref, limit=5):
        return [{"number": 3, "title": "docs: fix link", "url": "u", "additions": 1, "deletions": 1,
                 "changed_files": 1, "labels": [], "files": ["README.md"], "created_at": "", "merged_at": ""}]

    async def aclose(self):
        pass


class ScriptedLLM:
    """Replays a fixed list of turns; each turn is a list of (tool_name, args)."""

    model = "fake"

    def __init__(self, turns: list[list[tuple[str, dict]]]):
        self.turns = list(turns)
        self.history_lengths: list[int] = []
        self.forced: list[str | None] = []

    def user_message(self, text):
        return {"role": "user", "text": text}

    def tool_results(self, results):
        return {"role": "tool", "results": [(c.name, r) for c, r in results]}

    async def generate(self, history, system, tools, force_tool=None):
        self.history_lengths.append(len(history))
        self.forced.append(force_tool)
        calls = self.turns.pop(0) if self.turns else []
        return LLMTurn(content={"role": "model"}, function_calls=[FunctionCall(n, a) for n, a in calls],
                       input_tokens=1000, output_tokens=200)


def valid_submission(**overrides) -> dict:
    sub = {
        "architecture_summary": "A small Python library.",
        "key_directories": [{"path": "src/demo", "purpose": "library code"}, {"path": "made/up", "purpose": "x"}],
        "setup_steps": [{"title": "Install", "command": "pip install -e .[dev]", "source": "CONTRIBUTING.md"}],
        "conventions": {"commit": ["Conventional commits"], "sources": ["CONTRIBUTING.md"]},
        "issue_picks": [
            {"number": 9, "skill_match": 0.9, "difficulty": "easy", "why": "w", "approach": "a", "likely_files": []},
            {"number": 7, "skill_match": 0.9, "difficulty": "easy", "why": "w", "approach": "a",
             "likely_files": ["src/demo/core.py", "src/invented.py"]},
            {"number": 12345, "skill_match": 1.0, "difficulty": "easy", "why": "w", "approach": "a"},
        ],
    }
    sub.update(overrides)
    return sub


@pytest.fixture
def settings(tmp_path):
    return Settings(gemini_api_key="x", github_token="x", cache_path=tmp_path / "c.sqlite3", max_agent_steps=5)


@pytest.fixture
def cache(settings):
    c = Cache(settings.cache_path)
    yield c
    c.close()
