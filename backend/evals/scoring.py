"""Score a generated plan against hand-written expected facts.

A fact is "found" if any of its regex patterns matches the plan's procedural text: the setup steps
(title, command, detail) and the conventions. Architecture, issue suggestions and caveats are
deliberately not searched, so an unrelated mention can't count as a hit.
"""

import json
import re
import statistics
from pathlib import Path
from typing import Any

CASES_PATH = Path(__file__).with_name("cases.json")
KINDS = ("setup", "convention")


def load_cases(path: Path = CASES_PATH) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["cases"]


def procedural_text(plan: dict) -> str:
    lines: list[str] = []
    for step in plan.get("setup_steps", []):
        lines += [step.get("title", ""), step.get("command", ""), step.get("detail", "")]
    conv = plan.get("conventions", {})
    for key in ("branch", "commit", "pull_request", "code_style"):
        lines += conv.get(key, [])
    return "\n".join(l for l in lines if l)


def score_plan(plan: dict, case: dict) -> dict[str, Any]:
    text = procedural_text(plan)
    results = []
    for fact in case["facts"]:
        found = any(re.search(p, text, re.IGNORECASE) for p in fact["patterns"])
        results.append({"id": fact["id"], "kind": fact["kind"], "fact": fact["fact"], "found": found})
    by_kind = {
        k: {"found": sum(r["found"] for r in results if r["kind"] == k), "total": sum(r["kind"] == k for r in results)}
        for k in KINDS
    }
    found = sum(r["found"] for r in results)
    return {"found": found, "total": len(results), "by_kind": by_kind, "facts": results}


def summarize(rows: list[dict]) -> dict[str, Any]:
    """rows: one per repo with keys repo, score (or None), metrics (or None), error (or None)."""
    scored = [r for r in rows if r.get("score")]
    found = sum(r["score"]["found"] for r in scored)
    total = sum(r["score"]["total"] for r in scored)
    kinds = {
        k: {
            "found": sum(r["score"]["by_kind"][k]["found"] for r in scored),
            "total": sum(r["score"]["by_kind"][k]["total"] for r in scored),
        }
        for k in KINDS
    }
    metrics = [r["metrics"] for r in scored if r.get("metrics")]
    latencies = [m["latency_s"] for m in metrics]
    costs = [m["est_cost_usd"] for m in metrics]
    models: dict[str, int] = {}
    for m in metrics:
        models[m["model"]] = models.get(m["model"], 0) + 1
    return {
        "repos_scored": len(scored),
        "repos_failed": [r["repo"] for r in rows if not r.get("score")],
        "facts_found": found,
        "facts_total": total,
        "accuracy": round(found / total, 3) if total else None,
        "by_kind": {k: {**v, "accuracy": round(v["found"] / v["total"], 3) if v["total"] else None} for k, v in kinds.items()},
        "latency_s": {
            "median": round(statistics.median(latencies), 1) if latencies else None,
            "max": round(max(latencies), 1) if latencies else None,
        },
        "est_cost_usd": {
            "mean": round(statistics.mean(costs), 4) if costs else None,
            "total": round(sum(costs), 4) if costs else None,
        },
        "model_turns_median": statistics.median([m["steps"] for m in metrics]) if metrics else None,
        "tool_calls_median": statistics.median([m["tool_calls"] for m in metrics]) if metrics else None,
        "tokens_median": statistics.median([m["input_tokens"] + m["output_tokens"] for m in metrics]) if metrics else None,
        "models": models,
    }
