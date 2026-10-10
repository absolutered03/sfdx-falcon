// Typed change lines from release notes, without a model. Every line in a release's
// notes becomes one entry (added, changed, deprecated, removed, fixed, security,
// maintenance or other), so a tool page can show the whole changelog as a diff-style
// list with exact counts, and the summarizer can be given every line that matters
// instead of the first 12,000 characters.
//
// Works on GitHub release markdown (the API body) and on the plain text we keep from
// Atom feeds, because both put one change per line. Prose release notes (a blog-style
// release post) produce few or no entries, which is the honest result.

export const CHANGE_TYPES = ["security", "removed", "deprecated", "added", "changed", "fixed", "other", "maintenance"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface ChangeLine {
  type: ChangeType;
  text: string;
  breaking?: boolean;
}

// Section headings used by release-please, goreleaser, GitHub's generated notes and
// hand-written changelogs. A heading sets the type for lines that carry no prefix.
const SECTION_TYPES: [RegExp, ChangeType | "stop" | "breaking"][] = [
  [/^new contributors?$|^contributors$|^full changelog|^thanks|^thank you/i, "stop"],
  [/breaking/i, "breaking"],
  [/security|vulnerab|cve/i, "security"],
  [/deprecat/i, "deprecated"],
  [/remov/i, "removed"],
  [/feature|enhancement|new|added|highlights|improvement/i, "added"],
  [/fix|bug/i, "fixed"],
  [/dependenc|chore|maintenance|ci\b|build|test|docs|documentation|refactor|internal|misc/i, "maintenance"],
  [/change|update|performance/i, "changed"],
];

// Conventional-commit prefixes: "feat(cli)!: ...", "fix: ...", "chore(deps): ...".
const PREFIX = /^([a-z][\w+./-]*)(\([^)]*\))?(!)?:\s*/i;
const PREFIX_TYPES: Record<string, ChangeType> = {
  feat: "added", feature: "added", add: "added", new: "added",
  fix: "fixed", bugfix: "fixed", hotfix: "fixed", bug: "fixed",
  perf: "changed", change: "changed", changed: "changed", revert: "changed", update: "changed",
  deprecate: "deprecated", deprecated: "deprecated", deprecation: "deprecated",
  remove: "removed", removed: "removed",
  security: "security", sec: "security",
  chore: "maintenance", ci: "maintenance", build: "maintenance", test: "maintenance", tests: "maintenance",
  docs: "maintenance", doc: "maintenance", style: "maintenance", refactor: "maintenance", deps: "maintenance",
  release: "maintenance", lint: "maintenance",
};

