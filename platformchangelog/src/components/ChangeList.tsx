import { CHANGE_TYPES, countChanges, type ChangeLine, type ChangeType } from "@/ingest/changes";

// The diff-style change list from the design prototype: a gutter sigil per type, row
// tint for added, removed and security. Lines come straight from the source's release
// notes, typed by code (src/ingest/changes.ts); there is no generated text here.

const SIGIL: Record<ChangeType, string> = {
  added: "+", removed: "-", deprecated: "-", changed: "~", fixed: "*", security: "!", other: "·", maintenance: "·",
};
const ORDER: ChangeType[] = ["security", "removed", "deprecated", "added", "changed", "fixed", "other"];
const VISIBLE = 10;

function Rows({ lines }: { lines: ChangeLine[] }) {
  return (
    <ul className="chg">
      {lines.map((l, i) => (
        <li key={i} className={`chg-${l.type}`}>
          <span className="sig" aria-label={l.type}>{SIGIL[l.type]}</span>
          <span>
            {l.breaking && <span className="brk">breaking</span>}
            {l.type === "deprecated" && <span className="dep">deprecated</span>}
            {l.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Counts in Keep a Changelog order, e.g. "238 changes  +17 added  *53 fixed  !7 security  47 maintenance". */
export function DiffStat({ lines }: { lines: ChangeLine[] }) {
  const { total, counts, breaking } = countChanges(lines);
  return (
    <div className="diffstat">
      <span>{total} {total === 1 ? "change" : "changes"}</span>
      {breaking > 0 && <span className="brk">{breaking} breaking</span>}
      {CHANGE_TYPES.filter((t) => counts[t] > 0).map((t) => (
        <span key={t} className={`ds-${t}`}>{t === "maintenance" || t === "other" ? "" : SIGIL[t]}{counts[t]} {t}</span>
      ))}
    </div>
  );
}

export function ChangeList({ lines, sourceUrl }: { lines: ChangeLine[]; sourceUrl: string }) {
  const main = [
    ...lines.filter((l) => l.breaking),
    ...ORDER.flatMap((t) => lines.filter((l) => l.type === t && !l.breaking)),
  ];
  const maintenance = lines.filter((l) => l.type === "maintenance" && !l.breaking);
  return (
    <div className="changes">
      <DiffStat lines={lines} />
      <Rows lines={main.slice(0, VISIBLE)} />
      {main.length > VISIBLE && (
        <details>
          <summary>{main.length - VISIBLE} more</summary>
          <Rows lines={main.slice(VISIBLE)} />
        </details>
      )}
      {maintenance.length > 0 && (
        <details>
          <summary>{maintenance.length} maintenance (dependency bumps, CI, tests, docs)</summary>
          <Rows lines={maintenance} />
        </details>
      )}
      <a className="chg-src" href={sourceUrl} rel="noopener nofollow">Full release notes</a>
    </div>
  );
}
