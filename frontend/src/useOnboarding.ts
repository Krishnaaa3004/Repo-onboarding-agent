import { useCallback, useRef, useState } from "react";
import type { AgentEvent, Classification, Level, Metrics, OnboardingPlan } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8000";

export interface ActivityItem {
  id: number;
  kind: "status" | "tool" | "note";
  text: string;
  tool?: string;
  done: boolean;
}

export interface RunRequest {
  repo: string;
  languages: string[];
  level: Level;
}

type Phase = "idle" | "running" | "done" | "error";

/**
 * Streams the agent's Server-Sent Events. Uses fetch + a stream reader rather than EventSource
 * so we can read the JSON error body on 400/429 responses.
 */
export function useOnboarding() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  const handle = useCallback((ev: AgentEvent) => {
    const id = nextId.current++;
    switch (ev.type) {
      case "status":
        setActivity((a) => [...a.map((x) => (x.kind === "status" ? { ...x, done: true } : x)),
          { id, kind: "status", text: ev.message, done: false }]);
        break;
      case "tool_call":
        setActivity((a) => [...a, { id, kind: "tool", tool: ev.name, text: describeCall(ev.name, ev.args), done: false }]);
        break;
      case "tool_result":
        setActivity((a) => {
          // mark the oldest pending call of this tool as finished, showing its result summary
          const idx = a.findIndex((x) => x.kind === "tool" && x.tool === ev.name && !x.done);
          if (idx === -1) return a;
          const copy = [...a];
          copy[idx] = { ...copy[idx], text: ev.summary, done: true };
          return copy;
        });
        break;
      case "note":
        setActivity((a) => [...a, { id, kind: "note", text: ev.text, done: true }]);
        break;
      case "classification":
        setClassification(ev.data);
        break;
      case "plan":
        setPlan(ev.plan);
        break;
      case "metrics":
        setMetrics(ev.data);
        break;
      case "error":
        setError(ev.message);
        setPhase("error");
        break;
      case "done":
        setActivity((a) => a.map((x) => ({ ...x, done: true })));
        setPhase("done");
        break;
    }
  }, []);

  const start = useCallback(async (req: RunRequest, refresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("running");
    setActivity([]);
    setClassification(null);
    setPlan(null);
    setMetrics(null);
    setError(null);

    const params = new URLSearchParams({ repo: req.repo, languages: req.languages.join(","), level: req.level });
    if (refresh) params.set("refresh", "true");

    try {
      const resp = await fetch(`${API_URL}/api/onboard?${params}`, { signal: controller.signal });
      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${resp.status}`);
      }
      const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        // SSE messages are separated by a blank line; lines starting with ':' are keepalive comments
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
      const msg = (e as Error).message;
      setError(msg === "Failed to fetch" ? "Could not reach the server. The free backend may be waking up; try again in ~30s." : msg);
      setPhase("error");
    }
  }, [handle]);

  return { phase, activity, classification, plan, metrics, error, start };
}

function describeCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "fetch_repo_file":
      return `Reading ${args.path}`;
    case "list_repo_tree":
      return `Listing ${args.path || "/"}`;
    case "list_issues":
      return "Finding open, unassigned issues";
    case "search_code":
      return `Searching code for "${args.query}"`;
    case "get_merged_prs_by_first_timers":
      return "Looking at merged PRs from first-time contributors";
    default:
      return name;
  }
}
