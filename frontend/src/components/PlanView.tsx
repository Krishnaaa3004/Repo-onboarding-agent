import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { blobUrl } from "../lib/repo";
import type { ConventionKey, OnboardingPlan, RankedIssue } from "../types";
import { ArrowRight, ArrowUpRight, Check, Copy, Folder } from "./Icons";
import { Rich } from "./Rich";

export const CONVENTION_LABELS: Record<ConventionKey, string> = {
  branch: "Branches",
  commit: "Commits",
  pull_request: "Pull requests",
  code_style: "Code style & checks",
};
export const CONVENTION_KEYS = Object.keys(CONVENTION_LABELS) as ConventionKey[];

export interface SectionDef {
  id: "overview" | "setup" | "rules" | "issues";
  title: string;
  items: string[];
  doneWhen: "all" | "any";
}

/** The checklist ids for each section; shared by the progress rail and the sections. */
export function sectionDefs(plan: OnboardingPlan): SectionDef[] {
  const dirs = plan.key_directories.map((d) => `dir-${d.path}`);
  return [
    { id: "overview", title: "Overview", items: dirs.length ? dirs : ["overview-read"], doneWhen: "all" },
    { id: "setup", title: "Setup", items: plan.setup_steps.map((_, i) => `setup-${i}`), doneWhen: "all" },
    { id: "rules", title: "House rules", items: CONVENTION_KEYS.flatMap((k) => plan.conventions[k].map((_, i) => `conv-${k}-${i}`)), doneWhen: "all" },
    { id: "issues", title: "First issues", items: plan.issues.map((i) => `issue-${i.number}`), doneWhen: "any" },
  ];
}

interface Props {
  plan: OnboardingPlan;
  checked: Set<string>;
  toggle: (id: string, value?: boolean) => void;
  onOpenIssue: (issue: RankedIssue) => void;
}

