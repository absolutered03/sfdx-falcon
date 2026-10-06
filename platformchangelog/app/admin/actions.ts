"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db/client";
import { isAuthorized } from "@/lib/auth";
import { canonicalUrl, sha256, stripHtml, EXCERPT_LIMIT } from "@/ingest/normalize";
import { CATEGORIES, IMPACTS, ITEM_KINDS, type Category, type Impact, type ItemKind } from "@/lib/taxonomy";

async function assertAdmin() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Publish an item with whatever the editor changed. This is the only path to "approved". */
export async function approveItem(fd: FormData) {
  await assertAdmin();
  const db = getDb();
  const id = Number(str(fd, "id"));
  const categories = fd.getAll("categories").map(String).filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  const impact = str(fd, "impact") as Impact;
  const kind = str(fd, "kind") as ItemKind;
  if (!IMPACTS.includes(impact) || !ITEM_KINDS.includes(kind)) throw new Error("bad impact or kind");
  if (!str(fd, "summary") || !str(fd, "platformImpact")) throw new Error("summary and platform impact are required");

  await db.update(schema.items).set({
    status: "approved",
    summary: str(fd, "summary"),
    platformImpact: str(fd, "platformImpact"),
    editorNote: str(fd, "editorNote") || null,
    impact,
    kind,
    categories,
    reviewedAt: new Date(),
  }).where(eq(schema.items.id, id));

  // Replace entity links with what the editor typed (comma-separated slugs).
  const slugs = str(fd, "entities").split(",").map((s) => s.trim()).filter(Boolean);
  await db.delete(schema.itemEntities).where(eq(schema.itemEntities.itemId, id));
  if (slugs.length) {
    const ents = await db.select({ id: schema.entities.id }).from(schema.entities).where(inArray(schema.entities.slug, slugs));
    if (ents.length) await db.insert(schema.itemEntities).values(ents.map((e) => ({ itemId: id, entityId: e.id })));
  }
  revalidatePath("/admin");
}

export async function rejectItem(fd: FormData) {
  await assertAdmin();
  await getDb().update(schema.items)
    .set({ status: "rejected", reviewedAt: new Date(), statusReason: `editor: ${str(fd, "reason") || "rejected"}` })
    .where(eq(schema.items.id, Number(str(fd, "id"))));
  revalidatePath("/admin");
}

/** For reports, postmortems and case studies found outside the feeds. The next ingest run drafts it. */
export async function addManualItem(fd: FormData) {
  await assertAdmin();
  const excerpt = stripHtml(str(fd, "excerpt")).slice(0, EXCERPT_LIMIT);
  await getDb().insert(schema.items).values({
    url: canonicalUrl(str(fd, "url")),
    title: str(fd, "title"),
    publishedAt: new Date(str(fd, "publishedAt") || Date.now()),
    excerpt,
    contentHash: sha256(excerpt),
    status: "pending_llm",
    statusReason: "added by editor",
  }).onConflictDoNothing({ target: schema.items.url });
  revalidatePath("/admin");
}
