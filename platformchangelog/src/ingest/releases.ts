// Release sources: full notes from the GitHub API (the Atom feed is the fallback),
// markdown changelog files, and the deterministic checks that keep nightly builds and
// dependency-only releases out of the feed. Shared by ingest and the rebuild script.

import { condenseForModel, isMaintenanceOnly, parseChangelogFile, parseChanges, type ChangeLine } from "./changes";
import { BODY_LIMIT, EXCERPT_LIMIT, canonicalUrl, parseFeed, sha256, stripHtml, type RawItem } from "./normalize";

export interface FetchResult {
  status: "ok" | "not_modified";
  items: RawItem[];
  etag?: string | null;
  lastModified?: string | null;
}

interface GithubRelease {
  html_url: string;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  created_at: string;
}

const githubHeaders = (userAgent: string, etag?: string | null) => {
  const h: Record<string, string> = { "user-agent": userAgent, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  // Optional. GitHub Actions provides one (github.token); without it the limit is 60
  // requests an hour, enough for ~40 repos every 3 hours since 304s are free.
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (etag) h["if-none-match"] = etag;
  return h;
};

/** One page of a repo's releases from the API: full markdown notes and the prerelease flag. */
export async function fetchGithubReleasePage(repo: string, userAgent: string, opts: { page?: number; perPage?: number; etag?: string | null } = {}) {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=${opts.perPage ?? 30}&page=${opts.page ?? 1}`;
  const res = await fetch(url, { headers: githubHeaders(userAgent, opts.etag), signal: AbortSignal.timeout(20_000) });
  if (res.status === 304) return { status: 304 as const, items: [] as RawItem[], etag: opts.etag ?? null };
  if (!res.ok) return { status: res.status, items: [] as RawItem[], etag: null };
  const releases = (await res.json()) as GithubRelease[];
  const items: RawItem[] = [];
  for (const r of releases) {
    if (r.draft) continue;
    const body = (r.body ?? "").slice(0, BODY_LIMIT);
    try {
      items.push({
        url: canonicalUrl(r.html_url),
        title: stripHtml(r.name?.trim() || r.tag_name),
        publishedAt: new Date(r.published_at ?? r.created_at),
        excerpt: body.slice(0, EXCERPT_LIMIT),
        body,
        contentHash: sha256(body),
        prerelease: r.prerelease,
      });
    } catch {
      // unparseable URL: skip the release
    }
  }
  return { status: 200 as const, items, etag: res.headers.get("etag") };
}

/** GitHub releases via the API; falls back to the Atom feed when the API is rate limited or refused. */
export async function fetchGithubReleases(repo: string, userAgent: string, etag?: string | null): Promise<FetchResult> {
  const api = await fetchGithubReleasePage(repo, userAgent, { etag });
  if (api.status === 304) return { status: "not_modified", items: [] };
  if (api.status === 200) return { status: "ok", items: api.items, etag: api.etag };
  if (api.status !== 403 && api.status !== 429) throw new Error(`GitHub API HTTP ${api.status}`);
  const res = await fetch(`https://github.com/${repo}/releases.atom`, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GitHub API HTTP ${api.status}, Atom fallback HTTP ${res.status}`);
  return { status: "ok", items: parseFeed(await res.text()) };
}

/**
 * A markdown changelog file. Release-candidate sections are skipped (the same version
 * reappears as stable a week later), as are sections dated in the future. The link
 * keeps GitHub's heading anchor, so it lands on the release's section.
 */
export async function fetchChangelog(rawUrl: string, pageUrl: string, userAgent: string, etag?: string | null): Promise<FetchResult> {
  const headers: Record<string, string> = { "user-agent": userAgent };
  if (etag) headers["if-none-match"] = etag;
  const res = await fetch(rawUrl, { headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 304) return { status: "not_modified", items: [] };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const now = Date.now();
  const items = parseChangelogFile(await res.text())
    .filter((r) => r.channel !== "stable-rc" && r.date.getTime() <= now)
    .map((r) => ({
      url: `${pageUrl}#${r.anchor}`,
      title: r.version,
      publishedAt: r.date,
      excerpt: "",
      body: r.body.slice(0, BODY_LIMIT),
      contentHash: sha256(r.body),
      version: r.version,
      lines: r.lines,
    }));
  return { status: "ok", items, etag: res.headers.get("etag") };
}

/**
 * Typed lines, the stored notes, and what the summarizer gets, for one release.
 * typed=false for release posts in RSS feeds (GitLab's monthly notes): prose, not lines.
 */
export function releaseContent(it: Pick<RawItem, "body" | "excerpt" | "lines">, typed = true) {
  const body = it.body ?? it.excerpt;
  const lines: ChangeLine[] = typed ? (it.lines ?? parseChanges(body)) : [];
  const excerpt = lines.length ? condenseForModel(lines, EXCERPT_LIMIT) : body.slice(0, EXCERPT_LIMIT);
  return { body, lines, excerpt };
}

// Salesforce CLI's GitHub releases say only "!! Release as nightly !!".
const NIGHTLY = /\bnightly\b/i;

/**
 * Release checks that need the notes, after the title checks in triage. Returns null
 * when the release is a candidate for an entry.
 */
export function releaseNotesTriage(
  it: Pick<RawItem, "title" | "prerelease">,
  body: string,
  lines: ChangeLine[],
): { status: "out_of_scope" | "logged"; reason: string } | null {
  if (it.prerelease) return { status: "out_of_scope", reason: "marked prerelease on GitHub" };
  if (NIGHTLY.test(it.title) || NIGHTLY.test(body.split("\n", 3).join(" "))) return { status: "out_of_scope", reason: "nightly build" };
  if (isMaintenanceOnly(lines)) {
    return { status: "logged", reason: lines.length ? "maintenance only: dependency, CI, test or docs changes" : "no release notes" };
  }
  return null;
}
