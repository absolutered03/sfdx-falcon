// Deterministic gate in front of the LLM. Broad feeds (The New Stack, InfoQ) publish
// far more off-niche than on-niche, and every item this rejects is an LLM call saved.
// Tune by editing the lists; no model is involved.

const SCOPE_TERMS = [
  "platform engineering", "platform team", "internal developer", "developer portal", "idp",
  "golden path", "paved road", "self-service", "service catalog", "scorecard",
  "backstage", "port.io", "cortex", "opslevel", "humanitec", "roadie",
  "developer experience", "devex", "dora", "space framework", "change failure", "pr size",
  "mcp", "model context protocol", "ai sre", "incident agent", "agentic", "coding agent",
  "kubernetes", "gitops", "argo", "flux", "crossplane", "terraform", "opentofu", "pulumi",
  "kyverno", "open policy agent", "opa", "policy as code",
  "ci/cd", "pipeline", "github actions", "progressive delivery", "rollback", "canary",
  "opentelemetry", "observability", "postmortem", "post-mortem", "incident review", "outage",
  "supply chain", "sbom", "slsa", "sigstore", "provenance",
  "finops", "cloud cost", "guardrail", "least privilege", "rbac",
  "jenkins", "tekton", "salesforce", "agentforce", "platform-as-a-service", "eks",
  "servicenow", "power platform", "power apps", "dataverse", "copilot studio",
  "sap btp", "business technology platform", "kyma",
];

// Consumer and model-release news is out of scope for v1 even when it mentions agents.
const DENY_TERMS = [
  "webinar", "register now", "sponsored", "funding round", "raises $", "series a", "series b",
  "iphone", "chatgpt plus", "image generation", "benchmark leaderboard",
];

export interface PrefilterResult {
  pass: boolean;
  reason: string;
}

// Whole-word match, so "eks" does not fire on "weeks" or "idp" inside another word.
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const toRegex = (t: string) => new RegExp(`${/^\w/.test(t) ? "\\b" : ""}${escape(t)}${/\w$/.test(t) ? "\\b" : ""}`, "i");
const DENY = DENY_TERMS.map((t) => [t, toRegex(t)] as const);
const SCOPE = SCOPE_TERMS.map((t) => [t, toRegex(t)] as const);

/** `terms` replaces the global scope list for one source (see sources.keyword_terms). */
export function prefilter(title: string, excerpt: string, terms?: string[] | null): PrefilterResult {
  const hay = `${title}\n${excerpt.slice(0, 3000)}`;
  const denied = DENY.find(([, re]) => re.test(hay));
  if (denied) return { pass: false, reason: `prefilter: deny term "${denied[0]}"` };
  const scope = terms?.length ? terms.map((t) => [t, toRegex(t)] as const) : SCOPE;
  const hit = scope.find(([, re]) => re.test(hay));
  return hit ? { pass: true, reason: `prefilter: matched "${hit[0]}"` } : { pass: false, reason: "prefilter: no scope term" };
}
