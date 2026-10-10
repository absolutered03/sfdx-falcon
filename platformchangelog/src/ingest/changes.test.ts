import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { condenseForModel, countChanges, isMaintenanceOnly, parseChangelogFile, parseChanges } from "./changes";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

test("Kyverno 1.19.0 (Atom text): every line typed, credits stripped", () => {
  const lines = parseChanges(fixture("kyverno-1.19.0-atom.txt"));
  const { total, counts } = countChanges(lines);
  assert.ok(total >= 125, `expected about 130 lines from the stored 12k excerpt, got ${total}`);
  assert.ok(counts.fixed > 40 && counts.added > 10 && counts.maintenance > 30);
  assert.ok(lines.every((l) => !/ by @|#\d{4,}/.test(l.text)), "credits and PR numbers removed");
  assert.ok(lines.some((l) => l.type === "security" && /CVE-2026-32280/.test(l.text)));
  assert.ok(lines.some((l) => /label_match/.test(l.text)), "underscores inside names survive");
  assert.equal(lines.find((l) => /cli apply cross resource/i.test(l.text))?.type, "added");
  assert.equal(lines.find((l) => /zerolog/.test(l.text))?.type, "maintenance");
  assert.equal(lines.find((l) => /cosign releaser/.test(l.text))?.type, "maintenance");
});

test("markdown release notes: headings set context, breaking and prefixes win", () => {
  const md = [
    "## What's Changed",
    "### ⚠ BREAKING CHANGES",
    "* drop support for Kubernetes 1.29 (#101)",
    "### Features",
    "* **helm:** OCI chart signing (#102) ([abc1234](https://github.com/x/y/commit/abc1234))",
    "* feat(api)!: rename spec.rules to spec.policies by @dev in https://github.com/x/y/pull/103",
    "### Bug Fixes",
    "* handle empty selectors",
    "* chore(deps): bump golang.org/x/net from 0.30.0 to 0.31.0 to fix CVE-2026-11111",
    "```",
    "helm upgrade --install x",
    "```",
    "## New Contributors",
    "* @someone made their first contribution in #99",
    "**Full Changelog**: https://github.com/x/y/compare/v1...v2",
  ].join("\n");
  const lines = parseChanges(md);
  assert.equal(lines.length, 5);
  assert.deepEqual(lines[0], { type: "removed", text: "Drop support for Kubernetes 1.29", breaking: true });
  assert.equal(lines[1].type, "added");
  assert.equal(lines[1].text, "Helm: OCI chart signing");
  assert.deepEqual(lines[2], { type: "added", text: "Rename spec.rules to spec.policies", breaking: true });
  assert.equal(lines[3].type, "fixed");
  assert.equal(lines[4].type, "security", "a dependency bump that fixes a CVE is security");
});

test("nightly and dependency-only releases are maintenance only", () => {
  assert.ok(isMaintenanceOnly(parseChanges("!! Release as nightly !!")));
  assert.ok(isMaintenanceOnly(parseChanges("")));
  assert.ok(isMaintenanceOnly(parseChanges("* chore(deps): bump @salesforce/core from 8.1.0 to 8.1.1\n* ci: pin node")));
  assert.ok(!isMaintenanceOnly(parseChanges("* fix: org login race on Linux")));
});

test("condensed model input leads with counts and drops maintenance", () => {
  const lines = parseChanges(fixture("kyverno-1.19.0-atom.txt"));
  const text = condenseForModel(lines, 12_000);
  assert.match(text, /^Release notes, condensed: \d+ changes in total/);
  assert.ok(!/zerolog/.test(text), "maintenance lines are not sent");
  assert.ok(text.indexOf("security:") < text.indexOf("fixed:"), "security before fixes");
  assert.ok(condenseForModel(lines, 800).length <= 800);
});

test("Salesforce CLI release notes file: weekly sections with NEW / CHANGE / FIX", () => {
  const releases = parseChangelogFile(fixture("salesforce-cli-releasenotes.md"));
  assert.deepEqual(releases.map((r) => [r.version, r.channel]), [["2.154.4", "stable-rc"], ["2.153.5", "stable"], ["2.152.14", null], ["2.151.7", null]]);
  const stable = releases[1];
  assert.equal(stable.date.toISOString().slice(0, 10), "2026-10-07");
  assert.equal(stable.anchor, "21535-october-7-2026-stable");
  assert.deepEqual(stable.lines.map((l) => l.type), ["added", "changed", "fixed"]);
  assert.match(stable.lines[1].text, /SF_TEMP_SHOW_SECRETS/);
  assert.ok(stable.lines.every((l) => !/plugin-\w+ PR/.test(l.text)), "PR credits stripped");
});

test("component scopes, release-please feed text, backports", () => {
  const opa = parseChanges("Ast: Fix panic for shadowed root document calls ( #8897 ) authored by @dev\nTopdown+util: Add generic SliceStack ( #9001 )\nCompile: Validate plan-addons exist ( #9092 )");
  assert.deepEqual(opa.map((l) => l.type), ["fixed", "added", "other"]);
  assert.equal(opa[0].text, "Ast: Fix panic for shadowed root document calls");
  const rp = parseChanges("0.4.30 (2026-02-20)\nBug Fixes\nvalidate namespace before running custom analyzers ( #1617 ) ( 458aa9d )");
  assert.deepEqual(rp, [{ type: "fixed", text: "Validate namespace before running custom analyzers" }]);
  assert.equal(parseChanges("* [Backport release-2.3] Bump go to 1.26\n* fix: x")[0].type, "maintenance");
  assert.equal(parseChanges("Signed-off-by: bot <a@b.c>\nCo-authored-by: x <y@z>").length, 0);
});
