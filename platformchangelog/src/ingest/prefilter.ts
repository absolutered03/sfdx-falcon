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
  "kyverno", "open policy agent", "opa ", "policy as code",
  "ci/cd", "pipeline", "github actions", "progressive delivery", "rollback", "canary",
  "opentelemetry", "observability", "postmortem", "post-mortem", "incident review", "outage",
  "supply chain", "sbom", "slsa", "sigstore", "provenance",
  "finops", "cloud cost", "guardrail", "least privilege", "rbac",
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

export function prefilter(title: string, excerpt: string): PrefilterResult {
  const hay = `${title}\n${excerpt.slice(0, 3000)}`.toLowerCase();
  const denied = DENY_TERMS.find((t) => hay.includes(t));
  if (denied) return { pass: false, reason: `prefilter: deny term "${denied}"` };
  const hit = SCOPE_TERMS.find((t) => hay.includes(t));
  return hit ? { pass: true, reason: `prefilter: matched "${hit}"` } : { pass: false, reason: "prefilter: no scope term" };
}
