import { DiffStat } from "@/components/ChangeList";
import type { FeedItem } from "@/lib/queries";
import { CATEGORY_LABELS, type Category } from "@/lib/taxonomy";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// All text here is plain text from the DB, rendered by React (escaped). No HTML from a
// feed or the model is ever injected into the page.
export function ItemCard({ row }: { row: FeedItem }) {
  const { item, sourceName, entities } = row;
  return (
    <article className="item">
      <div className="meta">
        {item.impact && <span className={`tag ${item.impact}`}>{item.impact}</span>}
        <span>{fmt(item.publishedAt)}</span>
        <span>{sourceName ?? "Editor"}</span>
        {item.categories.map((c) => (
          <a key={c} href={`/?category=${c}`}>{CATEGORY_LABELS[c as Category]}</a>
        ))}
      </div>
      <h3>
        <a href={item.url} rel="noopener nofollow">{item.title}</a>
      </h3>
      {item.summary && <p style={{ margin: "4px 0" }}>{item.summary}</p>}
      {item.platformImpact && (
        <p className="impact"><b>For platform teams:</b> {item.platformImpact}</p>
      )}
      {item.kind === "release" && item.changes && item.changes.length > 1 && <DiffStat lines={item.changes} />}
      {item.editorNote && <p className="editor">Editor: {item.editorNote}</p>}
      {entities.length > 0 && (
        <div className="meta">
          {entities.map((e) => <a key={e.slug} href={`/tools/${e.slug}`}>{e.name}</a>)}
        </div>
      )}
    </article>
  );
}
