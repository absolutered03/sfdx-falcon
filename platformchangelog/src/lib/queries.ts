import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
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

export async function getEntityList() {
  return getDb().select().from(entities).where(eq(entities.archived, false)).orderBy(asc(entities.name));
}

/** Everything the tool page needs in one place. */
export async function getEntityPage(slug: string) {
  const db = getDb();
  const [entity] = await db.select().from(entities).where(eq(entities.slug, slug));
  if (!entity) return null;

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
    .where(eq(entityAlternatives.entityId, entity.id));

  return {
    entity,
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
