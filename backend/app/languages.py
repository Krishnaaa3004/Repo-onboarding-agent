"""Programming languages a profile may list. Anything else is dropped before it reaches the prompt.

Keep in sync with frontend/src/lib/languages.ts, which uses the same list for the form.
"""

LANGUAGES = [
    "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift",
    "Kotlin", "Scala", "Dart", "R", "Julia", "Lua", "Perl", "Haskell", "Elixir", "Erlang", "Clojure", "F#",
    "OCaml", "Objective-C", "Shell", "PowerShell", "SQL", "HTML", "CSS", "MATLAB", "Groovy", "Zig", "Nim",
    "Crystal", "Fortran", "COBOL", "Assembly", "Solidity", "Elm", "Visual Basic", "Racket", "Scheme", "Lisp",
    "Prolog", "Ada", "Pascal", "Delphi", "Apex", "ABAP", "Verilog", "VHDL", "Mojo",
]

ALIASES = {
    "js": "JavaScript", "node": "JavaScript", "nodejs": "JavaScript", "node.js": "JavaScript", "ecmascript": "JavaScript",
    "ts": "TypeScript",
    "py": "Python", "python3": "Python",
    "golang": "Go",
    "cpp": "C++", "c plus plus": "C++", "cplusplus": "C++",
    "csharp": "C#", "c sharp": "C#",
    "fsharp": "F#", "f sharp": "F#",
    "rb": "Ruby",
    "kt": "Kotlin",
    "bash": "Shell", "sh": "Shell", "zsh": "Shell",
    "ps": "PowerShell", "pwsh": "PowerShell",
    "objc": "Objective-C", "obj-c": "Objective-C", "objective c": "Objective-C",
    "html5": "HTML", "css3": "CSS", "scss": "CSS", "sass": "CSS",
    "vb": "Visual Basic", "vb.net": "Visual Basic",
    "asm": "Assembly",
    "common lisp": "Lisp",
}

_BY_LOWER = {name.lower(): name for name in LANGUAGES}


def normalize_language(value: str) -> str | None:
    """Canonical name for a known language (case-insensitive, aliases allowed), else None."""
    key = " ".join(value.strip().lower().split())
    if not key or len(key) > 30:
        return None
    return _BY_LOWER.get(key) or ALIASES.get(key)


def clean_languages(values: list[str], limit: int = 8) -> list[str]:
    out: list[str] = []
    for v in values:
        lang = normalize_language(v)
        if lang and lang not in out:
            out.append(lang)
    return out[:limit]
