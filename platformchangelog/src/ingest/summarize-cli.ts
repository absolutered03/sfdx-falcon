// Comparison-only backend: runs the exact production prompt and schema through the
// local Claude Code CLI (`claude -p`), which bills to the signed-in Claude subscription
// instead of an API key. Used by scripts/compare-models.ts and nothing else; the
// ingest job always goes through the API in summarize.ts.
//
// The CLI is locked down so the comparison measures the model, not the harness:
// no tools, no MCP servers, no user/project settings or hooks, no saved session, and it
// runs from the OS temp dir so no CLAUDE.md is picked up. It still adds a small fixed
// preamble of its own, so token counts run slightly above a direct API call.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { z } from "zod";
import {
  ItemSummary,
  SYSTEM,
  buildUserPrompt,
  enforceAllowList,
  type SummarizeInput,
  type SummarizeOptions,
  type SummarizeResult,
} from "./summarize";

const SCHEMA = JSON.stringify(z.toJSONSchema(ItemSummary));
const TIMEOUT_MS = 180_000;

interface CliModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

function runCli(args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
    });
    child.stdin.end(stdin);
  });
}

export async function summarizeItemViaCli(input: SummarizeInput, opts: SummarizeOptions = {}): Promise<SummarizeResult> {
  const model = opts.model ?? "claude-opus-5-5";
  const args = [
    "-p",
    "--model", model,
    "--system-prompt", SYSTEM,
    "--json-schema", SCHEMA,
    "--output-format", "json",
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
  ];
  // Haiku 4.5 takes no effort setting; every newer model gets the production effort.
  if (!model.startsWith("claude-haiku-4")) args.push("--effort", opts.effort ?? "low");

  const raw = JSON.parse(await runCli(args, buildUserPrompt(input)));
  // The CLI may also make small side calls on another model; count only the one asked for.
  const mu = (raw.modelUsage?.[model] ?? {}) as Partial<CliModelUsage>;
  const usage = {
    inputTokens: (mu.inputTokens ?? 0) + (mu.cacheReadInputTokens ?? 0) + (mu.cacheCreationInputTokens ?? 0),
    outputTokens: mu.outputTokens ?? 0,
    costUsd: mu.costUSD ?? 0,
  };

  if (raw.is_error) return { ok: false, reason: `cli error: ${String(raw.result ?? raw.subtype).slice(0, 200)}`, model, usage };
  const parsed = ItemSummary.safeParse(raw.structured_output);
  if (!parsed.success) return { ok: false, reason: "output failed schema validation", model, usage };
  return { ok: true, model, usage, data: enforceAllowList(parsed.data, input.entitySlugs) };
}
