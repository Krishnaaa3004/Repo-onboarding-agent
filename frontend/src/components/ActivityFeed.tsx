import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Metrics } from "../types";
import type { Phase, TraceItem } from "../useOnboarding";
import { Close, Flag, Spark, Switch, TOOL_ICON } from "./Icons";

interface Props {
  trace: TraceItem[];
  phase: Phase;
  metrics: Metrics | null;
  source: "live" | "example";
  onClose?: () => void;
  liveHref?: string;
}

/** The live agent trace: every status change and tool call, as a timeline. */
export function AgentTrace({ trace, phase, metrics, source, onClose, liveHref }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const running = phase === "running";

  useEffect(() => {
    const el = listRef.current;
    if (el && running) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [trace.length, running]);

  const tools = trace.filter((t) => t.kind === "tool").length;

  return (
    <aside className="trace" aria-label="Agent trace">
      <header className="trace-head">
        <div>
          <p className="eyebrow">Agent trace</p>
          <p className="trace-status">
            {running ? <><span className="live-dot" aria-hidden="true" /> working</> : phase === "error" ? "stopped" : source === "example" && !trace.length ? "saved run" : "finished"}
            <span className="trace-count">· {tools} tool call{tools === 1 ? "" : "s"}</span>
          </p>
        </div>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Hide agent trace"><Close size={16} /></button>
        )}
      </header>

      {trace.length === 0 && source === "example" ? (
        <div className="trace-empty">
          <p>This plan was saved from an earlier run, so it opens instantly. Re-run it to watch the agent work in real time.</p>
          {liveHref && <a className="btn btn-ghost btn-sm" href={liveHref}>Run it live</a>}
        </div>
      ) : (
        <ol className="trace-list" ref={listRef} aria-live="polite">
          <AnimatePresence initial={false}>
            {trace.map((item, i) => {
              const prev = trace[i - 1];
              const newTurn = item.step !== undefined && item.step !== prev?.step;
              const Icon = item.kind === "tool" ? TOOL_ICON[item.tool ?? ""] ?? Spark : item.kind === "fallback" ? Switch : item.kind === "note" ? Spark : Flag;
              return (
                <motion.li key={item.id}
                  className={`trace-item k-${item.kind} ${item.done ? "is-done" : "is-pending"}`}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  {newTurn && <span className="trace-turn">{item.step === 0 ? "prefetch · in code" : `model turn ${item.step}`}</span>}
                  <span className="trace-node" aria-hidden="true">
                    {item.done || item.kind !== "tool" ? <Icon size={14} /> : <span className="pulse" />}
                  </span>
                  <span className="trace-body">
                    <span className="trace-label">
                      {item.label}
                      {item.tool && <code className="trace-tool">{item.tool}</code>}
                    </span>
                    {item.summary && <span className="trace-summary">{item.summary}</span>}
                  </span>
                  <span className="trace-t mono">+{item.t.toFixed(1)}s</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}

      {metrics && (
        <dl className="trace-metrics">
          <div><dt>model</dt><dd>{metrics.model.replace(/^gemini-/, "")}</dd></div>
          <div><dt>turns</dt><dd>{metrics.steps}</dd></div>
          <div><dt>tools</dt><dd>{metrics.tool_calls}</dd></div>
          <div><dt>tokens</dt><dd>{((metrics.input_tokens + metrics.output_tokens) / 1000).toFixed(1)}k</dd></div>
          <div><dt>time</dt><dd>{metrics.latency_s.toFixed(0)}s</dd></div>
          <div><dt>est. cost</dt><dd>${metrics.est_cost_usd.toFixed(3)}</dd></div>
        </dl>
      )}
    </aside>
  );
}
