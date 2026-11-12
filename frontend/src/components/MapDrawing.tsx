import { motion } from "framer-motion";
import type { Classification } from "../types";
import type { Milestone } from "../useOnboarding";

const POINTS = [
  { x: 60, y: 210, label: "Sizing up the repo" },
  { x: 250, y: 90, label: "Reading the docs" },
  { x: 470, y: 190, label: "Agent investigating" },
  { x: 680, y: 70, label: "Drawing the route" },
];
const PATH = "M60 210 C 120 210, 170 90, 250 90 S 400 190, 470 190 S 610 70, 680 70";

/** Loading state: the route is drawn waypoint by waypoint as the agent reaches each milestone. */
export function MapDrawing({ milestone, classification, status }: { milestone: Milestone; classification: Classification | null; status: string }) {
  const progress = [0.04, 0.3, 0.62, 0.9, 1][milestone];
  return (
    <div className="map-drawing">
      <svg viewBox="0 0 740 280" className="map-svg" role="img" aria-label={`Progress: ${POINTS[Math.min(milestone, 3)].label}`}>
        <path d={PATH} fill="none" stroke="var(--rule-strong)" strokeWidth="2" strokeDasharray="5 6" />
        <motion.path d={PATH} fill="none" stroke="var(--cobalt)" strokeWidth="3" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: progress }} transition={{ duration: 1.4, ease: "easeInOut" }} />
        {POINTS.map((p, i) => {
          const reached = milestone > i || (i === 0 && milestone >= 0);
          const current = Math.min(milestone, 3) === i;
          return (
            <g key={p.label}>
              {current && (
                <motion.circle cx={p.x} cy={p.y} r="14" fill="none" stroke="var(--cobalt)" strokeWidth="1.5"
                  initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut" }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
              )}
              <circle cx={p.x} cy={p.y} r="12" fill={reached ? "var(--cobalt)" : "var(--paper)"} stroke="var(--cobalt)" strokeWidth="2" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className={`map-num ${reached ? "on" : ""}`}>{i + 1}</text>
              <text x={p.x} y={p.y + (i % 2 ? -26 : 36)} textAnchor="middle" className={`map-label ${current ? "on" : ""}`}>{p.label}</text>
            </g>
          );
        })}
        <text x="16" y="268" className="map-meta">SURVEY IN PROGRESS</text>
        <text x="724" y="268" textAnchor="end" className="map-meta">1 : ONE REPO</text>
      </svg>

      <div className="map-caption">
        <p className="map-status" aria-live="polite">{status || "Starting the survey…"}</p>
        {classification ? (
          <p className="map-class">
            <strong>{classification.full_name}</strong>
            {classification.description && <> · {classification.description}</>}
            <span className="map-tags">
              <span className="tag">{classification.primary_language || "unknown language"}</span>
              <span className="tag">{classification.size} · {classification.file_count.toLocaleString()} files</span>
              <span className={`tag ${classification.activity === "active" ? "tag-ok" : classification.activity === "inactive" ? "tag-err" : "tag-warn"}`}>{classification.activity}</span>
            </span>
          </p>
        ) : (
          <p className="map-class muted">A fresh plan usually takes 30–90 seconds on the free model tier.</p>
        )}
      </div>
    </div>
  );
}
