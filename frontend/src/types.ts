// Mirrors backend/app/schemas.py (OnboardingPlan) and the agent's event stream.

export type Level = "beginner" | "intermediate";

export interface Classification {
  full_name: string;
  description: string;
  primary_language: string;
  languages: Record<string, number>;
  stars: number;
  size: "small" | "medium" | "large";
  activity: "active" | "moderate" | "inactive";
  file_count: number;
  default_branch: string;
}

export interface SetupStep {
  title: string;
  command: string;
  detail: string;
  source: string;
  inferred: boolean;
}

export interface Conventions {
  branch: string[];
  commit: string[];
  pull_request: string[];
  code_style: string[];
  sources: string[];
}

export type ConventionKey = Exclude<keyof Conventions, "sources">;

export interface RankedIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  difficulty: "easy" | "medium" | "hard";
  score: number;
  heuristic_score: number;
  skill_match: number;
  updated_days_ago: number;
  comments: number;
  why: string;
  approach: string;
  likely_files: string[];
}

export interface OnboardingPlan {
  classification: Classification;
  architecture_summary: string;
  key_directories: { path: string; purpose: string }[];
  setup_steps: SetupStep[];
  conventions: Conventions;
  issues: RankedIssue[];
  first_timer_insights: string[];
  caveats: string[];
}

export interface Metrics {
  steps: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
  latency_s: number;
  model: string;
  cached: boolean;
}

export type ErrorCode =
  | "bad_url" | "repo_not_found" | "github_rate_limit" | "github_error"
  | "llm_busy" | "llm_quota" | "llm_error" | "rate_limited" | "network" | "unknown";

export type AgentEvent =
  | { type: "status"; message: string; kind?: "fallback" }
  | { type: "classification"; data: Classification }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; step: number }
  | { type: "tool_result"; name: string; summary: string; step: number }
  | { type: "note"; text: string }
  | { type: "plan"; plan: OnboardingPlan }
  | { type: "metrics"; data: Metrics }
  | { type: "error"; message: string; code?: ErrorCode }
  | { type: "done" };

/** A saved run: plan + metrics, and optionally the recorded event trace (with timestamps). */
export interface ExampleRun {
  plan: OnboardingPlan;
  metrics: Metrics;
  trace: (AgentEvent & { t?: number })[];
}
