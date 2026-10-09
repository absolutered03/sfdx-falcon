// Read models for /admin/insights and /admin/tools.
import { sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";

const rows = async <T>(q: ReturnType<typeof sql>) => (await getDb().execute(q)) as unknown as T[];
const since = (days: number) => sql`now() - make_interval(days => ${days})`;

export async function getInsights(days: number) {
  const s = since(days);
  const [totals] = await rows<{ views: number; sessions: number; median_sec: number | null; searches: number; outbound: number }>(sql`
    select
      (select count(*)::int from events where type = 'pageview' and at > ${s}) as views,
      (select count(distinct session_id)::int from events where type = 'pageview' and at > ${s}) as sessions,
      (select round((percentile_cont(0.5) within group (order by duration_ms) / 1000)::numeric, 1)::float from events where type = 'engagement' and at > ${s}) as median_sec,
      (select count(*)::int from events where type = 'search' and at > ${s}) as searches,
      (select count(*)::int from events where type = 'outbound' and at > ${s}) as outbound`);

  const pages = await rows<{ path: string; views: number; avg_sec: number | null }>(sql`
    select v.path, v.views, round((e.avg_ms / 1000)::numeric, 1)::float as avg_sec
    from (select path, count(*)::int as views from events where type = 'pageview' and at > ${s} group by path) v
    left join (select path, avg(duration_ms) as avg_ms from events where type = 'engagement' and at > ${s} group by path) e using (path)
    order by v.views desc limit 25`);

  const terms = (type: "search" | "filter") => rows<{ query: string; n: number; zero: number; avg_results: number; last: string }>(sql`
    select query, count(*)::int as n, count(*) filter (where result_count = 0)::int as zero,
           round(avg(result_count)::numeric, 1)::float as avg_results, max(at)::date::text as last
    from events where type = ${type} and at > ${s} and query is not null
    group by query order by n desc limit 30`);

  const outbound = await rows<{ entity_slug: string | null; target_host: string; n: number }>(sql`
    select entity_slug, target_host, count(*)::int as n
    from events where type = 'outbound' and at > ${s}
    group by entity_slug, target_host order by n desc limit 30`);

  return { totals, pages, searches: await terms("search"), filters: await terms("filter"), outbound };
}

export type Suggestion = {
  term: string;
  searches: number;
  filters: number;
  last: string;
  match: { kind: "untracked" | "hidden"; slug: string; name: string } | null;
};

/**
 * What people looked for and did not get, from the last 90 days of searches and
 * registry filters, most frequent first:
 *   - terms that matched no public tool at all, and
 *   - terms that name an untracked or not-yet-public tool, even when other tools
 *     matched ("helm" also hits Flux, whose description mentions Helm).
 * Dismissed terms and terms a public tool now answers are left out.
 */
export async function getSuggestions(): Promise<Suggestion[]> {
  const db = getDb();
  const terms = await rows<{ term: string; searches: number; filters: number; zero: number; last: string }>(sql`
    select query as term,
           count(*) filter (where type = 'search')::int as searches,
           count(*) filter (where type = 'filter')::int as filters,
           count(*) filter (where result_count = 0)::int as zero,
           max(at)::date::text as last
    from events
    where type in ('search', 'filter') and at > now() - interval '90 days'
      and query is not null and length(query) >= 2
      and query not in (select term from dismissed_terms)
    group by query
    order by count(*) desc, max(at) desc
    limit 200`);

  const ents = await db
    .select({ slug: schema.entities.slug, name: schema.entities.name, vendor: schema.entities.vendor, description: schema.entities.description, tracked: schema.entities.tracked })
    .from(schema.entities);
  const visible = new Set((await getVisibleSlugs()).map((r) => r.slug));
  const words = (t: string) => t.split(" ").filter((w) => w.length >= 2 && !/^v?\d+(\.\d+)*$/.test(w));

  const out: Suggestion[] = [];
  for (const t of terms) {
    const w = words(t.term);
    if (!w.length) continue;
    // A tool named by the term itself (name or slug contains every word).
    const named = ents.find((e) => w.every((x) => `${e.name} ${e.slug}`.toLowerCase().includes(x)));
    // Any tool the term matches, including by description, as site search does.
    const anyHit = ents.find((e) => w.every((x) => `${e.name} ${e.slug} ${e.vendor ?? ""} ${e.description}`.toLowerCase().includes(x)));
    const notPublic = (e?: (typeof ents)[number]) => !!e && !(e.tracked && visible.has(e.slug));

    let match: Suggestion["match"] = null;
    if (notPublic(named)) match = { kind: named!.tracked ? "hidden" : "untracked", slug: named!.slug, name: named!.name };
    else if (t.zero > 0 && !named && notPublic(anyHit)) match = { kind: anyHit!.tracked ? "hidden" : "untracked", slug: anyHit!.slug, name: anyHit!.name };

    const missed = match !== null || (t.zero > 0 && !named && !anyHit);
    if (missed) out.push({ term: t.term, searches: t.searches, filters: t.filters, last: t.last, match });
    if (out.length >= 50) break;
  }
  return out;
}

async function getVisibleSlugs() {
  return rows<{ slug: string }>(sql`
    select e.slug from entities e
    where e.tracked and (coalesce(e.practical_notes, '') <> '' or exists (
      select 1 from item_entities ie join items i on i.id = ie.item_id
      where ie.entity_id = e.id and (i.status = 'approved' or (i.kind = 'release' and i.status <> 'out_of_scope'))))`);
}

export type AdminTool = {
  slug: string; name: string; kind: string; category: string | null; tracked: boolean; visible: boolean;
  sources: number; active_sources: number; releases: number; last_fetched: string | null; last_error: string | null;
};

export async function getAllTools(): Promise<AdminTool[]> {
  return rows<AdminTool>(sql`
    select e.slug, e.name, e.kind::text, e.categories[1]::text as category, e.tracked,
           (e.tracked and (coalesce(e.practical_notes, '') <> '' or exists (
             select 1 from item_entities ie join items i on i.id = ie.item_id
             where ie.entity_id = e.id and (i.status = 'approved' or (i.kind = 'release' and i.status <> 'out_of_scope'))))) as visible,
           (select count(*)::int from sources s where s.entity_slug = e.slug) as sources,
           (select count(*)::int from sources s where s.entity_slug = e.slug and s.active) as active_sources,
           (select count(*)::int from item_entities ie join items i on i.id = ie.item_id where ie.entity_id = e.id and i.kind = 'release' and i.status <> 'out_of_scope') as releases,
           (select max(s.last_fetched_at)::date::text from sources s where s.entity_slug = e.slug) as last_fetched,
           (select string_agg(s.slug || ': ' || s.last_error, '; ') from sources s where s.entity_slug = e.slug and s.last_error is not null) as last_error
    from entities e
    order by e.tracked desc, e.name`);
}
