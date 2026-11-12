import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EXAMPLES } from "../lib/examples";
import { parseRepo, planPath } from "../lib/repo";
import type { Level } from "../types";
import { ArrowRight, Close } from "./Icons";

const SUGGESTED = ["Python", "TypeScript", "JavaScript", "Go", "Rust", "Java", "C++", "Docs"];

/** The hero input: written on the page like a note on a map, not a boxed form. */
export function RepoForm() {
  const navigate = useNavigate();
  const [repo, setRepo] = useState("");
  const [languages, setLanguages] = useState<string[]>(["Python"]);
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [invalid, setInvalid] = useState(false);

  const addLanguage = (lang: string) => {
    const l = lang.trim().replace(/,$/, "");
    if (l && !languages.some((x) => x.toLowerCase() === l.toLowerCase()) && languages.length < 8) setLanguages([...languages, l]);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addLanguage(draft);
    } else if (e.key === "Backspace" && !draft && languages.length) {
      setLanguages(languages.slice(0, -1));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRepo(repo);
    if (!parsed) return setInvalid(true);
    navigate(planPath(parsed.owner, parsed.repo, languages, level));
  };

  const unused = SUGGESTED.filter((s) => !languages.some((l) => l.toLowerCase() === s.toLowerCase())).slice(0, 4);

  return (
    <form className="repo-form" onSubmit={submit} noValidate>
      <label htmlFor="repo-input" className="visually-hidden">GitHub repository URL</label>
      <div className={`repo-line ${invalid ? "is-invalid" : ""}`}>
        <span className="repo-prefix" aria-hidden="true">github.com/</span>
        <input
          id="repo-input"
          type="text"
          placeholder="owner/repo"
          value={repo}
          onChange={(e) => { setRepo(e.target.value); setInvalid(false); }}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? "repo-error" : undefined}
        />
        <button type="submit" className="btn btn-accent repo-go" disabled={!repo.trim()}>
          Map it <ArrowRight size={16} />
        </button>
      </div>
      {invalid && <p id="repo-error" className="repo-error" role="alert">That doesn't look like a GitHub repo. Try something like pallets/flask.</p>}

      <div className="repo-options">
        <fieldset className="opt">
          <legend className="eyebrow">I know</legend>
          <div className="chips">
            {languages.map((l) => (
              <button type="button" key={l} className="chip is-on" onClick={() => setLanguages(languages.filter((x) => x !== l))}
                aria-label={`Remove ${l}`}>
                {l} <Close size={12} />
              </button>
            ))}
            {unused.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => addLanguage(s)} aria-label={`Add ${s}`}>+ {s}</button>
            ))}
            <input className="chip-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              onBlur={() => draft && addLanguage(draft)} placeholder="other…" aria-label="Add another language" />
          </div>
        </fieldset>

        <fieldset className="opt">
          <legend className="eyebrow">Experience</legend>
          <div className="level" role="radiogroup">
            {(["beginner", "intermediate"] as Level[]).map((l) => (
              <label key={l} className={`level-opt ${level === l ? "is-on" : ""}`}>
                <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="repo-examples">
        <span className="eyebrow">Or open a mapped repo</span>
        {EXAMPLES.map((ex, i) => (
          <span key={ex.slug}>
            <Link to={`/plan/${ex.slug}`} className="link-arrow mono">{ex.slug}</Link>
            {i < EXAMPLES.length - 1 && <span className="sep" aria-hidden="true"> · </span>}
          </span>
        ))}
      </p>
    </form>
  );
}
