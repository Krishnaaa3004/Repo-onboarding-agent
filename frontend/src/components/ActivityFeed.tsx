import type { ActivityItem } from "../useOnboarding";

const TOOL_ICON: Record<string, string> = {
  fetch_repo_file: "📄",
  list_repo_tree: "🗂️",
  list_issues: "🎯",
  search_code: "🔎",
  get_merged_prs_by_first_timers: "🌱",
};

export function ActivityFeed({ items, running }: { items: ActivityItem[]; running: boolean }) {
  if (!items.length) return null;
  return (
    <details className="card activity" open={running}>
      <summary>
        <span>Agent activity</span>
        <span className="muted small">
          {items.filter((i) => i.kind === "tool").length} tool calls{running ? " · working…" : ""}
        </span>
      </summary>
      <ol>
        {items.map((it) => (
          <li key={it.id} className={`act act-${it.kind} ${it.done ? "done" : "pending"}`}>
            <span className="act-icon" aria-hidden>
              {!it.done ? <span className="spinner" /> : it.kind === "tool" ? TOOL_ICON[it.tool ?? ""] ?? "🔧" : it.kind === "note" ? "💭" : "✓"}
            </span>
            <span className="act-text">{it.text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
