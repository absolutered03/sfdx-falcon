// Side-by-side model comparison on real items from the database. Read-only: it never
// writes to `items`, so it is safe to run against production.
//
//   npm run compare                                  # opus 5.5 vs haiku 4.5, 12 items
//   npm run compare -- --limit 20 --include-out-of-scope
//   npm run compare -- --models claude-opus-5-5,claude-sonnet-5-5
//
// Writes reports/compare-<timestamp>.md: cost, latency and failure rates per model,
// agreement between models, and every draft side by side for you to judge. The
// numbers tell you what it costs; only reading the drafts tells you which is better.

import { mkdirSync, writeFileSync } from "node:fs";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";
import { EXCERPT_LIMIT } from "../src/ingest/normalize";
import { summarizeItem, type SummarizeResult } from "../src/ingest/summarize";

// $ per million tokens, input / output. Anthropic list prices as of 2026-09-25.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const MODELS = (arg("models") ?? "claude-opus-5-5,claude-haiku-4-5").split(",");
const LIMIT = Number(arg("limit") ?? 12);
const INCLUDE_OOS = process.argv.includes("--include-out-of-scope");

for (const m of MODELS) if (!PRICES[m]) throw new Error(`No price for ${m}; add it to PRICES`);

const db = getDb();
const statuses = ["pending_llm", "draft", "approved", "rejected", ...(INCLUDE_OOS ? ["out_of_scope" as const] : [])] as const;

// Recent candidates with enough text to summarize, then round-robin across sources
// so one chatty feed cannot fill the sample.
const candidates = await db
  .select({ item: schema.items, source: schema.sources })
  .from(schema.items)
  .leftJoin(schema.sources, eq(schema.items.sourceId, schema.sources.id))
  .where(sql`${inArray(schema.items.status, [...statuses])} and length(${schema.items.excerpt}) >= 200`)
  .orderBy(desc(schema.items.publishedAt))
  .limit(300);

const bySource = new Map<string, typeof candidates>();
for (const c of candidates) {
  const k = c.source?.slug ?? "manual";
  bySource.set(k, [...(bySource.get(k) ?? []), c]);
}
const sample: typeof candidates = [];
while (sample.length < LIMIT && [...bySource.values()].some((l) => l.length)) {
  for (const list of bySource.values()) {
    const next = list.shift();
    if (next && sample.length < LIMIT) sample.push(next);
  }
}
if (!sample.length) throw new Error("No items to compare. Run `npm run ingest` first.");

const entitySlugs = (await db.select({ slug: schema.entities.slug }).from(schema.entities)).map((e) => e.slug);

interface Run {
  result: SummarizeResult;
  ms: number;
}
const runs: Run[][] = []; // runs[itemIndex][modelIndex]

console.log(`Comparing ${MODELS.join(" vs ")} on ${sample.length} items...`);
for (const [i, { item, source }] of sample.entries()) {
  const input = {
    title: item.title,
    sourceName: source?.name ?? "manual",
    sourceTier: source?.tier ?? "manual",
    url: item.url,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt,
    truncated: item.excerpt.length >= EXCERPT_LIMIT,
    defaultCategories: source?.defaultCategories ?? [],
    entitySlugs,
  };
  runs[i] = [];
  for (const model of MODELS) {
    const t0 = Date.now();
    try {
      runs[i].push({ result: await summarizeItem(input, { model }), ms: Date.now() - t0 });
    } catch (e) {
      runs[i].push({ result: { ok: false, reason: `error: ${(e as Error).message}`, model, usage: { inputTokens: 0, outputTokens: 0 } }, ms: Date.now() - t0 });
    }
  }
  console.log(`  ${i + 1}/${sample.length} ${item.title.slice(0, 70)}`);
}

// ---- aggregate -------------------------------------------------------------
const cost = (m: string, u: { inputTokens: number; outputTokens: number }) =>
  (u.inputTokens * PRICES[m][0] + u.outputTokens * PRICES[m][1]) / 1e6;

const perModel = MODELS.map((m, j) => {
  const rs = runs.map((r) => r[j]);
  const ok = rs.filter((r) => r.result.ok).length;
  const usd = rs.reduce((s, r) => s + cost(m, r.result.usage), 0);
  const inTok = rs.reduce((s, r) => s + r.result.usage.inputTokens, 0);
  const outTok = rs.reduce((s, r) => s + r.result.usage.outputTokens, 0);
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  return {
    model: m,
    ok,
    failed: rs.length - ok,
    usd,
    perItem: usd / rs.length,
    per50day30: (usd / rs.length) * 50 * 30,
    inTok: Math.round(inTok / rs.length),
    outTok: Math.round(outTok / rs.length),
    p50: ms[Math.floor(ms.length / 2)],
  };
});

