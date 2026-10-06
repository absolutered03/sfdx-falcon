import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// A feed entry reduced to the fields we keep, whatever format it came from.
export interface RawItem {
  url: string;
  title: string;
  publishedAt: Date;
  excerpt: string;
  contentHash: string;
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

// Release notes for big projects run to tens of KB. Cap what we store and send to the
// LLM; the reviewer always has the link. The cap is a cost decision, stated openly.
export const EXCERPT_LIMIT = 12_000;

function toRaw(url: string, title: string, date: string, bodyHtml: string): RawItem | null {
  if (!url || !title) return null;
  const publishedAt = new Date(date);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const excerpt = stripHtml(bodyHtml).slice(0, EXCERPT_LIMIT);
  try {
    return { url: canonicalUrl(url), title: stripHtml(title), publishedAt, excerpt, contentHash: sha256(excerpt) };
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

// v1.2.0-rc.1, v1.56.0-next.2, 2.0.0-beta, nightly.
export const isPrerelease = (title: string) =>
  /-(rc|alpha|beta|pre|preview|next|nightly|dev)[.\d]*\b/i.test(title) || /\bnightly\b/i.test(title);

// "v2.4.2" or "v3.5.4: Bump version" is a product release; "apis/v2.4.2" or
// "kyverno-chart-3.9.1" is a component tag.
export const isProductReleaseTag = (title: string) => /^v?\d+\.\d+/.test(title.trim());

export const extractVersion = (title: string) => title.match(/v?\d+\.\d+(\.\d+)?/)?.[0] ?? null;

// x.y.z with z > 0. Patch releases skip the LLM unless the notes look security-relevant.
export const isPatchRelease = (version: string | null) => !!version && /^v?\d+\.\d+\.[1-9]\d*$/.test(version);

export const mentionsSecurity = (text: string) => /\bCVE-\d{4}-\d+|\bsecurity\b|vulnerab|\bGHSA-/i.test(text);
