import { getInsights } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights", robots: { index: false } };

type SP = Promise<{ days?: string }>;

export default async function Insights({ searchParams }: { searchParams: SP }) {
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const { totals, pages, searches, filters, outbound } = await getInsights(days);
  const zeroSearches = searches.filter((s) => s.zero > 0);

  return (
    <>
      <h1 style={{ fontSize: 22 }}>Insights, last {days} days</h1>
      <div className="filters">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`/admin/insights?days=${d}`} className={d === days ? "on" : ""}>{d} days</a>
        ))}
      </div>
      <p className="meta">
        First-party events only: no cookies, no IP addresses, deleted after 180 days. Referrers, countries and devices
        live in Cloudflare Web Analytics.
      </p>

      <table>
        <tbody>
          <tr><th>Page views</th><td>{totals.views}</td><th>Visits</th><td>{totals.sessions}</td></tr>
          <tr><th>Median time on page</th><td>{totals.median_sec ?? "n/a"}{totals.median_sec !== null ? " s" : ""}</td><th>Searches</th><td>{totals.searches}</td></tr>
          <tr><th>Outbound clicks</th><td>{totals.outbound}</td><th></th><td></td></tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 18 }}>Searches that found no tool ({zeroSearches.length})</h2>
      <p className="meta">Add or re-track these from <a href="/admin/tools">Tools</a>.</p>
      <TermTable rows={zeroSearches} />

      <h2 style={{ fontSize: 18 }}>Top searches</h2>
      <TermTable rows={searches} />

      <h2 style={{ fontSize: 18 }}>Registry filters</h2>
      <TermTable rows={filters} />

      <h2 style={{ fontSize: 18 }}>Outbound clicks</h2>
      {outbound.length === 0 ? <p>None yet.</p> : (
        <table>
          <thead><tr><th>Tool</th><th>Went to</th><th>Clicks</th></tr></thead>
          <tbody>
            {outbound.map((o, i) => (
              <tr key={i}><td>{o.entity_slug ?? "none"}</td><td>{o.target_host}</td><td>{o.n}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 18 }}>Pages</h2>
      {pages.length === 0 ? <p>None yet.</p> : (
        <table>
          <thead><tr><th>Page</th><th>Views</th><th>Avg time on page</th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.path}><td>{p.path}</td><td>{p.views}</td><td>{p.avg_sec !== null ? `${p.avg_sec} s` : "n/a"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function TermTable({ rows }: { rows: { query: string; n: number; zero: number; avg_results: number; last: string }[] }) {
  if (!rows.length) return <p>None yet.</p>;
  return (
    <table>
      <thead><tr><th>Term</th><th>Times</th><th>Found nothing</th><th>Avg matches</th><th>Last</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.query}><td>{r.query}</td><td>{r.n}</td><td>{r.zero}</td><td>{r.avg_results}</td><td>{r.last}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
