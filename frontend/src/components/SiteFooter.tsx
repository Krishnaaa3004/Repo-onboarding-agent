import { Link } from "react-router-dom";
import { Compass } from "./Icons";
import { REPO_URL } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Compass size={28} />
          <p className="footer-title">A field guide for your first contribution.</p>
          <p className="footer-note">
            A student project by{" "}
            <a href="https://github.com/Krishnaaa3004" target="_blank" rel="noreferrer">@Krishnaaa3004</a>.
            Plans are written by an LLM from each repo's own files, so check commands before you run them.
          </p>
        </div>
        <div>
          <p className="eyebrow">Pages</p>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/examples">Examples</Link></li>
            <li><Link to="/about">How it works</Link></li>
            <li><a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Built with</p>
          <ul className="mono-list">
            <li>FastAPI · Python 3.13</li>
            <li>Gemini function calling</li>
            <li>GitHub REST + GraphQL</li>
            <li>React · three.js · Framer Motion</li>
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span className="mono">SHEET 01 / 01</span>
        <span className="mono">SCALE 1 : ONE REPO</span>
      </div>
    </footer>
  );
}
