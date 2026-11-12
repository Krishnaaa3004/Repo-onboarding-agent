/* Hand-drawn line icons in one style (1.6px stroke, round caps). No emoji, no icon font. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Compass = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
    <path d="M14.8 9.2 10.6 10.6 9.2 14.8l4.2-1.4z" fill="currentColor" stroke="none" />
  </Base>
);
export const ArrowRight = (p: P) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>;
export const ArrowUpRight = (p: P) => <Base {...p}><path d="M7 17 17 7M8 7h9v9" /></Base>;
export const Copy = (p: P) => <Base {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Base>;
export const Check = (p: P) => <Base {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>;
export const Close = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>;
export const File = (p: P) => <Base {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Base>;
export const Folder = (p: P) => <Base {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Base>;
export const Tree = (p: P) => <Base {...p}><path d="M5 4v14a2 2 0 0 0 2 2h3M5 9h5M5 14h5" /><rect x="11" y="6" width="9" height="5" rx="1" /><rect x="11" y="16" width="9" height="5" rx="1" /></Base>;
export const Target = (p: P) => <Base {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></Base>;
export const Search = (p: P) => <Base {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Base>;
export const Sprout = (p: P) => <Base {...p}><path d="M12 21v-8" /><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" /></Base>;
export const Spark = (p: P) => <Base {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Base>;
export const Switch = (p: P) => <Base {...p}><path d="M4 8h13l-3-3M20 16H7l3 3" /></Base>;
export const Flag = (p: P) => <Base {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Base>;
export const Github = (p: P) => (
  <Base {...p}>
    <path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </Base>
);
export const Refresh = (p: P) => <Base {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></Base>;
export const Layers = (p: P) => <Base {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Base>;

export const TOOL_ICON: Record<string, (p: P) => React.JSX.Element> = {
  fetch_repo_file: File,
  list_repo_tree: Tree,
  list_issues: Target,
  search_code: Search,
  get_merged_prs_by_first_timers: Sprout,
};
