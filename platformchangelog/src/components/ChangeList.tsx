import { CHANGE_TYPES, countChanges, type ChangeLine, type ChangeType } from "@/ingest/changes";
import { SIGIL, TOKEN, releaseFlags, statSegments } from "@/lib/release-view";

// The change list from the design prototype, typeset like a diff: column 1 is the
// breaking flag, column 2 the type sigil, then the line and its type as a label, so
// color is never the only signal. Lines come straight from the source's release notes,
// typed by code (src/ingest/changes.ts); there is no generated text here.

const ORDER: ChangeType[] = ["security", "removed", "deprecated", "changed", "added", "fixed", "other"];
const VISIBLE = 12;

export function DiffList({ lines }: { lines: ChangeLine[] }) {
  return (
    <ul className="diff">
      {lines.map((c, i) => (
        <li key={i} className={`ln t-${c.type}${c.breaking ? " brk" : ""}`}>
          <span className="g1" aria-label={c.breaking ? "breaking" : undefined}>{c.breaking ? "!" : ""}</span>
          <span className="g2" aria-hidden="true">{SIGIL[c.type]}</span>
          <span className="tx">{c.text}</span>
          <span className="ty">{c.type}{c.breaking ? " / breaking" : ""}</span>
        </li>
      ))}
    </ul>
  );
}

/** "++~**!": the shape of a release at a glance. */
export function StatBar({ lines }: { lines: ChangeLine[] | null | undefined }) {
  const segs = statSegments(lines);
  if (!segs.length) return null;
  return (
    <span className="stat" title={segs.map((s) => `${s.n} ${s.type}`).join(", ")}>
      {segs.map((s) => <span key={s.type} style={{ color: `var(--${TOKEN[s.type]})` }}>{s.glyphs}</span>)}
    </span>
  );
}

export function Flags({ lines }: { lines: ChangeLine[] | null | undefined }) {
  const f = releaseFlags(lines);
  return (
    <>
      {f.breaking && <span className="fl brk">breaking</span>}
      {f.security && <span className="fl sec">security</span>}
    </>
  );
}

export function ChangeList({ lines }: { lines: ChangeLine[] }) {
  const main = [
    ...lines.filter((l) => l.breaking),
    ...ORDER.flatMap((t) => lines.filter((l) => l.type === t && !l.breaking)),
  ];
  const maintenance = lines.filter((l) => l.type === "maintenance" && !l.breaking);
  const { total, counts } = countChanges(lines);
  return (
    <>
      {main.length > 0 && <DiffList lines={main.slice(0, VISIBLE)} />}
      {main.length > VISIBLE && (
        <details className="more">
          <summary>{main.length - VISIBLE} more lines</summary>
          <DiffList lines={main.slice(VISIBLE)} />
        </details>
      )}
      {maintenance.length > 0 && (
        <details className="more">
          <summary>{maintenance.length} maintenance lines (dependency bumps, CI, tests, docs)</summary>
          <DiffList lines={maintenance} />
        </details>
      )}
      <div className="rf">
        <span>{total} {total === 1 ? "line" : "lines"}</span>
        {CHANGE_TYPES.filter((t) => counts[t]).map((t) => <span key={t}>{counts[t]} {t}</span>)}
        <span>typed from the source notes</span>
      </div>
    </>
  );
}
