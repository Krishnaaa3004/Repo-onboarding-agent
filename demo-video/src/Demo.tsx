import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { EVAL, FILE_COUNT, GITHUB, ISSUE, LIVE_URL, MESSY_TREE, metrics, plan, REPO, RULES, SETUP, TRACE } from "./data";
import { C, Card, Compass, Eyebrow, F, Mark, Paper, Tag, Tick, Type, useSpring } from "./ui";

const S1 = 90, S2 = 90, S3 = 120, S4 = 150, S5 = 90; // 18 s at 30 fps
export const TOTAL_FRAMES = S1 + S2 + S3 + S4 + S5;

/** Every scene eases out over its last frames so cuts feel continuous (no dead frames). */
function Shell({ dur, children }: { dur: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const out = interpolate(f, [dur - 9, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // slow continuous camera push-in: keeps every frame moving, so there are no dead frames between beats
  const drift = interpolate(f, [0, dur], [1, 1.025]);
  return <AbsoluteFill style={{ opacity: out, transform: `scale(${(0.985 + 0.015 * out) * drift})` }}>{children}</AbsoluteFill>;
}

export function Demo() {
  let at = 0;
  const seq = (dur: number, node: ReactNode) => {
    const from = at;
    at += dur;
    return <Sequence from={from} durationInFrames={dur}><Shell dur={dur}>{node}</Shell></Sequence>;
  };
  return (
    <Paper>
      {seq(S1, <Hook />)}
      {seq(S2, <Input />)}
      {seq(S3, <AgentScene />)}
      {seq(S4, <PlanScene />)}
      {seq(S5, <Outro />)}
    </Paper>
  );
}

/* ---------------- 1. Hook ---------------- */

function Hook() {
  const f = useCurrentFrame();
  const title = useSpring(0, { damping: 18 });
  const tree = useSpring(8, { damping: 14 });
  return (
    <AbsoluteFill style={{ padding: "150px 140px", flexDirection: "row", alignItems: "center", gap: 90 }}>
      <div style={{ flex: 1.15, transform: `translateY(${(1 - title) * 50}px)`, opacity: title }}>
        <Eyebrow style={{ marginBottom: 30 }}>Field guide · for first-time contributors</Eyebrow>
        <div style={{ font: `400 112px/1.0 ${F.display}`, letterSpacing: "-0.035em", color: C.ink }}>
          Found a repo you want to <Mark delay={16}>contribute</Mark> to?
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 56, flexWrap: "wrap" }}>
          <Tag delay={30}>{FILE_COUNT} files</Tag>
          <Tag delay={42} dot={C.marker}>no idea where to start</Tag>
        </div>
      </div>
      <div style={{ flex: 0.85, perspective: 1400 }}>
        <Card style={{
          padding: "34px 40px", transform: `rotateY(${-14 + 6 * tree}deg) rotateX(6deg) translateZ(${(1 - tree) * -300}px)`,
          opacity: tree, transformOrigin: "center",
        }}>
          <div style={{ font: `500 26px ${F.mono}`, color: C.ink3, marginBottom: 18 }}>{REPO}/</div>
          {MESSY_TREE.map((name, i) => {
            const jiggle = Math.sin((f + i * 11) / 4.5) * (i % 2 ? 2.2 : -2.6);
            const x = Math.sin((f + i * 7) / 6) * 7;
            return (
              <div key={name} style={{
                font: `500 31px/1.6 ${F.mono}`, color: name.endsWith("/") ? C.ink : C.ink2,
                transform: `translateX(${x + (i % 3) * 18}px) rotate(${jiggle}deg)`,
              }}>
                {name.endsWith("/") ? "▸ " : "· "}{name}
              </div>
            );
          })}
        </Card>
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- 2. Input ---------------- */

function Input() {
  const f = useCurrentFrame();
  const enter = useSpring(0, { damping: 16 });
  const press = useSpring(64, { damping: 8, stiffness: 260 });
  const btnScale = f < 64 ? 1 : 1 - 0.12 * Math.sin(Math.min(press, 1) * Math.PI) + 0.04 * Math.max(0, press - 1);
  const chip = useSpring(46, { damping: 10, stiffness: 180 });
  const level = useSpring(54, { damping: 10, stiffness: 180 });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div style={{ width: 1280, transform: `rotateX(${(1 - enter) * 18}deg) translateY(${(1 - enter) * 80}px)`, opacity: enter }}>
        <Eyebrow style={{ marginBottom: 26 }}>Paste a repo · pick what you know</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 20, borderBottom: `4px solid ${C.ink}`, paddingBottom: 22 }}>
          <span style={{ font: `500 46px ${F.mono}`, color: C.ink3 }}>github.com/</span>
          <span style={{ flex: 1, font: `500 58px ${F.mono}`, color: C.ink }}>
            <Type text={REPO} start={8} duration={30} />
          </span>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 16, padding: "26px 44px", borderRadius: 999,
            background: f >= 64 ? C.cobaltDeep : C.cobalt, color: "#fff", font: `600 36px ${F.body}`,
            transform: `scale(${btnScale})`, boxShadow: f >= 64 && f < 72 ? `0 0 0 14px ${C.cobaltTint}` : "none",
          }}>
            Map it <span style={{ fontSize: 40 }}>→</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 90, marginTop: 52, alignItems: "flex-start" }}>
          <div>
            <div style={{ font: `600 30px ${F.body}`, color: C.ink, marginBottom: 18 }}>
              <span style={{ display: "inline-block", width: 24, height: 3, background: C.cobalt, verticalAlign: "middle", marginRight: 14 }} />
              Languages you know
            </div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 26px", borderRadius: 999,
              background: C.ink, color: C.paper, font: `500 30px ${F.body}`, transform: `scale(${chip})`,
            }}>Python <span style={{ opacity: 0.7 }}>×</span></span>
          </div>
          <div>
            <div style={{ font: `600 30px ${F.body}`, color: C.ink, marginBottom: 18 }}>
              <span style={{ display: "inline-block", width: 24, height: 3, background: C.cobalt, verticalAlign: "middle", marginRight: 14 }} />
              Your experience
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 14, font: `500 32px ${F.body}`, color: C.ink, transform: `scale(${level})`, transformOrigin: "left" }}>
              <span style={{ width: 30, height: 30, borderRadius: 99, border: `3px solid ${C.cobalt}`, display: "inline-grid", placeItems: "center" }}>
                <span style={{ width: 14, height: 14, borderRadius: 99, background: C.cobalt }} />
              </span>
              Beginner
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- 3. Agent at work ---------------- */

