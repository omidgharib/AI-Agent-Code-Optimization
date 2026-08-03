// FILE: src/core/engine.ts
import { runEslint } from "../analyzers/eslint.js";
import { runTsc } from "../analyzers/tsc.js";
import { runPlaywright } from "../analyzers/playwright.js";
import { normalize } from "../normalize/normalizer.js";
import { prioritize } from "../prioritize/prioritize.js";
import { buildContext } from "../fix/contextBuilder.js";
import { selectIssuesForFix } from "../fix/fixPlanner.js";
import { requestFix } from "../fix/llmClient.js";
import { applyDiff } from "../fix/diffApplier.js";
import { writeReport } from "../report/report.js";
import { logger } from "./logger.js";
import type { AuditConfig, PrioritizedIssue, FixResponse } from "./types.js";

async function analyze(cwd: string) {
  const [eslint, tsc, pw] = await Promise.all([
    runEslint(cwd),
    runTsc(cwd),
    runPlaywright(cwd),
  ]);
  return normalize([...eslint, ...tsc, ...pw]);
}

export async function runAudit(
  config: AuditConfig,
): Promise<{ exitCode: number }> {
  const repoRoot = config.path;
  const outDir = `${repoRoot}/ai-auditor-report`;
  const allPatches: FixResponse["patches"] = [];
  const verificationErrors: string[] = [];

  try {
    let issues = await analyze(repoRoot);

    if (config.severity) {
      const order = ["low", "medium", "high", "critical"];
      const minIdx = order.indexOf(config.severity);
      issues = issues.filter((i) => order.indexOf(i.severity) >= minIdx);
    }

    let prioritized = prioritize(issues);
    logger.info(`Found ${prioritized.length} issues`);

    if (config.fix) {
      if (!config.apiKey) {
        logger.error("--fix requires an API key (--api-key or OPENAI_API_KEY)");
        return { exitCode: 2 };
      }

      for (let iter = 0; iter < config.maxFixIterations; iter++) {
        const selected = selectIssuesForFix(prioritized);
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

        // Re-analyze after applying patches
        const newIssues = await analyze(repoRoot);
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
        outDir,
      },
    );

    if (config.json || config.md) logger.info(`Report written to ${outDir}`);

    return { exitCode: prioritized.length > 0 ? 1 : 0 };
  } catch (e) {
    logger.error(`Internal error: ${String(e)}`);
    return { exitCode: 2 };
  }
}
