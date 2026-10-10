import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { compareVersions } from "../ingest/normalize";
import type { Category, Impact, ItemKind } from "./taxonomy";

const { items, sources, entities, itemEntities, entityAlternatives, placements, sponsors } = schema;

export type FeedItem = Awaited<ReturnType<typeof getFeed>>[number];

export interface FeedFilters {
  category?: Category;
  impact?: Impact;
  kind?: ItemKind;
}

/** Public feed: approved items only, newest first, with source and linked entities. */
export async function getFeed(f: FeedFilters, limit = 100) {
  const db = getDb();
  const rows = await db
    .select({ item: items, sourceName: sources.name, sourceTier: sources.tier })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(
      and(
        eq(items.status, "approved"),
        f.category ? arrayContains(items.categories, [f.category]) : undefined,
        f.impact ? eq(items.impact, f.impact) : undefined,
        f.kind ? eq(items.kind, f.kind) : undefined,
      ),
    )
    .orderBy(desc(items.publishedAt))
    .limit(limit);
  return attachEntities(rows);
}

async function attachEntities<T extends { item: { id: number } }>(rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, entities: [] as { slug: string; name: string }[] }));
  const db = getDb();
  const links = await db
    .select({ itemId: itemEntities.itemId, slug: entities.slug, name: entities.name })
    .from(itemEntities)
    .innerJoin(entities, eq(itemEntities.entityId, entities.id))
    .where(inArray(itemEntities.itemId, rows.map((r) => r.item.id)));
  return rows.map((r) => ({ ...r, entities: links.filter((l) => l.itemId === r.item.id) }));
}

/**
 * A tool is public once it has something to show: a known release (which gives it a
 * current version), an approved entry, or practical notes. Tools with none of these
 * stay tracked but unlisted, so the registry never shows an empty page.
 */
const isVisible = sql<boolean>`(
  ${entities.tracked} and (
  coalesce(${entities.practicalNotes}, '') <> ''
  or exists (
    select 1 from ${itemEntities} ie join ${items} i on i.id = ie.item_id
    where ie.entity_id = ${entities.id}
      and (i.status = 'approved' or (i.kind = 'release' and i.status <> 'out_of_scope'))
  ))
)`;


export interface CurrentVersion {
  version: string;
  publishedAt: Date;
  url: string;
}

/**
 * Highest released version per tool, not the most recent by date: projects such as
 * Argo CD and Helm ship patches on older lines the same day as the newest line.
 * Any release that passed triage counts, reviewed or not, because the version
 * number is a fact from the source, not generated text.
 */
export async function getCurrentVersions(entityIds: number[]): Promise<Map<number, CurrentVersion>> {
  const out = new Map<number, CurrentVersion>();
  if (!entityIds.length) return out;
  const rows = await getDb()
    .select({ entityId: itemEntities.entityId, version: items.version, publishedAt: items.publishedAt, url: items.url })
    .from(itemEntities)
    .innerJoin(items, eq(itemEntities.itemId, items.id))
    .where(and(inArray(itemEntities.entityId, entityIds), eq(items.kind, "release"), ne(items.status, "out_of_scope"), isNotNull(items.version)));
  for (const r of rows) {
    const best = out.get(r.entityId);
    if (!best || compareVersions(r.version!, best.version) > 0) {
      out.set(r.entityId, { version: r.version!, publishedAt: r.publishedAt, url: r.url });
    }
  }
  return out;
}

export async function getEntityList() {
  const list = await getDb()
    .select()
    .from(entities)
    .where(and(eq(entities.archived, false), isVisible))
    .orderBy(asc(entities.name));
  const versions = await getCurrentVersions(list.map((e) => e.id));
  return list.map((e) => ({ ...e, current: versions.get(e.id) ?? null }));
}

