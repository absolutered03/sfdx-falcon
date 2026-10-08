import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
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
  coalesce(${entities.practicalNotes}, '') <> ''
  or exists (
    select 1 from ${itemEntities} ie join ${items} i on i.id = ie.item_id
    where ie.entity_id = ${entities.id}
      and (i.status = 'approved' or (i.kind = 'release' and i.status <> 'out_of_scope'))
  )
)`;

/** Numeric version compare: v3.10.0 > v3.9.4, 2.585 > 2.580.1. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

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
    .where(and(eq(itemEntities.entityId, entity.id), inArray(items.status, ["approved", "logged"])))
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
    releases: linked.filter((r) => r.item.kind === "release"),
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

/** Review queue: drafts first, then what the LLM threw out (a human can overrule it). */
export async function getReviewQueue() {
  const db = getDb();
  const rows = await db
    .select({ item: items, sourceName: sources.name, sourceTier: sources.tier })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(eq(items.status, "draft"))
    .orderBy(desc(items.publishedAt))
    .limit(50);
  const llmRejected = await db
    .select({ item: items, sourceName: sources.name, sourceTier: sources.tier })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .where(and(eq(items.status, "out_of_scope"), isNotNull(items.llmModel)))
    .orderBy(desc(items.publishedAt))
    .limit(20);
  return { drafts: await attachEntities(rows), llmRejected: await attachEntities(llmRejected) };
}
