import { useCallback, useEffect, useState } from "react";

/** Ticked checklist items for one repo, remembered in localStorage (a per-browser convenience). */
export function useChecklist(storageKey: string | null) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!storageKey) return setChecked(new Set());
    try {
      const raw = localStorage.getItem(storageKey);
      setChecked(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setChecked(new Set());
    }
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          /* storage unavailable (private mode): ticks just won't persist */
        }
        return next;
      });
    },
    [storageKey],
  );

  return { checked, toggle };
}