const NODE_X = 1020, NODE_W = 720, AGENT = { x: 180, y: 560, w: 420, h: 150 };
const nodeY = (i: number) => 300 + i * 175;

function AgentScene() {
  const f = useCurrentFrame();
  const head = useSpring(0, { damping: 18 });
  const agent = useSpring(4, { damping: 12 });
  const starts = [14, 36, 58, 80];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 140, top: 96, opacity: head, transform: `translateY(${(1 - head) * 30}px)` }}>
        <div style={{ font: `400 78px/1.05 ${F.display}`, letterSpacing: "-0.03em", color: C.ink }}>
          The agent <Mark delay={10}>reads what matters</Mark>
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {TRACE.map((_, i) => {
          const x1 = AGENT.x + AGENT.w, y1 = AGENT.y + AGENT.h / 2, x2 = NODE_X, y2 = nodeY(i) + 56;
          const d = `M${x1} ${y1} C ${x1 + 220} ${y1}, ${x2 - 220} ${y2}, ${x2} ${y2}`;
          const p = interpolate(f, [starts[i], starts[i] + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--rule-strong)" strokeWidth={3} strokeDasharray="8 10" />
              <path d={d} fill="none" stroke="var(--cobalt)" strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
            </g>
          );
        })}
      </svg>

      <div style={{
        position: "absolute", left: AGENT.x, top: AGENT.y, width: AGENT.w, height: AGENT.h,
        transform: `scale(${0.6 + 0.4 * agent})`, opacity: agent,
      }}>
        <Card style={{ height: "100%", background: C.ink, display: "flex", alignItems: "center", gap: 22, padding: "0 34px" }}>
          <span style={{ width: 22, height: 22, borderRadius: 99, background: C.marker, boxShadow: `0 0 0 ${6 + 4 * Math.sin(f / 4)}px rgba(243,217,133,0.25)` }} />
          <div>
            <div style={{ font: `600 40px ${F.body}`, color: C.paper }}>Gemini agent</div>
            <div style={{ font: `500 22px ${F.mono}`, color: "var(--rule-strong)", marginTop: 6 }}>function calling loop</div>
          </div>
        </Card>
      </div>

      {TRACE.map((t, i) => {
        const lit = useSpring(starts[i] + 14, { damping: 12, stiffness: 170 });
        const on = f >= starts[i] + 14;
        return (
          <div key={t.tool} style={{
            position: "absolute", left: NODE_X, top: nodeY(i), width: NODE_W,
            transform: `translateX(${(1 - Math.min(1, lit + 0.3)) * 40}px) scale(${on ? 1 + 0.03 * Math.sin(Math.min(lit, 1) * Math.PI) : 1})`,
            opacity: f >= starts[i] ? 1 : 0.35,
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 26px", borderRadius: 12,
              border: `2.5px solid ${on ? C.cobalt : C.ruleStrong}`, background: on ? C.cobaltTint : "#fffdf9",
              font: `600 32px ${F.mono}`, color: on ? C.cobaltDeep : C.ink3,
              boxShadow: on ? `6px 6px 0 ${C.ink}` : "none",
            }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: on ? C.cobalt : C.ruleStrong }} />
              {t.tool}
            </div>
            <div style={{ font: `500 27px ${F.mono}`, color: C.ink2, marginTop: 12, marginLeft: 6, height: 34 }}>
              {on && <><span style={{ color: C.cobalt }}>↳ </span><Type text={t.result} start={starts[i] + 16} duration={14} cursor={false} /></>}
            </div>
          </div>
        );
      })}

      <div style={{ position: "absolute", left: 180, top: 790, display: "flex", gap: 18, flexWrap: "wrap", width: 640 }}>
        <Tag delay={30}>README</Tag>
        <Tag delay={46}>CONTRIBUTING</Tag>
        <Tag delay={96} dot={C.marker}>{metrics.tool_calls} tool calls</Tag>
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- 4. The plan assembles ---------------- */

