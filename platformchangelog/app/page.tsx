import Link from "next/link";
import { Flags, StatBar } from "@/components/ChangeList";
import { Pane } from "@/components/shell/Pane";
import { getPlacement, getStats, getStream, type StreamFilters, type StreamRow } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, IMPACTS, ITEM_KINDS, type Category } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const pick = <T extends string>(v: unknown, allowed: readonly T[]) =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const day = (d: Date) => d.toISOString().slice(0, 10);

function ago(d: string) {
  const n = Math.round((Date.parse(day(new Date())) - Date.parse(d)) / 86_400_000);
  if (n <= 0) return "today";
  if (n === 1) return "1 day ago";
  if (n < 30) return `${n} days ago`;
  if (n < 60) return "1 month ago";
  return `${Math.round(n / 30)} months ago`;
}

// "Kyverno v1.19.0: Bump version" -> "Bump version"; a bare version or tool name -> "".
function releaseTitle(row: Extract<StreamRow, { type: "release" }>) {
  const v = (row.item.version ?? "").replace(/^v/i, "");
  const s = row.item.title
    .replace(new RegExp(`^${row.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .replace(new RegExp(`^v?${v.replace(/\./g, "\\.")}\\s*[:\\-]?\\s*`, "i"), "")
    .trim();
  return /^release notes$/i.test(s) ? "" : s;
}

const TYPES = [
  ["added", "+", "New functionality."],
  ["changed", "~", "Existing behavior changed."],
  ["deprecated", "-", "Still works, scheduled for removal."],
  ["removed", "-", "Decommissioned, gone in this version."],
  ["fixed", "*", "A defect corrected."],
  ["security", "!", "A vulnerability closed or a dependency patched for one."],
] as const;

export default async function Feed({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f: StreamFilters = {
    category: pick(sp.category, CATEGORIES),
    impact: pick(sp.impact, IMPACTS),
    kind: pick(sp.kind, ITEM_KINDS),
    all: sp.show === "all",
  };
  const [rows, stats, ad] = await Promise.all([getStream(f), getStats(), getPlacement("feed_inline", { category: f.category })]);

  const href = (patch: Partial<Record<"category" | "impact" | "kind" | "show", string | undefined>>) => {
    const cur = { category: f.category, impact: f.impact, kind: f.kind, show: f.all ? "all" : undefined, ...patch };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(cur)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };
  const chip = (label: string, to: string, on: boolean) => <Link key={label} href={to} className={`chipl${on ? " on" : ""}`}>{label}</Link>;

  let lastDay = "";
  return (
    <div className="ws ws-feed">
      <Pane
        title="feed"
        count={rows.length}
        className="p-stream"
        right={<span className="ex">{f.all ? "all releases, patches included" : "patches hidden unless security or breaking"}</span>}
      >
        {rows.length === 0 && <div className="empty"><b>Nothing here for this filter.</b> Clear the filters to see every release and entry.</div>}
        {rows.map((row, i) => {
          const d = day(row.item.publishedAt);
          const header = d !== lastDay ? <div className="dg"><span>{d}</span><span className="ago">{ago(d)}</span></div> : null;
          lastDay = d;
          const sponsor = ad && i === 4 && (
            <div className="sponsor">
              <span className="fl">sponsored</span> {ad.sponsorName}: <a href={ad.placement.url} rel="sponsored noopener">{ad.placement.title}</a>
              <div className="sans">{ad.placement.body}</div>
            </div>
          );
          if (row.type === "release") {
            const title = releaseTitle(row);
            const published = row.item.status === "approved";
            return (
              <div key={row.item.id}>
                {header}
                <Link className={`frow k-${row.kind}`} href={`/tools/${row.slug}#v${(row.item.version ?? "").replace(/^v/i, "")}`} data-entity={row.slug}>
                  <span className="f1">
                    <span className="fn">{row.name}</span>
                    <span className="fv">{row.item.version}</span>
                    <span className="kd">{row.kind}</span>
                    {published && row.item.impact === "major" && <span className="fl maj">major</span>}
                  </span>
                  <span className="f2"><Flags lines={row.item.changes} /><StatBar lines={row.item.changes} /></span>
                  {title && <span className="ft">{title}</span>}
                  {published && row.item.platformImpact && <span className="fp"><b>platform teams</b>{row.item.platformImpact}</span>}
                </Link>
                {sponsor}
              </div>
            );
          }
          const e = row.item;
          return (
            <div key={e.id}>
              {header}
              <article className="frow k-entry" data-entity={row.entities[0]?.slug}>
                <span className="f1">
                  <a className="fn" href={e.url} rel="noopener nofollow" target="_blank">{e.title}</a>
                </span>
                <span className="f2">
                  {e.impact === "major" && <span className="fl maj">major</span>}
                  <span className="kd">{e.kind.replace("_", " ")}</span>
                </span>
                {e.summary && <span className="fs">{e.summary}</span>}
                {e.platformImpact && <span className="fp"><b>platform teams</b>{e.platformImpact}</span>}
                <span className="fe">
                  <span className="src">{row.sourceName ?? "editor"}</span>
                  {row.entities.map((x) => <Link key={x.slug} href={`/tools/${x.slug}`}>{x.name}</Link>)}
                </span>
                {e.editorNote && <span className="fp"><b>editor</b>{e.editorNote}</span>}
              </article>
              {sponsor}
            </div>
          );
        })}
      </Pane>

      <Pane title="status" className="p-stats" right={<span className="pn">last 30 days for lines</span>}>
        <div className="stats">
          <span className="k">tools tracked</span><span className="v">{stats.tools}</span>
          <span className="k">releases in registry</span><span className="v">{stats.releases}</span>
          <span className="k">released in the last 30 days</span><span className="v">{stats.recent}</span>
          <span className="k">entries published</span><span className="v">{stats.published}</span>
          <span className="k">breaking change lines</span><span className="v brk">{stats.breaking}</span>
          <span className="k">security lines</span><span className="v sec">{stats.security}</span>
        </div>
      </Pane>

      <Pane title="change types" className="p-legend" right={<span className="pn">two-column gutter, like git status</span>}>
        <ul className="legend">
          {TYPES.map(([k, sg, ds]) => <li key={k} className={`t-${k}`}><span className="sg">{sg}</span><span className="nm">{k}</span><span className="ds">{ds}</span></li>)}
          <li className="t-breaking"><span className="sg">!</span><span className="nm">breaking</span><span className="ds">Flag in the first column; the change needs action before upgrading.</span></li>
        </ul>
      </Pane>

      <Pane title="filter" className="p-filter">
        <div className="fgroup">
          <span className="k">category</span>
          {chip("all", href({ category: undefined }), !f.category)}
          {CATEGORIES.map((c) => chip(CATEGORY_LABELS[c as Category].toLowerCase(), href({ category: c }), f.category === c))}
        </div>
        <div className="fgroup">
          <span className="k">show</span>
          {chip("major only", href({ impact: f.impact === "major" ? undefined : "major" }), f.impact === "major")}
          {chip("releases", href({ kind: f.kind === "release" ? undefined : "release" }), f.kind === "release")}
          {chip("case studies", href({ kind: f.kind === "case_study" ? undefined : "case_study" }), f.kind === "case_study")}
          {chip("postmortems", href({ kind: f.kind === "incident" ? undefined : "incident" }), f.kind === "incident")}
          {chip("include patches", href({ show: f.all ? undefined : "all" }), !!f.all)}
        </div>
      </Pane>
    </div>
  );
}
