// Rebuild stored releases with typed change lines (src/ingest/changes.ts).
//
//   npm run rebuild:releases                 re-type every stored release from what we hold
//   npm run rebuild:releases -- --refetch    first pull full notes from the GitHub API
//   npm run rebuild:releases -- --dry-run    report only, no writes
//
// What it does, per release:
//   1. --refetch: replaces the stored notes with the full markdown from the GitHub API
//      (releases stored before 2026-10-10 hold at most 12,000 characters of feed text,
//      which for Kyverno 1.19.0 is 133 of about 238 lines). Up to 300 releases per repo.
//   2. Parses every line into a type and stores it in items.changes.
//   3. Applies the new release checks, demotions only: nightly builds become
//      out_of_scope (they stop counting as the current version); queued releases with
//      only dependency, CI, test or docs changes become logged. Nothing is promoted and
//      nothing published is touched: published entries that now look like noise are
//      listed for you to unpublish in /admin if you agree.
//   4. Gives queued releases the condensed model input, so the next ingest summarizes
//      from every line that matters.
// Safe to re-run.

import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";
import { countChanges, parseChangelogEntries, parseChanges, type ChangeLine } from "../src/ingest/changes";
import { fetchGithubReleasePage, releaseContent, releaseNotesTriage } from "../src/ingest/releases";
import { SITE_URL } from "../src/lib/site";

const REFETCH = process.argv.includes("--refetch");
const DRY = process.argv.includes("--dry-run");
const USER_AGENT = `platformchangelog-rebuild/0.1 (+${SITE_URL}/about)`;

const db = getDb();
const { items, sources } = schema;

const releaseSources = (await db.select().from(sources)).filter(
  (s) => s.kind === "github_releases" || s.kind === "changelog_md" || s.releaseFeed,
);
const sourceById = new Map(releaseSources.map((s) => [s.id, s]));

// 1. Full notes from the API.
let refetched = 0;
const refetchErrors: string[] = [];
if (REFETCH) {
  for (const s of releaseSources.filter((x) => x.kind === "github_releases" && x.active)) {
    for (let page = 1; page <= 3; page++) {
      const res = await fetchGithubReleasePage(s.githubRepo!, USER_AGENT, { page, perPage: 100 });
      if (res.status !== 200) {
        refetchErrors.push(`${s.githubRepo}: HTTP ${res.status}`);
        break;
      }
      for (const it of res.items) {
        if (DRY) { refetched++; continue; }
        const updated = await db.update(items).set({ body: it.body, contentHash: it.contentHash }).where(eq(items.url, it.url)).returning({ id: items.id });
        refetched += updated.length;
      }
      if (res.items.length < 100) break;
    }
  }
}

// 2 to 4. Re-type, demote, condense.
const rows = await db.select().from(items).where(eq(items.kind, "release"));
const tally = { releases: 0, typed: 0, lines: 0, nightly: 0, maintenanceOnly: 0, condensed: 0 };
const publishedNoise: string[] = [];
const byType: Record<string, number> = {};

for (const item of rows) {
  const s = item.sourceId ? sourceById.get(item.sourceId) : undefined;
  if (!s) continue;
  tally.releases++;
  const typed = s.kind !== "rss";
  const body = item.body ?? item.excerpt;
  const lines: ChangeLine[] = !typed ? [] : s.kind === "changelog_md" ? parseChangelogEntries(body) : parseChanges(body);
  const rel = releaseContent({ body, excerpt: item.excerpt, lines }, typed);
  if (lines.length) tally.typed++;
  tally.lines += lines.length;
  for (const [t, n] of Object.entries(countChanges(lines).counts)) byType[t] = (byType[t] ?? 0) + n;

  const set: Partial<typeof items.$inferInsert> = { body, changes: typed ? lines : null };
  const notes = typed ? releaseNotesTriage({ title: item.title }, body, lines) : null;
  if (notes?.status === "out_of_scope" && ["pending_llm", "draft", "logged"].includes(item.status)) {
    set.status = "out_of_scope";
    set.statusReason = notes.reason;
    tally.nightly++;
  } else if (notes?.status === "logged" && ["pending_llm", "draft"].includes(item.status)) {
    set.status = "logged";
    set.statusReason = notes.reason;
    tally.maintenanceOnly++;
  } else if (notes && item.status === "approved") {
    publishedNoise.push(`${item.title} (${notes.reason}) id=${item.id}`);
  }
  if (["pending_llm", "draft"].includes(set.status ?? item.status) && rel.excerpt !== item.excerpt) {
    set.excerpt = rel.excerpt;
    tally.condensed++;
  }
  if (!DRY) await db.update(items).set(set).where(eq(items.id, item.id));
}

console.log(`${DRY ? "DRY RUN: " : ""}rebuild: ${tally.releases} releases, ${tally.typed} with typed notes, ${tally.lines} lines`);
console.log(`  by type: ${Object.entries(byType).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(", ")}`);
console.log(`  nightly builds moved out of scope: ${tally.nightly}; queued maintenance-only releases logged: ${tally.maintenanceOnly}; queued releases given condensed input: ${tally.condensed}`);
if (REFETCH) console.log(`  full notes refetched for ${refetched} releases${refetchErrors.length ? `; errors: ${refetchErrors.join(", ")}` : ""}`);
if (publishedNoise.length) console.log(`  published entries that now look like noise (unpublish in /admin if you agree):\n    ${publishedNoise.join("\n    ")}`);
process.exit(0);
