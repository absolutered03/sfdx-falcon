// Single source of truth for the controlled vocabularies. The DB enums, the LLM
// output schema and the UI filters all import from here, so they cannot drift.

export const CATEGORIES = [
  "idp", // internal developer platforms and portals, golden paths, scorecards, catalogs
  "ai_agents", // agents on the platform: MCP servers, AI SRE, IaC copilots, AI pipeline checks
  "cicd",
  "observability",
  "supply_chain",
  "cost_governance", // cost, permissions, policy, governance of agents on platform APIs
  "reports", // surveys, benchmarks, DX / agent-experience measurement
  "app_platforms", // enterprise PaaS (Salesforce first): DevOps, governance and agents on the platform
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  idp: "IDP & portals",
  ai_agents: "AI agents on platform",
  cicd: "CI/CD",
  observability: "Observability",
  supply_chain: "Supply chain",
  cost_governance: "Cost & governance",
  reports: "Reports & DX data",
  app_platforms: "Enterprise app platforms",
};

export const ITEM_KINDS = [
  "release",
  "post",
  "case_study",
  "incident",
  "report",
  "announcement",
  "sponsored",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const IMPACTS = ["notable", "major"] as const;
export type Impact = (typeof IMPACTS)[number];

// Flags the LLM may raise. Shown in /admin, never publicly. The system adds two of its
// own outside this list: llm_failed and held_by_checks.
export const FLAGS = [
  "vendor_marketing",
  "unverified_claim",
  "no_concrete_change",
  "breaking_change",
  "security_fix",
  "deprecation",
] as const;
export type Flag = (typeof FLAGS)[number];

export const ITEM_STATUSES = [
  "pending_llm", // fetched and passed the prefilter, waiting for the summarizer
  "draft", // held: failed a publish check or the model call failed; off the site
  "out_of_scope", // prefilter or LLM said no; kept so it is never re-fetched
  "logged", // routine patch release: version, date and link only, no generated text.
  //           Shown in an entity's release history, never in the feed.
  "approved", // public
  "rejected", // an editor unpublished or rejected it
] as const;
