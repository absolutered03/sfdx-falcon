import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeList, Flags, StatBar } from "@/components/ChangeList";
import { Pane } from "@/components/shell/Pane";
import { ToolList } from "@/components/ToolList";
import { getEntityPage, getPlacement } from "@/lib/queries";
import { getToolPane } from "@/lib/registry-view";
import { CATEGORY_LABELS, type Category } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const FULL_RELEASES = 12; // newest releases get the full change list; older ones one row each
const anchor = (v: string | null) => (v ? `v${v.replace(/^v/i, "")}` : undefined);

export async function generateMetadata({ params }: { params: Params }) {
  const data = await getEntityPage((await params).slug);
  return data ? { title: `${data.entity.name}: releases, alternatives and case notes`, description: data.entity.description } : {};
}

export default async function ToolPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, pane] = await Promise.all([getEntityPage(slug), getToolPane()]);
  if (!data) notFound();
  const { entity, current, releases, kinds, caseNotes, coverage, alternatives } = data;
  const ad = await getPlacement("entity_sidebar", { entitySlug: slug });

  const lineList = [...new Set(releases.map((r) => (r.item.version ?? "").replace(/^v/i, "").split(".").slice(0, 2).join(".")).filter(Boolean))];
  const releaseTitle = (title: string, version: string | null) => {
    const v = (version ?? "").replace(/^v/i, "").replace(/\./g, "\\.");
    const s = title
      .replace(new RegExp(`^${entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
      .replace(new RegExp(`^v?${v}\\s*[:\\-]?\\s*`, "i"), "")
      .trim();
    return /^release notes$/i.test(s) ? "" : s;
  };

  return (
    <div className="ws ws-registry m-detail" data-entity={entity.slug}>
      <section className="pane p-tools">
        <div className="ph"><span className="pt">tools</span><span className="pn">{pane.tools.length}</span><span className="sp" /><span className="hint"><kbd>j</kbd> <kbd>k</kbd> move <kbd>f</kbd> filter</span></div>
        <ToolList tools={pane.tools} groups={pane.groups} current={entity.slug} />
      </section>

      <Pane className="p-tool" title={<><Link className="back" href="/tools">&lsaquo; tools</Link> {entity.slug}</>} right={<span className="pn">{entity.kind.replace("_", " ")}</span>}>
        <div className="th">
          <div className="th-top">
            <h1>{entity.name}</h1>
            {current && <span className="cur"><b>{current.version}</b><span>current &middot; {fmt(current.publishedAt)}</span></span>}
          </div>
          <p className="sans">{entity.description}</p>
          <div className="meta">
            {entity.governance && <><span><span className="k">governance</span> {entity.governance}</span><span className="dot">&middot;</span></>}
            {entity.license && <span><span className="k">license</span> {entity.license.replace("_", " ")}</span>}
            {entity.vendor && <><span className="dot">&middot;</span><span><span className="k">vendor</span> {entity.vendor}</span></>}
          </div>
          <div className="tags">
            <span className="tag kind">{entity.kind.replace("_", " ")}</span>
            {entity.categories.map((c) => <span key={c} className="tag">{CATEGORY_LABELS[c as Category]}</span>)}
          </div>
          {lineList.length > 1 && (
            <div className="lines"><span>release lines seen</span>{lineList.slice(0, 8).map((l) => <code key={l}>{l}</code>)}</div>
          )}
          <div className="links">
            {entity.homepageUrl && <a href={entity.homepageUrl} target="_blank" rel="noopener">homepage</a>}
            {entity.repoUrl && <a href={entity.repoUrl} target="_blank" rel="noopener">repository</a>}
            {current && <a href={current.url} target="_blank" rel="noopener nofollow">latest release</a>}
          </div>
          {entity.practicalNotes && (
            <div className="practical">
              <h2>practical notes</h2>
              {/* Human-written. Rendered as plain paragraphs. */}
              {entity.practicalNotes.split(/\n{2,}/).map((p, i) => <p key={i} className="sans">{p}</p>)}
            </div>
          )}
        </div>
      </Pane>

      <Pane className="p-alts" title="alternatives" count={alternatives.length || undefined}>
        {alternatives.length === 0 && <div className="empty">No alternatives recorded for {entity.name} yet.</div>}
        {alternatives.map((a) => (
          <div key={a.slug} className="alt">
            <div className="an"><Link href={`/tools/${a.slug}`}><b>{a.name}</b></Link>{a.current ? <span className="tv">{a.current.version}</span> : <span className="nt">no release recorded</span>}</div>
            <p className="sans">{a.note}</p>
          </div>
        ))}
        {(caseNotes.length > 0 || coverage.length > 0) && (
          <>
            {caseNotes.length > 0 && <div className="section-t">case notes and incidents</div>}
            {caseNotes.map(({ item, sourceName }) => (
              <div key={item.id} className="note">
                <a href={item.url} target="_blank" rel="noopener nofollow">{item.title}</a> <span style={{ color: "var(--mute)" }}>({sourceName}, {fmt(item.publishedAt)})</span>
                {item.platformImpact && <div>{item.platformImpact}</div>}
              </div>
            ))}
            {coverage.length > 0 && <div className="section-t">other coverage</div>}
            {coverage.slice(0, 20).map(({ item, sourceName }) => (
              <div key={item.id} className="note">
                <a href={item.url} target="_blank" rel="noopener nofollow">{item.title}</a> <span style={{ color: "var(--mute)" }}>({sourceName}, {fmt(item.publishedAt)})</span>
              </div>
            ))}
          </>
        )}
        {caseNotes.length === 0 && <div className="note" style={{ color: "var(--mute)" }}>No case notes yet. Know of a public postmortem or case study? Tell us.</div>}
        {ad && (
          <div className="sponsor">
            <span className="fl">sponsored</span> {ad.sponsorName}: <a href={ad.placement.url} rel="sponsored noopener">{ad.placement.title}</a>
            <div className="sans">{ad.placement.body}</div>
          </div>
        )}
      </Pane>

      <Pane className="p-rel" title="releases" count={releases.length} right={<span className="ex">change lines typed from the source notes</span>}>
        {releases.length === 0 && <div className="empty">No releases recorded yet.</div>}
        {releases.slice(0, FULL_RELEASES).map(({ item }) => {
          const kind = kinds.get(item.id) ?? "patch";
          const title = releaseTitle(item.title, item.version);
          return (
            <article key={item.id} className={`rel k-${kind}`} id={anchor(item.version)} data-v={item.version ?? undefined}>
              <div className="rh">
                <span className="v">{item.version ?? "release"}</span>
                <span className="d">{fmt(item.publishedAt)}</span>
                <span className="kd">{kind}</span>
                {item.status === "approved" && item.impact === "major" && <span className="fl brk" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>major</span>}
                <Flags lines={item.changes} />
                <StatBar lines={item.changes} />
                <a className="src" href={item.url} target="_blank" rel="noopener nofollow">source</a>
              </div>
              {title && <p className="rt">{title}</p>}
              {item.status === "approved" && item.summary && <p className="sumry">{item.summary}</p>}
              {item.status === "approved" && item.platformImpact && <p className="sumry"><b className="kd" style={{ fontFamily: "var(--font-mono)" }}>platform teams </b>{item.platformImpact}</p>}
              {item.changes?.length ? (
                <ChangeList lines={item.changes} />
              ) : (
                <div className="quiet">No itemized notes. <a href={item.url} target="_blank" rel="noopener nofollow">Read the source</a>.</div>
              )}
            </article>
          );
        })}
        {releases.length > FULL_RELEASES && (
          <details className="more" style={{ padding: "8px 12px" }}>
            <summary>{releases.length - FULL_RELEASES} older releases</summary>
            <table className="older">
              <tbody>
                {releases.slice(FULL_RELEASES).map(({ item }) => (
                  <tr key={item.id} id={anchor(item.version)}>
                    <td><a href={item.url} target="_blank" rel="noopener nofollow">{item.version ?? "release"}</a></td>
                    <td style={{ color: "var(--mute)" }}>{fmt(item.publishedAt)}</td>
                    <td>{kinds.get(item.id) ?? ""}</td>
                    <td><Flags lines={item.changes} /> <StatBar lines={item.changes} /> <span style={{ color: "var(--mute)" }}>{item.changes?.length ? `${item.changes.length} lines` : "no itemized notes"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </Pane>
    </div>
  );
}
