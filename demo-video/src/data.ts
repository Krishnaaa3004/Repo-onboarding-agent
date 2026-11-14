/**
 * Everything shown in the video comes from real data:
 *  - the saved pallets/flask plan the live site ships (frontend/src/examples/pallets__flask.json)
 *  - the tool trace printed by the first live CLI run on pallets/flask
 *  - the eval report (backend/evals/results/report.md)
 */
import flask from "../../frontend/src/examples/pallets__flask.json";

export const plan = flask.plan;
export const metrics = flask.metrics;

export const REPO = "pallets/flask";
export const FILE_COUNT = plan.classification.file_count; // 236

// top-level entries of the flask repo (as listed by the agent's list_repo_tree)
export const MESSY_TREE = [
  "src/flask/", "tests/", "docs/", "examples/", ".github/", ".devcontainer/",
  "pyproject.toml", "CHANGES.rst", "README.md", ".pre-commit-config.yaml",
];

// real tool calls and results from the live flask run
export const TRACE = [
  { tool: "list_repo_tree", result: "Listed / · 86 entries" },
  { tool: "fetch_repo_file", result: "Read docs/contributing.rst + PR template" },
  { tool: "list_issues", result: "2 open, unassigned issues" },
  { tool: "get_merged_prs_by_first_timers", result: "5 first-timer PRs merged" },
];

export const SETUP = plan.setup_steps; // python3 -m venv .venv (inferred), uv sync, pre-commit install, pytest
export const RULES = [plan.conventions.pull_request[0], plan.conventions.commit[0], plan.conventions.code_style[0]];
export const ISSUE = plan.issues[0]; // #6146, score 87

export const EVAL = { found: 51, total: 56, pct: 91, repos: 10 };
export const LIVE_URL = "repo-onboarding-agent.vercel.app";
export const GITHUB = "github.com/Krishnaaa3004/Repo-onboarding-agent";
