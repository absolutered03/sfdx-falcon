# 03 First-week plan

| | |
|---|---|
| Status | Plan |
| Date | 2026-10-06 |
| Owner | CT |
| Audience | CT |

## Read this first

- **Launch bar for day 7**: 16 tool pages, ~50 approved entries covering the last 30 days, a methodology page, and digest #1 drafted. Ugly is fine; empty is not.
- **The review queue is the real cost.** Budget 20 to 30 minutes a day for it. If that slips, the site goes stale, and that is the failure to design against, not code.
- **The moat is the practical notes on tool pages**, which only you can write. Automation buys you the time to write them.

## What to hardcode, what to automate

| Hardcode (JSON in `data/`, edit by hand) | Automate | Do by hand, every time |
|---|---|---|
| Source allow-list (`data/sources.json`) | Fetching, ETag polling, dedupe | Approve, edit or reject every draft |
| Registry entities and descriptions (`data/entities.json`) | Pre-release, chart-tag and patch triage | Practical notes on tool pages |
| Alternatives and their one-line notes | First-pass summary, tags, impact, entity links | Digest intro and the reader question |
| Category list (`src/lib/taxonomy.ts`) | Run summary in the Actions log | Case studies and postmortems found off-feed (manual add form) |
| Scope and deny keyword lists (`src/ingest/prefilter.ts`) | Digest outline (`npm run digest`) | Sponsor decisions, later |

## Smallest launch source set (13)

Already in `data/sources.json`. Feed URLs for the five blogs were fetched and confirmed working on 2026-09-22; the GitHub feeds were fetched and parsed on 2026-10-06.

| Source | Tier | Why |
|---|---|---|
| Kubernetes Blog | primary | Release and deprecation news platform teams plan around |
| CNCF Blog (keyword-filtered) | community | Project updates and end-user case studies |
| PlatformEngineering.org Blog | community | The niche's own outlet; vendor-adjacent, so weigh accordingly |
| The New Stack (keyword-filtered) | media | Volume; most of it will be filtered out |
| InfoQ main feed (keyword-filtered) | media | Practitioner talks and case studies |
| GitHub releases: Backstage, Argo CD, Crossplane, Kyverno | primary | Core IDP and GitOps stack |
| GitHub releases: Kubernetes MCP Server, Terraform MCP Server, kagent, K8sGPT | primary / vendor | The AI-for-platform slice nobody else tracks with a platform lens |

> **Do not use `feed.infoq.com/devops/`.** It returns valid RSS but its newest items are from May 2022. The main InfoQ feed plus the keyword filter covers it.

**Not ingested, on purpose:** Platform Weekly and other newsletters are competitors and aggregators, so read them for discovery and add what you find by hand from the primary source. Annual reports (DORA, Puppet, State of Platform Engineering) are manual adds when they drop.

**Add in week 2, after verifying each feed URL:** Backstage blog, Humanitec engineering blog, Flux, Open Policy Agent, OpenTofu, Argo Rollouts releases, and two or three companies' engineering blogs that publish real platform postmortems.

## Day by day

| Day | Do | Done when |
|---|---|---|
| 1 | Register the domain. Move this folder into its own repo (the workflow file only runs from a repo root). Create a Railway project with Postgres. `npm ci`, `npm run db:push`, `npm run seed`, `npm run ingest:dry`, then `MAX_LLM_CALLS_PER_RUN=10 npm run ingest`. | 10 drafts in `/admin` |
| 2 | Read all 10 drafts against their sources. Tune the system prompt in `summarize.ts` and the keyword lists. Re-run on the backlog. Verify every entity description against the project's own site. | You would publish 8 of 10 drafts with light edits |
| 3 | Approve the 30-day backfill. Write practical notes for Backstage, Port, Argo CD, Crossplane and the Kubernetes MCP server. Hand-add 3 to 5 real case studies or postmortems. | 5 tool pages you would send to a peer |
| 4 | Deploy the site to Railway. Add `DATABASE_URL` and `ANTHROPIC_API_KEY` as repo secrets and enable the cron workflow. | Cron runs green twice unattended |
| 5 | Add an RSS feed of approved items, `sitemap.xml`, OpenGraph tags, and a `robots.txt` that allows answer engines and blocks bulk-training crawlers. | Tool pages show a proper title and description when shared |
| 6 | `npm run digest`, write the intro and reader question, set it up in Buttondown. Read the whole site once on a phone. | Digest #1 ready to send |
| 7 | Soft launch: one LinkedIn post about why a vendor-neutral registry for this niche is needed, link in the first comment. Send digest #1 to whoever subscribed. | First 25 subscribers is a fine day-7 number |

## After week 1

- Watch the ratio of approved to drafted. Below about 60%, the prefilter or prompt needs work before adding sources.
- Track which tool pages get search traffic. That tells you which practical notes to write next.
- Sponsorship conversations start when the digest has a few thousand engaged readers, not before `[estimate]`. Treat the first months as a credibility asset, not a revenue line.
