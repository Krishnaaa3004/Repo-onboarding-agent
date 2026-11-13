import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { LANGUAGES, normalizeLanguage } from "../lib/languages";

interface Props {
  value: string;
  onChange: (v: string) => void;
  selected: string[];
  invalid: boolean;
  errorId?: string;
  /** Called with free text (Enter / blur) or a picked option; the parent validates it. */
  onCommit: (text: string) => void;
  onBackspaceEmpty: () => void;
}

/**
 * A small, styled combobox for adding a language. Replaces the native <datalist>, which renders as a tall,
 * unstyleable OS panel. Shows at most ~5 rows and scrolls inside itself.
 */
export function LanguageInput({ value, onChange, selected, invalid, errorId, onCommit, onBackspaceEmpty }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = LANGUAGES.filter((l) => !selected.includes(l));
    if (!q) return pool;
    const alias = normalizeLanguage(q); // "golang" -> Go, "js" -> JavaScript
    const starts = pool.filter((l) => l.toLowerCase().startsWith(q));
    const contains = pool.filter((l) => !l.toLowerCase().startsWith(q) && l.toLowerCase().includes(q));
    const ranked = [...starts, ...contains];
    if (alias && pool.includes(alias as (typeof LANGUAGES)[number]) && !ranked.includes(alias as (typeof LANGUAGES)[number])) {
      ranked.unshift(alias as (typeof LANGUAGES)[number]);
    }
    return ranked;
  }, [value, selected]);

  const pick = (lang: string) => {
    onCommit(lang);
    setActive(0);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (open && value.trim() && options[active]) pick(options[active]);
      else if (value.trim()) onCommit(value);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !value) {
      onBackspaceEmpty();
    }
  };

  const showList = open && (options.length > 0 || value.trim().length > 0);

  return (
    <div className="lang-combo">
      <input
        className={`chip-input ${invalid ? "is-invalid" : ""}`}
        value={value}
        placeholder="add another…"
        aria-label="Add another language"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        maxLength={30}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); if (value.trim()) onCommit(value); }}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="lang-pop" id={listId} role="listbox" aria-label="Languages">
          {options.length ? (
            options.map((l, i) => (
              <li key={l} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                className={`lang-opt ${i === active ? "is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(l)}>
                {l}
              </li>
            ))
          ) : (
            <li className="lang-empty" role="presentation">No language matches “{value.trim().slice(0, 20)}”</li>
          )}
        </ul>
      )}
    </div>
  );
}
