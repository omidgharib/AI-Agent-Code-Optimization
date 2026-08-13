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
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    html: opts.html ?? false,
  };
}
