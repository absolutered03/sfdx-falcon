// Ingestion job. Run on a schedule (GitHub Actions cron, see .github/workflows/ingest.yml).
//
//   fetch (allow-listed sources only) -> normalize -> dedupe on canonical URL
//   -> deterministic prefilter -> store as pending_llm
//   -> summarize up to MAX_LLM_CALLS_PER_RUN -> store as draft for human review
//
// Nothing here publishes. The only way an item becomes public is a human pressing
// Approve in /admin.
//
// Usage:
//   npm run ingest           full run against DATABASE_URL
//   npm run ingest:dry       fetch + normalize + prefilter only; no DB, no LLM, prints what it would do

import { readFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";
import {
  EXCERPT_LIMIT,
  extractVersion,
  isMajorRelease,
  isPatchRelease,
  isPrerelease,
  isProductReleaseTag,
  mentionsSecurity,
  parseFeed,
  type RawItem,
} from "../src/ingest/normalize";
import { prefilter } from "../src/ingest/prefilter";
import { draftItem } from "../src/ingest/draft";
import { SITE_URL } from "../src/lib/site";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_LLM_CALLS = Number(process.env.MAX_LLM_CALLS_PER_RUN ?? 40);
const BACKFILL_DAYS = 30; // ignore anything older on a source's first fetch
const USER_AGENT = `platformchangelog-ingest/0.1 (+${SITE_URL}/about)`;

type SourceRow = typeof schema.sources.$inferSelect;
type SourceSeed = Pick<SourceRow, "slug" | "name" | "kind" | "tier"> & Partial<SourceRow>;

const isReleaseSource = (s: SourceSeed) => s.kind === "github_releases" || !!s.releaseFeed;

const feedUrlFor = (s: SourceSeed) =>
  s.kind === "github_releases" ? `https://github.com/${s.githubRepo}/releases.atom` : s.feedUrl!;

interface FetchResult {
  status: "ok" | "not_modified";
  items: RawItem[];
  etag?: string | null;
  lastModified?: string | null;
}

async function fetchSource(s: SourceSeed): Promise<FetchResult> {
  const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" };
  if (s.etag) headers["if-none-match"] = s.etag;
  if (s.lastModified) headers["if-modified-since"] = s.lastModified;
  const res = await fetch(feedUrlFor(s), { headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 304) return { status: "not_modified", items: [] };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {
    status: "ok",
    items: parseFeed(await res.text()),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

// Decide, without a model, what happens to a freshly fetched item.
// GitHub release names are often a bare version ("v2.4.2"), meaningless in a mixed feed.
// Prefix the tool name unless the title already carries it ("GitLab 19.4 release notes").
function releaseTitle(title: string, toolName?: string): string {
  if (!toolName) return title;
  const firstWord = toolName.toLowerCase().split(/\s+/)[0];
  return title.toLowerCase().includes(firstWord) ? title : `${toolName} ${title}`;
}

type Triage = { status: "pending_llm" | "out_of_scope" | "logged"; reason: string };

function triage(s: SourceSeed, it: RawItem): Triage {
  if (isReleaseSource(s)) {
    if (!isProductReleaseTag(it.title)) return { status: "out_of_scope", reason: "component or chart tag" };
    if (s.tagPattern && !new RegExp(s.tagPattern).test(it.title)) return { status: "out_of_scope", reason: "other component" };
    if (isPrerelease(it.title)) return { status: "out_of_scope", reason: "prerelease tag" };
    const version = extractVersion(it.title);
    const security = mentionsSecurity(it.excerpt);
    if (s.releasePolicy === "major_or_security" && !security && !isMajorRelease(version)) {
      return { status: "logged", reason: "supporting tool: not a major or security release" };
    }
    if (isPatchRelease(version) && !security) {
      return { status: "logged", reason: "routine patch release" };
    }
    return { status: "pending_llm", reason: "github release" };
  }
  if (!s.keywordFilter) return { status: "pending_llm", reason: "niche source, no prefilter" };
  const pf = prefilter(it.title, s.keywordTitleOnly ? "" : it.excerpt, s.keywordTerms);
  return { status: pf.pass ? "pending_llm" : "out_of_scope", reason: pf.reason };
}

async function dryRun() {
  const seeds = JSON.parse(readFileSync("data/sources.json", "utf8")) as SourceSeed[];
  const cutoff = Date.now() - BACKFILL_DAYS * 86_400_000;
  let candidates = 0;
  for (const s of seeds) {
    try {
      const { items } = await fetchSource(s);
      const recent = items.filter((i) => i.publishedAt.getTime() >= cutoff);
      const triaged = recent.map((i) => ({ i, t: triage(s, i) }));
      const passed = triaged.filter((x) => x.t.status === "pending_llm");
      const logged = triaged.filter((x) => x.t.status === "logged").length;
      candidates += passed.length;
      console.log(
        `\n[${s.slug}] fetched ${items.length}, last ${BACKFILL_DAYS}d ${recent.length}, to LLM ${passed.length}, logged ${logged}, dropped ${recent.length - passed.length - logged}`,
      );
      for (const { i } of passed.slice(0, 3)) console.log(`   + ${i.publishedAt.toISOString().slice(0, 10)}  ${i.title.slice(0, 90)}`);
    } catch (e) {
      console.log(`\n[${s.slug}] ERROR ${(e as Error).message}`);
    }
  }
  console.log(`\nDry run: ${candidates} items would be queued; at most ${MAX_LLM_CALLS} summarized per run.`);
}

async function fetchPhase(db: ReturnType<typeof getDb>) {
  const sources = await db.select().from(schema.sources).where(eq(schema.sources.active, true));
  const entityRows = await db.select({ id: schema.entities.id, slug: schema.entities.slug, name: schema.entities.name }).from(schema.entities);
  const entityId = new Map(entityRows.map((e) => [e.slug, e.id]));
  const entityName = new Map(entityRows.map((e) => [e.slug, e.name]));
  let inserted = 0;

  for (const s of sources) {
    try {
      const res = await fetchSource(s);
      if (res.status === "not_modified") {
        await db.update(schema.sources).set({ lastFetchedAt: new Date(), lastError: null }).where(eq(schema.sources.id, s.id));
        continue;
      }
      const cutoff = s.lastFetchedAt ? 0 : Date.now() - BACKFILL_DAYS * 86_400_000;
      for (const it of res.items) {
        // Older news is skipped on a first fetch, but older releases are kept as logged
        // history (no LLM call), so every tool shows a current version from day one.
        const old = it.publishedAt.getTime() < cutoff;
        if (old && !isReleaseSource(s)) continue;
        let t = triage(s, it);
        if (old && t.status === "pending_llm") t = { status: "logged", reason: "release history from before the first fetch" };
        const isRelease = isReleaseSource(s);
        const [row] = await db
          .insert(schema.items)
          .values({
            sourceId: s.id,
            url: it.url,
            title: isRelease ? releaseTitle(it.title, s.entitySlug ? entityName.get(s.entitySlug) : undefined) : it.title,
            publishedAt: it.publishedAt,
            excerpt: it.excerpt,
            contentHash: it.contentHash,
            status: t.status,
            statusReason: t.reason,
            kind: isRelease ? "release" : "post",
            version: isRelease ? extractVersion(it.title) : null,
            categories: s.defaultCategories,
          })
          .onConflictDoNothing({ target: schema.items.url })
          .returning({ id: schema.items.id });
        if (!row) continue; // already seen
        inserted++;
        const eid = s.entitySlug ? entityId.get(s.entitySlug) : undefined;
        if (eid) await db.insert(schema.itemEntities).values({ itemId: row.id, entityId: eid }).onConflictDoNothing();
      }
      await db
        .update(schema.sources)
        .set({ lastFetchedAt: new Date(), lastError: null, etag: res.etag ?? null, lastModified: res.lastModified ?? null })
        .where(eq(schema.sources.id, s.id));
    } catch (e) {
      // One broken feed never stops the run; the error is visible on the source row.
      console.error(`[${s.slug}] ${(e as Error).message}`);
      await db.update(schema.sources).set({ lastError: (e as Error).message }).where(eq(schema.sources.id, s.id));
    }
  }
  return inserted;
}

async function summarizePhase(db: ReturnType<typeof getDb>) {
  const entityRows = await db.select({ id: schema.entities.id, slug: schema.entities.slug }).from(schema.entities);
  const entityId = new Map(entityRows.map((e) => [e.slug, e.id]));

  const queue = await db
    .select({ item: schema.items, source: schema.sources })
    .from(schema.items)
    .leftJoin(schema.sources, eq(schema.items.sourceId, schema.sources.id))
    .where(eq(schema.items.status, "pending_llm"))
    .orderBy(desc(schema.items.publishedAt))
    .limit(MAX_LLM_CALLS);

  let calls = 0, drafted = 0, rejected = 0, failed = 0, consecutiveErrors = 0;
  for (const { item, source } of queue) {
    calls++;
    const r = await draftItem(db, item, source, entityId);
    if (r.outcome === "error") {
      // Left pending for the next run. Stop early if the provider is down.
      console.error(`[item ${item.id}] ${r.message}`);
      if (++consecutiveErrors >= 3) {
        console.error("3 consecutive LLM errors, stopping summarize phase");
        break;
      }
      continue;
    }
    consecutiveErrors = 0;
    if (r.outcome === "drafted") drafted++;
    else if (r.outcome === "out_of_scope") rejected++;
    else failed++;
  }
  return { calls, drafted, rejected, failed };
}

async function main() {
  if (DRY_RUN) return dryRun();
  const db = getDb();
  const inserted = await fetchPhase(db);
  const s = await summarizePhase(db);
  const backlog = await db.$count(schema.items, eq(schema.items.status, "pending_llm"));
  const awaitingReview = await db.$count(schema.items, eq(schema.items.status, "draft"));
  console.log(
    `ingest: ${inserted} new items | LLM calls ${s.calls}/${MAX_LLM_CALLS} (drafted ${s.drafted}, out of scope ${s.rejected}, failed ${s.failed}) | backlog ${backlog} | awaiting review ${awaitingReview}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
