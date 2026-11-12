import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AgentTrace } from "../components/ActivityFeed";
import { ArrowUpRight, Layers, Refresh, Switch } from "../components/Icons";
import { IssueDrawer } from "../components/IssueDrawer";
import { MapDrawing } from "../components/MapDrawing";
import { PlanView, sectionDefs, type SectionDef } from "../components/PlanView";
import { findExample } from "../lib/examples";
import { useMediaQuery, usePageTitle } from "../lib/hooks";
import { planPath } from "../lib/repo";
import type { ErrorCode, Level, RankedIssue } from "../types";
import { useChecklist } from "../useChecklist";
import { useOnboarding, type RunError } from "../useOnboarding";

export default function PlanPage() {
  const { owner = "", repo = "" } = useParams();
  const [params] = useSearchParams();
  const full = `${owner}/${repo}`;
  const example = findExample(full);
  const live = params.get("live") === "1";
  const level: Level = params.get("level") === "intermediate" ? "intermediate" : "beginner";
  const langParam = params.get("langs");
  const languages = useMemo(
    () => (langParam ?? (example ? "Python" : "")).split(",").map((s) => s.trim()).filter(Boolean),
    [langParam, example],
  );

  usePageTitle(full);
  const ob = useOnboarding();
  const wide = useMediaQuery("(min-width: 1180px)");
  const [traceOpen, setTraceOpen] = useState(true);
  const [openIssue, setOpenIssue] = useState<RankedIssue | null>(null);
  const { checked, toggle } = useChecklist(`roa:checklist:v2:${full.toLowerCase()}`);

  const run = useCallback(
    (refresh = false) => {
      if (example && !live && !refresh) ob.loadExample(example.run);
      else ob.start({ repo: full, languages, level }, refresh);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [full, languages.join(","), level, live],
  );

  // Deferred so React StrictMode's double-mount in dev doesn't fire two agent runs.
  useEffect(() => {
    const t = window.setTimeout(() => run(), 30);
    return () => window.clearTimeout(t);
  }, [run]);

  useEffect(() => setTraceOpen(wide), [wide]);

  const { plan, phase, error, trace, metrics, classification, milestone, source } = ob;
  const sections = plan ? sectionDefs(plan) : null;
  const latestStatus = [...trace].reverse().find((t) => t.kind === "status")?.label ?? "";
  const fallback = [...trace].reverse().find((t) => t.kind === "fallback");
  const liveHref = planPath(owner, repo, languages, level, true);

  return (
    <div className="plan-page">
      <header className="plan-head blueprint">
        <div className="wrap-wide plan-head-inner">
          <div>
            <p className="eyebrow crumbs">
              <Link to="/">Home</Link> <span aria-hidden="true">/</span> Plan <span aria-hidden="true">/</span> {owner}
            </p>
            <h1 className="plan-title">
              <a href={`https://github.com/${full}`} target="_blank" rel="noreferrer">{full}</a>
            </h1>
            <p className="plan-sub">
              {classification ? (
                <>
                  <span>{classification.primary_language || "—"}</span>
                  <span>{classification.size} · {classification.file_count.toLocaleString()} files</span>
                  <span className={`act-${classification.activity}`}>{classification.activity}</span>
                  <span>★ {classification.stars.toLocaleString()}</span>
                </>
              ) : phase === "running" ? <span>surveying…</span> : null}
              <span>for: {languages.length ? languages.join(", ") : "any language"} · {level}</span>
            </p>
          </div>
          <div className="plan-actions">
            {source === "example" && phase !== "running" && (
              <span className="tag tag-cobalt" title="Saved from an earlier run of the agent">saved plan</span>
            )}
            {!wide && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTraceOpen((v) => !v)} aria-expanded={traceOpen}>
                <Layers size={15} /> {traceOpen ? "Hide" : "Show"} agent trace
              </button>
            )}
            {source === "example" ? (
              <a className="btn btn-ghost btn-sm" href={liveHref}><Refresh size={15} /> Run live</a>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(true)} disabled={phase === "running"}>
                <Refresh size={15} /> Re-run
              </button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {fallback && phase === "running" && (
          <motion.div className="wrap-wide" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <p className="banner" role="status"><Switch size={16} /> Gemini was busy, so the agent switched models: {fallback.label}.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`wrap-wide plan-layout ${traceOpen && wide ? "with-trace" : ""}`}>
        <ProgressRail sections={sections} checked={checked} />

        <div className="plan-center">
          {plan ? (
            <PlanView plan={plan} checked={checked} toggle={toggle} onOpenIssue={setOpenIssue} />
          ) : error ? (
            <ErrorState error={error} fullName={full} onRetry={() => run(true)} />
          ) : (
            <MapDrawing milestone={milestone} classification={classification} status={latestStatus} />
          )}
        </div>

        {traceOpen && (
          <div className="plan-trace">
            <AgentTrace trace={trace} phase={phase} metrics={metrics} source={source}
              onClose={() => setTraceOpen(false)} liveHref={liveHref} />
          </div>
        )}
      </div>

      {plan && (
        <IssueDrawer issue={openIssue} fullName={full} branch={plan.classification.default_branch} level={level}
          picked={!!openIssue && checked.has(`issue-${openIssue.number}`)}
          onTogglePick={() => openIssue && toggle(`issue-${openIssue.number}`)}
          onClose={() => setOpenIssue(null)} />
      )}
    </div>
  );
}

/* ---------------- progress rail ---------------- */

function ProgressRail({ sections, checked }: { sections: SectionDef[] | null; checked: Set<string> }) {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    if (!sections) return;
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const placeholder: SectionDef[] = [
    { id: "overview", title: "Overview", items: [], doneWhen: "all" },
    { id: "setup", title: "Setup", items: [], doneWhen: "all" },
    { id: "rules", title: "House rules", items: [], doneWhen: "all" },
    { id: "issues", title: "First issues", items: [], doneWhen: "any" },
  ];
  const list = sections ?? placeholder;
  const totals = list.map((s) => ({ ...s, done: s.items.filter((i) => checked.has(i)).length }));
  const allItems = totals.reduce((n, s) => n + s.items.length, 0);
  const allDone = totals.reduce((n, s) => n + s.done, 0);

  return (
    <nav className="rail" aria-label="Plan sections">
      <p className="eyebrow rail-head">Your route</p>
      <ol className="rail-list">
        {totals.map((s, i) => {
          const complete = s.items.length > 0 && (s.doneWhen === "any" ? s.done > 0 : s.done === s.items.length);
          const partial = !complete && s.done > 0;
          return (
            <li key={s.id} className={`rail-item ${active === s.id && sections ? "is-active" : ""} ${complete ? "is-complete" : partial ? "is-partial" : ""}`}>
              <a href={`#${s.id}`} aria-current={active === s.id ? "step" : undefined} onClick={(e) => { if (!sections) e.preventDefault(); }}>
                <span className="rail-dot" aria-hidden="true">{complete ? "✓" : String(i + 1).padStart(2, "0")}</span>
                <span className="rail-text">
                  <span className="rail-title">{s.title}</span>
                  <span className="rail-count mono">
                    {sections ? (s.doneWhen === "any" ? (s.done ? `${s.done} picked` : "pick one") : `${s.done}/${s.items.length}`) : "…"}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {sections && allItems > 0 && (
        <div className="rail-progress">
          <div className="rail-bar"><motion.span animate={{ width: `${(100 * allDone) / allItems}%` }} transition={{ duration: 0.4 }} /></div>
          <p className="mono">{allDone} of {allItems} ticked · saved in this browser</p>
        </div>
      )}
    </nav>
  );
}

/* ---------------- error state ---------------- */

const ERRORS: Record<ErrorCode, { title: string; body: string }> = {
  llm_busy: { title: "Gemini is busy right now.", body: "The model and its backups are all overloaded at the moment. This usually clears in a minute or two." },
  llm_quota: { title: "Today's free model quota is used up.", body: "This demo runs on Gemini's free tier, which allows a small number of requests per day. Saved plans still work." },
  llm_error: { title: "The model returned an error.", body: "Something went wrong on the model side. Trying again usually works." },
  repo_not_found: { title: "We couldn't find that repo.", body: "Check the owner and name. Private repos aren't supported; the agent can only read public ones." },
  github_rate_limit: { title: "GitHub's rate limit was hit.", body: "Too many GitHub API calls in a short time. Wait a few minutes and try again." },
  github_error: { title: "GitHub returned an error.", body: "The repo couldn't be read just now. Try again in a moment." },
  rate_limited: { title: "That's a lot of new repos for one hour.", body: "To protect the free quota, each visitor can map a few new repos per hour. Repos mapped before still open instantly." },
  bad_url: { title: "That doesn't look like a GitHub repo.", body: "Use the form owner/repo, for example pallets/flask." },
  network: { title: "Couldn't reach the server.", body: "The free backend sleeps when idle and takes about 30 seconds to wake up. Try again shortly." },
  unknown: { title: "Something went wrong.", body: "An unexpected error stopped the agent." },
};

function ErrorState({ error, fullName, onRetry }: { error: RunError; fullName: string; onRetry: () => void }) {
  const e = ERRORS[error.code] ?? ERRORS.unknown;
  return (
    <div className="error-state ticks" role="alert">
      <p className="eyebrow">Off the map · {error.code.replace(/_/g, " ")}</p>
      <h2>{e.title}</h2>
      <p>{e.body}</p>
      <details className="error-detail">
        <summary>Technical detail</summary>
        <code>{error.message}</code>
      </details>
      <div className="error-actions">
        {error.code !== "repo_not_found" && error.code !== "bad_url" && (
          <button type="button" className="btn" onClick={onRetry}><Refresh size={15} /> Try again</button>
        )}
        <Link className="btn btn-ghost" to="/plan/pallets/flask">Open a saved example</Link>
        {error.code === "repo_not_found" && (
          <a className="link-arrow" href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer">
            Check it on GitHub <ArrowUpRight size={12} style={{ display: "inline" }} />
          </a>
        )}
      </div>
    </div>
  );
}
