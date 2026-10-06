# 04 Editorial rules: how not to become a vendor-press rewrite site

| | |
|---|---|
| Status | Proposed; the public summary is on `/about` |
| Date | 2026-10-06 |
| Owner | CT |
| Audience | Whoever presses Approve |

The failure mode is quiet. Vendor posts are the easiest thing to ingest, they summarize cleanly, and after three months the feed is a press-release mirror. These rules exist to stop that drift, and most of them are enforced in code or data rather than by memory.

## The rules

| # | Rule | Enforced by |
|---|---|---|
| 1 | **Primary sources over coverage of them.** Link the release notes, the postmortem, the report PDF; not the article about it. If a media piece is the only source, say so. | `sources.tier`; reviewer |
| 2 | **Every entry answers "what changes for a platform team".** If the honest answer is "nothing concrete", reject it or say exactly that. | Required `platform_impact` field; `no_concrete_change` flag |
| 3 | **A vendor announcement on its own is never Major.** Major needs a breaking change, a security fix, a capability teams will plan around, or new primary data, and for vendor claims, corroboration from a non-vendor source. | Prompt rule; reviewer; `unverified_claim` flag |
| 4 | **Claims are attributed, not repeated.** "The vendor says it cuts MTTR 60%" not "cuts MTTR 60%". No adoption, ROI or performance number is published without its source in the sentence. | Prompt rule; reviewer |
| 5 | **Case studies and postmortems outrank launches.** When choosing what leads the digest, a real postmortem beats a launch every time. | Digest template puts case notes above releases |
| 6 | **Ratio check, weekly.** If vendor-tier items exceed a third of approved entries in a week, cut vendor items before adding more. | Query in the weekly checklist below |
| 7 | **No hype vocabulary.** No "revolutionary", "game-changing", "seamless", no em dashes. Adjectives only where the source earned them. | Prompt rule; reviewer |
| 8 | **Sponsors buy placements, never coverage.** No paid inclusion, no pre-review, no veto. A sponsor's ad never sits on a page for a product it sells or competes with. Sponsored content never gets an impact tag. | `placements`, `conflict_entity_slugs`, `kind = sponsored` |
| 9 | **Tool pages say who owns the thing.** Vendor-owned, foundation-governed, or community; and who funded a report. | `entities.vendor`, `entities.governance` |
| 10 | **Corrections are visible.** Fix the entry, add an editor note saying what changed and when. | `editor_note` |
| 11 | **Practical notes are human-only.** The model never writes the opinion layer of a tool page. | Seed never writes `practical_notes`; no LLM path touches it |
| 12 | **When in doubt, reject.** An empty day is better than a filler entry. The digest template says "nothing major this week" rather than promoting a notable item. | Digest template |

## Weekly checklist (10 minutes)

1. Vendor share of the week's approved items:
   ```sql
   select s.tier, count(*) from items i join sources s on s.id = i.source_id
   where i.status = 'approved' and i.reviewed_at > now() - interval '7 days' group by 1;
   ```
2. Skim the "model said out of scope" list in `/admin` for false negatives.
3. Check `sources.last_error`; fix or deactivate dead feeds.
4. Add one practical note to one tool page. This is the moat; it compounds.
