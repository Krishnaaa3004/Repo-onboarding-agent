"""Export example plans as static JSON for the frontend, so the demo works even when Gemini is down.

    uv run python scripts/export_examples.py            # from the local plan cache (no LLM calls)
    uv run python scripts/export_examples.py --live     # re-run the agent and record its full event trace
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agent import clean_lines, plan_cache_key, run_agent  # noqa: E402
from app.cache import Cache  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.llm import GeminiLLM  # noqa: E402
from app.schemas import Profile  # noqa: E402

EXAMPLES = ["pallets/flask", "httpie/cli", "pallets/click"]
PROFILE = Profile(languages=["Python"], level="beginner")
OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "examples"


def tidy(plan: dict) -> dict:
    """Plans cached before the junk filter existed get the same cleaning as new ones."""
    plan["caveats"] = clean_lines(plan["caveats"])
    plan["first_timer_insights"] = clean_lines(plan["first_timer_insights"])
    for key in ("branch", "commit", "pull_request", "code_style"):
        plan["conventions"][key] = clean_lines(plan["conventions"][key])
    return plan


async def record(repo: str, settings, cache) -> dict:
    llm = GeminiLLM(settings.gemini_api_key, settings.gemini_model, settings.gemini_fallback_models)
    started, trace, plan, metrics = time.perf_counter(), [], None, None
    async for ev in run_agent(repo, PROFILE, settings=settings, cache=cache, llm=llm, use_cache=False):
        ev = {**ev, "t": round(time.perf_counter() - started, 2)}
        if ev["type"] == "error":
            raise SystemExit(f"{repo}: {ev['message']}")
        if ev["type"] == "plan":
            plan = ev["plan"]
        elif ev["type"] == "metrics":
            metrics = ev["data"]
        else:
            trace.append(ev)
    return {"plan": tidy(plan), "metrics": metrics, "trace": trace}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    parser.add_argument("repos", nargs="*", default=EXAMPLES)
    args = parser.parse_args()

    settings = get_settings()
    cache = Cache(settings.cache_path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for repo in args.repos:
        if args.live:
            data = await record(repo, settings, cache)
        else:
            hit = cache.get(plan_cache_key(repo, PROFILE))
            if not hit:
                print(f"skip {repo}: not cached")
                continue
            data = {"plan": tidy(hit["plan"]), "metrics": hit["metrics"], "trace": []}
        out = OUT_DIR / f"{repo.replace('/', '__')}.json"
        out.write_text(json.dumps(data, indent=1), encoding="utf-8")
        print(f"wrote {out.name}: {len(data['plan']['issues'])} issues, {len(data['trace'])} trace events")


if __name__ == "__main__":
    asyncio.run(main())
