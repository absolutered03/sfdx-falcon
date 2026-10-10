import { notFound } from "next/navigation";
import { ChangeList, DiffStat } from "@/components/ChangeList";
import { getEntityPage, getPlacement } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const FULL_RELEASES = 12; // newest releases get the full change list; older ones a one-line diffstat

export async function generateMetadata({ params }: { params: Params }) {
  const data = await getEntityPage((await params).slug);
  return data ? { title: `${data.entity.name}: releases, alternatives and case notes`, description: data.entity.description } : {};
}

export default async function ToolPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await getEntityPage(slug);
  if (!data) notFound();
  const { entity, current, releases, caseNotes, coverage, alternatives } = data;
  const ad = await getPlacement("entity_sidebar", { entitySlug: slug });

  return (
    <div data-entity={entity.slug}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{entity.name}</h1>
      <div className="meta">
        <span>{entity.kind.replace("_", " ")}</span>
        {current && (
          <span>
            Current: <a href={current.url} rel="noopener nofollow">{current.version}</a> ({current.publishedAt.toISOString().slice(0, 10)})
          </span>
        )}
        {entity.governance && <span>{entity.governance}</span>}
        {entity.vendor && <span>Vendor: {entity.vendor}</span>}
        {entity.homepageUrl && <a href={entity.homepageUrl} rel="noopener">Site</a>}
        {entity.repoUrl && <a href={entity.repoUrl} rel="noopener">Repo</a>}
      </div>
      <p>{entity.description}</p>

      {entity.practicalNotes && (
        <section>
          <h2 style={{ fontSize: 18 }}>Practical notes</h2>
          {/* Human-written. Rendered as plain paragraphs; add a markdown renderer later if needed. */}
          {entity.practicalNotes.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18 }}>Release history</h2>
        {releases.length === 0 && <p>No releases recorded yet.</p>}
        {releases.slice(0, FULL_RELEASES).map(({ item }) => (
          <div key={item.id} className="release" id={item.version ? `v${item.version.replace(/^v/i, "")}` : undefined}>
            <div className="release-head">
              <a href={item.url} rel="noopener nofollow" className="ver">{item.version ?? "release"}</a>
              <span>{fmt(item.publishedAt)}</span>
              {item.impact === "major" && <span className="tag major">major</span>}
            </div>
            {item.status === "approved" && (item.platformImpact ?? item.summary) && <p className="impact">{item.platformImpact ?? item.summary}</p>}
            {item.changes?.length ? (
              <ChangeList lines={item.changes} sourceUrl={item.url} />
            ) : (
              <p className="meta">{item.status === "logged" ? "No itemized notes; see the release page." : ""}</p>
            )}
          </div>
        ))}
        {releases.length > FULL_RELEASES && (
          <details>
            <summary>{releases.length - FULL_RELEASES} older releases</summary>
            <table>
              <tbody>
                {releases.slice(FULL_RELEASES).map(({ item }) => (
                  <tr key={item.id} id={item.version ? `v${item.version.replace(/^v/i, "")}` : undefined}>
                    <td style={{ width: 100 }}>{fmt(item.publishedAt)}</td>
                    <td style={{ width: 90 }}><a href={item.url} rel="noopener nofollow">{item.version ?? "release"}</a></td>
                    <td>{item.changes?.length ? <DiffStat lines={item.changes} /> : <span className="meta">No itemized notes</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18 }}>Alternatives</h2>
        {alternatives.length === 0 ? <p>None recorded yet.</p> : (
          <table>
            <tbody>
              {alternatives.map((a) => (
                <tr key={a.slug}>
                  <td style={{ width: "30%" }}><a href={`/tools/${a.slug}`}>{a.name}</a></td>
                  <td>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18 }}>Case notes and incidents</h2>
        {caseNotes.length === 0 ? <p>None yet. Know of a public postmortem or case study? Tell us.</p> : (
          <ul>
            {caseNotes.map(({ item, sourceName }) => (
              <li key={item.id}>
                <a href={item.url} rel="noopener nofollow">{item.title}</a> ({sourceName}, {fmt(item.publishedAt)}). {item.platformImpact}
              </li>
            ))}
          </ul>
        )}
      </section>

      {coverage.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18 }}>Other coverage</h2>
          <ul>
            {coverage.slice(0, 20).map(({ item, sourceName }) => (
              <li key={item.id}><a href={item.url} rel="noopener nofollow">{item.title}</a> ({sourceName}, {fmt(item.publishedAt)})</li>
            ))}
          </ul>
        </section>
      )}

      {ad && (
        <aside className="item">
          <div className="meta"><span className="tag sponsored">Sponsored</span><span>{ad.sponsorName}</span></div>
          <a href={ad.placement.url} rel="sponsored noopener">{ad.placement.title}</a>
          <p style={{ margin: "4px 0" }}>{ad.placement.body}</p>
        </aside>
      )}
    </div>
  );
}
