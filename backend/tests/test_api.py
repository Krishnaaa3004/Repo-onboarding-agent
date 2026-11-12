import json

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.config import Settings


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "settings", Settings(gemini_api_key="x", github_token="x",
                                                   cache_path=tmp_path / "c.sqlite3", rate_limit_per_hour=2))

    async def fake_run_agent(repo, profile, **kwargs):
        yield {"type": "status", "message": f"run {repo} {profile.level} {profile.languages}"}
        yield {"type": "done"}

    monkeypatch.setattr(main, "run_agent", fake_run_agent)
    with TestClient(main.app) as c:
        yield c


def events(resp) -> list[dict]:
    return [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_bad_repo_is_400(client):
    assert client.get("/api/onboard", params={"repo": "nope"}).status_code == 400


def test_stream_sends_sse_events(client):
    resp = client.get("/api/onboard", params={"repo": "https://github.com/pallets/flask",
                                              "languages": "Python, Go", "level": "intermediate"})
    assert resp.headers["content-type"].startswith("text/event-stream")
    evs = events(resp)
    assert evs[0]["message"] == "run pallets/flask intermediate ['Python', 'Go']"
    assert evs[-1] == {"type": "done"}


def test_rate_limit_counts_fresh_runs(client):
    for _ in range(2):
        assert client.get("/api/onboard", params={"repo": "a/b"}).status_code == 200
    assert client.get("/api/onboard", params={"repo": "a/b"}).status_code == 429


def test_rate_limiter_window():
    rl = main.RateLimiter(limit=1, window_s=3600)
    assert rl.allow("ip") and not rl.allow("ip") and rl.allow("other")
