# Eval results

Generated 2026-11-13 20:36 UTC. Expected facts: `evals/cases.json` (written by hand from each repo's docs before any run).

- **Accuracy: 51/56 facts (91%)** across 10 repos
- Setup facts: 21/21 (100%) · Convention facts: 30/35 (86%)
- Latency: median 52.6s, max 109.3s per fresh plan
- Estimated cost: mean $0.0562 per plan (at the configured paid-tier rates; actual cost on the free tier is $0)
- Median per plan: 2.0 model turns, 9.0 tool calls, 28396.5 tokens
- Models used: gemini-3.6-flash ×5, gemini-3.5-flash-lite ×5

| Repo | Language | Facts | Setup | Conventions | Latency | Cost | Model |
|---|---|---|---|---|---|---|---|
| httpie/cli | Python | 6/6 | 2/2 | 4/4 | 68.52s | $0.05268 | gemini-3.6-flash |
| encode/httpx | Python | 5/5 | 2/2 | 3/3 | 68.48s | $0.06139 | gemini-3.6-flash |
| pydantic/pydantic | Python | 6/6 | 3/3 | 3/3 | 76.97s | $0.06923 | gemini-3.6-flash |
| Textualize/rich | Python | 7/7 | 2/2 | 5/5 | 109.3s | $0.07031 | gemini-3.6-flash |
| vitejs/vite | TypeScript | 4/6 | 3/3 | 1/3 | 57.18s | $0.07094 | gemini-3.6-flash |
| astral-sh/ruff | Rust | 6/7 | 3/3 | 3/4 | 47.94s | $0.05674 | gemini-3.5-flash-lite |
| sharkdp/bat | Rust | 3/3 | 1/1 | 2/2 | 12.56s | $0.03905 | gemini-3.5-flash-lite |
| pytest-dev/pytest | Python | 4/5 | 1/1 | 3/4 | 10.46s | $0.05063 | gemini-3.5-flash-lite |
| prettier/prettier | JavaScript, TypeScript | 4/5 | 2/2 | 2/3 | 10.34s | $0.04655 | gemini-3.5-flash-lite |
| gohugoio/hugo | Go | 6/6 | 2/2 | 4/4 | 13.2s | $0.04479 | gemini-3.5-flash-lite |

## Missed facts

- **vitejs/vite**: Open a suggestion issue before a new feature; Multiple commits are fine; they are squashed on merge
- **astral-sh/ruff**: Update snapshot tests with `cargo insta review`
- **pytest-dev/pytest**: Maintainers may squash commits on merge
- **prettier/prettier**: PRs adding new formatting options are not accepted
