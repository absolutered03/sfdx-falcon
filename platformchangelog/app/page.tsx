import { ItemCard } from "@/components/ItemCard";
import { getFeed, getPlacement, type FeedFilters } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, IMPACTS, ITEM_KINDS, type Category } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const pick = <T extends string>(v: unknown, allowed: readonly T[]) =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f: FeedFilters = {
    category: pick(sp.category, CATEGORIES),
    impact: pick(sp.impact, IMPACTS),
    kind: pick(sp.kind, ITEM_KINDS),
  };
  const [rows, ad] = await Promise.all([getFeed(f), getPlacement("feed_inline", { category: f.category })]);

  const href = (patch: Partial<Record<keyof FeedFilters, string | undefined>>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <h1 style={{ fontSize: 22 }}>What shipped for platform teams</h1>
      <div className="filters">
        <a href={href({ category: undefined })} className={!f.category ? "on" : ""}>All</a>
        {CATEGORIES.map((c) => (
          <a key={c} href={href({ category: c })} className={f.category === c ? "on" : ""}>{CATEGORY_LABELS[c as Category]}</a>
        ))}
      </div>
      <div className="filters">
        <a href={href({ impact: f.impact === "major" ? undefined : "major" })} className={f.impact === "major" ? "on" : ""}>Major only</a>
        <a href={href({ kind: f.kind === "release" ? undefined : "release" })} className={f.kind === "release" ? "on" : ""}>Releases</a>
        <a href={href({ kind: f.kind === "case_study" ? undefined : "case_study" })} className={f.kind === "case_study" ? "on" : ""}>Case studies</a>
        <a href={href({ kind: f.kind === "incident" ? undefined : "incident" })} className={f.kind === "incident" ? "on" : ""}>Postmortems</a>
      </div>

      {rows.length === 0 && <p>Nothing here yet for this filter.</p>}
      {rows.map((row, i) => (
        <div key={row.item.id}>
          <ItemCard row={row} />
          {ad && i === 4 && (
            <article className="item">
              <div className="meta"><span className="tag sponsored">Sponsored</span><span>{ad.sponsorName}</span></div>
              <h3><a href={ad.placement.url} rel="sponsored noopener">{ad.placement.title}</a></h3>
              <p style={{ margin: "4px 0" }}>{ad.placement.body}</p>
            </article>
          )}
        </div>
      ))}
    </>
  );
}
