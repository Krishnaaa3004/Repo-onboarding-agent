/**
 * Programming languages the profile accepts. Free text is mapped to one of these (case-insensitive,
 * with common aliases like "js" or "golang"); anything else is rejected.
 * Keep in sync with backend/app/languages.py, which enforces the same list on the server.
 */
export const LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift",
  "Kotlin", "Scala", "Dart", "R", "Julia", "Lua", "Perl", "Haskell", "Elixir", "Erlang", "Clojure", "F#",
  "OCaml", "Objective-C", "Shell", "PowerShell", "SQL", "HTML", "CSS", "MATLAB", "Groovy", "Zig", "Nim",
  "Crystal", "Fortran", "COBOL", "Assembly", "Solidity", "Elm", "Visual Basic", "Racket", "Scheme", "Lisp",
  "Prolog", "Ada", "Pascal", "Delphi", "Apex", "ABAP", "Verilog", "VHDL", "Mojo",
] as const;

const ALIASES: Record<string, string> = {
  js: "JavaScript", node: "JavaScript", nodejs: "JavaScript", "node.js": "JavaScript", ecmascript: "JavaScript",
  ts: "TypeScript",
  py: "Python", python3: "Python",
  golang: "Go",
  cpp: "C++", "c plus plus": "C++", cplusplus: "C++",
  csharp: "C#", "c sharp": "C#",
  fsharp: "F#", "f sharp": "F#",
  rb: "Ruby",
  kt: "Kotlin",
  bash: "Shell", sh: "Shell", zsh: "Shell",
  ps: "PowerShell", pwsh: "PowerShell",
  objc: "Objective-C", "obj-c": "Objective-C", "objective c": "Objective-C",
  html5: "HTML", css3: "CSS", scss: "CSS", sass: "CSS",
  vb: "Visual Basic", "vb.net": "Visual Basic",
  asm: "Assembly",
  "common lisp": "Lisp",
};

const BY_LOWER = new Map(LANGUAGES.map((l) => [l.toLowerCase(), l as string]));

/** Returns the canonical language name, or null if the input isn't a known language. */
export function normalizeLanguage(input: string): string | null {
  const key = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key || key.length > 30) return null;
  return BY_LOWER.get(key) ?? ALIASES[key] ?? null;
}

/** Cleans a list of user-supplied languages: known ones only, canonical names, no duplicates. */
export function cleanLanguages(inputs: string[]): string[] {
  const out: string[] = [];
  for (const raw of inputs) {
    const lang = normalizeLanguage(raw);
    if (lang && !out.includes(lang)) out.push(lang);
  }
  return out.slice(0, 8);
}
