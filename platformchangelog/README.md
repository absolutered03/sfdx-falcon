# Platform Changelog

| | |
|---|---|
| Status | MVP starter. Builds, runs and renders against Postgres; LLM call not yet run live. Domain `platformchangelog.dev` owned (2026-10-08), not yet pointed at a host |
| Date | 2026-10-06 |
| Owner | CT |
| Audience | CT, and anyone who runs this later |

A vendor-neutral registry and feed for platform engineering, developer experience and DevOps in the AI age. Software writes entries from an allow-list of public sources and publishes them automatically; an editor audits after publication.

> This folder is self-contained and meant to become its own repository. It sits inside `sfdx-falcon` only because that was the repo attached to the session that built it.

## Read these first

1. **The feed is a crowded market; the registry is not.** Lead with tool pages. See [01](docs/01-market-and-name.md).
2. **Volume is lower than ai-tldr.** 8 repos produced 8 summary-worthy releases in 30 days. Daily volume comes from blogs.
3. **Feed items auto-publish (project decision, 2026-10-09), with three safeguards.** The model can never tag an entry Major; deterministic checks hold anything with no source link, runaway length, markup, links, dashes or hype words; the prompt carries the fixes from the evals. `/admin` is the after-the-fact audit: edit, Mark Major, Unpublish. Practical notes stay human-only.

## Docs

| File | What's in it | Read it when |
|---|---|---|
| [01-market-and-name.md](docs/01-market-and-name.md) | Competitors, the gap, name and domain | Deciding whether and what to launch |
| [02-product-and-architecture.md](docs/02-product-and-architecture.md) | Product shape, stack trade-offs, schema, ingestion flow, pages, sponsorship design | Changing how it works |
| [03-first-week-plan.md](docs/03-first-week-plan.md) | Hardcode vs automate, launch sources, day-by-day plan | Planning the week |
| [04-editorial-rules.md](docs/04-editorial-rules.md) | The rules that keep it from becoming a press-release mirror | Before approving anything |

## Run it

```bash
cp .env.example .env            # fill DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_PASSWORD
npm ci
npm run db:push                 # create tables from src/db/schema.ts
npm run seed                    # load data/sources.json and data/entities.json
npm run ingest:dry              # fetch + triage only: no DB, no LLM
npm run ingest                  # fetch, store, draft up to MAX_LLM_CALLS_PER_RUN
npm run dev                     # http://localhost:3000, audit at /admin
npm run digest > digest.md      # weekly outline
npm run backfill                # one-time launch backfill: dry run lists one draft per tool; add --run to draft
npm run compare                 # opus 5.5 vs haiku 4.5 on 12 real items, read-only -> reports/
```

## Layout

```
app/                    pages: feed, /tools, /tools/[slug], /search, /about, /admin (+ server actions)
app/admin/insights      search, filter, outbound and time-on-page reports
app/admin/tools         suggestions from searches, track / untrack, add a tool
app/api/events          cookieless analytics beacon
proxy.ts                basic auth for /admin
src/db/schema.ts        all tables
src/lib/taxonomy.ts     categories, kinds, impacts, statuses (single source of truth)
src/lib/queries.ts      every read the public pages do, including site search
src/lib/admin-queries.ts insights, suggestions, full tool list
src/ingest/normalize.ts feed parsing, URL canonicalization, release triage
src/ingest/prefilter.ts keyword gate for broad feeds
src/ingest/summarize.ts the one LLM call
src/ingest/publish-checks.ts deterministic gate before anything goes live
scripts/                ingest, seed, digest
data/                   hardcoded sources and registry
.github/workflows/      3-hourly ingest cron
```

## Verify

Run on 2026-10-06 against a local Postgres 16:

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean |
| Production build | `npm run build` | 6 routes built, proxy registered |
| Live feed parsing | `npm run ingest:dry` | 8 GitHub release feeds parsed; 78 entries in 30 days, 8 sent to LLM, 14 logged as patches, rest dropped |
| Schema + seed | `npm run db:push && npm run seed` | 13 sources, 16 entities, 7 comparisons (14 rows, both directions) |
| Full ingest | `npm run ingest` | 43 new items stored; LLM phase stopped cleanly after 3 auth errors (no key in the test environment), items left `pending_llm` |
| Dedupe | `npm run ingest` again | 0 new items |
| Pages | curl each route | `/`, filters, `/tools`, `/tools/backstage` (6 logged patch releases + 4 comparisons), `/about` all 200; unknown slug 404; `/admin` 401 without credentials, 200 with |
| Publish path | headless Chromium clicks Approve | item moved to `approved` with `reviewed_at` set; queue emptied |
| Admin observability (2026-10-09) | headless Chromium with a normal UA, plus curl | searches, filters, outbound clicks, page views and engagement logged; curl and Googlebot searches not logged; untrack Helm gives 404, Track again gives 200 and clears the suggestion; Add created Spinnaker plus its GitHub source; Dismiss hides the term |
| SEO surface (2026-10-08) | curl `/robots.txt`, `/sitemap.xml`, a tool page | robots allows answer engines, blocks training crawlers and `/admin`; sitemap lists 19 URLs on `https://platformchangelog.dev`; tool pages carry `og:title` / `og:description` |

## Honest status

| Part | State |
|---|---|
| Fetch, normalize, dedupe, triage | ✅ verified on real GitHub feeds |
| Blog RSS feeds | ⚠️ the build sandbox's network policy blocked these five hosts, so they were not fetched here. The URLs were confirmed working from a normal network on 2026-09-22. Confirm on day 1 with `npm run ingest:dry` |
| LLM summarization | ⚠️ typechecked against the current SDK, not run live (no API key in the build environment). First real run should use `MAX_LLM_CALLS_PER_RUN=10` |
| Auto-publish and admin audit | ✅ publish checks unit-tested; publish path verified against Postgres with a stubbed model call (2026-10-09). Not yet run with a live model |
| Sponsorship | ⚙️ schema and rendering slots only; no admin UI for placements |
| Entity descriptions | ⚠️ starter drafts; verify each before launch |

## Recovery

- **A feed breaks**: the run continues; the error is on `sources.last_error`. Fix the URL in `data/sources.json` and re-seed, or set `active = false`.
- **The LLM provider is down**: after 3 consecutive errors the run stops summarizing and leaves items `pending_llm` for the next run.
- **A bad entry got published**: set it back with `update items set status = 'rejected' where id = ...;` or fix it and add an `editor_note`.
