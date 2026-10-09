# Platform Changelog: design note

Prototype: `index.html` in this folder (self-contained, 204 KB, built from `registry-data.json`).

## Concept

The site is laid out like a tiling desktop a senior engineer runs every day: a thin top bar with numbered workspaces (1 feed, 2 registry, 3 methodology) and a launcher-style search, tiled panes with 8px gaps and 1px borders where the active pane gets the accent border, and a tmux-style status line at the bottom with the breadcrumb and key hints. Change lists are typeset as a diff with a two-column gutter, the same shape as `git status --short`. Nothing glows, blinks or types itself; the terminal feel comes from density, alignment and a coordinated palette.

## Palette and type

Tokens live on `:root` (dark first, Tokyo Night) with Tokyo Night Day under the light rules, following the artifact contract. A palette switcher in the top bar (and the `t` key) swaps in the other Omarchy themes: Catppuccin, Gruvbox, Nord, Everforest, Kanagawa, Rose Pine, each with a dark and a light variant. Non-default palettes are injected from a JS table as `:root[data-palette]` rules; the choice is kept in `localStorage` inside try/catch.

Surface tokens: `--bg` (desktop background behind the tiles), `--pane`, `--raised` (selected row), `--hover`, `--line`, `--line-strong`. Text: `--fg`, `--fg-dim`, `--mute`, `--prose` (a darker neutral for sans paragraphs in light mode, because Tokyo Night Day's blue foreground tires over a paragraph). Accent: `--accent` (active border, workspace number, minor and major versions), `--accent-ink`.

Semantic colors are separate from the accent and map to the terminal's ANSI set, which is why they survive every palette swap: `--add` green, `--rm` red, `--chg` yellow, `--dep` yellow, `--fix` cyan, `--sec` orange, `--brk` magenta.

Type: IBM Plex Mono for everything structural (bar, lists, versions, change lines, status line) and IBM Plex Sans for the plain-English parts (tool descriptions, alternative notes, methodology). Same family, so the two sit together; the sans keeps paragraphs readable on a phone. Fallback stacks are declared. Base size 13px mono, 14px sans for prose, 11px uppercase with letter-spacing for labels; digits use tabular numerals.

## Layout and how it collapses

Desktop (900px and up): the app fills the viewport; each pane scrolls on its own.

- Feed: releases stream (left, full height) and a right column of three panes: status (counts), change types legend, reviewed (designed empty state).
- Registry: tools pane (left, full height, with its filter input and category groups), tool header (middle top), alternatives (right top), releases (bottom, spanning the right two columns).
- Methodology: a prose pane and a data-model pane.

Phone (under 900px): the top bar wraps to two rows (brand and theme controls, then workspaces and search; inactive workspace buttons show only their number). The main area becomes one scroll. In the registry the tools pane is the first screen; tapping a tool switches to the detail stack (header, alternatives, releases) with a `‹ tools` control in the pane title and `esc` on a keyboard. Change-line type labels drop under the text so the text column keeps its width. Side gutter is 8px pane gap plus 10 to 14px inner padding, so text never sits closer than 16px to the edge, and the check confirmed `scrollWidth` equals the viewport at 390px.

Release emphasis: the kind (major, minor, patch) is derived from the previous version in the tool's list. Minor and major releases get an accent rule and a brighter, larger version number; patches are quieter. A release with a breaking or security line gets a `breaking` or `security` tag in its header and in the feed, plus a diffstat-style glyph bar (`++~**!`) that shows the shape of the release at a glance. Several lines released on the same day (Argo CD 3.3, 3.4, 3.5) sort highest first, and the header lists the release lines seen.

## Change-type legend (recommended) and alternatives

Recommended, as built: Keep a Changelog types plus one flag, shown in a two-column gutter like `git status --short`. Column 1 is the breaking flag, column 2 the type sigil.

| gutter | type | color | treatment |
| --- | --- | --- | --- |
| `+` | added | green | green row tint |
| `-` | removed | red | red row tint |
| `-` | deprecated | yellow | dimmed text, label says deprecated |
| `~` | changed | yellow | no tint |
| `*` | fixed | cyan | no tint |
| `!` | security | orange | orange row tint |
| `!` in column 1 | breaking (flag on any type) | magenta | magenta left bar, line sorted to the top |

Why: `+` and `-` keep the git-diff reading CT asked for. Fixes are not additions or removals, so they get their own glyph; `*` reads as "patched" and stays visually quieter than the tinted rows. Security is a type because readers scan release notes for it. Breaking is a flag rather than a type because a removal, a rename and a changed default can all be breaking; a flag keeps the type honest and still puts the magenta where the eye goes first. Every line also carries its type as a text label, so color is never the only signal.

Alternatives for CT to choose from:

1. Conventional-commit keywords in a fixed-width gutter: `feat`, `fix`, `chg`, `rm`, `depr`, `sec`, with `BREAK` in the flag column. Pro: zero learning for anyone who writes conventional commits, works with no color at all. Con: a 5-character gutter costs width on phones and reads noisier than single glyphs.
2. Pure diff semantics: a fix is rendered as a pair, the old behavior as a red `-` line and the new behavior as a green `+` line; security as a `!` hunk header above the pair. Pro: the truest version of "looks like a git diff". Con: doubles the line count, and the summarizer would have to produce a before and an after for every fix, which it often cannot ("fixed a panic" has no meaningful before).
3. Fix as a tilde with a severity scale: `~` for both changed and fixed in one yellow, with security as `~` on an orange row and breaking as `!`. Pro: the smallest vocabulary, three glyphs total. Con: readers can no longer tell a behavior change from a fix without reading the label, which is the distinction platform teams care about most when deciding whether to upgrade.

## Keyboard map

- `/` focus global search; type to search tool names, descriptions, versions and change lines; `↑` `↓` (or ctrl-j, ctrl-k) move through results, `enter` opens the result in the registry and scrolls to the release, `esc` clears then blurs.
- `1` `2` `3` switch workspace (feed, registry, methodology).
- `j` `k` or `↑` `↓` move through the tool list (desktop: selects and renders; phone: moves the highlight), `enter` opens, `f` focuses the registry filter, `esc` in the filter clears it.
- `t` cycles the palette.
- `esc` closes search, or on a phone returns from a tool's detail to the list.
- Everything also works by mouse and touch; shortcuts are never required.

## What the real Next.js app needs to adopt this

Data model. The summarizer must emit a structured list per release instead of prose, and that list is what the reviewer edits and approves:

```yaml
release:
  tool: flux
  version: v2.9.6
  date: 2026-10-01
  kind: patch            # derived: major | minor | patch, from the previous version on the same tool
  source: https://github.com/fluxcd/flux2/releases/tag/v2.9.6
  status: reviewed       # detected | summarized | reviewed | rejected
  changes:
    - { type: fixed,    text: "helm-controller no longer reapplies chart CRDs ..." }
    - { type: security, text: "SOPS decryption error redaction extended ..." }
    - { type: changed,  breaking: true, text: "sync metrics renamed ..." }
```

`type` is one of `added | changed | deprecated | removed | fixed | security`; `breaking` is an optional boolean. Two derived fields are worth storing on the release row to keep list pages cheap: `has_breaking` and `has_security`, plus per-type counts for the diffstat bar. The reviewer UI (the existing admin approve flow) should edit this list line by line rather than a free-text summary; the approve step publishes the typed list.

Mapping to existing pages and components:

- `/` (feed) maps to workspace 1: the releases stream is the current feed list, with date grouping and the diffstat bar; the right column is three small server components (status counts, legend, reviewed empty state) until reviewed items exist, at which point the stream shows reviewed entries first.
- `/tools` (tool index) and `/tools/[slug]` map to workspace 2 as one layout: the tools pane is a shared client component (filter, groups, keyboard selection), `/tools/[slug]` fills the header, alternatives and releases panes. On phones the route decides which pane is visible (`/tools` shows the list, `/tools/[slug]` the detail), which keeps back navigation native.
- A `/methodology` page maps to workspace 3; the data-model pane is static content.
- Shared components: top bar with workspace tabs and search, status line with breadcrumb, pane shell (title row, active border), change list (the diff block), release header (version, date, kind, flags, diffstat), tool row, legend.
- Theme: ship the palette table as CSS variables under `[data-palette]` and the light rules under `prefers-color-scheme` and `[data-theme]`, exactly as the prototype does; the palette select and `t` key write `localStorage` and a cookie so SSR can set the attribute on `<html>` without a flash.

Server work:

- Search index: the prototype searches an in-memory index of tools, releases and change lines. The app should build a small search index at publish time (tool fields, version strings, change-line text with type and breaking flag) and expose a `/api/search?q=` route backed by Postgres full-text search or a prebuilt lunr/minisearch JSON blob served statically. Results need three groups (tools, releases, change lines) and a stable release anchor (`/tools/flux#v2.9.6`) to land on.
- Version ordering and kind derivation (`cmpVer`, previous-version lookup) belong in the ingest step so `kind`, `current_version` and `release_lines` are stored, not computed in the browser.
- Release deep links: the prototype uses `#slug` hashes because of the artifact sandbox; the app should use real routes with `?v=` or an anchor per release.

## Things to flag

- Example change lists exist for 23 releases across 21 tools (the latest release of each, plus Kargo v1.12.0 and Helm v4.2.4 because they carry breaking and security lines). They were written by hand from the `notes` field only, and are labeled as examples in the UI and in the methodology text. Two judgment calls are visible in them: Jenkins' raised minimum Remoting version is flagged breaking, and Kargo's "there will be no v1.13.0" note is typed deprecated. An editor can disagree; that is what review is for.
- Release kind for two-part versions (GitLab 19.4, Jenkins 2.585) is treated as major.minor, so every Jenkins weekly reads as minor. The app should let a tool declare its versioning scheme.
- Fonts come from Google Fonts; with no network the fallback stacks render.
- Raw source notes (shown under "source notes (truncated)") are the feed's own text and may contain characters the copy rules exclude; all authored copy follows them.
