import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, Classification, ErrorCode, ExampleRun, Level, Metrics, OnboardingPlan } from "./types";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8000";

export interface TraceItem {
  id: number;
  t: number; // seconds since the run started
  kind: "status" | "tool" | "note" | "fallback";
  tool?: string;
  label: string; // what the agent is doing
  summary?: string; // result, once the tool returns
  step?: number;
  done: boolean;
}

export interface RunRequest {
  repo: string;
  languages: string[];
  level: Level;
}

export type Phase = "idle" | "running" | "done" | "error";
/** Milestones used to draw the loading map: classify -> docs -> issues -> plan. */
export type Milestone = 0 | 1 | 2 | 3 | 4;

export interface RunError {
  code: ErrorCode;
  message: string;
}

/**
 * Runs the agent over Server-Sent Events, or replays a saved example.
 * Uses fetch + a stream reader rather than EventSource so 400/429 JSON error bodies can be read.
 */
export function useOnboarding() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [trace, setTrace] = useState<TraceItem[]>([]);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<RunError | null>(null);
  const [milestone, setMilestone] = useState<Milestone>(0);
  const [source, setSource] = useState<"live" | "example">("live");

  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const nextId = useRef(0);
  const startedAt = useRef(0);

  const stopAll = () => {
    abortRef.current?.abort();
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  useEffect(() => stopAll, []);

  const reset = (src: "live" | "example") => {
    stopAll();
    setTrace([]);
    setClassification(null);
    setPlan(null);
    setMetrics(null);
    setError(null);
    setMilestone(0);
    setSource(src);
    startedAt.current = performance.now();
  };

  const handle = useCallback((ev: AgentEvent, t?: number) => {
    const id = nextId.current++;
    const at = t ?? (performance.now() - startedAt.current) / 1000;
    switch (ev.type) {
      case "status":
        setTrace((a) => [...a.map((x) => (x.kind === "status" ? { ...x, done: true } : x)),
          { id, t: at, kind: ev.kind === "fallback" ? "fallback" : "status", label: ev.message, done: ev.kind === "fallback" }]);
        if (/reading docs/i.test(ev.message)) setMilestone((m) => (m < 2 ? 2 : m));
        if (/thinking|writing the plan/i.test(ev.message)) setMilestone((m) => (m < 3 ? 3 : m));
        break;
      case "tool_call":
        setTrace((a) => [...a, { id, t: at, kind: "tool", tool: ev.name, label: describeCall(ev.name, ev.args), step: ev.step, done: false }]);
        break;
      case "tool_result":
        setTrace((a) => {
          const idx = a.findIndex((x) => x.kind === "tool" && x.tool === ev.name && !x.done);
          if (idx === -1) return a;
          const copy = [...a];
          copy[idx] = { ...copy[idx], summary: ev.summary, done: true };
          return copy;
        });
        break;
      case "note":
        setTrace((a) => [...a, { id, t: at, kind: "note", label: ev.text, done: true }]);
        break;
      case "classification":
        setClassification(ev.data);
        setMilestone((m) => (m < 1 ? 1 : m));
        break;
      case "plan":
        setPlan(ev.plan);
        setClassification(ev.plan.classification);
        setMilestone(4);
        break;
      case "metrics":
        setMetrics(ev.data);
        break;
      case "error":
        setError({ code: ev.code ?? guessCode(ev.message), message: ev.message });
        setPhase("error");
        break;
      case "done":
        setTrace((a) => a.map((x) => ({ ...x, done: true })));
        setPhase("done");
        break;
    }
  }, []);

  const start = useCallback(async (req: RunRequest, refresh = false) => {
    reset("live");
    setPhase("running");
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ repo: req.repo, languages: req.languages.join(","), level: req.level });
    if (refresh) params.set("refresh", "true");

    try {
      const resp = await fetch(`${API_URL}/api/onboard?${params}`, { signal: controller.signal });
      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({}));
        const code: ErrorCode = body.code ?? (resp.status === 429 ? "rate_limited" : resp.status === 400 ? "bad_url" : "unknown");
        setError({ code, message: body.error ?? `Server returned ${resp.status}` });
        setPhase("error");
        return;
      }
      const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) handle(JSON.parse(line.slice(6)) as AgentEvent);
          }
        }
      }
      setPhase((p) => (p === "running" ? "done" : p));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError({ code: "network", message: (e as Error).message });
      setPhase("error");
    }
  }, [handle]);

  /** Show a saved plan instantly; replay its recorded trace (if any) at 3x speed alongside. */
  const loadExample = useCallback((run: ExampleRun) => {
    reset("example");
    handle({ type: "plan", plan: run.plan });
    handle({ type: "metrics", data: { ...run.metrics, cached: true } });
    if (!run.trace.length) {
      setPhase("done");
      return;
    }
    setPhase("running");
    const last = run.trace[run.trace.length - 1].t ?? 0;
    run.trace.forEach((ev, i) => {
      const at = Math.min((ev.t ?? i) / 3, 1 + i * 0.4) * 1000;
      timersRef.current.push(window.setTimeout(() => handle(ev, ev.t), at));
    });
    timersRef.current.push(window.setTimeout(() => {
      setTrace((a) => a.map((x) => ({ ...x, done: true })));
      setPhase("done");
    }, Math.min(last / 3, 1 + run.trace.length * 0.4) * 1000 + 300));
  }, [handle]);

  return { phase, trace, classification, plan, metrics, error, milestone, source, start, loadExample };
}

function guessCode(message: string): ErrorCode {
  if (/503|overload|high demand|unavailable/i.test(message)) return "llm_busy";
  if (/429|quota|exhausted/i.test(message)) return "llm_quota";
  if (/not found/i.test(message)) return "repo_not_found";
  return "unknown";
}

export function describeCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "fetch_repo_file":
      return `Read ${args.path}`;
    case "list_repo_tree":
      return `List ${args.path ? `${args.path}/` : "the repo root"}`;
    case "list_issues":
      return "Scan open, unassigned issues";
    case "search_code":
      return `Search code for “${args.query}”`;
    case "get_merged_prs_by_first_timers":
      return "Study merged PRs from first-timers";
    default:
      return name;
  }
}
