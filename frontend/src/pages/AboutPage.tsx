import { Link } from "react-router-dom";
import { ArrowUpRight } from "../components/Icons";
import { REPO_URL } from "../components/SiteHeader";
import { usePageTitle } from "../lib/hooks";

const LOOP = [
  { who: "code", title: "Classify", body: "Repo metadata, languages and the full file tree. Size and activity are computed, notable files are found by pattern." },
  { who: "code", title: "Prefetch", body: "README, CONTRIBUTING, PR template, candidate issues and first-timer PRs, fetched in parallel and handed to the model up front." },
  { who: "llm", title: "Investigate", body: "Gemini calls tools to fill gaps: config files for exact commands, folder listings, code search for the files behind an issue." },
  { who: "llm", title: "Submit", body: "The model calls submit_plan with structured JSON. The schema is generated from the same Pydantic models that validate it." },
  { who: "code", title: "Validate", body: "Invalid plans go back to the model with the errors listed. At the step limit, the model is forced to submit." },
  { who: "code", title: "Ground and rank", body: "Unknown issue numbers and file paths are dropped. Issues are scored: 40% GitHub signals, 35% skill match, 25% difficulty fit." },
];

const TOOLS = [
  ["fetch_repo_file", "Read a file, capped at 12k characters"],
  ["list_repo_tree", "List a folder, skipping node_modules and friends"],
  ["list_issues", "Open, unassigned issues with beginner labels, else recent ones"],
  ["search_code", "GitHub code search inside the repo"],
  ["get_merged_prs_by_first_timers", "Merged PRs whose author had no earlier merged PR there"],
  ["submit_plan", "The final answer, as validated JSON"],
];

export default function AboutPage() {
  usePageTitle("About");
  return (
    <div className="page about">
      <header className="page-head blueprint">
        <div className="wrap">
          <p className="eyebrow">About</p>
          <h1 className="page-title">A small agent with a narrow job.</h1>
          <p className="page-lede">
            Repo Onboarding Agent is a student project, built to learn how tool-calling agents work end to end: the
            loop, the tools, the guardrails, and how to measure whether the output is any good.
          </p>
        </div>
      </header>

      <div className="wrap page-body prose-page">
        <section>
          <h2>The problem</h2>
          <p>
            Starting on an unfamiliar open-source repo means a few hours of reading before you write a line: the
            README, the contributing guide, the folder layout, which issues are actually free. First PRs often get
            closed for small, avoidable things: the wrong target branch, no changelog entry, a skipped PR template.
            This tool does the reading and gives you a route through it.
          </p>
        </section>

        <section>
          <h2>How the agent loop works</h2>
          <p>Cheap, certain work runs in code. The model is only asked for judgement.</p>
          <ol className="loop">
            {LOOP.map((s, i) => (
              <li key={s.title} className={`loop-step who-${s.who}`}>
                <span className="loop-n mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="loop-who">{s.who === "llm" ? "Gemini" : "code"}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
          <p>Each step streams to the browser as a Server-Sent Event, which is what the agent trace on a plan page shows.</p>
          <table className="tools-table">
            <caption className="eyebrow">The agent's tools</caption>
            <tbody>
              {TOOLS.map(([name, what]) => (
                <tr key={name}><th scope="row"><code>{name}</code></th><td>{what}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Working within a free tier</h2>
          <p>
            Gemini's free tier allows about 20 requests per model per day, and the newest models are often
            overloaded. So routine reads moved from the model into code (cutting requests per plan from 5–8 to about
            3), finished plans and GitHub responses are cached in SQLite, and an overloaded model falls back to the
            next one in a chain. The examples on this site are saved files, so they always work.
          </p>
        </section>

        <section>
          <h2>How it's evaluated</h2>
          <p>
            About ten well-known repos, each with setup steps and conventions written by hand from their docs. The
            eval runs the agent on each and counts how many of those facts appear in the plan. It also logs tokens,
            estimated cost and latency per run. <span className="tag tag-todo">TODO · results pending</span>
          </p>
        </section>

        <section>
          <h2>Limitations</h2>
          <ul>
            <li>Plans are only as good as the repo's docs. If the contributing guide lives on an external site, the agent says so but doesn't follow the link.</li>
            <li>The model can still be wrong. Check commands before you run them.</li>
            <li>The free backend sleeps when idle, so the first request can take about 30 seconds.</li>
            <li>Only public repos.</li>
          </ul>
        </section>

        <section>
          <h2>Roadmap</h2>
          <ul>
            <li><strong>Pre-PR diff checker.</strong> Paste your diff before opening a PR and check it against the repo's rules: tests touched, changelog updated, commit format, template filled in.</li>
            <li>Follow contributing guides hosted outside the repo.</li>
            <li>Skip issues that already have a linked open PR.</li>
            <li>Shareable plan links.</li>
          </ul>
        </section>

        <p className="about-links">
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={15} /></a>
          <Link className="btn btn-ghost" to="/plan/pallets/flask">See an example plan</Link>
        </p>
      </div>
    </div>
  );
}
