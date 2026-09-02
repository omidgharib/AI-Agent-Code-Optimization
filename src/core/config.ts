// FILE: src/core/config.ts
import type { AuditConfig } from "./types";
import { resolveModel } from "./models";

export function buildConfig(
  opts: Partial<AuditConfig> & { path?: string },
): AuditConfig {
  const model = resolveModel({
    provider: opts.provider,
    model: opts.model,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
  });

  return {
    path: opts.path ?? process.cwd(),
    url: opts.url,
    json: opts.json ?? false,
    md: opts.md ?? false,
    fix: opts.fix ?? false,
    maxFixIterations: opts.maxFixIterations ?? 2,
    fixBatch: opts.fixBatch ?? 10,
    include: opts.include ?? [],
    exclude: opts.exclude ?? [
      "node_modules",
      "dist",
      ".next",
      "coverage",
      "ai-auditor-report",
    ],
    severity: opts.severity,
    model: model.model,
    provider: model.provider,
    keyRequired: model.keyRequired,
    mechanicalAutofix: opts.mechanicalAutofix ?? true,
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    aifaUserId: opts.aifaUserId ?? process.env.AIFA_USER_ID,
    aifaSessionId: opts.aifaSessionId ?? process.env.AIFA_SESSION_ID,
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    html: opts.html ?? false,
    patchRetries: opts.patchRetries ?? 1,
    agentMode: opts.agentMode ?? (opts.dryRun ? "dry-run" : "apply"),
    issueIds: opts.issueIds ?? [],
    maxAiRequests: opts.maxAiRequests ?? 10,
    maxAgentSeconds: opts.maxAgentSeconds ?? 300,
    maxChangedFiles: opts.maxChangedFiles ?? 5,
    analysisModel: opts.analysisModel ?? model.model,
    maxAgentTokens: opts.maxAgentTokens ?? 100_000,
    maxCostUsd: opts.maxCostUsd ?? 0,
    baselinePath: opts.baselinePath,
    maxCritical: opts.maxCritical ?? Number.MAX_SAFE_INTEGER,
    maxHigh: opts.maxHigh ?? Number.MAX_SAFE_INTEGER,
    failOnNew: opts.failOnNew ?? false,
    minLighthouseScores: opts.minLighthouseScores ?? {},
    sarif: opts.sarif ?? false,
    changedOnly: opts.changedOnly ?? false,
  };
}
