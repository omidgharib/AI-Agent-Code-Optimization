// FILE: src/core/engine.ts
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { runEslint, runEslintAutofix } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { runPlaywright } from "../analyzers/playwright";
import { runLighthouse } from "../analyzers/lighthouse";
import { normalize } from "../normalize/normalizer";
import { prioritize } from "../prioritize/prioritize";
import { buildContext } from "../fix/contextBuilder";
import { selectIssuesForFix } from "../fix/fixPlanner";
import {
  requestFix,
  repairPatch,
  diagnoseEndpoint,
  MAX_ATTEMPTS,
} from "../fix/llmClient";
import { applyDiff, getDiffTargetPath } from "../fix/diffApplier";
import { writeReport } from "../report/report";
import { logger } from "./logger";
import type { LighthouseReport } from "../report/summary";
import type {
  AuditConfig,
  PrioritizedIssue,
  FixResponse,
  Issue,
  Severity,
} from "./types";

interface AnalyzeResult {
  issues: Issue[];
  lighthouse?: LighthouseReport;
}

const SEVERITY_ORDER = ["low", "medium", "high", "critical"];

function filterBySeverity(issues: Issue[], severity?: Severity): Issue[] {
  if (!severity) return issues;
  const minIdx = SEVERITY_ORDER.indexOf(severity);
  return issues.filter(
    (i) => SEVERITY_ORDER.indexOf(i.severity) >= minIdx,
  );
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
    let issues = filterBySeverity(initialAnalysis.issues, config.severity);
    const lighthouse = initialAnalysis.lighthouse;

    let prioritized = prioritize(issues);
    logger.info(`Found ${prioritized.length} issues`);

    if (config.fix) {
      if (config.keyRequired && !config.apiKey) {
        logger.error(
          `--fix requires an API key for provider "${config.provider}" (set --api-key or the provider's key env var)`,
        );
        return { exitCode: 2 };
      }

      logger.debug(
        `Fix endpoint: ${config.provider} → model "${config.model}" @ ${config.baseUrl}${config.apiKey ? " (with API key)" : " (no API key)"}; up to ${MAX_ATTEMPTS} attempts per request`,
      );

      const preflight = await diagnoseEndpoint(
        config.baseUrl,
        config.model,
        config.provider,
      );
      if (preflight.status === "fatal") {
        logger.error(preflight.message);
        logger.error(
          "Fix aborted because the LLM endpoint is not listening. Start the proxy/daemon (or fix --base-url / --provider) and re-run.",
        );
        return { exitCode: 2 };
      }
      if (preflight.status === "warn") {
        logger.warn(preflight.message);
        if (/localhost|127\.0\.0\.1/.test(config.baseUrl)) {
          logger.warn(
            "Local proxy tip: authorize the account/login inside the proxy itself (e.g. 'Authorize DeepSeek login' in ForgetMeAI), and check the upstream is reachable from this network: `Test-NetConnection api.deepseek.com -Port 443`.",
          );
        }
      } else {
        logger.debug("Endpoint preflight OK");
      }

      // Mechanical pre-pass: let bundled ESLint autofix deterministic issues
      // first so the LLM never spends tokens on them.
      const mechanicallyFixedIds = new Set<string>();
      if (config.mechanicalAutofix) {
        try {
          const autofixed = await runEslintAutofix(repoRoot, {
            dryRun: config.dryRun,
          });
          for (const a of autofixed) mechanicallyFixedIds.add(a.id);
          if (autofixed.length > 0) {
            logger.success(
              config.dryRun
                ? `Mechanical pre-pass would autofix ${autofixed.length} issues`
                : `Mechanical pre-pass autofixed ${autofixed.length} issues`,
            );
          } else {
            logger.info("Mechanical pre-pass: nothing to autofix");
          }
        } catch (e) {
          logger.warn(`Mechanical pre-pass failed: ${String(e)}`);
        }

        // If fixes were written, re-analyze so counts and the LLM pool reflect
        // the new file contents (autofixed issues are gone automatically).
        if (!config.dryRun && mechanicallyFixedIds.size > 0) {
          const fresh = (await analyze(repoRoot, config.url, false)).issues;
          prioritized = prioritize(filterBySeverity(fresh, config.severity));
          logger.info(
            `Re-analyzed after mechanical pass: ${prioritized.length} issues`,
          );
        }
      }

      for (let iter = 0; iter < config.maxFixIterations; iter++) {
        const planned = selectIssuesForFix(prioritized);
        const selected = planned
          .flatMap((p) => p.issues)
          .filter((i) => !mechanicallyFixedIds.has(i.id));
        if (selected.length === 0) {
          if (planned.length === 0) {
            logger.info(
              "No LLM-fixable issues left (the LLM only handles style / maintainability / autofixable issues; bug, security and performance issues are excluded by design).",
            );
          }
          break;
        }

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
          logger.error(
            `LLM request failed (provider "${config.provider}", model "${config.model}" @ ${config.baseUrl}): ${String(e)}`,
          );
          if (
            /localhost|127\.0\.0\.1/.test(config.baseUrl)
          ) {
            logger.warn(
              `Local endpoint at ${config.baseUrl} did not service the request — make sure the proxy/daemon is fully started and the port matches (try: Invoke-WebRequest http://127.0.0.1:<port>/v1/models).`,
            );
          } else if (config.provider === "ollama") {
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
          let result = await applyDiff(
            patch.unifiedDiff,
            repoRoot,
            config.dryRun,
          );

          // Apply-feedback repair: LLM diffs often carry slightly stale context
          // (a dropped comma, different spacing). Send the exact apply error and
          // the CURRENT file content back and ask for a corrected single diff.
          for (
            let attempt = 1;
            !result.success && attempt <= config.patchRetries;
            attempt++
          ) {
            logger.warn(
              `Patch "${patch.description}" failed to apply (${result.error}); asking the LLM to repair it (${attempt}/${config.patchRetries})`,
            );
            const contents: Record<string, string> = {};
            const target = getDiffTargetPath(patch.unifiedDiff);
            if (target) {
              try {
                contents[target] = await fs.readFile(
                  resolve(repoRoot, target),
                  "utf8",
                );
              } catch {
                /* file may be new/absent */
              }
            }
            try {
              const rep = await repairPatch(
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
                patch,
                result.error ?? "unknown apply error",
                contents,
              );
              if (rep.patches.length === 0) break;
              result = await applyDiff(
                rep.patches[0].unifiedDiff,
                repoRoot,
                config.dryRun,
              );
            } catch (e) {
              logger.warn(`Patch repair failed: ${String(e)}`);
              break;
            }
          }

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
    if (e instanceof Error && e.stack)
      logger.trace(`Stack: ${e.stack}`);
    if (e instanceof Error && e.cause)
      logger.trace(`Caused by: ${String(e.cause)}`);
    return { exitCode: 2 };
  }
}
