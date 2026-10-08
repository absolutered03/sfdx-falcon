// Turn one queued item into a draft for human review: the shared step behind the
// ingest job and the one-time backfill. One LLM call; never publishes.

import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { schema } from "../db/client";
import type { Category } from "../lib/taxonomy";
import { EXCERPT_LIMIT } from "./normalize";
import { summarizeItem } from "./summarize";

type Item = typeof schema.items.$inferSelect;
type Source = typeof schema.sources.$inferSelect;

export type DraftOutcome =
  | { outcome: "drafted" | "out_of_scope" | "failed" }
  | { outcome: "error"; message: string }; // API or network error: item left as it was

export async function draftItem(db: Db, item: Item, source: Source | null, entityId: Map<string, number>): Promise<DraftOutcome> {
  let r;
  try {
    r = await summarizeItem({
      title: item.title,
      sourceName: source?.name ?? "manual",
      sourceTier: source?.tier ?? "manual",
      url: item.url,
      publishedAt: item.publishedAt,
      excerpt: item.excerpt,
      truncated: item.excerpt.length >= EXCERPT_LIMIT,
      defaultCategories: source?.defaultCategories ?? [],
      entitySlugs: [...entityId.keys()],
    });
  } catch (e) {
    return { outcome: "error", message: (e as Error).message };
  }

  if (!r.ok) {
    // Still goes to a human, flagged, with no generated text.
    await db.update(schema.items)
      .set({ status: "draft", statusReason: r.reason, llmModel: r.model, flags: ["llm_failed"] })
      .where(eq(schema.items.id, item.id));
    return { outcome: "failed" };
  }

  const d = r.data;
  await db.update(schema.items)
    .set({
      // A release always belongs to a tracked tool, so "not in scope" means "not worth an
      // entry": keep it as logged history rather than dropping it, or the tool could lose
      // its current version.
      status: d.in_scope ? "draft" : item.kind === "release" ? "logged" : "out_of_scope",
      statusReason: `llm: ${d.scope_reason}`,
      kind: item.kind === "release" ? "release" : (d.kind as Item["kind"]),
      version: d.version ?? item.version,
      categories: [...new Set([...item.categories, ...d.categories])] as Category[],
      impact: d.impact,
      summary: d.summary,
      platformImpact: d.platform_impact,
      flags: d.flags,
      llmModel: r.model,
      llmRaw: d,
    })
    .where(eq(schema.items.id, item.id));
  const ids = d.entity_slugs.map((s) => entityId.get(s)).filter((x): x is number => x !== undefined);
  if (ids.length) {
    await db.insert(schema.itemEntities).values(ids.map((entityId) => ({ itemId: item.id, entityId }))).onConflictDoNothing();
  }
  return { outcome: d.in_scope ? "drafted" : "out_of_scope" };
}
