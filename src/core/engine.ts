// FILE: src/core/engine.ts
import { runEslint } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { runPlaywright } from "../analyzers/playwright";
import { runLighthouse } from "../analyzers/lighthouse";
import { normalize } from "../normalize/normalizer";
import { prioritize } from "../prioritize/prioritize";
import { buildContext } from "../fix/contextBuilder";
import { selectIssuesForFix } from "../fix/fixPlanner";
import { requestFix } from "../fix/llmClient";
import { applyDiff } from "../fix/diffApplier";
import { writeReport } from "../report/report";
import { logger } from "./logger";
import type { LighthouseReport } from "../report/summary";
import type {
  AuditConfig,
  PrioritizedIssue,
  FixResponse,
  Issue,
} from "./types";

interface AnalyzeResult {
  issues: Issue[];
  lighthouse?: LighthouseReport;
}

async function analyze(
  cwd: string,
  url?: string,
  includeLighthouse = true,
): Promise<AnalyzeResult> {
  const tasks: Promise<Issue[]>[] = [
    runEslint(cwd),
    runTsc(cwd),
    runPlaywright(cwd),
  ];

  let lighthouse: LighthouseReport | undefined;

  if (url && includeLighthouse) {
    tasks.push(
      runLighthouse(url)
        .then((res) => {
          lighthouse = res.lhr;
          return res.issues;
        })
        .catch((e) => {
          logger.warn(`Lighthouse skipped: ${String(e)}`);
          return [];
        }),
    );
  }

  const results = await Promise.all(tasks);
  return { issues: normalize(results.flat()), lighthouse };
}

export async function runAudit(
  config: AuditConfig,
): Promise<{ exitCode: number }> {
  const repoRoot = config.path;
  const outDir = `${repoRoot}/ai-auditor-report`;
  const allPatches: FixResponse["patches"] = [];
  const verificationErrors: string[] = [];

  try {
    const initialAnalysis = await analyze(repoRoot, config.url);
    let issues = initialAnalysis.issues;
    const lighthouse = initialAnalysis.lighthouse;

    if (config.severity) {
      const order = ["low", "medium", "high", "critical"];
      const minIdx = order.indexOf(config.severity);
      issues = issues.filter((i) => order.indexOf(i.severity) >= minIdx);
    }

    let prioritized = prioritize(issues);
    logger.info(`Found ${prioritized.length} issues`);

    if (config.fix) {
      if (config.keyRequired && !config.apiKey) {
        logger.error(
          `--fix requires an API key for provider "${config.provider}" (set --api-key or the provider's key env var)`,
        );
        return { exitCode: 2 };
      }

      for (let iter = 0; iter < config.maxFixIterations; iter++) {
        const planned = selectIssuesForFix(prioritized);
        const selected = planned.flatMap((p) => p.issues);
        if (selected.length === 0) break;

        logger.info(
          `Fix iteration ${iter + 1}: ${selected.length} issues selected`,
        );
        const context = await buildContext(selected);

        let fixResponse: FixResponse;
        try {
          fixResponse = await requestFix(
            {
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              model: config.model,
            },
            {
              repoRoot,
              issues: selected,
              context,
              constraints: {
                maxFilesChanged: 5,
                preferMinimalDiff: true,
                doNotChangePublicAPI: false,
                keepFormatting: true,
              },
            },
          );
        } catch (e) {
          logger.error(`LLM request failed: ${String(e)}`);
          if (config.provider === "ollama") {
            logger.warn(
              "Ollama provider: make sure Ollama is running (`ollama serve`) and the model is pulled (`ollama pull llama3.2`), or pick another provider with --provider / --list-models.",
            );
          } else if (
            config.provider === "openrouter" &&
            String(e).includes("404")
          ) {
            logger.warn(
              `Model "${config.model}" not found on OpenRouter. Free models rotate — run --list-models or check https://openrouter.ai/models?max_price=0 for a current free model.`,
            );
          }
          verificationErrors.push(String(e));
          break;
        }

        if (fixResponse.patches.length === 0) {
          logger.info("No patches returned, stopping fix loop");
          break;
        }

        let anyApplied = false;
        for (const patch of fixResponse.patches) {
          const result = await applyDiff(
            patch.unifiedDiff,
            repoRoot,
            config.dryRun,
          );
          if (result.success) {
            allPatches.push(patch);
            anyApplied = true;
            logger.success(`Applied: ${patch.description}`);
          } else {
            logger.warn(`Patch failed: ${result.error}`);
          }
        }

        if (!anyApplied) break;

        // Re-analyze after applying patches.
        // Lighthouse is skipped on re-runs to avoid repeated
        // browser launches during the fix loop; it only runs once
        // on the initial pass.
        const newIssues = (await analyze(repoRoot, config.url, false)).issues;
        const newPrioritized = prioritize(newIssues);
        if (newPrioritized.length >= prioritized.length) {
          logger.info("No improvement detected, stopping fix loop");
          break;
        }
        prioritized = newPrioritized;
      }
    }

    const verificationPassed = verificationErrors.length === 0;
    await writeReport(
      prioritized,
      allPatches,
      { passed: verificationPassed, errors: verificationErrors },
      {
        json: config.json,
        md: config.md,
        html: config.html ?? false,
        outDir,
      },
      lighthouse,
    );

    if (config.json || config.md) logger.info(`Report written to ${outDir}`);

    return { exitCode: prioritized.length > 0 ? 1 : 0 };
  } catch (e) {
    logger.error(`Internal error: ${String(e)}`);
    return { exitCode: 2 };
  }
}
