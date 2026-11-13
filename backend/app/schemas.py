"""Data shapes shared by the agent, API and frontend.

`PlanSubmission` is what the LLM must send to the `submit_plan` tool. Its JSON schema is generated
from these Pydantic models, so the tool definition and our validation can never drift apart.
`OnboardingPlan` is the enriched version we send to the frontend (real URLs, final scores).
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from .languages import clean_languages

Level = Literal["beginner", "intermediate"]
Difficulty = Literal["easy", "medium", "hard"]


class Profile(BaseModel):
    languages: list[str] = Field(default_factory=list)
    level: Level = "beginner"

    @field_validator("languages")
    @classmethod
    def only_known_languages(cls, v: list[str]) -> list[str]:
        # Unknown words are dropped, so free text from the URL never reaches the prompt or cache key.
        return clean_languages(v)


# ---------- what the LLM submits ----------

class KeyDirectory(BaseModel):
    path: str
    purpose: str


class SetupStep(BaseModel):
    title: str = Field(description="Short imperative step, e.g. 'Install dependencies'")
    command: str = Field(default="", description="Exact shell command if the docs give one, else empty")
    detail: str = Field(default="", description="One or two sentences of context")
    source: str = Field(default="", description="Repo file this came from, e.g. CONTRIBUTING.md")
    inferred: bool = Field(default=False, description="True if not stated in docs and inferred from config files")


class Conventions(BaseModel):
    branch: list[str] = Field(default_factory=list, description="Branch naming / which branch to target")
    commit: list[str] = Field(default_factory=list, description="Commit message rules, sign-off/DCO, squashing")
    pull_request: list[str] = Field(default_factory=list, description="PR rules: template, tests, changelog, CLA, reviews")
    code_style: list[str] = Field(default_factory=list, description="Linters, formatters, pre-commit hooks, test commands")
    sources: list[str] = Field(default_factory=list, description="Files these rules were taken from")


class IssuePick(BaseModel):
    number: int
    skill_match: float = Field(ge=0, le=1, description="0-1, how well the issue fits the user's languages/skills")
    difficulty: Difficulty
    why: str = Field(description="One sentence on why this suits the user")
    approach: str = Field(description="2-4 sentence suggested approach")
    likely_files: list[str] = Field(default_factory=list, description="Real repo paths likely involved")


class PlanSubmission(BaseModel):
    architecture_summary: str = Field(description="Plain-English overview, 4-8 sentences, no marketing")
    key_directories: list[KeyDirectory] = Field(default_factory=list)
    setup_steps: list[SetupStep]
    conventions: Conventions
    issue_picks: list[IssuePick] = Field(default_factory=list, description="3-6 candidate issues from list_issues")
    first_timer_insights: list[str] = Field(
        default_factory=list, description="What successful first PRs here looked like (size, area, style)"
    )
    caveats: list[str] = Field(default_factory=list, description="Anything missing or uncertain")


# ---------- what the frontend receives ----------

class RankedIssue(BaseModel):
    number: int
    title: str
    url: str
    labels: list[str]
    difficulty: Difficulty
    score: int
    heuristic_score: float
    skill_match: float
    updated_days_ago: int
    comments: int
    why: str
    approach: str
    likely_files: list[str]


class Classification(BaseModel):
    full_name: str
    description: str = ""
    primary_language: str = ""
    languages: dict[str, float] = Field(default_factory=dict)
    stars: int = 0
    size: Literal["small", "medium", "large"] = "small"
    activity: Literal["active", "moderate", "inactive"] = "active"
    file_count: int = 0
    default_branch: str = "main"


class OnboardingPlan(BaseModel):
    classification: Classification
    architecture_summary: str
    key_directories: list[KeyDirectory]
    setup_steps: list[SetupStep]
    conventions: Conventions
    issues: list[RankedIssue]
    first_timer_insights: list[str]
    caveats: list[str]


def gemini_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Pydantic JSON schema -> self-contained schema Gemini accepts (no $ref, titles or defaults)."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, list):
            return [resolve(v) for v in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return resolve(defs[node["$ref"].split("/")[-1]])
        out = {}
        for k, v in node.items():
            if k in ("title", "default"):
                continue
            # keys of a `properties` map are field names (a field may be called "title"), not keywords
            out[k] = {name: resolve(sub) for name, sub in v.items()} if k == "properties" else resolve(v)
        return out

    return resolve(schema)
