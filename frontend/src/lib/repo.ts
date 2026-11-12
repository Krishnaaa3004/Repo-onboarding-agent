/** Same rules as backend/app/github.py:parse_repo_url, so bad input is caught before a request. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  let s = input.trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  s = s.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  const [owner, rawRepo] = s.split("/");
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;
  return { owner, repo };
}

export function planPath(owner: string, repo: string, languages: string[], level: string, live = false) {
  const q = new URLSearchParams();
  if (languages.length) q.set("langs", languages.join(","));
  if (level !== "beginner") q.set("level", level);
  if (live) q.set("live", "1");
  const qs = q.toString();
  return `/plan/${owner}/${repo}${qs ? `?${qs}` : ""}`;
}

export function blobUrl(fullName: string, branch: string, path: string) {
  return `https://github.com/${fullName}/blob/${branch}/${path.replace(/^\/+/, "")}`;
}
