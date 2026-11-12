"""The tools the agent can call, plus the deterministic repo classification step.

Every tool returns small JSON-serialisable dicts. Outputs are capped (file length, number of tree
entries, number of issues) because everything a tool returns is fed back into the LLM as tokens.
"""

import re
from collections import Counter
from typing import Any

from .github import GitHubClient, GitHubError, RepoRef
from .schemas import Classification, PlanSubmission, gemini_json_schema
from .scoring import BEGINNER_LABEL_RE, days_since, heuristic_score

MAX_FILE_CHARS = 12_000
MAX_TREE_ENTRIES = 250
NOISE_DIRS = re.compile(r"(^|/)(node_modules|vendor|third_party|\.git|dist|build|__pycache__|\.venv|site-packages)(/|$)")

# Files a newcomer (and the agent) should know about, grouped by why they matter.
NOTABLE_PATTERNS: dict[str, re.Pattern] = {
    "docs": re.compile(
        r"^(\.github/|docs?/)?(readme|contributing|code_of_conduct|development|hacking|governance|security)[^/]*$"
        r"|(^|/)pull_request_template[^/]*$|^\.github/pull_request_template/",
        re.I,
    ),
    "setup": re.compile(
        r"^(package\.json|pnpm-workspace\.yaml|yarn\.lock|pnpm-lock\.yaml|pyproject\.toml|setup\.py|setup\.cfg|"
        r"requirements[^/]*\.txt|Pipfile|poetry\.lock|uv\.lock|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|"
        r"Gemfile|composer\.json|Makefile|justfile|Taskfile\.ya?ml|Dockerfile|docker-compose\.ya?ml|compose\.ya?ml|"
        r"\.nvmrc|\.node-version|\.python-version|\.tool-versions|tox\.ini|noxfile\.py|CMakeLists\.txt|"
        r"\.devcontainer/devcontainer\.json)$",
        re.I,
    ),
    "conventions": re.compile(
        r"^(\.pre-commit-config\.yaml|commitlint\.config\.[cm]?[jt]s|\.commitlintrc[^/]*|\.editorconfig|"
        r"\.eslintrc[^/]*|eslint\.config\.[cm]?[jt]s|\.prettierrc[^/]*|ruff\.toml|\.ruff\.toml|\.flake8|"
        r"\.golangci\.ya?ml|rustfmt\.toml|biome\.json|CODEOWNERS|\.github/CODEOWNERS|changelog\.md|\.changeset/config\.json)$",
        re.I,
    ),
    "ci": re.compile(r"^\.github/workflows/[^/]+\.ya?ml$", re.I),
}


def classify(repo: dict, languages: dict[str, int], file_count: int) -> Classification:
    total = sum(languages.values()) or 1
    lang_pct = {k: round(100 * v / total, 1) for k, v in sorted(languages.items(), key=lambda kv: -kv[1])[:6]}
    days = days_since(repo["pushed_at"]) if repo.get("pushed_at") else 9999
    return Classification(
        full_name=repo["full_name"],
        description=repo.get("description") or "",
        primary_language=repo.get("language") or (next(iter(lang_pct), "")),
        languages=lang_pct,
        stars=repo.get("stargazers_count", 0),
        size="small" if file_count < 200 else "medium" if file_count < 2000 else "large",
        activity="active" if days <= 30 else "moderate" if days <= 180 else "inactive",
        file_count=file_count,
        default_branch=repo.get("default_branch", "main"),
    )


