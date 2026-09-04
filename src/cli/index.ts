// FILE: src/cli/index.ts
import { Command } from "commander";
import { buildConfig } from "../core/config";
import { RunCodeAudit } from "../code/application/runCodeAudit";
import { legacyCodeAuditRunner } from "../code/infrastructure/legacyAuditAdapter";
import { setDebug, setVerbose } from "../core/logger";
import { listModels } from "../core/models";
import type { AgentMode, Severity } from "../core/types";
import fs from "node:fs/promises";
import path from "node:path";
import { watch } from "node:fs";
import { applyApprovedPatch, verifyCodeRun } from "../code/application/patchCommands";

const program = new Command();
const runCodeAudit = new RunCodeAudit(legacyCodeAuditRunner);

program
  .name("ai-auditor")
  .description("AI-powered code auditing and auto-fix CLI")
  .version("1.0.0");

const code = program.command("code").description("Production-grade deterministic code audit workflow");
code.command("scan <path>").description("Read-only code analysis").option("--baseline <report.json>").option("--changed-only").option("--sarif").action(async (target, opts) => { const result = await runCodeAudit.execute(buildConfig({ path: target, json: true, md: true, html: true, sarif: opts.sarif ?? false, baselinePath: opts.baseline, changedOnly: opts.changedOnly ?? false, fix: false, dryRun: true, agentMode: "dry-run" })); process.exitCode = result.exitCode; });
code.command("fix <path>").description("Generate proposals without mutating the repository").requiredOption("--preview", "Preview only").option("--provider <id>").option("--model <model>").option("--api-key <key>").action(async (target, opts) => { const result = await runCodeAudit.execute(buildConfig({ path: target, json: true, md: true, html: true, fix: true, dryRun: true, agentMode: "dry-run", provider: opts.provider, model: opts.model, apiKey: opts.apiKey })); process.exitCode = result.exitCode; });
code.command("apply <run-id>").description("Apply one explicitly approved patch").requiredOption("--patch <id>").requiredOption("--actor <id>").requiredOption("--reason <text>").option("--path <path>", "Repository root", process.cwd()).action(async (runId, opts) => { console.log(JSON.stringify(await applyApprovedPatch(path.resolve(opts.path), runId, opts.patch, opts.actor, opts.reason), null, 2)); });
code.command("verify <run-id>").description("Repeat verification for a run").option("--path <path>", "Repository root", process.cwd()).action(async (runId, opts) => { const result = await verifyCodeRun(path.resolve(opts.path), runId); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 3; });

program
  .command("audit [path]")
  .description("Audit a codebase for issues")
  .option("--json", "Write JSON report")
  .option("--md", "Write Markdown report")
  .option("--fix", "Auto-fix issues using LLM")
  .option(
    "--no-mechanical",
    "Skip the mechanical ESLint autofix pre-pass (run before the LLM)",
  )
  .option(
    "--max-fix-iterations <n>",
    "Max fix iterations",
    "2",
  )
  .option(
    "--fix-batch <n>",
    "Issues sent to the LLM per fix/advisory iteration (default 10)",
    "10",
  )
  .option(
    "--patch-retries <n>",
    "How many times to ask the LLM to repair a diff that failed to apply (default 1)",
    "1",
  )
  .option("--include <pattern...>", "Include glob patterns")
  .option("--exclude <pattern...>", "Exclude glob patterns")
  .option("--severity <level>", "Minimum severity (low|medium|high|critical)")
  .option("--model <model>", "LLM model name (or provider preset id)")
  .option("--provider <id>", "Model provider preset (see --list-models)")
  .option("--base-url <url>", "LLM base URL")
  .option("--api-key <key>", "LLM API key")
  .option("--aifa-user-id <id>", "AIFA end-user ID (required for AIFA)")
  .option("--aifa-session-id <id>", "AIFA conversation session ID (optional)")
  .option("--list-models", "List available model providers and exit")
  .option("--dry-run", "Preview fixes without applying")
  .option("--agent-mode <mode>", "Agent mode (suggest|dry-run|apply)")
  .option("--issue-ids <ids>", "Comma-separated issue IDs to send to the agent")
  .option("--max-ai-requests <n>", "Maximum model requests per audit", "10")
  .option("--max-agent-seconds <n>", "Maximum total agent time in seconds", "300")
  .option("--max-changed-files <n>", "Maximum files the agent may change", "5")
  .option("--analysis-model <model>", "Separate model for advisory/analysis requests")
  .option("--max-agent-tokens <n>", "Estimated input-token budget", "100000")
  .option("--max-cost-usd <n>", "Estimated cost budget in USD; 0 disables", "0")
  .option("--baseline <report.json>", "Compare against a baseline report")
  .option("--max-critical <n>", "Quality gate: maximum critical issues")
  .option("--max-high <n>", "Quality gate: maximum high issues")
  .option("--fail-on-new", "Quality gate: fail when baseline has new issues")
  .option("--min-performance <n>", "Quality gate: minimum Lighthouse performance score (0-100)")
  .option("--min-accessibility <n>", "Quality gate: minimum Lighthouse accessibility score (0-100)")
  .option("--min-seo <n>", "Quality gate: minimum Lighthouse SEO score (0-100)")
  .option("--sarif", "Write report.sarif for CI/code hosting")
  .option("--changed-only", "Report only issues in Git-changed files")
  .option("--verbose", "Verbose output")
  .option(
    "--debug",
    "Debug output: full error cause chains, request URLs, retry details",
  )
  .option(
    "--url <url>",
    "URL to audit with Lighthouse (e.g. http://localhost:3000)",
  )
  .option("--html", "Write HTML report")
  .option("--export <path>", "Explicitly copy generated report files to this directory")
  .action(async (auditPath: string | undefined, opts) => {
    if (opts.verbose) setVerbose(true);
    if (opts.debug) {
      setVerbose(true);
      setDebug(true);
    }

    if (opts.listModels) {
      console.log(listModels());
      process.exit(0);
    }

    const agentMode = (opts.agentMode ?? (opts.dryRun ? "dry-run" : "apply")) as AgentMode;
    if (!["suggest", "dry-run", "apply"].includes(agentMode)) throw new Error("Invalid --agent-mode; use suggest, dry-run or apply");
    if (opts.url) console.warn("[deprecated] `audit --url` compatibility mode will be removed after this release; use the independent SEO Workspace/API for URL analysis.");
    const config = buildConfig({
      path: auditPath ?? process.cwd(),
      url: opts.url,
      json: opts.json ?? false,
      md: opts.md ?? false,
      fix: (opts.fix ?? false) || opts.agentMode !== undefined,
      mechanicalAutofix: opts.mechanical ?? true,
      maxFixIterations: parseInt(opts.maxFixIterations, 10),
      fixBatch: parseInt(opts.fixBatch, 10),
      patchRetries: parseInt(opts.patchRetries, 10),
      include: opts.include ?? [],
      exclude: opts.exclude,
      severity: opts.severity as Severity | undefined,
      model: opts.model,
      provider: opts.provider,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      aifaUserId: opts.aifaUserId,
      aifaSessionId: opts.aifaSessionId,
      dryRun: agentMode !== "apply",
      agentMode,
      issueIds: typeof opts.issueIds === "string" ? opts.issueIds.split(",").map((id: string) => id.trim()).filter(Boolean) : [],
      maxAiRequests: parseInt(opts.maxAiRequests, 10),
      maxAgentSeconds: parseInt(opts.maxAgentSeconds, 10),
      maxChangedFiles: parseInt(opts.maxChangedFiles, 10),
      analysisModel: opts.analysisModel,
      maxAgentTokens: parseInt(opts.maxAgentTokens, 10),
      maxCostUsd: parseFloat(opts.maxCostUsd),
      baselinePath: opts.baseline,
      maxCritical: opts.maxCritical === undefined ? undefined : parseInt(opts.maxCritical, 10),
      maxHigh: opts.maxHigh === undefined ? undefined : parseInt(opts.maxHigh, 10),
      failOnNew: opts.failOnNew ?? false,
      minLighthouseScores: Object.fromEntries([["performance", opts.minPerformance], ["accessibility", opts.minAccessibility], ["seo", opts.minSeo]].filter((entry) => entry[1] !== undefined).map(([key, value]) => [key, Number(value)])),
      sarif: opts.sarif ?? false,
      changedOnly: opts.changedOnly ?? false,
      verbose: opts.verbose ?? false,
      html: opts.html ?? false,
      exportPath: opts.export,
    });

    const { exitCode } = await runCodeAudit.execute(config);
    process.exit(exitCode);
  });

