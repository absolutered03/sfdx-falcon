import { getAuditQueue, type FeedItem } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, IMPACTS, ITEM_KINDS } from "@/lib/taxonomy";
import { addManualItem, approveItem, markMajor, rejectItem } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit", robots: { index: false } };

type Mode = "published" | "held" | "out_of_scope";

const modelImpact = (item: FeedItem["item"]) => (item.llmRaw as { impact?: string } | null)?.impact;

function EditForm({ row, mode }: { row: FeedItem; mode: Mode }) {
  const { item } = row;
  return (
    <>
      <details>
        <summary>Source text the model saw</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 300, overflow: "auto" }}>{item.excerpt}</pre>
      </details>
      <form action={approveItem}>
        <input type="hidden" name="id" value={item.id} />
        <label>Summary (2 to 4 sentences)<textarea name="summary" defaultValue={item.summary ?? ""} required /></label>
        <label>For platform teams<textarea name="platformImpact" defaultValue={item.platformImpact ?? ""} required /></label>
        <div className="row">
          <label>Impact
            <select name="impact" defaultValue={item.impact ?? "notable"}>{IMPACTS.map((i) => <option key={i}>{i}</option>)}</select>
          </label>
          <label>Kind
            <select name="kind" defaultValue={item.kind}>{ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </label>
          <label>Entities (slugs, comma-separated)
            <input name="entities" defaultValue={row.entities.map((e) => e.slug).join(", ")} />
          </label>
        </div>
        <div className="filters">
          {CATEGORIES.map((c) => (
            <label key={c} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" name="categories" value={c} defaultChecked={item.categories.includes(c)} style={{ width: "auto" }} />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
        <label>Editor note (optional, public)<input name="editorNote" defaultValue={item.editorNote ?? ""} /></label>
        <p><button type="submit">{mode === "published" ? "Save changes" : "Publish"}</button></p>
      </form>
    </>
  );
}

function Entry({ row, mode }: { row: FeedItem; mode: Mode }) {
  const { item, sourceName, sourceTier } = row;
  const suggestedMajor = mode === "published" && item.impact !== "major" && modelImpact(item) === "major";
  return (
    <article className="item">
      <div className="meta">
        <span>{item.publishedAt.toISOString().slice(0, 10)}</span>
        <span>{sourceName ?? "manual"} ({sourceTier ?? "manual"})</span>
        {mode === "published" && <span className={`tag ${item.impact}`}>{item.impact}</span>}
        {mode !== "published" && <span>{item.statusReason}</span>}
      </div>
      <h3><a href={item.url} target="_blank" rel="noopener nofollow">{item.title}</a></h3>
      {item.flags.length > 0 && <div className="flags">Flags: {item.flags.join(", ")}</div>}
      {mode === "published" ? (
        <>
          <p style={{ margin: "6px 0" }}>{item.summary}</p>
          <p className="impact"><b>For platform teams:</b> {item.platformImpact}</p>
          {suggestedMajor && (
            <form action={markMajor} className="row" style={{ alignItems: "center", margin: "8px 0" }}>
              <input type="hidden" name="id" value={item.id} />
              <span style={{ fontSize: 14 }}>The model suggested Major. Published as notable until you agree.</span>
              <button type="submit" style={{ flex: "0 0 auto" }}>Mark Major</button>
            </form>
          )}
          <details><summary>Edit</summary><EditForm row={row} mode={mode} /></details>
        </>
      ) : (
        <EditForm row={row} mode={mode} />
      )}
      <form action={rejectItem} className="row" style={{ marginTop: 8 }}>
        <input type="hidden" name="id" value={item.id} />
        <input name="reason" placeholder="Reason (wrong, vendor fluff, off-niche, duplicate...)" />
        <button type="submit" style={{ flex: "0 0 auto" }}>{mode === "published" ? "Unpublish" : "Reject"}</button>
      </form>
    </article>
  );
}

export default async function Admin() {
  const { published, held, llmRejected } = await getAuditQueue();
  return (
    <>
      <h1 style={{ fontSize: 22 }}>Audit</h1>
      <p style={{ color: "var(--muted)" }}>
        Feed items publish without review, capped at notable. Nothing here needs action; it is where you fix what slipped through.
      </p>

      <h2 style={{ fontSize: 18 }}>Published automatically, last 14 days ({published.length})</h2>
      {published.length === 0 && <p>Nothing yet.</p>}
      {published.map((r) => <Entry key={r.item.id} row={r} mode="published" />)}

      <h2 style={{ fontSize: 18, marginTop: 40 }}>Held by the publish checks ({held.length})</h2>
      <p style={{ color: "var(--muted)" }}>Off the site. The reason is on each one. Fix and publish, or leave them.</p>
      {held.map((r) => <Entry key={r.item.id} row={r} mode="held" />)}

      <h2 style={{ fontSize: 18, marginTop: 40 }}>The model called these out of scope</h2>
      <p style={{ color: "var(--muted)" }}>Skim for false negatives. Publishing one overrules the model.</p>
      {llmRejected.map((r) => <Entry key={r.item.id} row={r} mode="out_of_scope" />)}

      <h2 style={{ fontSize: 18, marginTop: 40 }}>Add an item by hand</h2>
      <form action={addManualItem}>
        <input name="url" placeholder="https://..." required />
        <input name="title" placeholder="Title" required />
        <input name="publishedAt" type="date" />
        <textarea name="excerpt" placeholder="Paste the relevant source text. The next ingest run writes it up and publishes it if it passes the checks." required />
        <p><button type="submit">Queue it</button></p>
      </form>
    </>
  );
}