class ToolBox:
    def __init__(self, gh: GitHubClient, ref: RepoRef):
        self.gh = gh
        self.ref = ref
        self.branch = "main"
        self.tree: list[dict] = []
        self.tree_truncated = False
        self.issues: dict[int, dict] = {}  # every issue the agent has seen, for post-validation

    # ---------- step 1: deterministic overview ----------

    async def overview(self) -> tuple[Classification, dict[str, Any]]:
        repo = await self.gh.repo(self.ref)
        if repo.get("archived"):
            raise GitHubError(f"{self.ref.full_name} is archived and no longer accepts contributions")
        self.branch = repo.get("default_branch", "main")
        languages = await self.gh.languages(self.ref)
        self.tree, self.tree_truncated = await self.gh.tree_paths(self.ref, self.branch)
        files = [e for e in self.tree if e["type"] == "file"]
        classification = classify(repo, languages, len(files))

        notable: dict[str, list[str]] = {k: [] for k in NOTABLE_PATTERNS}
        for e in files:
            for group, pattern in NOTABLE_PATTERNS.items():
                if pattern.search(e["path"]) and len(notable[group]) < 25:
                    notable[group].append(e["path"])

        context = {
            "classification": classification.model_dump(),
            "topics": repo.get("topics", []),
            "license": (repo.get("license") or {}).get("spdx_id"),
            "open_issues_and_prs": repo.get("open_issues_count", 0),
            "top_level": self._tree_listing("", depth=1)["entries"],
            "notable_files": notable,
        }
        return classification, context

    def core_doc_paths(self, notable_docs: list[str]) -> list[str]:
        """README, CONTRIBUTING and PR template: the docs every plan needs, so we read them up front."""
        def pick(pattern: str) -> str | None:
            matches = [p for p in notable_docs if re.search(pattern, p.split("/")[-1], re.I)]
            # prefer the shallowest copy (root README over docs/readme)
            return min(matches, key=lambda p: (p.count("/"), len(p))) if matches else None

        paths = [pick(r"^readme"), pick(r"^contributing"), pick(r"pull_request_template")]
        return [p for p in paths if p]

    # ---------- tools ----------

    def _tree_listing(self, path: str, depth: int) -> dict:
        prefix = path.strip("/")
        prefix = f"{prefix}/" if prefix else ""
        lines = []
        for e in self.tree:
            p = e["path"]
            if not p.startswith(prefix) or NOISE_DIRS.search(p):
                continue
            rel = p[len(prefix):]
            level = rel.count("/")
            if level >= depth:
                continue
            lines.append("  " * level + rel.split("/")[-1] + ("/" if e["type"] == "dir" else ""))
        truncated = len(lines) > MAX_TREE_ENTRIES
        return {"path": path or "/", "entries": "\n".join(lines[:MAX_TREE_ENTRIES]), "truncated": truncated}

    async def list_repo_tree(self, path: str = "", depth: int = 2) -> dict:
        depth = min(max(int(depth), 1), 4)
        result = self._tree_listing(path, depth)
        if not result["entries"]:
            return {"error": f"No such directory: {path}"}
        return result

    async def fetch_repo_file(self, path: str) -> dict:
        text = await self.gh.file_text(self.ref, path.strip("/"))
        truncated = len(text) > MAX_FILE_CHARS
        return {"path": path, "content": text[:MAX_FILE_CHARS], "truncated": truncated, "total_chars": len(text)}

    async def list_issues(self, labels: list[str] | None = None, limit: int = 15) -> dict:
        limit = min(max(int(limit), 1), 25)
        if not labels:
            all_labels = await self.gh.labels(self.ref)
            labels = [l for l in all_labels if BEGINNER_LABEL_RE.search(l)][:4]

        raw: dict[int, dict] = {}
        for label in labels:
            for issue in await self.gh.open_issues(self.ref, label=label):
                raw[issue["number"]] = issue
        used_fallback = False
        if not raw:  # no beginner labels in this repo: fall back to recent unassigned issues
            used_fallback = True
            for issue in await self.gh.open_issues(self.ref):
                raw[issue["number"]] = issue

        rows = []
        for issue in raw.values():
            issue_labels = [l["name"] for l in issue.get("labels", [])]
            updated = days_since(issue["updated_at"])
            assigned = bool(issue.get("assignee") or issue.get("assignees"))
            h = heuristic_score(issue_labels, updated, issue.get("comments", 0), assigned)
            row = {
                "number": issue["number"],
                "title": issue["title"],
                "url": issue["html_url"],
                "labels": issue_labels,
                "updated_days_ago": updated,
                "comments": issue.get("comments", 0),
                "heuristic_score": h,
                "body_excerpt": (issue.get("body") or "")[:400],
            }
            rows.append(row)
        rows.sort(key=lambda r: -r["heuristic_score"])
        rows = rows[:limit]
        for r in rows:
            self.issues[r["number"]] = r
        return {"labels_used": labels, "fallback_unlabeled": used_fallback, "issues": rows}

    async def search_code(self, query: str) -> dict:
        return {"query": query, "results": await self.gh.search_code(self.ref, query)}

    async def get_merged_prs_by_first_timers(self, limit: int = 5) -> dict:
        prs = await self.gh.merged_prs_by_first_timers(self.ref, limit=min(max(int(limit), 1), 8))
        areas = Counter(f.split("/")[0] for pr in prs for f in pr["files"])
        return {"prs": prs, "common_top_level_areas": dict(areas.most_common(5))}

    # ---------- dispatch ----------

    async def call(self, name: str, args: dict) -> dict:
        fn = {
            "list_repo_tree": self.list_repo_tree,
            "fetch_repo_file": self.fetch_repo_file,
            "list_issues": self.list_issues,
            "search_code": self.search_code,
            "get_merged_prs_by_first_timers": self.get_merged_prs_by_first_timers,
        }.get(name)
        if fn is None:
            return {"error": f"Unknown tool {name}"}
        try:
            return await fn(**args)
        except GitHubError as e:
            return {"error": str(e)}
        except TypeError as e:  # model passed bad arguments
            return {"error": f"Bad arguments for {name}: {e}"}


TOOL_DECLARATIONS: list[dict] = [
    {
        "name": "list_repo_tree",
        "description": "List files and folders under a directory of the repo (noise like node_modules is skipped).",
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path, '' for repo root"},
                "depth": {"type": "integer", "description": "How many levels deep, 1-4 (default 2)"},
            },
        },
    },
    {
        "name": "fetch_repo_file",
        "description": f"Read a text file from the repo's default branch. Truncated after {MAX_FILE_CHARS} chars.",
        "parameters_json_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "File path, e.g. CONTRIBUTING.md"}},
            "required": ["path"],
        },
    },
    {
        "name": "list_issues",
        "description": (
            "List open, unassigned issues. With no labels, auto-detects beginner labels (good first issue, "
            "help wanted, ...) and falls back to recent issues. Each issue has a heuristic_score (0-1) computed "
            "from labels, freshness and comment count."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "labels": {"type": "array", "items": {"type": "string"}, "description": "Exact label names (optional)"},
                "limit": {"type": "integer", "description": "Max issues to return, up to 25 (default 15)"},
            },
        },
    },
    {
        "name": "search_code",
        "description": "Search code in this repo (GitHub code search). Use to find files likely involved in an issue.",
        "parameters_json_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Keywords or identifier names"}},
            "required": ["query"],
        },
    },
    {
        "name": "get_merged_prs_by_first_timers",
        "description": "Recent merged PRs whose author had no earlier merged PR here: shows what a successful first PR looks like.",
        "parameters_json_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "Max PRs, up to 8 (default 5)"}},
        },
    },
    {
        "name": "submit_plan",
        "description": "Submit the final onboarding plan. Call exactly once, when you have gathered enough information.",
        "parameters_json_schema": gemini_json_schema(PlanSubmission),
    },
]
