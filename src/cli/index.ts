// FILE: src/cli/index.ts
import { Command } from "commander";
import { buildConfig } from "../core/config";
import { runAudit } from "../core/engine";
import { setDebug, setVerbose } from "../core/logger";
import { listModels } from "../core/models";
import type { Severity } from "../core/types";

const program = new Command();

program
  .name("ai-auditor")
  .description("AI-powered code auditing and auto-fix CLI")
  .version("1.0.0");

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
  .option("--max-fix-iterations <n>", "Max fix iterations", "2")
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
  .option("--list-models", "List available model providers and exit")
  .option("--dry-run", "Preview fixes without applying")
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

    const config = buildConfig({
      path: auditPath ?? process.cwd(),
      url: opts.url,
      json: opts.json ?? false,
      md: opts.md ?? false,
      fix: opts.fix ?? false,
      mechanicalAutofix: opts.mechanical ?? true,
      maxFixIterations: parseInt(opts.maxFixIterations, 10),
      patchRetries: parseInt(opts.patchRetries, 10),
      include: opts.include ?? [],
      exclude: opts.exclude,
      severity: opts.severity as Severity | undefined,
      model: opts.model,
      provider: opts.provider,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      dryRun: opts.dryRun ?? false,
      verbose: opts.verbose ?? false,
      html: opts.html ?? false,
    });

    const { exitCode } = await runAudit(config);
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(2);
});
