import { headers } from "next/headers";
import Link from "next/link";
import { Pane } from "@/components/shell/Pane";
import { SIGIL, TOKEN } from "@/lib/release-view";
import { isBot, logEvent, normalizeQuery } from "@/lib/analytics";
import { searchSite } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search", robots: { index: false } };

type SP = Promise<{ q?: string | string[] }>;
const fmt = (d: Date) => new Date(d).toISOString().slice(0, 10);
const anchor = (v: string | null) => (v ? `#v${v.replace(/^v/i, "")}` : "");

// The full results page: where enter lands when nothing in the launcher is selected,
// and the no-JavaScript path. Logged server-side so the tool count is exact.
export default async function Search({ searchParams }: { searchParams: SP }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 200);
  const { tools, releases, changes, entries } = await searchSite(q);
  if (q.trim().length >= 2 && !isBot((await headers()).get("user-agent"))) {
    await logEvent({ type: "search", path: "/search", query: normalizeQuery(q), resultCount: tools.length });
  }
  const total = tools.length + releases.length + changes.length + entries.length;

  return (
    <div className="ws ws-single">
      <Pane title="search" count={q.trim().length >= 2 ? `${total} results for "${q}"` : undefined}>
        <form action="/search" className="filter">
          <label className="srlabel" htmlFor="search-page-q">Search</label>
          <input id="search-page-q" name="q" type="search" defaultValue={q} placeholder="search tools, versions, changes" />
        </form>
        {q.trim().length < 2 && <div className="rempty">Type at least two characters.</div>}
        {q.trim().length >= 2 && (
          <>
            <div className="rgroup">tools {tools.length}</div>
            {tools.length === 0 && <div className="rempty">No tracked tool matches &quot;{q}&quot;. We log searches like this to decide what to cover next.</div>}
            {tools.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="rrow"><span className="rk">tool</span><span className="rt">{t.name} <span className="rm">{t.current?.version}</span><br /><span className="rm">{t.description}</span></span></Link>
            ))}
            {releases.length > 0 && <div className="rgroup">releases {releases.length}</div>}
            {releases.map((r) => (
              <Link key={r.item.id} href={`/tools/${r.slug}${anchor(r.item.version)}`} className="rrow"><span className="rk">release</span><span className="rt">{r.name} {r.item.version}<br /><span className="rm">{fmt(r.item.publishedAt)}</span></span></Link>
            ))}
            {changes.length > 0 && <div className="rgroup">change lines {changes.length}</div>}
            {changes.map((c, i) => (
              <Link key={i} href={`/tools/${c.slug}${anchor(c.version)}`} className="rrow">
                <span className="rk">change</span>
                <span className="rt"><span className="sg" style={{ color: TOKEN[c.type] ? `var(--${TOKEN[c.type]})` : "var(--mute)" }}>{c.breaking ? "!" : SIGIL[c.type]}</span>{c.text}<br /><span className="rm">{c.name} {c.version} &middot; {c.type}</span></span>
              </Link>
            ))}
            {entries.length > 0 && <div className="rgroup">entries {entries.length}</div>}
            {entries.map((e) => (
              <a key={e.item.id} href={e.item.url} target="_blank" rel="noopener nofollow" className="rrow"><span className="rk">entry</span><span className="rt">{e.item.title}<br /><span className="rm">{fmt(e.item.publishedAt)}</span></span></a>
            ))}
          </>
        )}
      </Pane>
    </div>
  );
}
