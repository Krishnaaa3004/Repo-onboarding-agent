"""Issue scoring: deterministic signals in code, judgement calls from the LLM.

heuristic_score  (computed here, from GitHub data)
    label signal  - is it tagged as beginner friendly?
    freshness     - recently updated issues are more likely still wanted
    crowding      - long comment threads often mean someone is already on it
    assignment    - assigned issues score 0

final_score  = 0.40 * heuristic + 0.35 * skill_match (LLM) + 0.25 * difficulty_fit (LLM difficulty vs user level)
"""

import re
from datetime import datetime, timezone

_LABEL_TIERS: list[tuple[re.Pattern, float]] = [
    (re.compile(r"good[\s_-]*first|first[\s_-]*timer|first[\s_-]*issue", re.I), 1.0),
    (re.compile(r"beginner|easy|starter|newcomer|low[\s_-]*hanging|up[\s_-]*for[\s_-]*grabs|e-easy", re.I), 0.8),
    (re.compile(r"help[\s_-]*wanted|contributions?[\s_-]*welcome|hacktoberfest", re.I), 0.55),
]

BEGINNER_LABEL_RE = re.compile("|".join(p.pattern for p, _ in _LABEL_TIERS), re.I)

DIFFICULTY_FIT = {
    "beginner": {"easy": 1.0, "medium": 0.5, "hard": 0.1},
    "intermediate": {"easy": 0.7, "medium": 1.0, "hard": 0.5},
}


def days_since(iso: str, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    then = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return max(0, (now - then).days)


def label_score(labels: list[str]) -> float:
    best = 0.3  # unlabeled issues still get a little credit
    for name in labels:
        for pattern, score in _LABEL_TIERS:
            if pattern.search(name):
                best = max(best, score)
    return best


def freshness_score(days_since_update: int) -> float:
    if days_since_update <= 30:
        return 1.0
    if days_since_update >= 365:
        return 0.1
    # linear from 1.0 at 30 days down to 0.2 at 365 days
    return round(1.0 - 0.8 * (days_since_update - 30) / 335, 3)


def crowding_score(comments: int) -> float:
    if comments <= 3:
        return 1.0
    if comments >= 15:
        return 0.2
    return round(1.0 - 0.8 * (comments - 3) / 12, 3)


def heuristic_score(labels: list[str], days_since_update: int, comments: int, assigned: bool) -> float:
    if assigned:
        return 0.0
    return round(
        0.45 * label_score(labels) + 0.35 * freshness_score(days_since_update) + 0.20 * crowding_score(comments), 3
    )


def final_score(heuristic: float, skill_match: float, difficulty: str, level: str) -> int:
    skill_match = min(max(skill_match, 0.0), 1.0)
    fit = DIFFICULTY_FIT.get(level, DIFFICULTY_FIT["beginner"]).get(difficulty, 0.5)
    return round(100 * (0.40 * heuristic + 0.35 * skill_match + 0.25 * fit))
