import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { Level } from "../types";
import type { RunRequest } from "../useOnboarding";

const EXAMPLES = [
  { repo: "pallets/flask", languages: ["Python"] },
  { repo: "httpie/cli", languages: ["Python"] },
  { repo: "pallets/click", languages: ["Python"] },
];
const SUGGESTED = ["Python", "TypeScript", "JavaScript", "Go", "Rust", "Java", "C++", "Docs"];

interface Props {
  busy: boolean;
  onSubmit: (req: RunRequest) => void;
}

export function RepoForm({ busy, onSubmit }: Props) {
  const [repo, setRepo] = useState("");
  const [languages, setLanguages] = useState<string[]>(["Python"]);
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<Level>("beginner");

  const addLanguage = (lang: string) => {
    const l = lang.trim();
    if (l && !languages.some((x) => x.toLowerCase() === l.toLowerCase()) && languages.length < 8) {
      setLanguages([...languages, l]);
    }
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
    if (repo.trim()) onSubmit({ repo: repo.trim(), languages, level });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label className="field">
        <span>GitHub repository</span>
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          required
        />
      </label>

      <div className="row">
        <label className="field grow">
          <span>Languages you know</span>
          <div className="chips-input">
            {languages.map((l) => (
              <button type="button" key={l} className="chip" onClick={() => setLanguages(languages.filter((x) => x !== l))}
                aria-label={`Remove ${l}`}>
                {l} <span aria-hidden>×</span>
              </button>
            ))}
            <input
              type="text"
              value={draft}
              placeholder={languages.length ? "" : "e.g. Python"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => draft && addLanguage(draft)}
              list="lang-suggestions"
            />
            <datalist id="lang-suggestions">
              {SUGGESTED.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </label>

        <div className="field">
          <span>Experience</span>
          <div className="segmented" role="radiogroup" aria-label="Experience level">
            {(["beginner", "intermediate"] as Level[]).map((l) => (
              <button type="button" key={l} role="radio" aria-checked={level === l}
                className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-footer">
        <div className="examples">
          <span className="muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex.repo} className="link" disabled={busy}
              onClick={() => { setRepo(ex.repo); setLanguages(ex.languages); onSubmit({ repo: ex.repo, languages: ex.languages, level }); }}>
              {ex.repo}
            </button>
          ))}
        </div>
        <button type="submit" className="primary" disabled={busy || !repo.trim()}>
          {busy ? "Analysing…" : "Build my plan"}
        </button>
      </div>
    </form>
  );
}
