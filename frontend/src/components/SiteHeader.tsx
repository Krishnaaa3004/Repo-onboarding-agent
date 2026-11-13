import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, Compass } from "./Icons";

export const REPO_URL = "https://github.com/Krishnaaa3004/Repo-onboarding-agent";

export function SiteHeader() {
  const wide = useLocation().pathname.startsWith("/plan/");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className={`${wide ? "wrap-wide" : "wrap"} site-header-inner`}>
        <Link to="/" className="wordmark" aria-label="Onboarding agent, home">
          <Compass size={22} className="wordmark-mark" />
          <span>
            <span className="wordmark-main">Onboarding</span>{" "}
            <span className="wordmark-sub">agent</span>
          </span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav-list">
            <li><Link to="/#how">How it works</Link></li>
            <li><NavLink to="/examples">Examples</NavLink></li>
            <li><NavLink to="/about">About</NavLink></li>
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="nav-gh">
                GitHub <ArrowUpRight size={14} />
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
