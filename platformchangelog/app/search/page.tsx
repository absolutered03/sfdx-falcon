import { headers } from "next/headers";
import { isBot, logEvent, normalizeQuery } from "@/lib/analytics";
import { searchSite } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search", robots: { index: false } };

type SP = Promise<{ q?: string | string[] }>;

export default async function Search({ searchParams }: { searchParams: SP }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 200);
  const { tools, releases, entries } = await searchSite(q);

  // Logged server-side so the result count is exact. resultCount is the number of
  // matching tools: a search that finds no tool is the "people want this" signal.
  if (q.trim().length >= 2 && !isBot((await headers()).get("user-agent"))) {
    await logEvent({ type: "search", path: "/search", query: normalizeQuery(q), resultCount: tools.length });
  }

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return (
    <>
      <h1 style={{ fontSize: 22 }}>Search</h1>
      <form action="/search" role="search" className="registry-filter">
        <label htmlFor="search-page-q" className="sr-only">Search</label>
        <input id="search-page-q" name="q" type="search" defaultValue={q} placeholder="Search tools and releases" />
      </form>
      {q.trim().length < 2 ? (
        <p>Type at least two characters.</p>
      ) : (
        <>
          <h2 style={{ fontSize: 18 }}>Tools ({tools.length})</h2>
          {tools.length === 0 ? (
            <p>
              No tracked tool matches &quot;{q}&quot;. We log searches like this to decide what to cover next.
            </p>
          ) : (
            <ul>
              {tools.map((t) => (
                <li key={t.slug}>
                  <a href={`/tools/${t.slug}`}>{t.name}</a>
                  {t.current && <span className="meta"> {t.current.version}</span>} <span style={{ color: "var(--muted)" }}>{t.description}</span>
                </li>
              ))}
            </ul>
          )}
          {releases.length > 0 && (
            <>
              <h2 style={{ fontSize: 18 }}>Releases ({releases.length})</h2>
              <ul>
                {releases.map((r) => (
                  <li key={r.item.id}>
                    <a href={`/tools/${r.slug}`}>{r.item.title}</a> <span className="meta">{fmt(r.item.publishedAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {entries.length > 0 && (
            <>
              <h2 style={{ fontSize: 18 }}>Entries ({entries.length})</h2>
              <ul>
                {entries.map((e) => (
                  <li key={e.item.id}>
                    <a href={e.item.url} rel="noopener nofollow">{e.item.title}</a> <span className="meta">{fmt(e.item.publishedAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
