// FILE: src/cli/index.ts
import { Command } from "commander";
import { buildConfig } from "../core/config";
import { runAudit } from "../core/engine";
import { setVerbose } from "../core/logger";
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
  .option("--max-fix-iterations <n>", "Max fix iterations", "2")
  .option("--include <pattern...>", "Include glob patterns")
  .option("--exclude <pattern...>", "Exclude glob patterns")
  .option("--severity <level>", "Minimum severity (low|medium|high|critical)")
  .option("--model <model>", "LLM model name")
  .option("--base-url <url>", "LLM base URL")
  .option("--api-key <key>", "LLM API key")
  .option("--dry-run", "Preview fixes without applying")
  .option("--verbose", "Verbose output")
  .option(
    "--url <url>",
    "URL to audit with Lighthouse (e.g. http://localhost:3000)",
  )
  .option("--html", "Write HTML report")
  .action(async (auditPath: string | undefined, opts) => {
    if (opts.verbose) setVerbose(true);

    const config = buildConfig({
      path: auditPath ?? process.cwd(),
      json: opts.json ?? false,
      md: opts.md ?? false,
      fix: opts.fix ?? false,
      maxFixIterations: parseInt(opts.maxFixIterations, 10),
      include: opts.include ?? [],
      exclude: opts.exclude,
      severity: opts.severity as Severity | undefined,
      model: opts.model,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      dryRun: opts.dryRun ?? false,
      verbose: opts.verbose ?? false,
    });

    const { exitCode } = await runAudit(config);
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(2);
});
