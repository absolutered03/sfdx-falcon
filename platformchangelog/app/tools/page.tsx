import { getEntityList } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registry" };

export default async function Tools() {
  const all = await getEntityList();
  return (
    <>
      <h1 style={{ fontSize: 22 }}>Registry</h1>
      <p>Tools, platforms, MCP servers and recurring reports we track, with release history and case notes.</p>
      {CATEGORIES.map((c) => {
        const list = all.filter((e) => e.categories[0] === c);
        if (!list.length) return null;
        return (
          <section key={c}>
            <h2 style={{ fontSize: 18 }}>{CATEGORY_LABELS[c]}</h2>
            <table>
              <thead>
                <tr><th>Tool</th><th>What it is</th><th>Current</th><th>Governance</th></tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.slug}>
                    <td style={{ width: "26%" }}><a href={`/tools/${e.slug}`}>{e.name}</a></td>
                    <td>{e.description}</td>
                    <td style={{ width: "16%", whiteSpace: "nowrap" }}>
                      {e.current ? (
                        <>
                          <a href={e.current.url} rel="noopener nofollow">{e.current.version}</a>
                          <div style={{ color: "var(--muted)", fontSize: 12 }}>{e.current.publishedAt.toISOString().slice(0, 10)}</div>
                        </>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>{e.license === "commercial" ? "SaaS" : "n/a"}</span>
                      )}
                    </td>
                    <td style={{ width: "16%", color: "var(--muted)" }}>{e.governance ?? e.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}
