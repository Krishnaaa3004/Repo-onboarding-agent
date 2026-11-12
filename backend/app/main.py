"""HTTP API. Run locally with:  uv run uvicorn app.main:app --reload"""

import asyncio
import json
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .agent import plan_cache_key, run_agent
from .cache import Cache
from .config import get_settings
from .github import parse_repo_url
from .llm import GeminiLLM
from .schemas import Profile

settings = get_settings()
KEEPALIVE_SECONDS = 15


class RateLimiter:
    """Sliding-window limit on fresh (uncached) runs per client IP. In memory, so per process."""

    def __init__(self, limit: int, window_s: int = 3600):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now, q = time.time(), self.hits[key]
        while q and q[0] < now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.cache = Cache(settings.cache_path)
    app.state.limiter = RateLimiter(settings.rate_limit_per_hour)
    yield
    app.state.cache.close()


app = FastAPI(title="Repo Onboarding Agent", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def client_ip(request: Request) -> str:
    # Render/Vercel put the real client first in X-Forwarded-For
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


def sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@app.get("/api/health")
async def health():
    return {"ok": not settings.missing_keys(), "model": settings.gemini_model}


@app.get("/api/onboard")
async def onboard(
    request: Request,
    repo: str = Query(..., max_length=200),
    languages: str = Query("", max_length=200, description="Comma-separated"),
    level: Literal["beginner", "intermediate"] = "beginner",
    refresh: bool = False,
):
    if settings.missing_keys():
        return JSONResponse({"error": "Server is missing API keys"}, status_code=503)
    try:
        ref = parse_repo_url(repo)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    profile = Profile(languages=[l.strip() for l in languages.split(",") if l.strip()][:8], level=level)
    cache: Cache = request.app.state.cache
    is_cached = not refresh and cache.get(plan_cache_key(ref.full_name, profile)) is not None
    if not is_cached and not request.app.state.limiter.allow(client_ip(request)):
        return JSONResponse(
            {"error": f"Rate limit: {settings.rate_limit_per_hour} new analyses per hour. Cached repos still work.",
             "code": "rate_limited"},
            status_code=429,
        )

    llm = GeminiLLM(settings.gemini_api_key, settings.gemini_model, settings.gemini_fallback_models)
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def produce():
        try:
            async for ev in run_agent(ref.full_name, profile, settings=settings, cache=cache, llm=llm,
                                      use_cache=not refresh):
                await queue.put(ev)
        except Exception as e:  # never leave the client hanging
            await queue.put({"type": "error", "message": f"Unexpected error: {str(e)[:200]}"})
        finally:
            await queue.put(None)

    async def stream():
        task = asyncio.create_task(produce())
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # SSE comment; keeps proxies from closing an idle stream
                    continue
                if ev is None:
                    break
                yield sse(ev)
        finally:
            task.cancel()  # client went away or we finished: stop the agent

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
