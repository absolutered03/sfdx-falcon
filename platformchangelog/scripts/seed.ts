// Load the hardcoded registry and source allow-list into the database.
// Idempotent: re-running updates rows in place, so data/*.json stays the source of truth
// for sources and entity metadata until the admin UI grows an editor for them.

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";

type SourceIn = typeof schema.sources.$inferInsert;
type EntityIn = typeof schema.entities.$inferInsert;

const db = getDb();
const sources = JSON.parse(readFileSync("data/sources.json", "utf8")) as SourceIn[];
const { entities, alternatives } = JSON.parse(readFileSync("data/entities.json", "utf8")) as {
  entities: EntityIn[];
  alternatives: { entity: string; alternative: string; note: string }[];
};

for (const s of sources) {
  await db.insert(schema.sources).values(s).onConflictDoUpdate({
    target: schema.sources.slug,
    set: { ...s, slug: undefined },
  });
}

for (const e of entities) {
  // practicalNotes is human-owned in the DB; never overwrite it from the seed file.
  const { practicalNotes: _ignored, ...meta } = e;
  await db.insert(schema.entities).values(meta).onConflictDoUpdate({
    target: schema.entities.slug,
    set: { ...meta, slug: undefined, updatedAt: sql`now()` },
  });
}

const ids = new Map(
  (await db.select({ id: schema.entities.id, slug: schema.entities.slug }).from(schema.entities)).map((r) => [r.slug, r.id]),
);
for (const a of alternatives) {
  const entityId = ids.get(a.entity);
  const alternativeId = ids.get(a.alternative);
  if (!entityId || !alternativeId) throw new Error(`Unknown entity in alternatives: ${a.entity} / ${a.alternative}`);
  // Store both directions so either page shows the comparison.
  for (const [x, y] of [[entityId, alternativeId], [alternativeId, entityId]]) {
    await db.insert(schema.entityAlternatives).values({ entityId: x, alternativeId: y, note: a.note }).onConflictDoUpdate({
      target: [schema.entityAlternatives.entityId, schema.entityAlternatives.alternativeId],
      set: { note: a.note },
    });
  }
}

console.log(`seeded ${sources.length} sources, ${entities.length} entities, ${alternatives.length} comparisons`);
process.exit(0);
