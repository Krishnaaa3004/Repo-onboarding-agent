"""Run the agent from the terminal.

    uv run python -m app.cli https://github.com/pallets/flask --lang python --level beginner
"""

import argparse
import asyncio
import json
import sys

from .agent import run_agent
from .cache import Cache
from .config import get_settings
from .llm import GeminiLLM
from .schemas import Profile


def print_plan(plan: dict) -> None:
    c = plan["classification"]
    print(f"\n=== {c['full_name']} ({c['primary_language']}, {c['size']}, {c['activity']}) ===\n")
    print("ARCHITECTURE\n" + plan["architecture_summary"])
    for d in plan["key_directories"]:
        print(f"  - {d['path']}: {d['purpose']}")
    print("\nSETUP")
    for i, s in enumerate(plan["setup_steps"], 1):
        flag = " (inferred)" if s["inferred"] else ""
        print(f"  {i}. {s['title']}{flag}" + (f"\n       $ {s['command']}" if s["command"] else ""))
    print("\nCONVENTIONS")
    for k in ("branch", "commit", "pull_request", "code_style"):
        for rule in plan["conventions"][k]:
            print(f"  [{k}] {rule}")
    print("\nGOOD FIRST ISSUES")
    for i in plan["issues"]:
        print(f"  #{i['number']} [{i['score']}] {i['title']} ({i['difficulty']})\n       {i['url']}\n       {i['approach']}")
        if i["likely_files"]:
            print(f"       files: {', '.join(i['likely_files'])}")
    if plan["first_timer_insights"]:
        print("\nWHAT FIRST PRs HERE LOOK LIKE")
        for s in plan["first_timer_insights"]:
            print(f"  - {s}")
    if plan["caveats"]:
        print("\nCAVEATS")
        for s in plan["caveats"]:
            print(f"  - {s}")


async def main() -> int:
    parser = argparse.ArgumentParser(description="Generate an onboarding plan for a GitHub repo.")
    parser.add_argument("repo", help="GitHub URL or owner/name")
    parser.add_argument("--lang", action="append", default=[], help="A language you know (repeatable)")
    parser.add_argument("--level", choices=["beginner", "intermediate"], default="beginner")
    parser.add_argument("--no-cache", action="store_true", help="Ignore a cached plan")
    parser.add_argument("--json", metavar="FILE", help="Also write the plan + metrics to this file")
    args = parser.parse_args()

    settings = get_settings()
    if missing := settings.missing_keys():
        print(f"Missing in backend/.env: {', '.join(missing)}", file=sys.stderr)
        return 2

    cache = Cache(settings.cache_path)
    llm = GeminiLLM(settings.gemini_api_key, settings.gemini_model, settings.gemini_fallback_models)
    profile = Profile(languages=args.lang, level=args.level)
    plan, metrics = None, None

    async for ev in run_agent(args.repo, profile, settings=settings, cache=cache, llm=llm, use_cache=not args.no_cache):
        t = ev["type"]
        if t == "status":
            print(f"... {ev['message']}")
        elif t == "tool_call":
            print(f"  -> {ev['name']}({json.dumps(ev['args'])[:120]})")
        elif t == "tool_result":
            print(f"  <- {ev['summary']}")
        elif t == "note":
            print(f"  (model) {ev['text'][:200]}")
        elif t == "error":
            print(f"ERROR: {ev['message']}", file=sys.stderr)
            return 1
        elif t == "plan":
            plan = ev["plan"]
        elif t == "metrics":
            metrics = ev["data"]

    if plan:
        print_plan(plan)
    if metrics:
        print(f"\nMETRICS {json.dumps(metrics)}")
    if args.json and plan:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"plan": plan, "metrics": metrics}, f, indent=2)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    sys.exit(asyncio.run(main()))
