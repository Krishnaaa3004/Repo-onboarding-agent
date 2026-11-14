/* Building blocks. All colours and fonts are the site's CSS variables (frontend/src/styles/tokens.css). */
import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  paper: "var(--paper)", paper2: "var(--paper-2)", paper3: "var(--paper-3)", rule: "var(--rule)",
  ruleStrong: "var(--rule-strong)", ink: "var(--ink)", ink2: "var(--ink-2)", ink3: "var(--ink-3)",
  cobalt: "var(--cobalt)", cobaltDeep: "var(--cobalt-deep)", cobaltTint: "var(--cobalt-tint)",
  marker: "var(--marker)", ok: "var(--ok)", okTint: "var(--ok-tint)",
};
export const F = { display: "var(--f-display)", body: "var(--f-body)", mono: "var(--f-mono)" };

/** Spring progress (0..1) that starts at `delay` frames. */
export function useSpring(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120, mass: 0.8, ...config } });
}

/** The site's blueprint grid on warm paper. */
export function Paper({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0, background: C.paper, overflow: "hidden",
      backgroundImage:
        "linear-gradient(rgba(36,67,196,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(36,67,196,0.11) 1px, transparent 1px)," +
        "linear-gradient(rgba(36,67,196,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(36,67,196,0.06) 1px, transparent 1px)",
      backgroundSize: "240px 240px, 240px 240px, 48px 48px, 48px 48px",
    }}>
      {children}
    </div>
  );
}

/** Highlighter swipe behind a word, drawn left to right. */
export function Mark({ children, delay }: { children: ReactNode; delay: number }) {
  const p = useSpring(delay, { damping: 20, stiffness: 90 });
  return (
    <span style={{ position: "relative", whiteSpace: "nowrap" }}>
      <span style={{
        position: "absolute", left: "-0.06em", right: "-0.06em", bottom: "0.06em", height: "0.42em",
        background: C.marker, transformOrigin: "left center", transform: `scaleX(${p})`, zIndex: 0,
      }} />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

/** Small black pill with a coloured dot, springs in. */
export function Tag({ children, delay, dot = C.cobalt, style }: { children: ReactNode; delay: number; dot?: string; style?: CSSProperties }) {
  const p = useSpring(delay, { damping: 11, stiffness: 160 });
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 24px", borderRadius: 999,
      background: C.ink, color: C.paper, font: `500 28px ${F.mono}`, letterSpacing: "0.01em",
      transform: `scale(${0.4 + 0.6 * p}) translateY(${(1 - p) * 30}px)`, opacity: Math.min(1, p * 1.6),
      ...style,
    }}>
      <span style={{ width: 12, height: 12, borderRadius: 99, background: dot }} />
      {children}
    </div>
  );
}

/** Card with the brutalist hard offset shadow. */
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: "#fffdf9", border: `2px solid ${C.ink}`, borderRadius: 14, boxShadow: `10px 10px 0 ${C.ink}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Text that types itself out between `start` and `start + duration` frames. */
export function Type({ text, start, duration, cursor = true }: { text: string; start: number; duration: number; cursor?: boolean }) {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [start, start + duration], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const typing = frame >= start && n < text.length;
  return (
    <span>
      {text.slice(0, n)}
      {cursor && (typing || (frame >= start && Math.floor(frame / 8) % 2 === 0 && frame < start + duration + 30)) && (
        <span style={{ display: "inline-block", width: "0.55em", height: "1em", background: C.cobalt, verticalAlign: "-0.12em", marginLeft: 2 }} />
      )}
    </span>
  );
}

/** Checkbox that ticks with a spring at `at`. */
export function Tick({ at, size = 34 }: { at: number; size?: number }) {
  const p = useSpring(at, { damping: 12, stiffness: 200 });
  const on = p > 0.02;
  return (
    <span style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0, display: "inline-grid", placeItems: "center",
      border: `2.5px solid ${on ? C.ok : C.ruleStrong}`, background: on ? C.ok : "#fffdf9",
      transform: `scale(${on ? 0.85 + 0.15 * p : 1})`,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" style={{ opacity: p }}>
        <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={24} strokeDashoffset={24 * (1 - p)} />
      </svg>
    </span>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ font: `500 24px ${F.mono}`, letterSpacing: "0.14em", textTransform: "uppercase", color: C.ink3, ...style }}>{children}</div>;
}

export function Compass({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={1.6} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <path d="M14.8 9.2 10.6 10.6 9.2 14.8l4.2-1.4z" fill={C.cobalt} stroke="none" />
    </svg>
  );
}
