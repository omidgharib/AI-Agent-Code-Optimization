// FILE: src/core/config.ts
import type { AuditConfig } from "./types";

export function buildConfig(
  opts: Partial<AuditConfig> & { path?: string },
): AuditConfig {
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
    model: opts.model ?? process.env.AI_AUDITOR_MODEL ?? "gpt-4.1-mini",
    baseUrl:
      opts.baseUrl ??
      process.env.AI_AUDITOR_BASE_URL ??
      "https://api.openai.com",
    apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    html: opts.html ?? false,
  };
}
