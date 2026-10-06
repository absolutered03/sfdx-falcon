// Weekly digest outline: approved items from the last 7 days, grouped into sections,
// printed as Markdown to paste into the newsletter tool. The intro and the "why it
// matters this week" line are left as blanks for a human to write; nothing here is sent.
//
//   npm run digest > digest.md

import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "../src/db/client";
import { CATEGORY_LABELS, type Category } from "../src/lib/taxonomy";

const db = getDb();
const since = new Date(Date.now() - 7 * 86_400_000);
const rows = await db
  .select()
  .from(schema.items)
  .where(and(eq(schema.items.status, "approved"), gte(schema.items.publishedAt, since)))
  .orderBy(desc(schema.items.publishedAt));

const line = (i: (typeof rows)[number]) =>
  `- **[${i.title}](${i.url})**${i.version ? ` (${i.version})` : ""}. ${i.summary ?? ""}\n  *For platform teams:* ${i.platformImpact ?? ""}`;

const major = rows.filter((i) => i.impact === "major");
const caseNotes = rows.filter((i) => i.impact !== "major" && ["case_study", "incident"].includes(i.kind));
const releases = rows.filter((i) => i.impact !== "major" && i.kind === "release");
const rest = rows.filter((i) => !major.includes(i) && !caseNotes.includes(i) && !releases.includes(i));

const byCategory = new Map<Category, typeof rows>();
for (const i of rest) {
  const c = (i.categories[0] ?? "reports") as Category;
  byCategory.set(c, [...(byCategory.get(c) ?? []), i]);
}

const out: string[] = [
  `# Platform Changelog, week of ${since.toISOString().slice(0, 10)}`,
  "",
  "_Intro: two or three sentences, written by hand. What was the shape of the week?_",
  "",
  "## The big ones",
  ...(major.length ? major.map(line) : ["_Nothing major this week. Say so; do not promote a notable item to fill the slot._"]),
  "",
  "## Case notes and postmortems",
  ...(caseNotes.length ? caseNotes.map(line) : ["_None this week._"]),
  "",
  "## Releases",
  ...releases.map(line),
  "",
  ...[...byCategory.entries()].flatMap(([c, list]) => [`## ${CATEGORY_LABELS[c]}`, ...list.map(line), ""]),
  "## One question for readers",
  "_A real question you want answered, e.g. how are you scoping agent credentials on your platform API?_",
  "",
  "<!-- SPONSOR SLOT (digest_top): render an active placement here, labelled Sponsored. -->",
];

console.log(out.join("\n"));
process.exit(0);
