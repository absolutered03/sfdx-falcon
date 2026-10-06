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
              <tbody>
                {list.map((e) => (
                  <tr key={e.slug}>
                    <td style={{ width: "30%" }}><a href={`/tools/${e.slug}`}>{e.name}</a></td>
                    <td>{e.description}</td>
                    <td style={{ width: "18%", color: "var(--muted)" }}>{e.governance ?? e.license}</td>
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
