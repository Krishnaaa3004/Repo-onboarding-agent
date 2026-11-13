import { motion, useScroll, useSpring } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HeroArt } from "../components/HeroArt";
import { ArrowRight } from "../components/Icons";
import { RepoForm } from "../components/RepoForm";
import { REPO_URL } from "../components/SiteHeader";
import { EXAMPLES } from "../lib/examples";
import { useMediaQuery, usePageTitle, useReducedMotion } from "../lib/hooks";

const HeroScene = lazy(() => import("../components/HeroScene"));

export default function Landing() {
  usePageTitle("");
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <Hero />
      <HowItWorks />
      <ExamplesSection />
      <Trust />
    </>
  );
}

/* ---------------- hero ---------------- */

function Hero() {
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 960px)");
  const use3d = wide && !reduced && hasWebGL();
  // Start fetching three.js only once the page is idle, so it never delays first paint.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!use3d) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setIdle(true), { timeout: 1500 });
    else window.setTimeout(() => setIdle(true), 600);
  }, [use3d]);

  return (
    <section className="hero blueprint" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">Field guide · for first-time contributors</p>
          <h1 id="hero-title" className="hero-title">
            From “I found a repo” to <span className="mark">your first PR</span>, without getting lost.
          </h1>
          <p className="hero-lede">
            Paste a GitHub repo. An agent reads its README, contributing guide, PR template and open issues, then
            hands you a route: how the code is laid out, how to run it, the house rules, and a few issues that fit
            what you know.
          </p>
          <RepoForm />
        </div>
        <div className="hero-visual ticks" aria-hidden={use3d ? undefined : true}>
          {use3d && idle ? (
            <Suspense fallback={<HeroArt animate={false} />}>
              <HeroScene />
            </Suspense>
          ) : (
            <HeroArt animate={!reduced} />
          )}
        </div>
      </div>
    </section>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ---------------- how it works ---------------- */

const STEPS = [
  {
    title: "Size up the repo",
    body: "Before any model call, plain code reads the repo's metadata and file tree: main language, how big it is, how active, and which docs and config files exist.",
    visual: <ClassifyVisual />,
  },
  {
    title: "Read the docs that matter",
    body: "README, CONTRIBUTING and the PR template are fetched in parallel. The agent then pulls whatever else it needs: package.json scripts, a Makefile, a linked docs page.",
    visual: <DocsVisual />,
  },
  {
    title: "Scan issues and first PRs",
    body: "Open, unassigned issues are scored for freshness, labels and how crowded they are. Recent merged PRs from first-timers show what a successful first change looks like here.",
    visual: <IssuesVisual />,
  },
  {
    title: "Draw the route",
    body: "Gemini submits a structured plan. Code checks it: issue numbers and file paths that don't exist are dropped, and setup steps not written in the docs are marked as inferred.",
    visual: <PlanVisual />,
  },
];

function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 75%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <section id="how" className="how" aria-labelledby="how-title">
      <div className="wrap how-grid">
        <div className="how-intro">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="section-title">Four waypoints, one agent loop.</h2>
          <p className="section-lede">
            The cheap, certain work happens in code. The model is only asked for judgement: what the architecture
            means, which issues fit you, how to approach them.
          </p>
          <Link to="/about" className="link-arrow">More on the agent loop <ArrowRight size={14} style={{ display: "inline", verticalAlign: "-2px" }} /></Link>
        </div>

        <ol className="how-steps" ref={listRef}>
          <svg className="how-route" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 2 100">
            <line x1="1" y1="0" x2="1" y2="100" className="how-route-bg" />
            <motion.line x1="1" y1="0" x2="1" y2="100" className="how-route-fg" style={{ pathLength: progress }} />
          </svg>
          {STEPS.map((s, i) => (
            <motion.li key={s.title} className="how-step"
              initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <span className="waypoint" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div className="how-step-text">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <div className="how-visual" aria-hidden="true">{s.visual}</div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClassifyVisual() {
  return (
    <div className="mini">
      <div className="mini-bar"><span style={{ width: "69%", background: "var(--cobalt)" }} /><span style={{ width: "21%", background: "#9fb0ea" }} /><span style={{ width: "10%", background: "var(--rule-strong)" }} /></div>
      <div className="mini-row mono"><span>Python 69%</span><span>HTML 21%</span><span>other</span></div>
      <div className="mini-tags"><span className="tag">medium</span><span className="tag tag-ok">active</span><span className="tag">236 files</span></div>
    </div>
  );
}
function DocsVisual() {
  return (
    <div className="mini mini-doc">
      <p className="mono mini-file">CONTRIBUTING.md</p>
      <span className="ln" style={{ width: "88%" }} />
      <span className="ln hl" style={{ width: "72%" }} />
      <span className="ln" style={{ width: "80%" }} />
      <span className="ln hl" style={{ width: "54%" }} />
      <span className="ln" style={{ width: "64%" }} />
    </div>
  );
}
function IssuesVisual() {
  return (
    <div className="mini">
      {[["87", "Fix typo in deploy docs", "easy"], ["74", "Add type hints to json/tag.py", "easy"], ["52", "Rework session cookies", "hard"]].map(([s, t, d]) => (
        <div className="mini-issue" key={t}>
          <span className={`mini-score ${+s > 70 ? "hi" : ""}`}>{s}</span>
          <span className="mini-issue-t">{t}</span>
          <span className={`tag ${d === "easy" ? "tag-ok" : "tag-err"}`}>{d}</span>
        </div>
      ))}
    </div>
  );
}
function PlanVisual() {
  return (
    <div className="mini">
      {[["Install with uv sync", true], ["Install pre-commit hooks", true], ["Open an issue before a PR", false], ["Pick issue #6146", false]].map(([t, on]) => (
        <div className={`mini-check ${on ? "on" : ""}`} key={t as string}>
          <span className="box">{on ? "✓" : ""}</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- examples ---------------- */

function ExamplesSection() {
  return (
    <section className="examples-sec" aria-labelledby="ex-title">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="eyebrow">See it in action</p>
            <h2 id="ex-title" className="section-title">Sheets already mapped.</h2>
          </div>
          <p className="section-lede sec-head-lede">
            These plans were produced by the real agent and saved, so they open instantly even when the model is
            busy.
          </p>
        </div>
        <ul className="sheets">
          {EXAMPLES.map((ex, i) => <SheetCard key={ex.slug} ex={ex} index={i} />)}
        </ul>
      </div>
    </section>
  );
}

export function SheetCard({ ex, index }: { ex: (typeof EXAMPLES)[number]; index: number }) {
  const { plan } = ex.run;
  const c = plan.classification;
  return (
    <motion.li className="sheet" whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
      <Link to={`/plan/${ex.slug}`} className="sheet-link">
        <div className="sheet-top">
          <span className="eyebrow">Sheet {String(index + 1).padStart(2, "0")} · {c.primary_language}</span>
          <span className="eyebrow">★ {(c.stars / 1000).toFixed(1)}k</span>
        </div>
        <h3 className="sheet-title">{ex.slug}</h3>
        <p className="sheet-blurb">{ex.blurb}</p>
        <MiniRoute seed={index} />
        <dl className="sheet-stats">
          <div><dt>files</dt><dd>{c.file_count.toLocaleString()}</dd></div>
          <div><dt>setup steps</dt><dd>{plan.setup_steps.length}</dd></div>
          <div><dt>issues picked</dt><dd>{plan.issues.length}</dd></div>
        </dl>
        <span className="sheet-cta">Open the plan <ArrowRight size={16} /></span>
      </Link>
    </motion.li>
  );
}

function MiniRoute({ seed }: { seed: number }) {
  const paths = [
    "M8 46 C 40 46, 50 14, 86 14 S 140 40, 170 22 S 220 10, 252 30",
    "M8 20 C 50 20, 60 44, 100 40 S 150 12, 190 18 S 230 44, 252 40",
    "M8 34 C 30 10, 70 10, 96 30 S 150 50, 176 30 S 226 12, 252 18",
  ];
  const dots = [[8, 46, 86, 14, 170, 22, 252, 30], [8, 20, 100, 40, 190, 18, 252, 40], [8, 34, 96, 30, 176, 30, 252, 18]][seed % 3];
  return (
    <svg viewBox="0 0 260 56" className="mini-route" aria-hidden="true">
      <path d={paths[seed % 3]} fill="none" stroke="var(--cobalt)" strokeWidth="1.8" strokeDasharray="4 4" />
      {[0, 2, 4, 6].map((k, i) => (
        <circle key={k} cx={dots[k]} cy={dots[k + 1]} r={i === 3 ? 5 : 3.5} fill={i === 3 ? "var(--marker)" : "var(--paper)"} stroke="var(--cobalt)" strokeWidth="1.6" />
      ))}
    </svg>
  );
}

/* ---------------- trust ---------------- */

function Trust() {
  // From backend/evals/results/report.md (10 repos, 56 hand-written facts, Nov 2026).
  const stats = [
    { value: "91%", label: "of 56 hand-written setup and convention facts found, across 10 well-known repos" },
    { value: "53s", label: "median time to a fresh plan on the free model tier; saved plans open instantly" },
    { value: "2", label: "model turns per plan (median), with about 9 tool calls, after moving routine reads into code" },
    { value: "6¢", label: "estimated cost per plan at Gemini 3.6 Flash list price; $0 on the free tier" },
  ];
  return (
    <section className="trust" aria-labelledby="trust-title">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Why trust it</p>
            <h2 id="trust-title" className="section-title">Measured, not vibes.</h2>
          </div>
          <p className="section-lede sec-head-lede">
            An eval harness runs the agent on 10 well-known repos and checks each plan against facts written by
            hand from the repo's own docs, before any run.{" "}
            <a className="link-arrow" href={`${REPO_URL}/blob/main/backend/evals/results/report.md`} target="_blank" rel="noreferrer">
              Read the full report
            </a>
          </p>
        </div>
        <dl className="stats">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <dt className="stat-value">{s.value}</dt>
              <dd className="stat-label">{s.label}</dd>
            </div>
          ))}
        </dl>
        <ul className="guarantees">
          <li><strong>Every issue is real.</strong> Numbers the agent never fetched are dropped; titles and links come from GitHub, not the model.</li>
          <li><strong>Every path exists.</strong> Files and folders are checked against the repo's actual tree.</li>
          <li><strong>Guesses are labelled.</strong> Setup steps not written in the docs carry an “inferred” badge.</li>
        </ul>
      </div>
    </section>
  );
}
