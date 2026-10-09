// Deterministic gate between the model's output and the public feed. No model judgment
// here: every check is a rule a test can pin down. An item that fails any of them is
// held (status "draft") and never published until an editor chooses to.

import type { ItemSummary } from "./summarize";

// Generous on purpose: the longest summary in 72 eval drafts was 752 characters and the
// longest platform line 483. These catch runaway output, not wordy-but-fine entries.
export const SUMMARY_MAX = 900;
export const PLATFORM_IMPACT_MAX = 600;

// Editorial rule 7. Whole words only, so "seamlessly" matches and "seam" does not.
const HYPE = /\b(revolutionary|revolutionize[sd]?|game[- ]chang(?:er|ing)|seamless(?:ly)?|groundbreaking|cutting[- ]edge|best[- ]in[- ]class|world[- ]class)\b/i;
const DASHES = /[\u2013\u2014]/; // en and em dash
const MARKUP_OR_LINK = /<\/?[a-z!][^>]*>|https?:\/\/|\bwww\./i;

export function publishChecks(url: string, d: Pick<ItemSummary, "summary" | "platform_impact">): string[] {
  const failed: string[] = [];
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") failed.push("source link is not http(s)");
  } catch {
    failed.push("no valid source link");
  }
  const summary = d.summary.trim();
  const impact = d.platform_impact.trim();
  if (!summary) failed.push("empty summary");
  if (!impact) failed.push("empty platform impact");
  if (summary.length > SUMMARY_MAX) failed.push(`summary over ${SUMMARY_MAX} characters`);
  if (impact.length > PLATFORM_IMPACT_MAX) failed.push(`platform impact over ${PLATFORM_IMPACT_MAX} characters`);
  const text = `${summary}\n${impact}`;
  if (DASHES.test(text)) failed.push("em or en dash");
  if (MARKUP_OR_LINK.test(text)) failed.push("markup or a link in generated text");
  const hype = text.match(HYPE);
  if (hype) failed.push(`hype word "${hype[0].toLowerCase()}"`);
  return failed;
}
