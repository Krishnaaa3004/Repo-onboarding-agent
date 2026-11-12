"""Thin async GitHub API client (REST + GraphQL) with SQLite caching."""

import base64
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .cache import Cache

API = "https://api.github.com"

_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
_LOGIN_RE = re.compile(r"^[A-Za-z0-9-]{1,39}$")


class GitHubError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class RepoRef:
    owner: str
    name: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.name}"


def parse_repo_url(url: str) -> RepoRef:
    """Accepts 'owner/repo', 'github.com/owner/repo', full URLs, '.git' suffixes and deeper paths."""
    s = url.strip()
    s = re.sub(r"^(https?://)?(www\.)?github\.com/", "", s, flags=re.IGNORECASE)
    s = s.split("?")[0].split("#")[0].strip("/")
    parts = s.split("/")
    if len(parts) < 2:
        raise ValueError(f"Not a GitHub repo URL: {url!r}")
    owner, name = parts[0], parts[1]
    if name.endswith(".git"):
        name = name[:-4]
    if not _OWNER_RE.match(owner) or not _REPO_RE.match(name):
        raise ValueError(f"Not a GitHub repo URL: {url!r}")
    return RepoRef(owner, name)


class GitHubClient:
    def __init__(self, token: str, cache: Cache | None = None, ttl: int = 6 * 3600):
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._http = httpx.AsyncClient(base_url=API, headers=headers, timeout=25.0)
        self._cache = cache
        self._ttl = ttl
        # Counters so each agent run can report how much it actually hit GitHub.
        self.requests_made = 0
        self.cache_hits = 0

    async def aclose(self) -> None:
        await self._http.aclose()

    # ---------- low level ----------

    async def _request(self, method: str, path: str, *, params: dict | None = None, json: Any = None,
                       accept: str | None = None) -> Any:
        key = f"gh:{method}:{path}:{sorted((params or {}).items())}:{json}:{accept}"
        if self._cache is not None:
            hit = self._cache.get(key)
            if hit is not None:
                self.cache_hits += 1
                return hit["v"]

        headers = {"Accept": accept} if accept else None
        self.requests_made += 1
        try:
            resp = await self._http.request(method, path, params=params, json=json, headers=headers)
        except httpx.HTTPError as e:
            raise GitHubError(f"Network error talking to GitHub: {e}") from e

        if resp.status_code == 404:
            raise GitHubError(f"Not found: {path}", 404)
        if resp.status_code in (403, 429) and resp.headers.get("x-ratelimit-remaining") == "0":
            raise GitHubError("GitHub API rate limit exhausted, try again later", resp.status_code)
        if resp.status_code >= 400:
            raise GitHubError(f"GitHub {resp.status_code} for {path}: {resp.text[:200]}", resp.status_code)

        ctype = resp.headers.get("content-type", "")
        value = resp.json() if "json" in ctype and not (accept or "").endswith("raw+json") else resp.text
        if isinstance(value, dict) and value.get("errors") and path == "/graphql":
            raise GitHubError(f"GraphQL error: {value['errors'][0].get('message')}")
        if self._cache is not None:
            self._cache.set(key, {"v": value}, self._ttl)
        return value

    async def get(self, path: str, params: dict | None = None, accept: str | None = None) -> Any:
        return await self._request("GET", path, params=params, accept=accept)

    async def graphql(self, query: str, variables: dict | None = None) -> dict:
        data = await self._request("POST", "/graphql", json={"query": query, "variables": variables or {}})
        return data["data"]

    # ---------- repo level ----------

    async def repo(self, ref: RepoRef) -> dict:
        return await self.get(f"/repos/{ref.full_name}")

    async def languages(self, ref: RepoRef) -> dict[str, int]:
        return await self.get(f"/repos/{ref.full_name}/languages")

    async def tree_paths(self, ref: RepoRef, branch: str) -> tuple[list[dict], bool]:
        """Every file/dir in the repo as [{path, type, size}], plus GitHub's 'truncated' flag."""
        data = await self.get(f"/repos/{ref.full_name}/git/trees/{branch}", params={"recursive": "1"})
        entries = [
            {"path": e["path"], "type": "dir" if e["type"] == "tree" else "file", "size": e.get("size", 0)}
            for e in data.get("tree", [])
            if e["type"] in ("tree", "blob")
        ]
        return entries, bool(data.get("truncated"))

    async def file_text(self, ref: RepoRef, path: str) -> str:
        data = await self.get(f"/repos/{ref.full_name}/contents/{path}")
        if isinstance(data, list):
            raise GitHubError(f"{path} is a directory, not a file")
        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        if data.get("download_url"):  # files > 1MB come back without inline content
            raise GitHubError(f"{path} is too large to read")
        return data.get("content", "")

    async def labels(self, ref: RepoRef) -> list[str]:
        data = await self.get(f"/repos/{ref.full_name}/labels", params={"per_page": 100})
        return [l["name"] for l in data]

    async def open_issues(self, ref: RepoRef, label: str | None = None, per_page: int = 30) -> list[dict]:
        params: dict[str, Any] = {"state": "open", "assignee": "none", "sort": "updated",
                                  "direction": "desc", "per_page": per_page}
        if label:
            params["labels"] = label
        data = await self.get(f"/repos/{ref.full_name}/issues", params=params)
        return [i for i in data if "pull_request" not in i]  # the issues endpoint also returns PRs

    async def search_code(self, ref: RepoRef, query: str, limit: int = 10) -> list[dict]:
        data = await self.get(
            "/search/code",
            params={"q": f"{query} repo:{ref.full_name}", "per_page": limit},
            accept="application/vnd.github.text-match+json",
        )
        out = []
        for item in data.get("items", [])[:limit]:
            fragments = [m.get("fragment", "")[:200] for m in item.get("text_matches", [])[:2]]
            out.append({"path": item["path"], "fragments": fragments})
        return out

    async def merged_prs_by_first_timers(self, ref: RepoRef, limit: int = 5) -> list[dict]:
        """Recent merged PRs whose author has exactly one merged PR in this repo.

        GitHub's authorAssociation is evaluated *now*, so a newcomer whose PR got merged shows up as
        CONTRIBUTOR, not FIRST_TIME_CONTRIBUTOR. So: take recent merged PRs from non-members, then
        count each author's merged PRs in one batched GraphQL query.
        """
        q = f"repo:{ref.full_name} is:pr is:merged sort:created-desc"
        data = await self.graphql(
            """
            query($q: String!) {
              search(query: $q, type: ISSUE, first: 40) {
                nodes { ... on PullRequest {
                  number title url createdAt mergedAt additions deletions changedFiles authorAssociation
                  author { __typename login }
                  labels(first: 5) { nodes { name } }
                  files(first: 8) { nodes { path } }
                } }
              }
            }""",
            {"q": q},
        )
        prs = [
            n for n in data["search"]["nodes"]
            if n and n.get("author") and n["author"]["__typename"] == "User"
            and n["authorAssociation"] not in ("OWNER", "MEMBER", "COLLABORATOR")
            and _LOGIN_RE.match(n["author"]["login"])
        ]
        logins = list(dict.fromkeys(p["author"]["login"] for p in prs))[:15]
        if not logins:
            return []

        aliases = "\n".join(
            f'a{i}: search(query: "repo:{ref.full_name} is:pr is:merged author:{login}", type: ISSUE, first: 0) {{ issueCount }}'
            for i, login in enumerate(logins)
        )
        counts = await self.graphql(f"query {{ {aliases} }}")
        first_timers = {login for i, login in enumerate(logins) if counts[f"a{i}"]["issueCount"] == 1}

        out = []
        for p in prs:
            if p["author"]["login"] not in first_timers:
                continue
            out.append({
                "number": p["number"],
                "title": p["title"],
                "url": p["url"],
                "additions": p["additions"],
                "deletions": p["deletions"],
                "changed_files": p["changedFiles"],
                "labels": [l["name"] for l in p["labels"]["nodes"]],
                "files": [f["path"] for f in (p.get("files") or {}).get("nodes", [])],
                "created_at": p["createdAt"],
                "merged_at": p["mergedAt"],
            })
            if len(out) >= limit:
                break
        return out
