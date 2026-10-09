import assert from "node:assert/strict";
import { test } from "node:test";
import { PLATFORM_IMPACT_MAX, SUMMARY_MAX, publishChecks } from "./publish-checks";

const ok = {
  summary: "Argo CD 3.2.0 adds sharded application controllers and drops support for Kubernetes 1.29.",
  platform_impact: "Teams on Kubernetes 1.29 must upgrade the cluster before moving to 3.2.",
};
const url = "https://github.com/argoproj/argo-cd/releases/tag/v3.2.0";

test("a clean entry passes", () => {
  assert.deepEqual(publishChecks(url, ok), []);
});

test("source link must be a valid http(s) URL", () => {
  assert.deepEqual(publishChecks("", ok), ["no valid source link"]);
  assert.deepEqual(publishChecks("javascript:alert(1)", ok), ["source link is not http(s)"]);
});

test("empty and runaway fields are held", () => {
  assert.ok(publishChecks(url, { ...ok, summary: "  " }).includes("empty summary"));
  assert.ok(publishChecks(url, { ...ok, platform_impact: "" }).includes("empty platform impact"));
  assert.ok(publishChecks(url, { ...ok, summary: "a".repeat(SUMMARY_MAX + 1) }).some((r) => r.startsWith("summary over")));
  assert.ok(publishChecks(url, { ...ok, platform_impact: "a".repeat(PLATFORM_IMPACT_MAX + 1) }).some((r) => r.startsWith("platform impact over")));
});

test("em and en dashes are held, hyphens are not", () => {
  assert.deepEqual(publishChecks(url, { ...ok, summary: "Argo CD 3.2 ships \u2014 finally." }), ["em or en dash"]);
  assert.deepEqual(publishChecks(url, { ...ok, summary: "Versions 3.0\u20133.2 are affected." }), ["em or en dash"]);
  assert.deepEqual(publishChecks(url, { ...ok, summary: "A well-known, self-hosted tool." }), []);
});

test("markup and links in generated text are held", () => {
  assert.deepEqual(publishChecks(url, { ...ok, summary: "See <a href=x>here</a>." }), ["markup or a link in generated text"]);
  assert.deepEqual(publishChecks(url, { ...ok, platform_impact: "Details at https://evil.example." }), ["markup or a link in generated text"]);
  assert.deepEqual(publishChecks(url, { ...ok, summary: "Requires Kubernetes 1.30 or later (>= 1.30)." }), []);
});

test("hype words are held as whole words only", () => {
  assert.deepEqual(publishChecks(url, { ...ok, summary: "A seamless upgrade path." }), ['hype word "seamless"']);
  assert.deepEqual(publishChecks(url, { ...ok, summary: "It is game-changing." }), ['hype word "game-changing"']);
  assert.deepEqual(publishChecks(url, { ...ok, summary: "Fixes a seam in the API." }), []);
});
