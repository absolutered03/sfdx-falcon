import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { CATEGORIES, IMPACTS, ITEM_KINDS, ITEM_STATUSES } from "../lib/taxonomy";

export const categoryEnum = pgEnum("category", CATEGORIES);
export const itemKindEnum = pgEnum("item_kind", ITEM_KINDS);
export const impactEnum = pgEnum("impact", IMPACTS);
export const itemStatusEnum = pgEnum("item_status", ITEM_STATUSES);
export const sourceKindEnum = pgEnum("source_kind", ["rss", "github_releases", "manual"]);
// Tier drives editorial weight: a vendor post needs corroboration before it can be "major".
export const sourceTierEnum = pgEnum("source_tier", ["primary", "community", "media", "vendor"]);
export const entityKindEnum = pgEnum("entity_kind", [
  "tool",
  "platform",
  "mcp_server",
  "report",
  "standard",
]);
export const placementSlotEnum = pgEnum("placement_slot", [
  "feed_inline",
  "digest_top",
  "entity_sidebar",
]);

const categories = (name: string) =>
  categoryEnum(name).array().notNull().default(sql`'{}'::category[]`);

// ---------------------------------------------------------------------------
// Sources: the allow-list. Nothing is ingested from a URL that is not a row here.
// ---------------------------------------------------------------------------
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: sourceKindEnum("kind").notNull(),
  tier: sourceTierEnum("tier").notNull(),
  siteUrl: text("site_url"),
  feedUrl: text("feed_url"), // RSS/Atom; for github_releases this is derived from githubRepo
  githubRepo: text("github_repo"), // "backstage/backstage"
  entitySlug: text("entity_slug"), // a release feed belongs to exactly one entity
  defaultCategories: categories("default_categories"),
  keywordFilter: boolean("keyword_filter").notNull().default(false), // broad feeds only
  // Replaces the global scope terms for this source, e.g. a strict AWS service list,
  // because the provider firehoses would otherwise flood the queue.
  keywordTerms: text("keyword_terms").array(),
  // Match keywords against the title only. For feeds whose bodies mention everything
  // (AWS announcements name CloudWatch and CloudFormation in passing) or that publish
  // SEO-style posts at volume.
  keywordTitleOnly: boolean("keyword_title_only").notNull().default(false),
  // "standard": every product release is a candidate. "major_or_security": supporting
  // tools (Jenkins, Tekton...) only reach the feed on a new major line or a security
  // fix; everything else is logged on the tool page.
  releasePolicy: text("release_policy").notNull().default("standard"),
  // Optional regex a release title must match, for repos that publish several
  // components (open-feature/flagd ships "flagd: v0.17.0" next to "core: v0.18.0").
  tagPattern: text("tag_pattern"),
  // An RSS feed whose items are releases (GitLab's monthly release notes): treated
  // like a GitHub release feed for triage, versions and history.
  releaseFeed: boolean("release_feed").notNull().default(false),
  active: boolean("active").notNull().default(true),
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
});

// ---------------------------------------------------------------------------
// Entities: the registry. Tools, platforms, MCP servers, recurring reports.
// Release history and case notes are not separate tables: they are items
// linked through item_entities, filtered by kind.
// ---------------------------------------------------------------------------
export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: entityKindEnum("kind").notNull(),
  categories: categories("categories"),
  description: text("description").notNull(), // one or two plain sentences, human-written
  homepageUrl: text("homepage_url"),
  repoUrl: text("repo_url"),
  vendor: text("vendor"), // null for foundation-governed OSS
  license: text("license"), // "oss" | "open_core" | "commercial"
  governance: text("governance"), // "CNCF graduated", "vendor-owned", ...
  practicalNotes: text("practical_notes"), // markdown, human-written only
  archived: boolean("archived").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entityAlternatives = pgTable(
  "entity_alternatives",
  {
    entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    alternativeId: integer("alternative_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    note: text("note").notNull(), // one-line comparison: "Pick X when..., Y when..."
  },
  (t) => [primaryKey({ columns: [t.entityId, t.alternativeId] })],
);

// ---------------------------------------------------------------------------
// Sponsorship (future upgrade). Defined now so sponsored content is a typed,
// separately-labelled thing from day one instead of a retrofit.
// ---------------------------------------------------------------------------
export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // Entities this sponsor sells or competes with. Their placements are never
  // shown on those entity pages, and their items never get an impact tag.
  conflictEntitySlugs: text("conflict_entity_slugs").array().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const placements = pgTable("placements", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull().references(() => sponsors.id),
  slot: placementSlotEnum("slot").notNull(),
  targetCategory: categoryEnum("target_category"), // null = run of site
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Items: every fetched thing, in every state. One row per canonical URL.
// ---------------------------------------------------------------------------
export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => sources.id),
    url: text("url").notNull().unique(), // canonical, tracking params stripped
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    excerpt: text("excerpt").notNull(), // plain text from the feed, the only thing the LLM sees
    contentHash: text("content_hash").notNull(),
    status: itemStatusEnum("status").notNull().default("pending_llm"),
    kind: itemKindEnum("kind").notNull().default("post"),
    version: text("version"),
    categories: categories("categories"),
    impact: impactEnum("impact"),
    summary: text("summary"),
    platformImpact: text("platform_impact"), // "What changed for platform teams"
    flags: text("flags").array().notNull().default(sql`'{}'`),
    statusReason: text("status_reason"), // why prefilter/LLM/human put it where it is
    llmModel: text("llm_model"),
    llmRaw: jsonb("llm_raw"), // the full structured output, for audit
    editorNote: text("editor_note"), // optional human aside, rendered publicly
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sponsorId: integer("sponsor_id").references(() => sponsors.id),
  },
  (t) => [
    index("items_status_published_idx").on(t.status, t.publishedAt),
    index("items_categories_idx").using("gin", t.categories),
  ],
);

export const itemEntities = pgTable(
  "item_entities",
  {
    itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.entityId] })],
);

// ---------------------------------------------------------------------------
// Weekly digest
// ---------------------------------------------------------------------------
export const digests = pgTable("digests", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull().unique(),
  title: text("title").notNull(),
  intro: text("intro"), // human-written, never generated
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const digestItems = pgTable(
  "digest_items",
  {
    digestId: integer("digest_id").notNull().references(() => digests.id, { onDelete: "cascade" }),
    itemId: integer("item_id").notNull().references(() => items.id),
    section: text("section").notNull(), // "Top of the week", "Releases", "Case notes", ...
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.digestId, t.itemId] })],
);
