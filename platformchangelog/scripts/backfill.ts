// One-time launch backfill: draft one reviewed entry per tool, so every visible tool
// page opens with a "what changed" written up from its latest minor or major release.
//
//   npm run backfill                 dry run: lists what it would draft, no LLM, no writes
//   npm run backfill -- --run        drafts them (API key required), up to --limit calls
//   npm run backfill -- --run --limit 10
//
// Picks, per tool with release history:
//   - skip if the tool already has an entry in review, approved or rejected
//   - otherwise the release that opened its current version line (4.1.0 when 4.1.4 is
//     current), so the entry covers the features; if that one is not in the stored
//     history, the current release itself. Never an older line: an entry should
//     describe the tool as it is now
// Drafts land in /admin like any other; nothing is published. Uses the API backend
// (LLM_MODEL, default claude-opus-5-5), never the subscription CLI, because these
// drafts become site content. Safe to re-run: tools handled once are skipped.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";
import { draftItem } from "../src/ingest/draft";
import { compareVersions, isPatchRelease } from "../src/ingest/normalize";

const RUN = process.argv.includes("--run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 60;

const db = getDb();
const { items, sources, entities, itemEntities } = schema;

const allEntities = await db.select({ id: entities.id, slug: entities.slug, name: entities.name }).from(entities);
const entityId = new Map(allEntities.map((e) => [e.slug, e.id]));

// Every release linked to a tool that made it past triage, plus whether the tool
// already has an entry a human has seen or will see.
const rows = await db
  .select({ entity: itemEntities.entityId, item: items, source: sources })
  .from(itemEntities)
  .innerJoin(items, eq(itemEntities.itemId, items.id))
  .leftJoin(sources, eq(items.sourceId, sources.id))
  .where(and(eq(items.kind, "release"), isNotNull(items.version), inArray(items.status, ["logged", "pending_llm", "draft", "approved", "rejected"])));

const handled = new Set(
  (await db
    .select({ entity: itemEntities.entityId })
    .from(itemEntities)
    .innerJoin(items, eq(itemEntities.itemId, items.id))
    .where(inArray(items.status, ["draft", "approved", "rejected"]))).map((r) => r.entity),
);

type Row = (typeof rows)[number];
const byEntity = new Map<number, Row[]>();
for (const r of rows) byEntity.set(r.entity, [...(byEntity.get(r.entity) ?? []), r]);

// "v4.1.4" -> "4.1"; two-part versions such as Jenkins "2.585" are their own line.
const lineOf = (v: string) => v.replace(/^v/i, "").split(".").slice(0, 2).join(".");
const highest = (list: Row[]) => list.reduce((a, b) => (compareVersions(b.item.version!, a.item.version!) > 0 ? b : a));

const picks: { name: string; row: Row; why: string }[] = [];
const skipped: string[] = [];
for (const e of allEntities) {
  const list = byEntity.get(e.id);
  if (!list) continue; // no release history: needs a blog item or practical notes instead
  if (handled.has(e.id)) {
    skipped.push(e.name);
    continue;
  }
  const current = highest(list);
  const line = lineOf(current.item.version!);
  const opener = list.filter((r) => !isPatchRelease(r.item.version) && lineOf(r.item.version!) === line);
  const row = opener.length ? highest(opener) : current;
  picks.push({ name: e.name, row, why: opener.length ? `opened the current ${line} line` : "current release (line opener not in history)" });
}
const noHistory = allEntities.filter((e) => !byEntity.has(e.id)).map((e) => e.name);

console.log(`Backfill ${RUN ? "RUN" : "dry run"}: ${picks.length} tools to draft, ${skipped.length} already handled, ${noHistory.length} without release history\n`);
for (const p of picks) {
  console.log(`  ${p.name.padEnd(36)} ${p.row.item.version!.padEnd(10)} ${p.row.item.publishedAt.toISOString().slice(0, 10)}  ${p.why}`);
}
if (skipped.length) console.log(`\nAlready handled: ${skipped.join(", ")}`);
console.log(`\nNo release history (need a blog item or practical notes to appear): ${noHistory.join(", ")}`);

if (!RUN) {
  console.log(`\nDry run only. Re-run with --run to draft up to ${Math.min(LIMIT, picks.length)} of these.`);
  process.exit(0);
}

let drafted = 0, rejected = 0, failed = 0, errors = 0, consecutive = 0;
for (const p of picks.slice(0, LIMIT)) {
  const r = await draftItem(db, p.row.item, p.row.source, entityId);
  if (r.outcome === "error") {
    errors++;
    console.error(`  ! ${p.name}: ${r.message}`);
    if (++consecutive >= 3) {
      console.error("3 consecutive LLM errors, stopping. Nothing was changed for the remaining tools; re-run later.");
      break;
    }
    continue;
  }
  consecutive = 0;
  if (r.outcome === "drafted") drafted++;
  else if (r.outcome === "out_of_scope") rejected++;
  else failed++;
  console.log(`  ${r.outcome.padEnd(12)} ${p.name} ${p.row.item.version}`);
}
console.log(`\nbackfill: drafted ${drafted}, model said out of scope ${rejected}, failed (flagged for you) ${failed}, errors ${errors}. Review them in /admin.`);
process.exit(0);
