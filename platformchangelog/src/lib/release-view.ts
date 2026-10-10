// Presentation helpers shared by the feed, the registry and search: release kind
// (major, minor, patch, from the previous version of the same tool, as in the design
// prototype), release flags, and the glyph diffstat.

import { countChanges, type ChangeLine } from "../ingest/changes";
import { compareVersions } from "../ingest/normalize";

export type ReleaseKind = "major" | "minor" | "patch";

const nums = (v: string) => (v.match(/\d+/g) ?? []).map(Number);

/**
 * Kind per release id. A release is major when its first number moved, minor when the
 * second did (two-part versions such as GitLab 19.4 count as minor), patch otherwise.
 * With no earlier version on record, x.0.0 is major, x.y.0 minor.
 */
export function releaseKinds(rows: { id: number; group: number | string; version: string | null }[]): Map<number, ReleaseKind> {
  const out = new Map<number, ReleaseKind>();
  const groups = new Map<number | string, { id: number; version: string }[]>();
  for (const r of rows) {
    if (!r.version) continue;
    const g = groups.get(r.group) ?? [];
    g.push({ id: r.id, version: r.version });
    groups.set(r.group, g);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => compareVersions(b.version, a.version));
    list.forEach((r, i) => {
      const n = nums(r.version);
      const prev = list.slice(i + 1).find((x) => compareVersions(x.version, r.version) < 0);
      let kind: ReleaseKind;
      if (!prev) kind = n.length >= 3 ? (n[2] === 0 ? (n[1] === 0 ? "major" : "minor") : "patch") : n.length === 2 ? "minor" : "patch";
      else {
        const p = nums(prev.version);
        kind = n[0] !== p[0] ? "major" : n.length >= 3 ? (n[1] !== p[1] ? "minor" : "patch") : "minor";
      }
      out.set(r.id, kind);
    });
  }
  return out;
}

export function releaseFlags(lines: ChangeLine[] | null | undefined) {
  const l = lines ?? [];
  return { breaking: l.some((x) => x.breaking), security: l.some((x) => x.type === "security") };
}

const STAT_ORDER = ["added", "changed", "deprecated", "removed", "fixed", "security"] as const;
export const SIGIL: Record<string, string> = { added: "+", changed: "~", deprecated: "-", removed: "-", fixed: "*", security: "!", other: "·", maintenance: "·" };
export const TOKEN: Record<string, string> = { added: "add", changed: "chg", deprecated: "dep", removed: "rm", fixed: "fix", security: "sec" };

/** The prototype's "++~**!" bar: one glyph per line, scaled to at most 18, maintenance and untyped lines left out. */
export function statSegments(lines: ChangeLine[] | null | undefined) {
  const { counts } = countChanges(lines ?? []);
  const typed = STAT_ORDER.reduce((n, t) => n + counts[t], 0);
  if (!typed) return [];
  const scale = typed > 18 ? 18 / typed : 1;
  return STAT_ORDER.filter((t) => counts[t]).map((t) => ({ type: t, glyphs: SIGIL[t].repeat(Math.max(1, Math.round(counts[t] * scale))), n: counts[t] }));
}
