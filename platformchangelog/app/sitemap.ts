import type { MetadataRoute } from "next";
import { getEntityList } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";

// Tool pages are the search surface, so every registry entry is listed.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entities = await getEntityList();
  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/tools`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    ...entities.map((e) => ({
      url: `${SITE_URL}/tools/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