export function PlanView({ plan, checked, toggle, onOpenIssue }: Props) {
  const c = plan.classification;
  return (
    <div className="plan-main">
      <Overview plan={plan} checked={checked} toggle={toggle} />

      <Section id="setup" n={2} title="Set it up locally" kicker="Exact commands from the repo's docs and config files.">
        <ol className="steps">
          {plan.setup_steps.map((s, i) => {
            const id = `setup-${i}`;
            const on = checked.has(id);
            return (
              <li key={id} className={`step ${on ? "is-on" : ""}`}>
                <CheckBox id={id} on={on} toggle={toggle} label={`Mark step ${i + 1} done`} />
                <div className="step-body">
                  <div className="step-title">
                    <span className="step-n mono">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{s.title}</h3>
                    {s.inferred && (
                      <span className="tag tag-marker" title="Not written in the docs; inferred from config files">inferred</span>
                    )}
                  </div>
                  {s.command && <Command text={s.command} />}
                  {s.detail && <p className="step-detail"><Rich text={s.detail} /></p>}
                  {s.source && (
                    <a className="source-link" href={blobUrl(c.full_name, c.default_branch, s.source)} target="_blank" rel="noreferrer">
                      from {s.source} <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="rules" n={3} title="House rules" kicker="What reviewers here expect, pulled from the repo's own files.">
        {CONVENTION_KEYS.some((k) => plan.conventions[k].length) ? (
          <div className="rules">
            {CONVENTION_KEYS.filter((k) => plan.conventions[k].length).map((k) => (
              <div key={k} className="rule-group">
                <h3 className="rule-group-title">{CONVENTION_LABELS[k]}</h3>
                <ul className="rule-cards">
                  {plan.conventions[k].map((rule, i) => {
                    const id = `conv-${k}-${i}`;
                    const on = checked.has(id);
                    return (
                      <li key={id} className={`rule ${on ? "is-on" : ""}`}>
                        <CheckBox id={id} on={on} toggle={toggle} label="Mark rule understood" />
                        <p><Rich text={rule} /></p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {plan.conventions.sources.length > 0 && (
              <p className="rule-sources">
                <span className="eyebrow">Sources</span>
                {plan.conventions.sources.map((src) => (
                  <a key={src} href={blobUrl(c.full_name, c.default_branch, src)} target="_blank" rel="noreferrer" className="source-link">
                    {src} <ArrowUpRight size={12} />
                  </a>
                ))}
              </p>
            )}
          </div>
        ) : (
          <Empty>This repo doesn't write down its conventions. Copy the style of recently merged PRs and keep your first change small.</Empty>
        )}
      </Section>

      <Section id="issues" n={4} title="First issues for you"
        kicker="Open and unassigned. Ranked by GitHub signals (40%), skill match (35%) and difficulty fit (25%). Click one for an approach.">
        {plan.issues.length ? (
          <ol className="issues">
            {plan.issues.map((iss, rank) => {
              const id = `issue-${iss.number}`;
              const on = checked.has(id);
              return (
                <motion.li key={id} className={`issue ${on ? "is-on" : ""}`} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
                  <span className="issue-rank" aria-hidden="true">{rank + 1}</span>
                  <button type="button" className="issue-open" onClick={() => onOpenIssue(iss)}>
                    <span className="issue-num mono">#{iss.number}</span>
                    <span className="issue-title">{iss.title}</span>
                    <span className="issue-meta">
                      <span className={`tag tag-${iss.difficulty === "easy" ? "ok" : iss.difficulty === "medium" ? "warn" : "err"}`}>{iss.difficulty}</span>
                      <span>updated {iss.updated_days_ago === 0 ? "today" : `${iss.updated_days_ago}d ago`}</span>
                      <span>{iss.comments} comments</span>
                      <span className="skill" title="Skill match">
                        skill <span className="skill-track"><span style={{ width: `${Math.round(iss.skill_match * 100)}%` }} /></span>
                      </span>
                    </span>
                    <span className="issue-why"><Rich text={iss.why} /></span>
                    <span className="issue-cta">See approach <ArrowRight size={14} /></span>
                  </button>
                  <div className="issue-side">
                    <span className={`score ${iss.score >= 75 ? "hi" : iss.score >= 55 ? "mid" : ""}`} title="Final score out of 100">{iss.score}</span>
                    <button type="button" className={`pick ${on ? "is-on" : ""}`} onClick={() => toggle(id)} aria-pressed={on}>
                      {on ? <><Check size={14} /> picked</> : "pick"}
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        ) : (
          <Empty>No open, unassigned issues right now. Docs fixes and missing tests are usually welcome; check the repo's discussions too.</Empty>
        )}
      </Section>

      {(plan.first_timer_insights.length > 0 || plan.caveats.length > 0) && (
        <section className="field-notes" aria-label="Field notes">
          {plan.first_timer_insights.length > 0 && (
            <div>
              <p className="eyebrow">Field notes Â· what first PRs here looked like</p>
              <ul>{plan.first_timer_insights.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>
            </div>
          )}
          {plan.caveats.length > 0 && (
            <div>
              <p className="eyebrow">Caveats Â· what the agent wasn't sure about</p>
              <ul>{plan.caveats.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------------- overview with folder map ---------------- */

function Overview({ plan, checked, toggle }: { plan: OnboardingPlan; checked: Set<string>; toggle: Props["toggle"] }) {
  const c = plan.classification;
  const dirs = plan.key_directories;
  const [selected, setSelected] = useState(0);
  const current = dirs[selected];
  const langs = Object.entries(c.languages);

  return (
    <Section id="overview" n={1} title="Lay of the land" kicker="What this codebase is and where things live.">
      <p className="lede"><Rich text={plan.architecture_summary} /></p>

      {langs.length > 0 && (
        <div className="lang-bar" aria-label="Languages">
          <div className="lang-track">
            {langs.map(([l, pct], i) => (
              <span key={l} style={{ width: `${pct}%`, background: ["var(--cobalt)", "#7c92e0", "#b9c5f1", "var(--rule-strong)", "var(--paper-3)"][i] ?? "var(--paper-3)" }} title={`${l} ${pct}%`} />
            ))}
          </div>
          <div className="lang-legend mono">{langs.slice(0, 4).map(([l, pct]) => <span key={l}>{l} {pct}%</span>)}</div>
        </div>
      )}

      {dirs.length > 0 ? (
        <div className="folder-map">
          <div className="folder-tiles blueprint" role="tablist" aria-label="Key folders">
            {dirs.map((d, i) => {
              const id = `dir-${d.path}`;
              return (
                <button key={d.path} type="button" role="tab" aria-selected={i === selected}
                  className={`tile ${i === selected ? "is-sel" : ""} ${checked.has(id) ? "is-seen" : ""} ${i === 0 ? "tile-big" : ""}`}
                  onClick={() => { setSelected(i); toggle(id, true); }}>
                  <Folder size={16} />
                  <span className="mono">{d.path}/</span>
                  {checked.has(id) && <Check size={14} className="tile-check" />}
                </button>
              );
            })}
          </div>
          {current && (
            <motion.div key={current.path} className="tile-detail" role="tabpanel"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <p className="eyebrow">Folder {String(selected + 1).padStart(2, "0")} of {dirs.length}</p>
              <h3 className="mono">{current.path}/</h3>
              <p><Rich text={current.purpose} /></p>
              <a className="source-link" href={`https://github.com/${c.full_name}/tree/${c.default_branch}/${current.path}`} target="_blank" rel="noreferrer">
                Browse on GitHub <ArrowUpRight size={12} />
              </a>
              <p className="tile-hint">Click each folder to explore it; that ticks it off.</p>
            </motion.div>
          )}
        </div>
      ) : (
        <label className="read-check">
          <input type="checkbox" checked={checked.has("overview-read")} onChange={() => toggle("overview-read")} /> I've read the overview
        </label>
      )}
    </Section>
  );
}

/* ---------------- small parts ---------------- */

function Section({ id, n, title, kicker, children }: { id: string; n: number; title: string; kicker: string; children: ReactNode }) {
  return (
    <section id={id} className="plan-sec" aria-labelledby={`${id}-h`}>
      <header className="plan-sec-head">
        <span className="waypoint sm" aria-hidden="true">{String(n).padStart(2, "0")}</span>
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          <p className="kicker">{kicker}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function CheckBox({ id, on, toggle, label }: { id: string; on: boolean; toggle: Props["toggle"]; label: string }) {
  return (
    <label className="cb">
      <input type="checkbox" checked={on} onChange={() => toggle(id)} aria-label={label} />
      <span className="cb-box" aria-hidden="true"><Check size={13} /></span>
    </label>
  );
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="cmd">
      <code><span className="cmd-prompt" aria-hidden="true">$ </span>{text}</code>
      <button type="button" className="cmd-copy" aria-label={copied ? "Copied" : `Copy command: ${text}`}
        onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); })}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "copied" : "copy"}</span>
      </button>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
