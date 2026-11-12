import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { blobUrl } from "../lib/repo";
import type { RankedIssue } from "../types";
import { ArrowUpRight, Check, Close, File } from "./Icons";
import { Rich } from "./Rich";

interface Props {
  issue: RankedIssue | null;
  fullName: string;
  branch: string;
  level: string;
  picked: boolean;
  onTogglePick: () => void;
  onClose: () => void;
}

const FIT: Record<string, Record<string, number>> = {
  beginner: { easy: 1, medium: 0.5, hard: 0.1 },
  intermediate: { easy: 0.7, medium: 1, hard: 0.5 },
};

/** Side drawer with the suggested approach for one issue. */
export function IssueDrawer({ issue, fullName, branch, level, picked, onTogglePick, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!issue) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [issue, onClose]);

  const fit = issue ? FIT[level]?.[issue.difficulty] ?? 0.5 : 0;

  return (
    <AnimatePresence>
      {issue && (
        <>
          <motion.div className="drawer-scrim" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}>
            <div className="drawer-head">
              <span className="eyebrow">Issue #{issue.number} Â· score {issue.score}</span>
              <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Close size={18} /></button>
            </div>
            <h2 id="drawer-title" className="drawer-title">{issue.title}</h2>
            <div className="drawer-tags">
              <span className={`tag tag-${issue.difficulty === "easy" ? "ok" : issue.difficulty === "medium" ? "warn" : "err"}`}>{issue.difficulty}</span>
              {issue.labels.map((l) => <span key={l} className="tag">{l}</span>)}
            </div>

            <section className="drawer-sec">
              <h3>Why it fits you</h3>
              <p><Rich text={issue.why} /></p>
            </section>
            <section className="drawer-sec">
              <h3>Suggested approach</h3>
              <p><Rich text={issue.approach} /></p>
            </section>
            {issue.likely_files.length > 0 && (
              <section className="drawer-sec">
                <h3>Files likely involved</h3>
                <ul className="drawer-files">
                  {issue.likely_files.map((f) => (
                    <li key={f}>
                      <a href={blobUrl(fullName, branch, f)} target="_blank" rel="noreferrer"><File size={14} /> <code>{f}</code> <ArrowUpRight size={12} /></a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="drawer-sec">
              <h3>How the score breaks down</h3>
              <ul className="breakdown">
                <Bar label="GitHub signals" hint="label, freshness, crowding" value={issue.heuristic_score} weight={40} />
                <Bar label="Skill match" hint="judged by the model" value={issue.skill_match} weight={35} />
                <Bar label="Difficulty fit" hint={`${issue.difficulty} for a ${level}`} value={fit} weight={25} />
              </ul>
              <p className="drawer-meta">Updated {issue.updated_days_ago === 0 ? "today" : `${issue.updated_days_ago} days ago`} Â· {issue.comments} comment{issue.comments === 1 ? "" : "s"}</p>
            </section>

            <div className="drawer-actions">
              <a className="btn btn-accent" href={issue.url} target="_blank" rel="noreferrer">Open on GitHub <ArrowUpRight size={16} /></a>
              <button type="button" className={`btn btn-ghost ${picked ? "is-picked" : ""}`} onClick={onTogglePick} aria-pressed={picked}>
                {picked ? <><Check size={16} /> Picked</> : "Pick this issue"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Bar({ label, hint, value, weight }: { label: string; hint: string; value: number; weight: number }) {
  return (
    <li>
      <span className="bd-label">{label} <span className="bd-hint">{hint} Â· {weight}%</span></span>
      <span className="bd-track"><span style={{ width: `${Math.round(value * 100)}%` }} /></span>
      <span className="bd-val mono">{Math.round(value * 100)}</span>
    </li>
  );
}
