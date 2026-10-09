// Turn one queued item into a published entry: the shared step behind the ingest job
// and the one-time backfill. One LLM call.
//
// Project decision (CT, 2026-10-09): feed items publish without human review. What
// stands in for the reviewer:
//  1. The model cannot award Major. Every auto-published entry is "notable"; the model's
//     suggestion is kept in llm_raw and shown in /admin, where an editor can raise it.
//  2. The prompt carries the fixes from the 2026-10-08 evals (see summarize.ts).
//  3. Deterministic checks (publish-checks.ts). Anything that fails is held as a draft
//     and stays off the site.

import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { schema } from "../db/client";
import type { Category } from "../lib/taxonomy";
import { EXCERPT_LIMIT } from "./normalize";
import { publishChecks } from "./publish-checks";
import { summarizeItem } from "./summarize";

type Item = typeof schema.items.$inferSelect;
type Source = typeof schema.sources.$inferSelect;

export type DraftOutcome =
  | { outcome: "published" | "held" | "out_of_scope" | "failed" }
  | { outcome: "error"; message: string }; // API or network error: item left as it was

export async function draftItem(
  db: Db,
  item: Item,
  source: Source | null,
  entityId: Map<string, number>,
  summarize: typeof summarizeItem = summarizeItem, // injectable so the publish path can be tested without an API key
): Promise<DraftOutcome> {
  let r;
  try {
    r = await summarize({
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
    // Held, flagged, with no generated text. Never published.
    await db.update(schema.items)
      .set({ status: "draft", statusReason: r.reason, llmModel: r.model, flags: ["llm_failed"] })
      .where(eq(schema.items.id, item.id));
    return { outcome: "failed" };
  }

  const d = r.data;
  const held = d.in_scope ? publishChecks(item.url, d) : [];
  const publish = d.in_scope && held.length === 0;
  await db.update(schema.items)
    .set({
      // A release always belongs to a tracked tool, so "not in scope" means "not worth an
      // entry": keep it as logged history rather than dropping it, or the tool could lose
      // its current version.
      status: publish ? "approved" : d.in_scope ? "draft" : item.kind === "release" ? "logged" : "out_of_scope",
      statusReason: held.length ? `held: ${held.join("; ")}` : `llm: ${d.scope_reason}`,
      approvedAt: publish ? new Date() : null,
      kind: item.kind === "release" ? "release" : (d.kind as Item["kind"]),
      version: d.version ?? item.version,
      categories: [...new Set([...item.categories, ...d.categories])] as Category[],
      impact: "notable", // safeguard 1: Major is an editor's call; d.impact stays in llm_raw
      summary: d.summary,
      platformImpact: d.platform_impact,
      flags: held.length ? [...d.flags, "held_by_checks"] : d.flags,
      llmModel: r.model,
      llmRaw: d,
    })
    .where(eq(schema.items.id, item.id));
  const ids = d.entity_slugs.map((s) => entityId.get(s)).filter((x): x is number => x !== undefined);
  if (ids.length) {
    await db.insert(schema.itemEntities).values(ids.map((entityId) => ({ itemId: item.id, entityId }))).onConflictDoNothing();
  }
  return { outcome: publish ? "published" : d.in_scope ? "held" : "out_of_scope" };
}