function PanelIn({ i, children, style }: { i: number; children: ReactNode; style?: CSSProperties }) {
  const p = useSpring(i * 7, { damping: 15, stiffness: 110 });
  return (
    <div style={{
      transform: `translateZ(${(1 - p) * -700}px) rotateY(${(1 - p) * (i % 2 ? 28 : -28)}deg) rotateX(${(1 - p) * 14}deg)`,
      opacity: Math.min(1, p * 1.4), transformStyle: "preserve-3d", ...style,
    }}>
      {children}
    </div>
  );
}

function PanelHead({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
      <span style={{ width: 46, height: 46, borderRadius: 99, border: `3px solid ${C.cobalt}`, display: "grid", placeItems: "center", font: `700 18px ${F.mono}`, color: C.cobalt }}>{n}</span>
      <span style={{ font: `500 36px ${F.display}`, letterSpacing: "-0.02em", color: C.ink }}>{title}</span>
    </div>
  );
}

function PlanScene() {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, 150], [0.93, 1.0], { extrapolateRight: "clamp" });
  const ticks = [86, 96, 106, 116];
  const done = ticks.filter((t) => f >= t).length;
  const expand = useSpring(96, { damping: 16, stiffness: 120 });
  const ruleHi = useSpring(70, { damping: 18 });
  const bar = useSpring(86, { damping: 26, stiffness: 60 });
  const cmdStarts = [22, 38, 52, 64];
  return (
    <AbsoluteFill style={{ padding: "64px 110px", perspective: 1800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 30 }}>
        <div style={{ font: `500 54px ${F.mono}`, letterSpacing: "-0.04em", color: C.ink }}>{REPO}</div>
        <Eyebrow>Python · medium · {FILE_COUNT} files · active</Eyebrow>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gridTemplateRows: "auto auto", gap: 34,
        transform: `scale(${push})`, transformOrigin: "50% 40%", transformStyle: "preserve-3d",
      }}>
        <PanelIn i={0}>
          <Card style={{ padding: "26px 32px", height: 330 }}>
            <PanelHead n="01" title="Lay of the land" />
            <div style={{ font: `400 25px/1.45 ${F.display}`, color: C.ink }}>
              {plan.architecture_summary.split(". ").slice(0, 2).join(". ")}.
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              {plan.key_directories.slice(0, 4).map((d) => (
                <span key={d.path} style={{ font: `500 20px ${F.mono}`, padding: "8px 14px", borderRadius: 8, background: C.cobaltTint, color: C.cobaltDeep }}>{d.path}/</span>
              ))}
            </div>
          </Card>
        </PanelIn>

        <PanelIn i={1}>
          <Card style={{ padding: "26px 32px", height: 330 }}>
            <PanelHead n="02" title="Set it up locally" />
            {SETUP.map((s, k) => (
              <div key={s.command} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 12 }}>
                <Tick at={ticks[k]} size={32} />
                <div style={{ flex: 1, background: C.ink, color: "#f3efe6", borderRadius: 8, padding: "9px 16px", font: `500 23px ${F.mono}` }}>
                  <span style={{ color: C.marker }}>$ </span><Type text={s.command} start={cmdStarts[k]} duration={10} cursor={false} />
                </div>
                {s.inferred && <span style={{ font: `700 15px ${F.mono}`, letterSpacing: "0.06em", background: C.marker, color: C.ink, padding: "6px 9px", borderRadius: 5 }}>INFERRED</span>}
              </div>
            ))}
          </Card>
        </PanelIn>

        <PanelIn i={2}>
          <Card style={{ padding: "26px 32px", height: 360 }}>
            <PanelHead n="03" title="House rules" />
            {RULES.map((r, k) => (
              <div key={r} style={{
                font: `500 22px/1.4 ${F.body}`, color: C.ink, padding: "12px 16px", marginBottom: 10, borderRadius: 10,
                borderLeft: `5px solid ${C.cobalt}`,
                background: k === 0 ? `rgba(243,217,133,${0.95 * ruleHi})` : "var(--paper-2)",
                transform: k === 0 ? `translateX(${8 * Math.sin(Math.min(ruleHi, 1) * Math.PI)}px)` : undefined,
              }}>{r}</div>
            ))}
          </Card>
        </PanelIn>

        <PanelIn i={3}>
          <Card style={{ padding: "26px 32px", height: 360, overflow: "hidden" }}>
            <PanelHead n="04" title="First issues for you" />
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <span style={{ font: `300 70px/0.9 ${F.display}`, color: C.cobalt }}>1</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: `500 20px ${F.mono}`, color: C.ink3 }}>#{ISSUE.number}</div>
                <div style={{ font: `500 29px/1.2 ${F.display}`, color: C.ink, marginTop: 4 }}>{ISSUE.title}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
                  <span style={{ font: `700 16px ${F.mono}`, letterSpacing: "0.06em", background: C.okTint, color: C.ok, padding: "6px 10px", borderRadius: 5 }}>EASY</span>
                  <span style={{ font: `700 22px ${F.mono}`, background: C.cobalt, color: "#fff", padding: "4px 12px", borderRadius: 8 }}>{ISSUE.score}</span>
                </div>
                <div style={{ maxHeight: 170 * expand, overflow: "hidden", opacity: expand }}>
                  <div style={{ font: `500 20px ${F.mono}`, color: C.ink3, marginTop: 16, letterSpacing: "0.1em" }}>SUGGESTED APPROACH</div>
                  <div style={{ font: `400 21px/1.4 ${F.body}`, color: C.ink, marginTop: 6 }}>{ISSUE.approach.split(". ")[0]}.</div>
                  <div style={{ font: `500 19px ${F.mono}`, color: C.cobaltDeep, marginTop: 10 }}>▸ {ISSUE.likely_files[0]}</div>
                </div>
              </div>
            </div>
          </Card>
        </PanelIn>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 30 }}>
        <div style={{ flex: 1, height: 14, borderRadius: 99, background: "var(--paper-3)", overflow: "hidden" }}>
          <div style={{ width: `${(done / 4) * 100 * Math.min(1, bar + 0.2)}%`, height: "100%", background: C.ok, borderRadius: 99 }} />
        </div>
        <span style={{ font: `500 26px ${F.mono}`, color: C.ink2 }}>setup {done}/4 ticked</span>
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- 5. Outro ---------------- */

