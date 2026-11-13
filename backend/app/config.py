"""Settings loaded from environment variables (and backend/.env in development)."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    github_token: str = field(default_factory=lambda: os.getenv("GITHUB_TOKEN", ""))
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))
    # Tried in order when the current model stays overloaded (503s); empty disables fallback.
    gemini_fallback_models: list[str] = field(
        default_factory=lambda: _csv(os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-3.5-flash-lite"))
    )
    cache_path: Path = field(
        default_factory=lambda: Path(os.getenv("CACHE_PATH", BACKEND_DIR / "data" / "cache.sqlite3"))
    )
    # How long raw GitHub responses and finished plans stay cached (seconds).
    github_ttl: int = 6 * 3600
    plan_ttl: int = 24 * 3600
    # Hard cap on LLM turns so a confused model can't loop forever.
    max_agent_steps: int = field(default_factory=lambda: int(os.getenv("MAX_AGENT_STEPS", "4")))
    allowed_origins: list[str] = field(
        default_factory=lambda: _csv(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))
    )
    # Optional regex for extra origins, e.g. Vercel preview URLs; empty disables it.
    allowed_origin_regex: str = field(default_factory=lambda: os.getenv("ALLOWED_ORIGIN_REGEX", ""))
    rate_limit_per_hour: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_HOUR", "8")))
    # USD per 1M tokens, used only to *estimate* what a run would cost on the paid tier.
    # Defaults are Gemini 3.6 Flash list prices (ai.google.dev pricing, Nov 2026; a 50% introductory
    # rate applies until 2026-12-31, so this slightly overstates current cost). Output includes thinking.
    price_in_per_m: float = field(default_factory=lambda: float(os.getenv("PRICE_IN_PER_M", "1.50")))
    price_out_per_m: float = field(default_factory=lambda: float(os.getenv("PRICE_OUT_PER_M", "7.50")))

    def missing_keys(self) -> list[str]:
        return [name for name, val in (("GEMINI_API_KEY", self.gemini_api_key), ("GITHUB_TOKEN", self.github_token)) if not val]


def get_settings() -> Settings:
    return Settings()