// Agreement between the first two models, on items both handled.
const both = runs.filter((r) => r[0].result.ok && r[1]?.result.ok);
const pair = both.map((r) => [r[0].result, r[1].result] as const).map(([a, b]) => {
  if (!a.ok || !b.ok) throw new Error("unreachable");
  return [a.data, b.data] as const;
});
const pct = (n: number) => (both.length ? `${Math.round((100 * n) / both.length)}%` : "n/a");
const jaccard = (x: string[], y: string[]) => {
  const u = new Set([...x, ...y]);
  return u.size ? x.filter((v) => y.includes(v)).length / u.size : 1;
};
const agreeScope = pair.filter(([a, b]) => a.in_scope === b.in_scope).length;
const agreeImpact = pair.filter(([a, b]) => a.impact === b.impact).length;
const agreeEntities = pair.filter(([a, b]) => [...a.entity_slugs].sort().join() === [...b.entity_slugs].sort().join()).length;
const catJ = pair.reduce((s, [a, b]) => s + jaccard(a.categories, b.categories), 0) / (pair.length || 1);

// ---- report ----------------------------------------------------------------
const $ = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;
const out: string[] = [
  `# Model comparison: ${MODELS.join(" vs ")}`,
  "",
  `Run ${new Date().toISOString()} on ${sample.length} items (${[...new Set(sample.map((s) => s.source?.slug ?? "manual"))].join(", ")}).`,
  "",
  "## Cost, speed, reliability",
  "",
  "| Model | OK | Failed | Avg in / out tokens | p50 latency | Cost this run | Per item | At 50 items/day, 30 days |",
  "|---|---|---|---|---|---|---|---|",
  ...perModel.map(
    (p) => `| ${p.model} | ${p.ok} | ${p.failed} | ${p.inTok} / ${p.outTok} | ${(p.p50 / 1000).toFixed(1)}s | ${$(p.usd)} | ${$(p.perItem)} | ${$(p.per50day30)} |`,
  ),
  "",
  `## Agreement (${MODELS[0]} vs ${MODELS[1]}, ${both.length} items both handled)`,
  "",
  `| In scope | Impact | Entities exact | Categories overlap (Jaccard) |`,
  `|---|---|---|---|`,
  `| ${pct(agreeScope)} | ${pct(agreeImpact)} | ${pct(agreeEntities)} | ${pair.length ? catJ.toFixed(2) : "n/a"} |`,
  "",
  "> Agreement is not accuracy. Where they disagree, read the source and decide who was right; that is the real test.",
  "",
  "## Side by side",
];

for (const [i, { item, source }] of sample.entries()) {
  out.push("", `### ${i + 1}. [${item.title}](${item.url})`, `${source?.name ?? "manual"} · ${item.publishedAt.toISOString().slice(0, 10)}`, "");
  for (const [j, m] of MODELS.entries()) {
    const { result: r, ms } = runs[i][j];
    out.push(`**${m}** (${(ms / 1000).toFixed(1)}s, ${$(cost(m, r.usage))})`, "");
    if (!r.ok) {
      out.push(`- FAILED: ${r.reason}`, "");
      continue;
    }
    const d = r.data;
    out.push(
      `- in scope: ${d.in_scope} (${d.scope_reason}) · kind: ${d.kind} · impact: **${d.impact}**`,
      `- categories: ${d.categories.join(", ") || "none"} · entities: ${d.entity_slugs.join(", ") || "none"} · flags: ${d.flags.join(", ") || "none"}`,
      `- summary: ${d.summary}`,
      `- for platform teams: ${d.platform_impact}`,
      "",
    );
  }
}

mkdirSync("reports", { recursive: true });
const file = `reports/compare-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
writeFileSync(file, out.join("\n"));
console.log(`\n${perModel.map((p) => `${p.model}: ${p.ok}/${sample.length} ok, ${$(p.perItem)}/item, p50 ${(p.p50 / 1000).toFixed(1)}s`).join("\n")}`);
console.log(`Report: ${file}`);
process.exit(0);
