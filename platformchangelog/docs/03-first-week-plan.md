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

### Added 2026-10-08: supporting tools, enterprise platforms, AWS

| Source | Tier | Policy | Verified |
|---|---|---|---|
| GitHub releases: Flux, OpenTofu, OPA, Argo Rollouts, Salesforce DX MCP Server | primary / vendor | every product release is a candidate | ✅ feeds parsed 2026-10-08 |
| GitHub releases: Jenkins, Tekton, Argo Workflows, Salesforce CLI | primary / vendor | **light coverage** (`release_policy = major_or_security`): only a new major line or a security fix reaches the feed; everything else is logged on the tool page | ✅ 2026-10-08: 31 releases in 30 days, 1 to the feed (a Tekton security fix) |
| Jenkins security advisories RSS | primary | all items | ⚠️ blocked in the build sandbox; check on day 1 |
| Salesforce Developers Blog | vendor | strict Salesforce platform-team term list (`keyword_terms`) | ⚠️ blocked in the build sandbox |
| What's New with AWS | vendor | strict AWS service term list (EKS, CodePipeline, CloudFormation, CDK, Q Developer, DevOps Agent, AgentCore, ECR, CloudWatch, Control Tower...) | ⚠️ blocked; **expect high volume, watch the prefilter pass rate in week 1** |
| AWS DevOps Blog, AWS Containers Blog | vendor | general keyword filter | ⚠️ blocked in the build sandbox |
| GitHub releases: ServiceNow SDK, Power Platform Build Tools and GitHub Actions | vendor | light coverage | ✅ 2026-10-08 |
| GitHub releases: Terraform Provider for SAP BTP | vendor | every release (monthly; the Kubernetes and IaC crossover) | ✅ 2026-10-08 |
| Microsoft Power Platform Blog | vendor | strict ALM and governance term list | ✅ 2026-10-08: ~8 posts a month, 5 of 6 recent passed |

New category: **Enterprise app platforms** (`app_platforms`), Salesforce first: platform-team concerns only (release governance, DevOps tooling, APIs and integration, permission and security model changes, agents such as Agentforce), not end-user feature marketing. Added the same day: ServiceNow, Microsoft Power Platform and SAP BTP. ServiceNow's and SAP's own blog feeds could not be confirmed, so they are not listed; media coverage reaches them through the general keyword list. Open-source Kyma has not released since 2023 and is not tracked.

**Not ingested, on purpose:** Platform Weekly and other newsletters are competitors and aggregators, so read them for discovery and add what you find by hand from the primary source. Annual reports (DORA, Puppet, State of Platform Engineering) are manual adds when they drop.

**Add in week 2, after verifying each feed URL:** Backstage blog, Humanitec engineering blog, Flux, Open Policy Agent, OpenTofu, Argo Rollouts releases, and two or three companies' engineering blogs that publish real platform postmortems.

## Day by day

| Day | Do | Done when |
|---|---|---|
| 1 | ~~Register the domain~~ (done 2026-10-08). Set up email forwarding for `editor@platformchangelog.dev`, the address `/about` publishes. Move this folder into its own repo (the workflow file only runs from a repo root). Create a Railway project with Postgres. `npm ci`, `npm run db:push`, `npm run seed`, `npm run ingest:dry`, then `MAX_LLM_CALLS_PER_RUN=10 npm run ingest`. | 10 drafts in `/admin` |
| 2 | Read all 10 drafts against their sources. Tune the system prompt in `summarize.ts` and the keyword lists. Re-run on the backlog. Verify every entity description against the project's own site. | You would publish 8 of 10 drafts with light edits |
| 3 | Approve the 30-day backfill. Write practical notes for Backstage, Port, Argo CD, Crossplane and the Kubernetes MCP server. Hand-add 3 to 5 real case studies or postmortems. | 5 tool pages you would send to a peer |
| 4 | Deploy the site to Railway and attach the domain (steps below). Add `DATABASE_URL` and `ANTHROPIC_API_KEY` as repo secrets and enable the cron workflow. | Cron runs green twice unattended |
| 5 | Add an RSS feed of approved items. (`sitemap.xml`, `robots.txt` and OpenGraph tags are already built.) Submit the sitemap in Google Search Console and Bing Webmaster Tools. | Search Console shows the sitemap read with 19+ URLs |
| 6 | `npm run digest`, write the intro and reader question, set it up in Buttondown. Read the whole site once on a phone. | Digest #1 ready to send |
| 7 | Soft launch: one LinkedIn post about why a vendor-neutral registry for this niche is needed, link in the first comment. Send digest #1 to whoever subscribed. | First 25 subscribers is a fine day-7 number |

## Backfill (decided 2026-10-08)

| What | Backfill? | Why |
|---|---|---|
| **Current version and recent release history** | ✅ automatic | On a feed's first fetch, releases older than the 30-day window are stored as logged history (no LLM, no review). GitHub's release feed holds the latest 10, which is enough for every tool to show a current version on day one. |
| **One reviewed entry per tool** | ✅ recommended, one sitting | Summarize each tool's latest minor or major release so every visible page opens with a reviewed "what changed". About 30 drafts, at roughly $0.0014 each on Haiku 5.5; the real cost is about an hour of review. |
| **Feed news older than 30 days** | ❌ | A "what shipped" feed full of old news reads as stale, and blog feeds only expose recent posts anyway. |
| **A year of release history** | ⏸ later, if wanted | Needs the GitHub API with a token (60 requests an hour without one). Nice for tool pages, not needed to launch. |

## Attaching platformchangelog.dev

1. In Railway, open the web service, Settings, Networking, **Custom Domain**, and add `platformchangelog.dev`. Railway shows the DNS record to create.
2. At the registrar, create that record. An apex domain cannot hold a plain CNAME, so use the registrar's **ALIAS / ANAME / CNAME-flattening** record if it offers one. If it does not, move DNS to Cloudflare (free) and use a flattened CNAME there, with the proxy turned **off** so Railway can issue the certificate.
3. Add `www.platformchangelog.dev` as a second custom domain and redirect it to the apex.
4. Wait for Railway to show the certificate as issued before testing.

> **`.dev` only works over HTTPS.** The whole TLD is on the browser HSTS preload list, so there is no plain-HTTP fallback: until the certificate is issued the site simply will not load. That is expected, not a misconfiguration.

Verify:

```bash
dig +short platformchangelog.dev          # resolves to Railway
curl -sI https://platformchangelog.dev    # HTTP/2 200
curl -s https://platformchangelog.dev/robots.txt | tail -2   # ends with the Sitemap line
```

## After week 1

- Watch the ratio of approved to drafted. Below about 60%, the prefilter or prompt needs work before adding sources.
- Track which tool pages get search traffic. That tells you which practical notes to write next.
- Sponsorship conversations start when the digest has a few thousand engaged readers, not before `[estimate]`. Treat the first months as a credibility asset, not a revenue line.