const SECURITY_ID = /\bCVE-\d{4}-\d+|\bGHSA-[\w-]+/i;
const SECURITY = /\bCVE-\d{4}-\d+|\bGHSA-[\w-]+|\bsecurity\b|vulnerab/i;
const NON_CODE_PREFIX = new Set(["docs", "doc", "test", "tests", "ci", "style", "lint"]);
const DEPENDENCY = /\bbump(s|ed)?\b.*\bfrom\b|\bdependabot\b|\brenovate\b|\bupdate (module|dependency|dependencies)\b|^(chore|build|fix)\(deps/i;
const BREAKING = /\bBREAKING\b/;

/** Strip credit and link noise: "by @user in #123", "(#123)", PR URLs, commit hashes. */
export function cleanLine(s: string): string {
  return s
    .replace(/\s*\(\s*#\d+\s*\)\s*(authored|reported|co-authored)\b.*$/i, "") // OPA: "(#8863) authored by @x"
    .replace(/\s+(authored|reported) by @.*$/i, "")
    .replace(/\s+by @[\w-]+(\s*\[bot\])?(\s+in\b.*)?$/i, "") // GitHub's generated "by @user in #123", even when cut off
    .replace(/\s*\(\s*\[?[0-9a-f]{7,40}\]?(\([^)]*\))?\s*\)\s*$/gi, "") // trailing commit hash
    .replace(/\s*\(?\s*\[?#\d+\]?(\([^)]*\))?\s*\)?\s*$/g, "") // trailing PR number
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links keep their text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(\w)`(?=\w)/g, "$1 ") // "The`project" (a missing space in the source) reads as two words
    .replace(/`+|\*\*|__/g, "") // code ticks and bold; underscores inside names (SF_TEMP_SHOW_SECRETS, label_match) stay
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=\s|$|[.,;:)])/g, "$1$2") // *emphasis* and _emphasis_
    .replace(/\s+/g, " ")
    .trim();
}

function classify(raw: string, section: ChangeType | null, inBreaking: boolean): ChangeLine | null {
  let text = raw;
  let type: ChangeType | null = null;
  let breaking = inBreaking || BREAKING.test(raw);

  const slash = text.match(/^(feat|fix|chore|docs|ci|test)\//i); // branch-style titles: "Feat/cli apply cross resource"
  if (slash) {
    type = PREFIX_TYPES[slash[1].toLowerCase()];
    text = text.slice(slash[0].length);
  }
  text = text.replace(/^\[(backport|cherry-pick)[^\]]*\]\s*/i, "");
  const m = text.match(PREFIX);
  let verbText = text; // what the keyword heuristics read
  if (m && PREFIX_TYPES[m[1].toLowerCase()]) {
    type = PREFIX_TYPES[m[1].toLowerCase()];
    if (m[3]) breaking = true;
    if (/deps/i.test(m[2] ?? "")) type = "maintenance";
    text = text.slice(m[0].length);
    verbText = text;
  } else if (m) {
    // A component scope ("Ast: Fix ...", "flagd-proxy: set ..."): keep it in the text,
    // classify by what follows.
    verbText = text.slice(m[0].length);
  }
  text = cleanLine(text);
  verbText = cleanLine(verbText);
  if (text.length < 3) return null;

  // Security outranks everything, including a dependency bump that fixes a CVE. The
  // word "security" alone does not count on a docs, test or CI line.
  const nonCode = !!m && NON_CODE_PREFIX.has(m[1].toLowerCase());
  if (SECURITY_ID.test(raw) || (SECURITY.test(raw) && !nonCode)) type = "security";
  else if (DEPENDENCY.test(raw)) type = "maintenance";
  else if (!type) type = section;
  if (!type && /^(add|adds|added|update|updates|fix|fixes)\b.*\b(tests?|e2e|unit tests?|test cases?)\b/i.test(verbText) && !/\bsupport\b/i.test(verbText)) type = "maintenance";
  if (!type) {
    if (/^(add|adds|added|introduce|introduces|support|supports|new|enable|enables|allow|allows)\b/i.test(verbText)) type = "added";
    else if (/^(fix|fixes|fixed|resolve|resolves|resolved|correct|prevent|prevents|handle|avoid)\b/i.test(verbText)) type = "fixed";
    else if (/^(deprecate|deprecates|deprecated)\b/i.test(verbText)) type = "deprecated";
    else if (/^(remove|removes|removed|drop|drops|dropped|delete)\b/i.test(verbText)) type = "removed";
    else if (/^(bump|bumps|upgrade|upgrades|update|updates)\b/i.test(verbText) && /\b(to|from)\b/i.test(verbText)) type = "maintenance";
    else if (/^(change|changes|changed|improve|improves|refactor|rename|renames|move|moves|make|makes)\b/i.test(verbText)) type = "changed";
    else if (/^(ci|test|tests|docs?|chore|lint)\b/i.test(verbText)) type = "maintenance";
    else type = "other";
  }
  const line: ChangeLine = { type, text: text[0].toUpperCase() + text.slice(1) };
  if (breaking) line.breaking = true;
  return line;
}

function headingType(line: string): ChangeType | "stop" | "breaking" | null {
  const h = line.replace(/^#+\s*/, "").replace(/[:⚠️\p{Extended_Pictographic}]/gu, "").trim();
  if (!h || h.length > 40) return null;
  for (const [re, t] of SECTION_TYPES) if (re.test(h)) return t;
  return null;
}

// Lines that are never changes: shell from install sections, sign-offs, boilerplate.
const CODEISH = /^(\w+=\s|\$\s|curl\b|wget\b|kubectl\b|helm (install|upgrade|repo|plugin)\b|chmod\b|sudo\b|gunzip\b|tar\b|mv\b|docker\b|brew\b|npm (i|install)\b|go install\b|export\s+\w+=|if \[|then$|fi$|done$|else$|printf\b|echo\b|for \w+ in\b)|&&|\|\||\$\(|\$\{|;\s*$/i;
const BOILERPLATE = /^(signed-off-by|co-authored-by|authored by|version:|no content\.?$|these are the release notes|join the discussion|available via|users are encouraged|installation|checksums?|sha256)/i;
const VERSION_LINE = /^v?\d+\.\d+(\.\d+)?\S*\s*(\([^)]*\))?$/i;
// GitHub-generated notes and most changelog tools credit a PR or author on each entry.
const REF = /\bby @[\w-]+|\(\s*#\d+\s*\)|\s#\d{3,}\b|\bin #\d+|\/pull\/\d+|\(\[?[0-9a-f]{7,40}\]?\(/i;
const BULLET = /^([*\-+]|\d+\.)\s+\S/;

/**
 * Parse release notes into typed lines. A heading ("## Bug Fixes", or a short plain
 * line such as "What's Changed" in Atom text) sets context; "New Contributors" and
 * "Full Changelog" end the list. Code blocks are skipped.
 */
export function parseChanges(notes: string): ChangeLine[] {
  const out: ChangeLine[] = [];
  let section: ChangeType | null = null;
  let inBreaking = false;
  let fenced = false;
  const all = notes.split(/\r?\n/).map((l) => l.trim());
  // Which lines can be entries: bullets when the notes have them; otherwise lines that
  // credit a PR or author (GitHub's generated notes as feed text); otherwise anything
  // that does not look like code, boilerplate or a wrapped prose fragment.
  const mode = all.filter((l) => BULLET.test(l)).length >= 2 ? "bullet" : all.filter((l) => REF.test(l)).length >= 3 ? "ref" : "loose";
  for (const line of all) {
    if (line.startsWith("```")) { fenced = !fenced; continue; }
    if (fenced || !line) continue;
    const isMdHeading = /^#{1,6}\s/.test(line);
    const bullet = BULLET.test(line);
    if (isMdHeading || (!bullet && !PREFIX.test(line) && line.length <= 40 && !/[.;]$/.test(line))) {
      if (/^what'?s changed$/i.test(line.replace(/^#+\s*/, ""))) { section = null; inBreaking = false; continue; }
      const t = headingType(line);
      if (t === "stop") break;
      if (t === "breaking") { inBreaking = true; section = null; continue; }
      if (t) { section = t; inBreaking = false; continue; }
      if (isMdHeading) { section = null; inBreaking = false; continue; }
    }
    if (/made (their|his|her) first contribution|^\**full changelog/i.test(line)) continue;
    if (/^(!!.*!!|release as nightly)$/i.test(line)) continue;
    if (mode === "bullet" && !bullet) continue;
    if (mode === "ref" && !REF.test(line) && !PREFIX.test(line)) continue;
    const bare = line.replace(/^([*\-+]|\d+\.)\s+/, "");
    if (BOILERPLATE.test(bare) || VERSION_LINE.test(bare)) continue;
    if (mode !== "bullet" && (CODEISH.test(bare) || /:$/.test(bare) || bare.length > 300)) continue;
    if (mode === "loose" && !REF.test(bare) && !PREFIX.test(bare) && (/^[a-z]/.test(bare) || bare.split(/\s+/).length < 3)) continue; // wrapped prose, or a stray label such as "Quick Start"
    const entry = classify(line.replace(/^([*\-+]|\d+\.)\s+/, ""), section, inBreaking);
    if (entry) out.push(entry);
  }
  return out;
}

export function countChanges(lines: ChangeLine[]) {
  const counts = Object.fromEntries(CHANGE_TYPES.map((t) => [t, 0])) as Record<ChangeType, number>;
  for (const l of lines) counts[l.type]++;
  return { total: lines.length, breaking: lines.filter((l) => l.breaking).length, counts };
}

/** True when there is nothing a reader would plan around: only dependency, CI, test and docs lines, or no notes at all. */
export const isMaintenanceOnly = (lines: ChangeLine[]) => lines.every((l) => l.type === "maintenance" && !l.breaking);

const PRIORITY: ChangeType[] = ["security", "removed", "deprecated", "added", "changed", "fixed", "other"];

/**
 * What the summarizer sees for a release: the counts, then every non-maintenance line,
 * most important first (breaking, then security, removals, deprecations, features,
 * changes, fixes). Truncation, if the limit is ever hit, drops the least important.
 */
export function condenseForModel(lines: ChangeLine[], limit: number): string {
  const { total, counts, breaking } = countChanges(lines);
  const head = [
    `Release notes, condensed: ${total} changes in total (${PRIORITY.filter((t) => counts[t]).map((t) => `${counts[t]} ${t}`).join(", ") || "none typed"}; ${counts.maintenance} maintenance lines such as dependency bumps, CI, tests and docs omitted)${breaking ? `, ${breaking} marked breaking` : ""}.`,
    "",
  ];
  const ordered = [
    ...lines.filter((l) => l.breaking),
    ...PRIORITY.flatMap((t) => lines.filter((l) => l.type === t && !l.breaking)),
  ];
  let text = head.join("\n");
  for (const l of ordered) {
    const row = `${l.breaking ? "[breaking] " : ""}${l.type}: ${l.text}\n`;
    if (text.length + row.length > limit) break;
    text += row;
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// Markdown changelog files (Salesforce CLI publishes its notes this way)
// ---------------------------------------------------------------------------

export interface ChangelogRelease {
  version: string;
  date: Date;
  channel: string | null; // "stable", "stable-rc", or null for older entries
  anchor: string; // GitHub's heading anchor
  body: string;
  lines: ChangeLine[];
}

const CHANGELOG_TYPES: Record<string, ChangeType> = { NEW: "added", CHANGE: "changed", FIX: "fixed", DEPRECATED: "deprecated", REMOVED: "removed", SECURITY: "security" };

/** GitHub's anchor for a markdown heading: lowercase, punctuation dropped, spaces to hyphens. */
export const githubAnchor = (heading: string) =>
  heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");

/**
 * Parse a changelog file whose releases are "## 2.153.5 (October 7, 2026) [stable]"
 * sections with "* NEW: / * CHANGE: / * FIX:" entries. Each entry keeps its first
 * paragraph only; examples and PR lists are left on the source page.
 */
export function parseChangelogFile(md: string): ChangelogRelease[] {
  const out: ChangelogRelease[] = [];
  const sections = md.split(/^## /m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf("\n");
    const heading = sec.slice(0, nl === -1 ? undefined : nl).trim();
    const m = heading.match(/^v?(\d+\.\d+(?:\.\d+)?)\s*\(([^)]+)\)\s*(?:\[([\w-]+)\])?/);
    if (!m) continue;
    const date = new Date(`${m[2]} UTC`);
    if (Number.isNaN(date.getTime())) continue;
    const body = nl === -1 ? "" : sec.slice(nl + 1).trim();
    out.push({ version: m[1], date, channel: m[3] ?? null, anchor: githubAnchor(heading), body, lines: parseChangelogEntries(body) });
  }
  return out;
}

/** The "* NEW: / * CHANGE: / * FIX:" entries of one changelog section, first paragraph each. */
export function parseChangelogEntries(body: string): ChangeLine[] {
  const lines: ChangeLine[] = [];
  let fenced = false;
  for (const raw of body.split(/\r?\n/)) {
    if (raw.trim().startsWith("```")) { fenced = !fenced; continue; }
    if (fenced) continue;
    const e = raw.match(/^\*\s+([A-Z]+):\s*(.+)$/);
    if (!e) continue;
    const type = CHANGELOG_TYPES[e[1]] ?? "other";
    let text = cleanLine(e[2].replace(/\s*\((plugin-[\w-]+|GitHub Issue|[\w-]+ PR)\b.*$/i, ""));
    if (text.length > 400) text = text.slice(0, text.lastIndexOf(" ", 397)) + "...";
    if (text) lines.push({ type: SECURITY.test(e[2]) ? "security" : type, text, ...(BREAKING.test(e[2]) ? { breaking: true } : {}) });
  }
  return lines;
}