program
  .command("monitor [path]")
  .description("Continuously audit a JavaScript/TypeScript project")
  .option("--interval <minutes>", "Audit interval in minutes", "15")
  .option("--retention <n>", "Number of report runs to retain", "30")
  .option("--max-critical <n>", "Maximum critical issues", "0")
  .option("--max-high <n>", "Maximum high issues", "0")
  .option("--sarif", "Write SARIF on each run")
  .option("--watch", "Run after source file changes instead of a fixed interval")
  .option("--webhook <url>", "POST a notification when the quality gate fails")
  .action(async (monitorPath: string | undefined, opts) => {
    const projectPath = path.resolve(monitorPath ?? process.cwd());
    const intervalMs = Math.max(1, Number(opts.interval)) * 60_000;
    const retention = Math.max(1, Number(opts.retention));
    const run = async () => {
      const result = await runCodeAudit.execute(buildConfig({ path: projectPath, json: true, md: true, html: true, sarif: opts.sarif ?? false, maxCritical: Number(opts.maxCritical), maxHigh: Number(opts.maxHigh) }));
      const reportRoot = path.join(projectPath, "ai-auditor-report");
      try {
        const dirs = (await fs.readdir(reportRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
        for (const old of dirs.slice(retention)) {
          const target = path.resolve(reportRoot, old);
          if (path.dirname(target) === path.resolve(reportRoot)) await fs.rm(target, { recursive: true, force: true });
        }
      } catch { /* report directory may not exist yet */ }
      console.log(`[monitor] ${new Date().toISOString()} exit=${result.exitCode}${result.exitCode === 3 ? " QUALITY GATE FAILED" : ""}`);
      if (result.exitCode === 3 && opts.webhook) {
        try { await fetch(String(opts.webhook), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: "ai-auditor", projectPath, status: "quality-gate-failed", at: new Date().toISOString() }) }); }
        catch (error) { console.error(`[monitor] notification failed: ${String(error)}`); }
      }
    };
    await run();
    if (opts.watch) {
      let timer: NodeJS.Timeout | undefined;
      watch(projectPath, { recursive: true }, (_event, filename) => {
        if (!filename || /(^|[\\/])(node_modules|dist|ai-auditor-report|\.git)([\\/]|$)/.test(filename)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void run(), 750);
      });
      console.log(`[monitor] watching source changes in ${projectPath}`);
    } else {
      setInterval(() => void run(), intervalMs);
      console.log(`[monitor] auditing ${projectPath} every ${intervalMs / 60_000} minute(s)`);
    }
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(2);
});
