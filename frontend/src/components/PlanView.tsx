import { useMemo, useState, type ReactNode } from "react";
import type { Conventions, Metrics, OnboardingPlan } from "../types";
import { useChecklist } from "../useChecklist";

const CONVENTION_LABELS: Record<keyof Omit<Conventions, "sources">, string> = {
  branch: "Branches",
  commit: "Commits",
  pull_request: "Pull requests",
  code_style: "Code style & checks",
};

function Check({ id, checked, toggle, children }: { id: string; checked: Set<string>; toggle: (id: string) => void; children: ReactNode }) {
  const on = checked.has(id);
  return (
    <li className={`check ${on ? "on" : ""}`}>
      <label>
        <input type="checkbox" checked={on} onChange={() => toggle(id)} />
        <span className="check-body">{children}</span>
      </label>
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="copy" onClick={(e) => {
      e.preventDefault();
      navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
    }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Section({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card section">
      <header>
        <h2><span className="num">{n}</span>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function PlanView({ plan, metrics }: { plan: OnboardingPlan; metrics: Metrics | null }) {
  const c = plan.classification;
  const storageKey = `roa:checklist:${c.full_name.toLowerCase()}`;
  const { checked, toggle } = useChecklist(storageKey);

  const ids = useMemo(() => {
    const out = plan.setup_steps.map((_, i) => `setup-${i}`);
    for (const key of Object.keys(CONVENTION_LABELS) as (keyof typeof CONVENTION_LABELS)[]) {
      plan.conventions[key].forEach((_, i) => out.push(`conv-${key}-${i}`));
    }
    plan.issues.forEach((i) => out.push(`issue-${i.number}`));
    return out;
  }, [plan]);
  const done = ids.filter((id) => checked.has(id)).length;
  const pct = ids.length ? Math.round((100 * done) / ids.length) : 0;
  const hasConventions = (Object.keys(CONVENTION_LABELS) as (keyof typeof CONVENTION_LABELS)[]).some((k) => plan.conventions[k].length);

  return (
    <div className="plan">
      <div className="card overview">
        <div>
          <h1>
            <a href={`https://github.com/${c.full_name}`} target="_blank" rel="noreferrer">{c.full_name}</a>
          </h1>
          {c.description && <p className="muted">{c.description}</p>}
          <div className="badges">
            {c.primary_language && <span className="badge">{c.primary_language}</span>}
            <span className="badge">{c.size} · {c.file_count.toLocaleString()} files</span>
            <span className={`badge activity-${c.activity}`}>{c.activity}</span>
            <span className="badge">★ {c.stars.toLocaleString()}</span>
          </div>
        </div>
        <div className="progress" aria-label={`${done} of ${ids.length} steps done`}>
          <div className="progress-label"><strong>{done}</strong>/{ids.length} done</div>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      <Section n={1} title="How the project is organised">
        <p className="prose">{plan.architecture_summary}</p>
        {plan.key_directories.length > 0 && (
          <dl className="dirs">
            {plan.key_directories.map((d) => (
              <div key={d.path}>
                <dt><code>{d.path}/</code></dt>
                <dd>{d.purpose}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section n={2} title="Set up locally">
        <ol className="checklist">
          {plan.setup_steps.map((s, i) => (
            <Check key={i} id={`setup-${i}`} checked={checked} toggle={toggle}>
              <span className="check-title">
                {s.title}
                {s.inferred && <span className="tag" title="Not written in the docs; inferred from config files">inferred</span>}
              </span>
              {s.command && (
                <span className="cmd"><code>{s.command}</code><CopyButton text={s.command} /></span>
              )}
              {s.detail && <span className="muted small">{s.detail}</span>}
              {s.source && <span className="source">from {s.source}</span>}
            </Check>
          ))}
        </ol>
      </Section>

      <Section n={3} title="House rules for contributions"
        aside={plan.conventions.sources.length > 0 && <span className="muted small">from {plan.conventions.sources.join(", ")}</span>}>
        {hasConventions ? (
          <div className="conventions">
            {(Object.keys(CONVENTION_LABELS) as (keyof typeof CONVENTION_LABELS)[]).map((key) =>
              plan.conventions[key].length ? (
                <div key={key}>
                  <h3>{CONVENTION_LABELS[key]}</h3>
                  <ul className="checklist">
                    {plan.conventions[key].map((rule, i) => (
                      <Check key={i} id={`conv-${key}-${i}`} checked={checked} toggle={toggle}>{rule}</Check>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <p className="muted">The repo doesn't document its conventions. Follow the style of recent merged PRs.</p>
        )}
      </Section>

      <Section n={4} title="Good first issues for you"
        aside={<span className="muted small" title="40% label/freshness/crowding signals computed from GitHub, 35% skill match and 25% difficulty fit judged by the model">How is this scored?</span>}>
        {plan.issues.length ? (
          <ul className="checklist issues">
            {plan.issues.map((iss) => (
              <Check key={iss.number} id={`issue-${iss.number}`} checked={checked} toggle={toggle}>
                <span className="issue-head">
                  <span className={`score score-${iss.score >= 75 ? "hi" : iss.score >= 55 ? "mid" : "lo"}`}>{iss.score}</span>
                  <a href={iss.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    #{iss.number} {iss.title}
                  </a>
                </span>
                <span className="badges">
                  <span className={`badge diff-${iss.difficulty}`}>{iss.difficulty}</span>
                  {iss.labels.slice(0, 3).map((l) => <span key={l} className="badge subtle">{l}</span>)}
                  <span className="muted small">updated {iss.updated_days_ago}d ago · {iss.comments} comments</span>
                </span>
                <span className="why">{iss.why}</span>
                <span className="approach"><strong>Approach:</strong> {iss.approach}</span>
                {iss.likely_files.length > 0 && (
                  <span className="files">{iss.likely_files.map((f) => <code key={f}>{f}</code>)}</span>
                )}
              </Check>
            ))}
          </ul>
        ) : (
          <p className="muted">No open, unassigned issues right now. Docs fixes and tests are usually welcome.</p>
        )}
      </Section>

      {(plan.first_timer_insights.length > 0 || plan.caveats.length > 0) && (
        <div className="grid2">
          {plan.first_timer_insights.length > 0 && (
            <section className="card note-card">
              <h3>🌱 What first PRs here looked like</h3>
              <ul>{plan.first_timer_insights.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}
          {plan.caveats.length > 0 && (
            <section className="card note-card">
              <h3>⚠️ Caveats</h3>
              <ul>{plan.caveats.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}
        </div>
      )}

      {metrics && (
        <p className="metrics muted small">
          {metrics.cached
            ? "Served from cache."
            : `${metrics.model} · ${metrics.steps} model turns · ${metrics.tool_calls} tool calls · ${(metrics.input_tokens + metrics.output_tokens).toLocaleString()} tokens · ~$${metrics.est_cost_usd.toFixed(3)} at paid rates · ${metrics.latency_s}s`}
        </p>
      )}
    </div>
  );
}
