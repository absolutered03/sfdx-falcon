import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// A feed entry reduced to the fields we keep, whatever format it came from.
export interface RawItem {
  url: string;
  title: string;
  publishedAt: Date;
  excerpt: string;
  contentHash: string;
  body?: string; // full release notes, when the source gives them (GitHub API, changelog files)
  prerelease?: boolean; // GitHub's own prerelease flag
  version?: string; // set by changelog files, where the version is not in a release title
  lines?: import("./changes").ChangeLine[]; // pre-typed lines (changelog files)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
});

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) return String((v as { "#text": unknown })["#text"]);
  return "";
};

// Feeds carry HTML. We keep plain text only: it is what the summarizer sees and what
// gets stored, so no markup or script from a source can ever reach the rendered page.
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    // Keep list, heading and code-block structure as markdown markers, so release
    // notes from a feed still parse into one change per bullet (src/ingest/changes.ts).
    .replace(/<li[^>]*>/gi, "\n* ")
    .replace(/<h[1-6][^>]*>/gi, "\n## ")
    .replace(/<pre[^>]*>/gi, "\n```\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const TRACKING_PARAMS = /^(utm_|mc_|ref$|source$|fbclid$|gclid$)/i;

export function canonicalUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.hostname = u.hostname.toLowerCase();
  let s = u.toString();
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
  return s;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// What the LLM sees is capped; a cost decision, stated openly. For releases the excerpt
// is the condensed typed lines (every non-maintenance line, most important first), so
// the cap almost never bites; the full notes are kept in items.body.
export const EXCERPT_LIMIT = 12_000;
// Full release notes kept for the tool page. Kyverno 1.19.0's 238 lines are ~25 KB.
export const BODY_LIMIT = 200_000;

function toRaw(url: string, title: string, date: string, bodyHtml: string): RawItem | null {
  if (!url || !title) return null;
  const publishedAt = new Date(date);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const full = stripHtml(bodyHtml);
  const excerpt = full.slice(0, EXCERPT_LIMIT);
  try {
    return { url: canonicalUrl(url), title: stripHtml(title), publishedAt, excerpt, body: full.slice(0, BODY_LIMIT), contentHash: sha256(full) };
  } catch {
    return null; // unparseable URL
  }
}

/** Parse RSS 2.0 or Atom (GitHub's releases.atom included) into RawItems. */
export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml);

  if (doc.rss?.channel) {
    return asArray(doc.rss.channel.item)
      .map((it: Record<string, unknown>) =>
        toRaw(
          text(it.link) || text(it.guid),
          text(it.title),
          text(it.pubDate) || text(it["dc:date"]),
          text(it["content:encoded"]) || text(it.description),
        ),
      )
      .filter((x): x is RawItem => x !== null);
  }

  if (doc.feed) {
    return asArray(doc.feed.entry)
      .map((e: Record<string, unknown>) => {
        const links = asArray(e.link as Record<string, string> | Record<string, string>[]);
        const href =
          links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? links[0]?.["@_href"] ?? "";
        return toRaw(href, text(e.title), text(e.published) || text(e.updated), text(e.content) || text(e.summary));
      })
      .filter((x): x is RawItem => x !== null);
  }

  throw new Error("Unrecognised feed format (neither RSS nor Atom)");
}

// GitHub release triage, all deterministic. Found against real feeds on 2026-10-06:
// Backstage ships weekly "-next.N" prereleases, Argo CD cuts the same patch on three
// release branches at once, and Crossplane/Kyverno publish chart and API-module tags
// alongside the real release.

// v1.2.0-rc.1, v1.56.0-next.2, v16.5.0-canary.3, 2.0.0-beta, nightly.
export const isPrerelease = (title: string) =>
  /-(rc|alpha|beta|pre|preview|next|canary|nightly|dev)[.\d]*\b/i.test(title) || /\bnightly\b/i.test(title);

// "v2.4.2", "v3.5.4: Bump version" and "Tekton Pipeline release v1.1.2" are product
// releases; "apis/v2.4.2", "kyverno-chart-3.9.1" and an unversioned "stable" are not.
export const isProductReleaseTag = (title: string) =>
  /\bv?\d+\.\d+/.test(title) && !/[\w-]+\/v?\d/.test(title) && !/chart/i.test(title);

// A new major line: v3.0.0, 2.0, v4.0.0 "Name". Used by sources on the
// major_or_security release policy.
export const isMajorRelease = (version: string | null) => !!version && /^v?\d+\.0(\.0)?$/.test(version);

export const extractVersion = (title: string) => title.match(/v?\d+\.\d+(\.\d+)?/)?.[0] ?? null;

// x.y.z with z > 0. Patch releases skip the LLM unless the notes look security-relevant.
export const isPatchRelease = (version: string | null) => !!version && /^v?\d+\.\d+\.[1-9]\d*$/.test(version);

/** Numeric version compare: v3.10.0 > v3.9.4, 2.585 > 2.580.1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map(Number);
  const pb = b.replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export const mentionsSecurity = (text: string) => /\bCVE-\d{4}-\d+|\bsecurity\b|vulnerab|\bGHSA-/i.test(text);
