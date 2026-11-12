import { useEffect, useState } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Repo Onboarding Agent` : "Repo Onboarding Agent: from a repo to your first PR";
  }, [title]);
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
