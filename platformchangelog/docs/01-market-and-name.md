# 01 Market check and name

| | |
|---|---|
| Status | Draft for decision |
| Date | 2026-10-06 |
| Owner | CT |
| Audience | CT |

## Read this first

1. **The news layer is crowded; the registry layer is not.** A daily feed of 2 to 3 sentence summaries for DevOps and platform engineers already exists at scale: TLDR DevOps has about 350,000 subscribers and that exact format. Competing on the feed alone is a losing position.
2. **Almost every existing map of this niche is owned by a vendor in it.** PlatformEngineering.org and InternalDeveloperPlatform.org are Humanitec's. The DX-measurement newsletter is DX's. The AI SRE landscapes are written by Bronto and Mezmo. The "Backstage vs Port" pages are written by Cortex and OpsLevel. **Vendor neutrality is the wedge, and it is only worth anything if the editorial rules in [04](04-editorial-rules.md) hold.**
3. **Nobody keeps interpreted release history per tool.** Awesome-lists and MCP directories list things; none of them say what v2.4 changed for a platform team, or link a tool to its public postmortems.
4. **Strongest single recommendation: lead with the registry, treat the feed as its intake.** Tool pages with release history, comparisons and case notes are the durable, searchable asset. The feed is how pages stay fresh and how people find them.

## Who is already here

Confidence: high where a source is linked, `[estimate]` where noted.

### Feeds and newsletters (crowded)

| Competitor | Format | Overlap | Gap we exploit |
|---|---|---|---|
| [TLDR DevOps](https://tldr.tech/devops) | Daily email, 10 to 15 links, 2 to 3 sentence summaries, ~350k subs | **Direct format overlap** | Broad DevOps/infra, no registry, no "what changes for platform teams", no history |
| [Platform Weekly](https://platformweekly.com/) | Weekly Substack, 42k+ subs | Same audience, IDP-heavy | Run by the Humanitec-founded community; weekly, not a reference |
| DevOps Weekly, KubeWeekly, SRE Weekly, DevOps'ish ([roundup](https://thectoclub.com/news/best-devops-newsletters)) | Weekly link roundups | Partial | Link lists without interpretation or entity pages |
| [Rohit Ghumare's weekly](https://thatdevopsguy.substack.com/p/devops-cloud-native-and-ai-now-weekly) | Weekly, DevOps + AI | AI-for-platform angle | Personal newsletter, no registry |
| [The New Stack](https://thenewstack.io), [DevOps.com](https://devops.com/), InfoQ | High-volume media | Source material for us | Vendor-heavy, no structured per-tool history |
| [Engineering Enablement (DX)](https://newsletter.getdx.com/) | DX research newsletter | DX and AI-impact measurement | Owned by a DX-measurement vendor |

### Registries and maps (thin, mostly vendor-owned)

| Competitor | What it is | Gap |
|---|---|---|
| [PlatformEngineering.org tooling landscape](https://thenewstack.io/platform-engineering-it-is-all-about-the-tooling/), [InternalDeveloperPlatform.org](https://internaldeveloperplatform.org/platform-tooling/) | Category maps of IDP tooling | Humanitec-owned; static; no release history |
| [PulseMCP](https://agentpedia.codes/mcp/pulsemcp), [Glama](https://glama.ai/newsletter), [mcp.so](https://mcp.so/), official MCP registry | Horizontal MCP directories, 17k+ servers indexed | Every MCP server for everything; no platform-engineering lens, no interpretation |
| [awesome-devops-ai](https://github.com/hammadhaqqani/awesome-devops-ai) (474 entries), [awesome-devops-mcp-servers](https://github.com/rohitg00/awesome-devops-mcp-servers) | Curated lists | No history, no comparison, no case notes |
| [Bronto AI SRE landscape](https://bronto.io/resources/articles/ai-sre-landscape-2026-66-tools-evaluated), [Mezmo market map](https://www.mezmo.com/learn/the-2026-ai-sre-market-map-agents-harnesses-and-the-data-layer) | One-off vendor articles | Written by vendors in the category; not maintained |
| Vendor comparison pages ([Cortex on OpsLevel vs Backstage](https://www.cortex.io/post/opslevel-vs-backstage), [OpsLevel on Port vs Backstage](https://www.opslevel.com/resources/port-vs-backstage-whats-the-best-internal-developer-portal)) | SEO comparisons | Written by a competitor of both subjects |

## Is the niche too crowded?

**No, if the product is the registry. Yes, if it is the feed.** Two honest caveats:

- **Audience ceiling.** Platform Weekly at ~42k is a reasonable reference for the whole addressable newsletter audience. This is a deep, narrow niche, which is good for sponsor CPMs and bad for scale `[estimate]`.
- **Volume is lower than ai-tldr.** The first dry run against real feeds (2026-10-06) found 78 GitHub release entries across 8 repos in 30 days, of which **8** were worth a summary once pre-releases, chart tags and routine patches were filtered. Daily volume will come from blogs, not releases. Expect 3 to 8 approved items a day at launch, not 30.

## Name and URL

**Recommendation: Platform Changelog, at `platformchangelog.dev`** (redirect `platformchangelog.com`).

- Says exactly what it is, and matches how people search ("crossplane 2.4 changelog", "backstage release notes").
- `.dev` reads correctly to the audience and forces HTTPS.
- No collision with TLDR's brand, which a "*-tldr" name would invite.

| Candidate | Domains | Note |
|---|---|---|
| **Platform Changelog** | platformchangelog.dev, .com, .io | Recommended. "Changelog" is generic, though [The Changelog](https://changelog.com) podcast is adjacent |
| The Paved Road | thepavedroad.dev, pavedroadreport.com | Insider term, more brand than description; pavedroad.dev is taken |
| Paved Log | pavedlog.dev | Shorter blend of both ideas |

> **Verify before buying.** Availability was checked by DNS on 2026-10-06: every recommended domain returned no record at all (taken domains such as `goldenpaths.dev`, `controlplane.news` and `pavedroad.io` resolve, and `paved.dev` / `pavedroad.dev` exist with no address). That is a strong hint, not proof. Registrar lookup was blocked from the build environment. Check at the registrar.