function Outro() {
  const f = useCurrentFrame();
  const logo = useSpring(0, { damping: 12 });
  const line = useSpring(10, { damping: 18 });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * logo}) rotate(${(1 - logo) * -40}deg)`, opacity: logo }}><Compass size={96} /></div>
      <div style={{ font: `500 84px ${F.display}`, letterSpacing: "-0.03em", color: C.ink, marginTop: 20, opacity: logo }}>Repo Onboarding Agent</div>
      <div style={{ font: `400 56px/1.2 ${F.display}`, color: C.ink2, marginTop: 22, opacity: line, transform: `translateY(${(1 - line) * 30}px)` }}>
        From “I found a repo” to <Mark delay={22}>my first PR</Mark>.
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 56, justifyContent: "center", flexWrap: "wrap", maxWidth: 1600 }}>
        <Tag delay={30}>{LIVE_URL}</Tag>
        <Tag delay={38}>{GITHUB}</Tag>
        <Tag delay={46} dot={C.marker}>{EVAL.pct}% on a {EVAL.repos}-repo eval</Tag>
      </div>
      {/* keeps a little motion during the hold */}
      <div style={{ position: "absolute", bottom: 70, font: `500 22px ${F.mono}`, color: C.ink3, letterSpacing: "0.12em", opacity: interpolate(f, [50, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        A STUDENT PROJECT · PYTHON · FASTAPI · GEMINI · REACT
      </div>
    </AbsoluteFill>
  );
}
