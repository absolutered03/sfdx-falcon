"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db/client";
import { assertAdmin } from "@/lib/admin-guard";
import { normalizeQuery } from "@/lib/analytics";
import { CATEGORIES, type Category } from "@/lib/taxonomy";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Move a tool between tracked and known-but-untracked. Its feeds stop or resume on the next ingest. */
export async function setTracked(fd: FormData) {
  await assertAdmin();
  await getDb().update(schema.entities)
    .set({ tracked: str(fd, "tracked") === "true" })
    .where(eq(schema.entities.slug, str(fd, "slug")));
  revalidatePath("/admin/tools");
}

/** Hide a search term from suggestions for good (typos, people, non-tools). */
export async function dismissTerm(fd: FormData) {
  await assertAdmin();
  const term = normalizeQuery(str(fd, "term"));
  if (term) await getDb().insert(schema.dismissedTerms).values({ term }).onConflictDoNothing();
  revalidatePath("/admin/tools");
}

const KINDS = ["tool", "platform", "mcp_server", "report", "standard"] as const;

/**
 * Add a tool to the registry, tracked. With a GitHub repo it also gets a release
 * feed, so the next ingest gives it a current version and it becomes visible.
 * Saved in the database only; data/entities.json is not changed.
 */
export async function addTool(fd: FormData) {
  await assertAdmin();
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const kind = str(fd, "kind") as (typeof KINDS)[number];
  const category = str(fd, "category") as Category;
  const description = str(fd, "description");
  const githubRepo = str(fd, "githubRepo").replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  if (!name || !slug || !description) throw new Error("Name and description are required");
  if (!KINDS.includes(kind) || !(CATEGORIES as readonly string[]).includes(category)) throw new Error("Bad kind or category");
  if (githubRepo && !/^[\w.-]+\/[\w.-]+$/.test(githubRepo)) throw new Error("GitHub repo must look like owner/name");

  const db = getDb();
  await db.insert(schema.entities).values({
    slug,
    name,
    kind,
    categories: [category],
    description,
    homepageUrl: str(fd, "homepageUrl") || null,
    repoUrl: githubRepo ? `https://github.com/${githubRepo}` : str(fd, "repoUrl") || null,
    vendor: str(fd, "vendor") || null,
    tracked: true,
  }).onConflictDoUpdate({ target: schema.entities.slug, set: { tracked: true } });

  if (githubRepo) {
    await db.insert(schema.sources).values({
      slug: `gh-${slug}`,
      name: `${name} releases`,
      kind: "github_releases",
      tier: str(fd, "vendor") ? "vendor" : "primary",
      githubRepo,
      entitySlug: slug,
      defaultCategories: [category],
    }).onConflictDoNothing();
  }
  revalidatePath("/admin/tools");
}
