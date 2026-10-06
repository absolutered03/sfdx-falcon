import { getReviewQueue, type FeedItem } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, IMPACTS, ITEM_KINDS } from "@/lib/taxonomy";
import { addManualItem, approveItem, rejectItem } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue", robots: { index: false } };

function ReviewForm({ row }: { row: FeedItem }) {
  const { item, sourceName, sourceTier } = row;
  return (
    <article className="item">
      <div className="meta">
        <span>{item.publishedAt.toISOString().slice(0, 10)}</span>
        <span>{sourceName ?? "manual"} ({sourceTier ?? "manual"})</span>
        <span>{item.statusReason}</span>
      </div>
      <h3><a href={item.url} target="_blank" rel="noopener nofollow">{item.title}</a></h3>
      {item.flags.length > 0 && <div className="flags">Flags: {item.flags.join(", ")}</div>}
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
        <p><button type="submit">Approve and publish</button></p>
      </form>
      <form action={rejectItem} className="row">
        <input type="hidden" name="id" value={item.id} />
        <input name="reason" placeholder="Reject reason (vendor fluff, off-niche, duplicate...)" />
        <button type="submit" style={{ flex: "0 0 auto" }}>Reject</button>
      </form>
    </article>
  );
}

export default async function Admin() {
  const { drafts, llmRejected } = await getReviewQueue();
  return (
    <>
      <h1 style={{ fontSize: 22 }}>Review queue ({drafts.length})</h1>
      {drafts.length === 0 && <p>Inbox zero.</p>}
      {drafts.map((r) => <ReviewForm key={r.item.id} row={r} />)}

      <h2 style={{ fontSize: 18, marginTop: 40 }}>The model called these out of scope</h2>
      <p style={{ color: "var(--muted)" }}>Skim for false negatives. Approving one publishes it.</p>
      {llmRejected.map((r) => <ReviewForm key={r.item.id} row={r} />)}

      <h2 style={{ fontSize: 18, marginTop: 40 }}>Add an item by hand</h2>
      <form action={addManualItem}>
        <input name="url" placeholder="https://..." required />
        <input name="title" placeholder="Title" required />
        <input name="publishedAt" type="date" />
        <textarea name="excerpt" placeholder="Paste the relevant source text. The next ingest run drafts a summary from it." required />
        <p><button type="submit">Queue for drafting</button></p>
      </form>
    </>
  );
}
