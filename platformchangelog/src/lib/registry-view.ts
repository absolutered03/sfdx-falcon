import type { ToolRow } from "@/components/ToolList";
import { getEntityList } from "./queries";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "./taxonomy";

/** Rows and category groups for the registry's tools pane. */
export async function getToolPane() {
  const list = await getEntityList();
  const tools: ToolRow[] = list.map((e) => {
    const cat = (e.categories[0] ?? "reports") as Category;
    return {
      slug: e.slug,
      name: e.name,
      kind: e.kind,
      vendor: e.vendor,
      category: cat,
      version: e.current?.version ?? null,
      search: `${e.name} ${e.slug} ${e.vendor ?? ""} ${CATEGORY_LABELS[cat] ?? ""} ${e.description}`.toLowerCase(),
    };
  });
  const groups = CATEGORIES.filter((c) => tools.some((t) => t.category === c)).map((c) => [c, CATEGORY_LABELS[c]] as [string, string]);
  return { list, tools, groups };
}