/** Everything the tool page needs in one place. */
export async function getEntityPage(slug: string) {
  const db = getDb();
  const [entity] = await db.select().from(entities).where(and(eq(entities.slug, slug), isVisible));
  if (!entity) return null; // unknown or not yet visible: 404

  const linked = await db
    .select({ item: items, sourceName: sources.name })
    .from(itemEntities)
    .innerJoin(items, eq(itemEntities.itemId, items.id))
    .leftJoin(sources, eq(items.sourceId, sources.id))
    // Releases waiting on (or held from) a summary still show: their change list is
    // source data, not generated text. Their summary fields are only rendered once approved.
    .where(and(
      eq(itemEntities.entityId, entity.id),
      sql`(${items.status} in ('approved', 'logged') or (${items.kind} = 'release' and ${items.status} in ('pending_llm', 'draft')))`,
    ))
    .orderBy(desc(items.publishedAt))
    .limit(200);

  const alternatives = await db
    .select({ slug: entities.slug, name: entities.name, note: entityAlternatives.note })
    .from(entityAlternatives)
    .innerJoin(entities, eq(entityAlternatives.alternativeId, entities.id))
    .where(and(eq(entityAlternatives.entityId, entity.id), isVisible));

  const current = (await getCurrentVersions([entity.id])).get(entity.id) ?? null;

  return {
    entity,
    current,
    // Newest first; within one day, highest version first (projects patch several
    // lines on the same day, and the current line should lead).
    releases: linked
      .filter((r) => r.item.kind === "release")
      .sort((a, b) =>
        b.item.publishedAt.toISOString().slice(0, 10).localeCompare(a.item.publishedAt.toISOString().slice(0, 10)) ||
        compareVersions(b.item.version ?? "0", a.item.version ?? "0"),
      ),
    caseNotes: linked.filter((r) => ["case_study", "incident"].includes(r.item.kind) && r.item.status === "approved"),
    coverage: linked.filter(
      (r) => !["release", "case_study", "incident", "sponsored"].includes(r.item.kind) && r.item.status === "approved",
    ),
    alternatives,
  };
}

/**
 * One active sponsored placement for a slot, or null. Sponsors never appear on the
 * page of an entity they sell or compete with (sponsors.conflict_entity_slugs).
 */
export async function getPlacement(slot: "feed_inline" | "entity_sidebar", opts: { category?: Category; entitySlug?: string } = {}) {
  const now = new Date();
  const rows = await getDb()
    .select({ placement: placements, sponsorName: sponsors.name, conflicts: sponsors.conflictEntitySlugs })
    .from(placements)
    .innerJoin(sponsors, eq(placements.sponsorId, sponsors.id))
    .where(and(eq(placements.slot, slot), lte(placements.startsAt, now), gte(placements.endsAt, now)))
    .orderBy(sql`random()`)
    .limit(10);
  return (
    rows.find(
      (r) =>
        (!r.placement.targetCategory || !opts.category || r.placement.targetCategory === opts.category) &&
        !(opts.entitySlug && r.conflicts.includes(opts.entitySlug)),
    ) ?? null
  );
}

/**
 * The after-the-fact audit in /admin: what went live automatically (newest first), what
 * the publish checks held back, and what the model threw out (an editor can overrule it).
 */
export async function getAuditQueue() {
  const db = getDb();
  const select = () =>
    db.select({ item: items, sourceName: sources.name, sourceTier: sources.tier }).from(items).leftJoin(sources, eq(items.sourceId, sources.id));
  const published = await select()
    .where(and(eq(items.status, "approved"), isNotNull(items.approvedAt), gte(items.approvedAt, new Date(Date.now() - 14 * 86_400_000))))
    .orderBy(desc(items.approvedAt))
    .limit(100);
  const held = await select().where(eq(items.status, "draft")).orderBy(desc(items.publishedAt)).limit(50);
  const llmRejected = await select()
    .where(and(eq(items.status, "out_of_scope"), isNotNull(items.llmModel)))
    .orderBy(desc(items.publishedAt))
    .limit(20);
  return {
    published: await attachEntities(published),
    held: await attachEntities(held),
    llmRejected: await attachEntities(llmRejected),
  };
}

// ---------------------------------------------------------------------------
// Site search
// ---------------------------------------------------------------------------

const VERSIONISH = /^v?\d+(\.\d+)*$/i;

/**
 * Search visible tools (every word that is not a version number must appear in the
 * name, slug, vendor or description), plus releases and approved entries whose title
 * or summary contains the phrase. Small registry, so tools are matched in memory.
 */
export async function searchSite(rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return { tools: [], releases: [], entries: [] };
  const words = q.split(/\s+/).filter((w) => w.length >= 2 && !VERSIONISH.test(w));

  const all = await getEntityList();
  const tools = all.filter((e) => {
    const hay = `${e.name} ${e.slug} ${e.vendor ?? ""} ${e.description}`.toLowerCase();
    return words.length ? words.every((w) => hay.includes(w)) : false;
  });

  const db = getDb();
  const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
  const releases = await db
    .select({ item: items, slug: entities.slug, name: entities.name })
    .from(items)
    .innerJoin(itemEntities, eq(itemEntities.itemId, items.id))
    .innerJoin(entities, eq(itemEntities.entityId, entities.id))
    .where(and(eq(items.kind, "release"), ne(items.status, "out_of_scope"), eq(entities.tracked, true), sql`${items.title} ilike ${like}`))
    .orderBy(desc(items.publishedAt))
    .limit(20);
  const entries = await db
    .select({ item: items })
    .from(items)
    .where(and(eq(items.status, "approved"), sql`(${items.title} ilike ${like} or ${items.summary} ilike ${like})`))
    .orderBy(desc(items.publishedAt))
    .limit(20);
  return { tools, releases, entries };
}
