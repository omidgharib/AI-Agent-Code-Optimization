// FILE: src/core/engine.ts
import fs from "node:fs/promises";
import path from "node:path";
import { resolve } from "node:path";
import { runEslint, runEslintAutofix } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { runPlaywright } from "../analyzers/playwright";
import { runLighthouse } from "../analyzers/lighthouse";
import { runDependencyAudit, runProjectHealth } from "../analyzers/projectHealth";
import { runSonar, type SonarConfig } from "../analyzers/sonar";
import { runSeoLab, type SeoHealth } from "../analyzers/seoLab";
import { analyzeArchitecture, type ArchitectureReport } from "../analyzers/architecture";
import { detectTests, importCoverage, testHealth } from "../verify/testIntelligence";
import { metricsFromLighthouse, performanceScores } from "../analyzers/performanceLab";
import { normalize } from "../normalize/normalizer";
import { prioritize } from "../prioritize/prioritize";
import { buildContext } from "../fix/contextBuilder";
import { selectAdvisoryIssues, selectIssuesForFix } from "../fix/fixPlanner";
import {
  requestFix,
  repairPatch,
  diagnoseEndpoint,
  MAX_ATTEMPTS,
} from "../fix/llmClient";
import { applyDiff, getDiffTargetPath } from "../fix/diffApplier";
import { preflightSuggestedPatch } from "../fix/patchPreflight";
import { issueVerificationFingerprint, prepareChangeSet } from "../fix/changeSet";
import { PatchTransaction } from "../fix/patchTransaction";
import { planSpecialistWork, specialistPromptContext } from "../fix/specialistPlanner";
import { writeReport } from "../report/report";
import { logger } from "./logger";
import { createFixTrace } from "./fixTrace";
import type { FixTracer } from "./fixTrace";
import type { LighthouseReport } from "../report/summary";
import type { SonarSummary } from "./types";
import type {
  AuditConfig,
  PrioritizedIssue,
  FixResponse,
  Issue,
  Severity,
} from "./types";
import { detectProject } from "./projectDetector";
import { loadProjectIgnore } from "./projectIgnore";
import { evaluateQualityGate } from "./qualityGate";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { auditArtifactRoot } from "../platform/artifacts/paths";
import { safeRead } from "../platform/security/safeMutation";
import { loadCodeAuditPolicy } from "../code/application/policy";
import { analyzeChangeImpact } from "../fix/changeDecision";
import { mergeOverlappingIssues } from "./issueMerge";

interface AnalyzeResult {
  issues: Issue[];
  lighthouse?: LighthouseReport;
  lighthouseDesktop?: LighthouseReport;
  seoLab?: SeoHealth;
  architecture?: ArchitectureReport;
  sonar?: SonarSummary;
}

const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
const execFileAsync = promisify(execFile);
async function bindPatchToPreview(repoRoot: string, patch: FixResponse["patches"][number]): Promise<void> { const target = getDiffTargetPath(patch.unifiedDiff); if (!target) return; try { patch.preApplySha256 = (await safeRead(repoRoot, target)).sha256; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") patch.preApplySha256 = "absent"; else throw error; } }

async function getChangedFiles(repoRoot: string): Promise<Set<string>> {
  try {
    const [tracked, untracked] = await Promise.all([
      execFileAsync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }),
      execFileAsync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot }),
    ]);
    return new Set(`${tracked.stdout}\n${untracked.stdout}`.split(/\r?\n/).map((file) => file.trim().replace(/\\/g, "/")).filter(Boolean));
  } catch {
    return new Set();
  }
}

function filterBySeverity(issues: Issue[], severity?: Severity): Issue[] {
  if (!severity) return issues;
  const minIdx = SEVERITY_ORDER.indexOf(severity);
  return issues.filter((i) => SEVERITY_ORDER.indexOf(i.severity) >= minIdx);
}

async function analyze(
  cwd: string,
  url?: string,
  includeLighthouse = true,
  extraExcludes: string[] = [],
  sonarConfig?: SonarConfig,
): Promise<AnalyzeResult> {
  const tasks: Promise<Issue[]>[] = [
    runEslint(cwd),
    runTsc(cwd),
    runPlaywright(cwd, url),
    runProjectHealth(cwd),
    runDependencyAudit(cwd),
  ];

  let lighthouse: LighthouseReport | undefined;
  let lighthouseDesktop: LighthouseReport | undefined;
  let seoLab: SeoHealth | undefined;
  let architecture: ArchitectureReport | undefined;
  let sonar: SonarSummary | undefined;
  if (sonarConfig?.enabled) {
    // SonarScanner and Chromium are both memory/CPU intensive. Run the scanner
    // before launching browser audits to avoid false timeouts on local machines.
    const result = await runSonar(cwd, sonarConfig);
    sonar = result.summary;
    if (result.summary.status === "not-run") {
      logger.warn(`SonarQube not run: ${result.summary.reason ?? "unknown reason"}`);
      if (sonarConfig.required) throw new Error(`Required SonarQube analysis did not run: ${result.summary.reason ?? "unknown reason"}`);
    } else logger.info(`SonarQube: ${result.summary.status}, quality gate ${result.summary.qualityGate ?? "NONE"}, ${result.summary.issueCount} issue(s)`);
    tasks.push(Promise.resolve(result.issues));
  }
  tasks.push(analyzeArchitecture(cwd).then((result) => { architecture = result; return result.findings.map((finding) => ({ id: createHash("sha256").update(`architecture:${finding.ruleId}:${finding.files.join(",")}:${finding.message}`).digest("hex").slice(0, 16), tool: "custom" as const, ruleId: finding.ruleId, message: finding.message, severity: finding.severity, category: "maintainability" as const, location: { filePath: finding.files[0] ?? "-" }, evidence: { relatedFiles: finding.files }, fix: { canAutoFix: false, strategy: "advisory" as const }, meta: { confidence: finding.confidence } })); }).catch((error) => { logger.warn(`Architecture analysis skipped: ${String(error)}`); return []; }));

  if (url && includeLighthouse) {
    const mobileLighthouseTask =
      runLighthouse(url)
        .then((res) => {
          lighthouse = res.lhr;
          return res.issues;
        })
        .catch((e) => {
          logger.warn(`Lighthouse skipped: ${String(e)}`);
          return [];
      });
    tasks.push(mobileLighthouseTask);
    tasks.push(
      runSeoLab(url)
        .then((result) => { seoLab = result.health; return result.issues; })
        .catch((error) => { logger.warn(`SEO Lab skipped: ${String(error)}`); return []; }),
    );
    tasks.push(
      mobileLighthouseTask.then(() => runLighthouse(url, "desktop"))
        .then((res) => { lighthouseDesktop = res.lhr; return res.issues.map((issue) => ({ ...issue, id: `${issue.id.slice(0, 15)}d`, meta: { ...issue.meta, lighthouseProfile: "desktop" } })); })
        .catch((e) => { logger.warn(`Lighthouse desktop skipped: ${String(e)}`); return []; }),
    );
  }

  const results = await Promise.all(tasks);
  const projectIgnore = await loadProjectIgnore(cwd, extraExcludes);
  const issues = mergeOverlappingIssues(normalize(results.flat())).filter(
    (item) => !item.location?.filePath || item.location.filePath === "-" || !projectIgnore.ignores(item.location.filePath),
  );
  return { issues, lighthouse, lighthouseDesktop, seoLab, architecture, sonar };
}

async function buildProjectMetadataContext(
  repoRoot: string,
): Promise<Array<{ filePath: string; excerpt: string }>> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const metadata = {
      name: pkg.name,
      scripts: pkg.scripts,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
    };
    return [{ filePath: "package.json", excerpt: JSON.stringify(metadata, null, 2).slice(0, 16_000) }];
  } catch {
    return [];
  }
}
async function buildUserFeedbackContext(repoRoot: string): Promise<Array<{ filePath: string; excerpt: string }>> {
  try {
    const feedback = JSON.parse(await fs.readFile(path.join(repoRoot, ".ai-auditor-feedback.json"), "utf8")) as Array<{ reason?: string }>;
    const reasons = feedback.slice(-20).map((item) => item.reason).filter((reason): reason is string => Boolean(reason));
    return reasons.length ? [{ filePath: "AI_AUDITOR_USER_FEEDBACK.json", excerpt: JSON.stringify({ constraintsFromRejectedPatches: [...new Set(reasons)] }) }] : [];
  } catch { return []; }
}

export async function runAudit(
  config: AuditConfig,
): Promise<{ exitCode: number }> {
  let repoRoot = path.resolve(config.path);
  const outDir = auditArtifactRoot(repoRoot);
  const reportTs = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.join(outDir, reportTs);
  const allPatches: FixResponse["patches"] = [];
  const recommendations: string[] = [];
  const verificationErrors: string[] = [];
  let mechanicalFixCount = 0;
  let specialistTaskCount = 0;
  let trace: FixTracer | undefined;
  let aiRequestCount = 0;
  let estimatedTokens = 0;
  let estimatedCostUsd = 0;
  const agentStartedAt = Date.now();
  const changedFiles = new Set<string>();
  const costPerMillionTokens = Number(process.env.AI_AUDITOR_COST_PER_MILLION_TOKENS ?? 0);
  const claimAiRequest = (estimatedChars = 0): void => {
    if (aiRequestCount >= config.maxAiRequests)
      throw new Error(`AI request budget exhausted (${config.maxAiRequests})`);
    if (Date.now() - agentStartedAt > config.maxAgentSeconds * 1000)
      throw new Error(`AI time budget exhausted (${config.maxAgentSeconds}s)`);
    const nextTokens = Math.ceil(estimatedChars / 4);
    if (estimatedTokens + nextTokens > config.maxAgentTokens)
      throw new Error(`AI token budget exhausted (${config.maxAgentTokens} estimated input tokens)`);
    const nextCost = costPerMillionTokens > 0 ? (nextTokens / 1_000_000) * costPerMillionTokens : 0;
    if (config.maxCostUsd > 0 && estimatedCostUsd + nextCost > config.maxCostUsd)
      throw new Error(`AI cost budget exhausted ($${config.maxCostUsd})`);
    aiRequestCount++;
    estimatedTokens += nextTokens;
    estimatedCostUsd += nextCost;
  };

  try {
    const project = await detectProject(repoRoot);
    repoRoot = project.root;
    const projectPolicy = await loadCodeAuditPolicy(repoRoot);
    const sonarConfig: SonarConfig = { ...projectPolicy.sonar, enabled: projectPolicy.sonar.enabled || process.env.AI_AUDITOR_SONAR_ENABLED === "true", hostUrl: process.env.AI_AUDITOR_SONAR_HOST_URL || projectPolicy.sonar.hostUrl, projectKey: process.env.AI_AUDITOR_SONAR_PROJECT_KEY || projectPolicy.sonar.projectKey, token: process.env.SONAR_TOKEN };
    logger.info(
      `Project: ${project.name} (${project.languages.join("+") || "JS/TS tooling"}, ${project.framework}, ${project.packageManager})`,
    );
    const initialAnalysis = await analyze(repoRoot, config.url, true, config.exclude, sonarConfig);
    let issues = filterBySeverity(initialAnalysis.issues, config.severity);
    if (config.changedOnly) {
      const changed = await getChangedFiles(repoRoot);
      issues = issues.filter((issue) => issue.location?.filePath === "-" || (issue.location?.filePath && changed.has(issue.location.filePath)));
      logger.info(`Incremental mode: ${changed.size} changed file(s), ${issues.length} matching issue(s)`);
    }
    const lighthouse = initialAnalysis.lighthouse;
    const lighthouseDesktop = initialAnalysis.lighthouseDesktop;
    const seoLab = initialAnalysis.seoLab;
    const architecture = initialAnalysis.architecture;
    const sonar = initialAnalysis.sonar;

    let prioritized = prioritize(issues);
    const problemCardIssues = prioritized;
    logger.info(`Found ${prioritized.length} issues`);

    if (config.fix) {
      config.maxAiRequests = Math.min(config.maxAiRequests, projectPolicy.maxAiRequests);
      config.maxAgentTokens = Math.min(config.maxAgentTokens, projectPolicy.maxAiTokens);
      config.maxChangedFiles = Math.min(config.maxChangedFiles, projectPolicy.maxFilesPerChangeSet);
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
          mechanicalFixCount = autofixed.length;
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
          const fresh = (await analyze(repoRoot, config.url, false, config.exclude)).issues;
          prioritized = prioritize(filterBySeverity(fresh, config.severity));
          logger.info(
            `Re-analyzed after mechanical pass: ${prioritized.length} issues`,
          );
        }
      }

      trace = await createFixTrace(
        reportDir,
        config.model,
        config.provider,
        config.baseUrl,
      );
      logger.debug(`Trace log: ${path.join(reportDir, "trace.json")}`);

      // Advisory pool is captured before the diff loop: re-analysis after
      // applied patches skips Lighthouse (no re-run), which would otherwise
      // silently drop every remaining URL-level finding.
      const selectedIds = new Set(config.issueIds);
      const withinUserScope = (issue: PrioritizedIssue) => selectedIds.size === 0 || selectedIds.has(issue.id);
      if (selectedIds.size > 0) logger.info(`Agent scope: ${selectedIds.size} user-selected issue ID(s)`);
      logger.info(`Agent controls: mode=${config.agentMode}, requests<=${config.maxAiRequests}, tokens<=${config.maxAgentTokens}, seconds<=${config.maxAgentSeconds}, files<=${config.maxChangedFiles}`);
      const advisoryPool = selectAdvisoryIssues(prioritized.filter(withinUserScope));
      const projectMetadataContext = await buildProjectMetadataContext(repoRoot);
      const userFeedbackContext = await buildUserFeedbackContext(repoRoot);

      let traceIteration = 0;
      for (let iter = 0; iter < config.maxFixIterations; iter++) {
        // An explicit UI selection is one user intent: never silently truncate
        // it to the normal background batch size.
        const planned = selectIssuesForFix(
          prioritized.filter(withinUserScope),
          selectedIds.size > 0 ? selectedIds.size : config.fixBatch,
        );
        const selected = planned
          .flatMap((p) => p.issues)
          .filter((i) => !mechanicallyFixedIds.has(i.id));
        if (selected.length === 0) {
          if (planned.length === 0) {
            if (advisoryPool.length > 0) {
              logger.info(
                "No file-based issues left for LLM diff fixes (Lighthouse/custom recommendations are handled next).",
              );
            } else {
              logger.info(
                "No LLM-fixable issues left (the LLM only handles style / maintainability / security / performance / autofixable issues).",
              );
            }
          }
          break;
        }

        logger.info(
          `Fix iteration ${iter + 1}: ${selected.length} issues selected`,
        );
        const transaction = new PatchTransaction(repoRoot, config.dryRun);
        const iterationPatchStart = allPatches.length;
        const previousFileIssues = prioritized.filter(
          (issue) => issue.location?.filePath && issue.location.filePath !== "-",
        );
        const selectedFiles = [...new Set(selected.map((issue) => issue.location?.filePath).filter((file): file is string => Boolean(file && file !== "-")))];
        const impact = await analyzeChangeImpact(repoRoot, selectedFiles, projectPolicy);
        const specialistPlan = planSpecialistWork(selected, {
          strategy: config.specialistStrategy ?? "standard",
          requests: Math.max(1, config.maxAiRequests - aiRequestCount),
          tokens: Math.max(1_000, config.maxAgentTokens - estimatedTokens),
          costUsd: config.maxCostUsd > 0 ? Math.max(0, config.maxCostUsd - estimatedCostUsd) : 0,
        });
        specialistTaskCount += specialistPlan.tasks.length;
        for (const task of specialistPlan.tasks) logger.debug(`Specialist ${task.specialist} → ${task.issueIds.length} issue(s), strategy=${task.strategy}, canPatch=${task.canPatch}, approvals=${task.approvalStages.join(",")}`);
        const context = [
          ...projectMetadataContext,
          ...userFeedbackContext,
          ...(await buildContext(selected, repoRoot)),
          { filePath: "AI_AUDITOR_CHANGE_IMPACT.json", excerpt: JSON.stringify(impact, null, 2) },
          ...specialistPromptContext(specialistPlan.tasks),
        ];

        trace.logIterationStart(++traceIteration, selected, context);

        let fixResponse: FixResponse;
        const aiRequestStartedAt = Date.now();
        try {
          claimAiRequest(JSON.stringify({ selected, context }).length);
          logger.info(
            `AI request -> ${config.provider}/${config.model} (diff fix iteration ${iter + 1})`,
          );
          fixResponse = await requestFix(
            {
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              model: config.model,
              provider: config.provider,
            },
            {
              repoRoot,
              issues: selected,
              context,
              constraints: {
                maxFilesChanged: config.maxChangedFiles,
                preferMinimalDiff: true,
                doNotChangePublicAPI: projectPolicy.protectedPublicApis.length > 0,
                keepFormatting: true,
              },
            },
            trace,
          );
          logger.success(
            `AI response <- ${config.provider}/${config.model} in ${((Date.now() - aiRequestStartedAt) / 1000).toFixed(1)}s (${fixResponse.patches.length} patches, ${fixResponse.notes.length} recommendations)`,
          );
        } catch (e) {
          logger.error(
            `LLM request failed (provider "${config.provider}", model "${config.model}" @ ${config.baseUrl}): ${String(e)}`,
          );
          if (/localhost|127\.0\.0\.1/.test(config.baseUrl)) {
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

        for (const note of fixResponse.notes) {
          logger.info(`LLM advisory: ${note}`);
          recommendations.push(note);
        }

        if (fixResponse.patches.length === 0) {
          if (recommendations.length > 0) {
            logger.info(
              "LLM returned recommendations only (no file diffs) — stopping fix loop",
            );
          } else {
            logger.info("No patches returned, stopping fix loop");
          }
          break;
        }

        // A model response is one logical approval unit. Validate all dependent
        // files together so a temporarily inconsistent half-fix is never
        // rejected or approved on its own.
        let suggestedChangeSet = config.agentMode !== "apply"
          ? await prepareChangeSet(
              repoRoot,
              fixResponse.patches.filter((patch) => patch.unifiedDiff?.trim()),
              previousFileIssues,
              selected.map((issue) => issue.id),
              0,
              projectPolicy,
              sonarConfig,
            )
          : undefined;
        if (suggestedChangeSet) {
          for (const patch of fixResponse.patches) {
            patch.changeSetId = suggestedChangeSet.id;
            patch.issueIds = suggestedChangeSet.issueIds;
            patch.verification = {
              passed: suggestedChangeSet.verification.passed,
              fixedIssueIds: suggestedChangeSet.verification.fixedIssueIds,
              beforeIssueCount: suggestedChangeSet.verification.beforeIssueCount,
              afterIssueCount: suggestedChangeSet.verification.afterIssueCount,
              introducedSevere: suggestedChangeSet.verification.introducedSevere,
              checks: suggestedChangeSet.verification.checks,
              relatedTests: suggestedChangeSet.verification.relatedTests,
              attempts: suggestedChangeSet.verification.attempts,
              confidence: suggestedChangeSet.verification.confidence,
              impact: suggestedChangeSet.verification.impact,
              sonar: suggestedChangeSet.verification.sonar,
              ...(suggestedChangeSet.verification.error ? { error: suggestedChangeSet.verification.error } : {}),
            };
          }
        } else {
          const changeSetId = createHash("sha256")
            .update(fixResponse.patches.map((patch) => patch.unifiedDiff).join("\0"))
            .digest("hex")
            .slice(0, 16);
          for (const patch of fixResponse.patches) {
            patch.changeSetId = changeSetId;
            patch.issueIds = selected.map((issue) => issue.id);
          }
        }

        // A multi-file preview is all-or-nothing. Do not let a repair of one
        // member make the UI show a misleading ready patch beside a blocked
        // dependent patch. But a failing hunk usually just means the model's
        // context lines are stale — so before flagging everything blocked,
        // repair the failing members with repairPatch (same mechanism as apply
        // mode) and re-verify the entire change set.
        if (suggestedChangeSet && !suggestedChangeSet.verification.passed) {
          const diffPatches = fixResponse.patches.filter((patch) => patch.unifiedDiff?.trim());
          const repairedByIndex = new Map<number, FixResponse["patches"][number]>();
          const repairFailures = new Map<number, string>();
          if (config.patchRetries > 0) {
            logger.warn("Change set failed verification — attempting to repair each failing patch before blocking: " + (suggestedChangeSet.verification.error ?? "verification failed"));
            let diffIndex = 0;
            for (const patch of fixResponse.patches) {
              if (!patch.unifiedDiff?.trim()) continue;
              const index = diffIndex++;
              let candidate = patch;
              let probe = await preflightSuggestedPatch(repoRoot, candidate.unifiedDiff, previousFileIssues);
              for (let attempt = 1; !probe.success && attempt <= config.patchRetries; attempt++) {
                logger.warn(`Change-set patch "${candidate.description}" failed preflight (${probe.error}); asking the LLM to repair it (${attempt}/${config.patchRetries})`);
                const contents: Record<string, string> = {};
                const target = getDiffTargetPath(candidate.unifiedDiff);
                if (target) { try { contents[target] = await fs.readFile(resolve(repoRoot, target), "utf8"); } catch { /* new file */ } }
                try {
                  claimAiRequest(JSON.stringify({ selected, context, candidate, contents }).length);
                  const rep = await repairPatch({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, provider: config.provider }, { repoRoot, issues: selected, context, constraints: { maxFilesChanged: config.maxChangedFiles, preferMinimalDiff: true, doNotChangePublicAPI: false, keepFormatting: true } }, candidate, probe.error ?? "unknown preflight error", contents, trace);
                  if (!rep.patches[0]?.unifiedDiff) break;
                  candidate = rep.patches[0];
                  probe = await preflightSuggestedPatch(repoRoot, candidate.unifiedDiff, previousFileIssues);
                  trace.logPatchRepair(candidate.description, probe.error ?? "", candidate.unifiedDiff, probe.success);
                } catch (error) {
                  logger.warn(`Patch repair failed: ${String(error)}`);
                  trace.logPatchRepair(candidate.description, probe.error ?? "unknown", undefined, false, String(error));
                  break;
                }
              }
              if (probe.success) repairedByIndex.set(index, candidate);
              else repairFailures.set(index, probe.error ?? "Preflight failed");
            }
          }
          const allReady = repairedByIndex.size === diffPatches.length;
          const revalidated: Awaited<ReturnType<typeof prepareChangeSet>> | undefined = allReady
            ? await prepareChangeSet(
                repoRoot,
                diffPatches.map((_, index) => repairedByIndex.get(index)!),
                previousFileIssues,
                selected.map((issue) => issue.id),
                config.patchRetries,
                projectPolicy,
                sonarConfig,
              )
            : undefined;

          const changeSetVerification = (cs: NonNullable<typeof suggestedChangeSet>) => ({
            passed: cs.verification.passed,
            fixedIssueIds: cs.verification.fixedIssueIds,
            beforeIssueCount: cs.verification.beforeIssueCount,
            afterIssueCount: cs.verification.afterIssueCount,
            introducedSevere: cs.verification.introducedSevere,
            checks: cs.verification.checks,
            relatedTests: cs.verification.relatedTests,
            attempts: cs.verification.attempts,
            confidence: cs.verification.confidence,
            impact: cs.verification.impact,
            sonar: cs.verification.sonar,
            ...(cs.verification.error ? { error: cs.verification.error } : {}),
          });

          let publishedPartial = false;
          if (revalidated?.verification.passed) {
            let diffIndex = 0;
            for (const patch of fixResponse.patches) {
              if (!patch.unifiedDiff?.trim()) continue;
              const repaired = repairedByIndex.get(diffIndex++);
              if (repaired && repaired !== patch) {
                patch.unifiedDiff = repaired.unifiedDiff;
                patch.description = repaired.description;
                patch.touches = repaired.touches;
              }
              patch.verification = changeSetVerification(revalidated);
            }
            suggestedChangeSet = revalidated;
            // Fall through: the per-patch loop below publishes the repaired
            // (now verified) candidate diffs as "ready" patches.
          } else if (repairedByIndex.size > 0 && repairedByIndex.size < diffPatches.length) {
            // One or more members could not be repaired (e.g. a hunk that
            // keeps conflicting with the current source). Mirror apply mode's
            // per-iteration progress: re-verify the repairable members as
            // their own change set and publish them as READY, blocking only
            // the members that keep failing instead of all-or-nothing.
            const subsetDiffs = diffPatches.filter((_, index) => repairedByIndex.has(index));
            const subset = await prepareChangeSet(
              repoRoot,
              subsetDiffs,
              previousFileIssues,
              selected.map((issue) => issue.id),
              config.patchRetries,
              projectPolicy,
              sonarConfig,
            );
            if (subset?.verification.passed) {
              publishedPartial = true;
              suggestedChangeSet = subset;
              let diffIndex = 0;
              for (const patch of fixResponse.patches) {
                if (!patch.unifiedDiff?.trim()) continue;
                const repaired = repairedByIndex.get(diffIndex);
                const ready = Boolean(repaired);
                if (repaired && repaired !== patch) {
                  patch.unifiedDiff = repaired.unifiedDiff;
                  patch.description = repaired.description;
                  patch.touches = repaired.touches;
                }
                patch.changeSetId = subset.id;
                patch.issueIds = selected.map((issue) => issue.id);
                patch.verification = changeSetVerification(subset);
                Object.assign(patch, {
                  preflight: ready
                    ? { status: "ready" as const, attempts: 0 }
                    : { status: "blocked" as const, attempts: config.patchRetries, error: repairFailures.get(diffIndex) ?? "Preflight failed" },
                });
                await bindPatchToPreview(repoRoot, patch);
                allPatches.push(patch);
                const patchTarget = patch.touches[0] ?? getDiffTargetPath(patch.unifiedDiff);
                if (patchTarget && !changedFiles.has(patchTarget) && changedFiles.size < config.maxChangedFiles) changedFiles.add(patchTarget);
                logger.info(ready ? `Patch ready: ${patch.description}` : `Patch blocked: ${patch.description} (${repairFailures.get(diffIndex) ?? "preflight failed"})`);
                diffIndex++;
              }
              logger.warn(`${repairedByIndex.size} of ${diffPatches.length} change-set members ready; blocked: ${[...repairFailures.values()].join("; ")}`);
            }
          }
          if (!revalidated?.verification.passed && !publishedPartial) {
            const finalError =
              revalidated?.verification.error ??
              suggestedChangeSet.verification.error ??
              "The logical change set did not pass verification";
            for (const patch of fixResponse.patches) {
              Object.assign(patch, {
                preflight: {
                  status: "blocked" as const,
                  attempts: revalidated?.verification.attempts ?? suggestedChangeSet.verification.attempts,
                  error: finalError,
                },
              });
              await bindPatchToPreview(repoRoot, patch);
              allPatches.push(patch);
            }
            logger.warn("Change set blocked: " + finalError);
            break;
          }
          if (publishedPartial) break;
        }

        let anyApplied = false;
        for (const patch of fixResponse.patches) {
          if (!patch.unifiedDiff || !patch.unifiedDiff.trim()) {
            logger.info(`Advisory recommendation: ${patch.description}`);
            recommendations.push(patch.description);
            continue;
          }
          const targetPath = patch.touches[0] ?? getDiffTargetPath(patch.unifiedDiff);
          if (targetPath && !changedFiles.has(targetPath) && changedFiles.size >= config.maxChangedFiles) {
            logger.warn(`Skipped patch "${patch.description}": changed-file budget exhausted (${config.maxChangedFiles})`);
            continue;
          }
          let candidate = patch;
          let repairAttempts = 0;
          let result: { success: boolean; error?: string };
          if (config.agentMode !== "apply" && suggestedChangeSet)
            result = suggestedChangeSet.verification.passed
              ? { success: true }
              : { success: false, error: suggestedChangeSet.verification.error };
          else if (config.agentMode !== "apply") result = await preflightSuggestedPatch(repoRoot, candidate.unifiedDiff, previousFileIssues);
          else {
            try { await transaction.capture(candidate.unifiedDiff); await transaction.verifyUnchanged(candidate.unifiedDiff); result = await applyDiff(candidate.unifiedDiff, repoRoot, config.dryRun); }
            catch (error) { result = { success: false, error: `Could not snapshot patch target: ${String(error)}` }; }
          }
          for (let attempt = 1; !result.success && attempt <= config.patchRetries; attempt++) {
            repairAttempts = attempt; logger.warn(`Patch "${candidate.description}" failed preflight (${result.error}); asking the LLM to repair it (${attempt}/${config.patchRetries})`);
            const contents: Record<string, string> = {}; const target = getDiffTargetPath(candidate.unifiedDiff); if (target) { try { contents[target] = await fs.readFile(resolve(repoRoot, target), "utf8"); } catch { /* new file */ } }
            try {
              claimAiRequest(JSON.stringify({ selected, context, candidate, contents }).length);
              const rep = await repairPatch({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, provider: config.provider }, { repoRoot, issues: selected, context, constraints: { maxFilesChanged: config.maxChangedFiles, preferMinimalDiff: true, doNotChangePublicAPI: false, keepFormatting: true } }, candidate, result.error ?? "unknown preflight error", contents, trace);
              if (!rep.patches[0]?.unifiedDiff) break; candidate = rep.patches[0];
              if (config.agentMode !== "apply") result = await preflightSuggestedPatch(repoRoot, candidate.unifiedDiff, previousFileIssues);
              else { await transaction.capture(candidate.unifiedDiff); await transaction.verifyUnchanged(candidate.unifiedDiff); result = await applyDiff(candidate.unifiedDiff, repoRoot, config.dryRun); }
              trace.logPatchRepair(candidate.description, result.error ?? "", candidate.unifiedDiff, result.success);
            } catch (error) { logger.warn(`Patch repair failed: ${String(error)}`); trace.logPatchRepair(candidate.description, result.error ?? "unknown", undefined, false, String(error)); break; }
          }
          if (config.agentMode !== "apply") {
            Object.assign(patch, candidate, { preflight: result.success ? { status: "ready", attempts: repairAttempts } : { status: "blocked", attempts: repairAttempts, error: result.error ?? "Preflight failed" } });
            await bindPatchToPreview(repoRoot, patch); allPatches.push(patch); if (targetPath) changedFiles.add(targetPath); logger.info(result.success ? `Patch ready: ${patch.description}` : `Patch blocked: ${patch.description} (${result.error})`); continue;
          }
          Object.assign(patch, candidate);
          if (result.success) {
            await bindPatchToPreview(repoRoot, patch);
            allPatches.push(patch);
            if (targetPath) changedFiles.add(targetPath);
            anyApplied = true;
            logger.success(`Applied: ${patch.description}`);
            const targetFile =
              patch.touches[0] ?? getDiffTargetPath(patch.unifiedDiff) ?? "?";
            trace.logPatchApply(
              patch.description,
              targetFile,
              patch.unifiedDiff,
              true,
            );
          } else {
            logger.warn(`Patch failed: ${result.error}`);
            trace.logPatchApply(
              patch.description,
              patch.touches[0] ?? getDiffTargetPath(patch.unifiedDiff) ?? "?",
              patch.unifiedDiff,
              false,
              result.error,
            );
          }
        }

        if (!anyApplied) break;

        if (config.dryRun) {
          logger.info("Dry run: patches validated without modifying source files");
          break;
        }

        // Re-analyze after applying patches.
        // Lighthouse is skipped on re-runs to avoid repeated
        // browser launches during the fix loop; it only runs once
        // on the initial pass.
        try {
          const newIssues = filterBySeverity(
            (await analyze(repoRoot, config.url, false, config.exclude)).issues,
            config.severity,
          );
          const newPrioritized = prioritize(newIssues);
          // Compare with the line-agnostic fingerprint: a fix legitimately
          // shifts lines (e.g. deleting an import above a pre-existing type
          // error), so the same problem must not be mistaken for a newly
          // introduced regression just because its ID embeds the old line.
          const previousFps = new Set(
            previousFileIssues.map(issueVerificationFingerprint),
          );
          const introducedSevere = newPrioritized.filter(
            (issue) =>
              !previousFps.has(issueVerificationFingerprint(issue)) &&
              (issue.severity === "high" || issue.severity === "critical"),
          );
          const improved =
            newPrioritized.length < previousFileIssues.length &&
            introducedSevere.length === 0;
          if (!improved) {
            await transaction.rollback();
            allPatches.splice(iterationPatchStart);
            const reason = introducedSevere.length > 0
              ? `verification introduced ${introducedSevere.length} high/critical issue(s)`
              : `verification did not reduce file issues (${previousFileIssues.length} -> ${newPrioritized.length})`;
            verificationErrors.push(reason);
            logger.warn(`Rolled back fix iteration: ${reason}`);
            break;
          }
          logger.success(
            `Verified fix iteration: file issues ${previousFileIssues.length} -> ${newPrioritized.length}`,
          );
          prioritized = newPrioritized;
        } catch (error) {
          await transaction.rollback();
          allPatches.splice(iterationPatchStart);
          const reason = `verification failed; iteration rolled back: ${String(error)}`;
          verificationErrors.push(reason);
          logger.error(reason);
          break;
        }
      }

      // Advisory recommendations: Lighthouse/custom findings have no file
      // target, so they can't be diffed. Batch them to the LLM until every
      // allowed issue has received guidance. Each batch is a bounded request
      // and nothing here modifies the repo, so this pass is not limited by
      // maxFixIterations — it simply drains the advisory pool.
      if (advisoryPool.length > 0) {
        const totalBatches = Math.ceil(advisoryPool.length / config.fixBatch);
        let batchNo = 0;
        for (let i = 0; i < advisoryPool.length; i += config.fixBatch) {
          batchNo++;
          const batch = advisoryPool.slice(i, i + config.fixBatch);
          const advisoryPlan = planSpecialistWork(batch, {
            strategy: config.specialistStrategy ?? "standard",
            requests: Math.max(1, config.maxAiRequests - aiRequestCount),
            tokens: Math.max(1_000, config.maxAgentTokens - estimatedTokens),
            costUsd: config.maxCostUsd > 0 ? Math.max(0, config.maxCostUsd - estimatedCostUsd) : 0,
          });
          specialistTaskCount += advisoryPlan.tasks.length;
          const advisoryContext = [...projectMetadataContext, ...specialistPromptContext(advisoryPlan.tasks)];
          logger.info(
            `Advisory batch ${batchNo}/${totalBatches}: ${batch.length} issues`,
          );

          trace.logIterationStart(++traceIteration, batch, advisoryContext);
          let fixResponse: FixResponse;
          const aiRequestStartedAt = Date.now();
          try {
            claimAiRequest(JSON.stringify({ batch, context: advisoryContext }).length);
            logger.info(
              `AI request -> ${config.provider}/${config.analysisModel} (advisory batch ${batchNo}/${totalBatches})`,
            );
            fixResponse = await requestFix(
              {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                model: config.analysisModel,
                provider: config.provider,
              },
              {
                repoRoot,
                issues: batch,
                context: advisoryContext,
                constraints: {
                  maxFilesChanged: config.maxChangedFiles,
                  preferMinimalDiff: true,
                  doNotChangePublicAPI: false,
                  keepFormatting: true,
                },
              },
              trace,
            );
            logger.success(
              `AI response <- ${config.provider}/${config.model} in ${((Date.now() - aiRequestStartedAt) / 1000).toFixed(1)}s (${fixResponse.notes.length} recommendations)`,
            );
          } catch (e) {
            logger.error(
              `LLM advisory request failed (batch ${batchNo}/${totalBatches}): ${String(e)}`,
            );
            verificationErrors.push(String(e));
            break;
          }

          for (const note of fixResponse.notes) {
            logger.info(`LLM advisory: ${note}`);
            recommendations.push(note);
          }
          if (fixResponse.notes.length === 0) {
            logger.warn(
              `Advisory batch ${batchNo}/${totalBatches} returned no recommendations`,
            );
          }
          if (fixResponse.patches.length > 0) {
            logger.debug(
              `Ignoring ${fixResponse.patches.length} diff(s) returned for advisory-only issues`,
            );
          }
        }
        logger.success(
          `Advisory complete: ${advisoryPool.length} issues across ${totalBatches} batches`,
        );
      }
    }
    if (config.fix && specialistTaskCount > 0) {
      logger.info(`Specialist planner: ${specialistTaskCount} specialist task(s), strategy "${config.specialistStrategy ?? "standard"}"`);
    }

    const verificationPassed = verificationErrors.length === 0;
    const qualityGate = await evaluateQualityGate(prioritized, lighthouse, {
      baselinePath: config.baselinePath,
      maxCritical: config.maxCritical,
      maxHigh: config.maxHigh,
      failOnNew: config.failOnNew,
      minScores: config.minLighthouseScores,
    });
    logger.info(qualityGate.passed ? "Quality gate: PASS" : `Quality gate: FAIL (${qualityGate.reasons.join("; ")})`);
    if (trace) await trace.flush();
    await writeReport(
      prioritized,
      allPatches,
      { passed: verificationPassed, errors: verificationErrors },
      {
        json: config.json,
        md: config.md,
        html: config.html ?? false,
        sarif: config.sarif,
        pdf: config.pdf,
        outDir,
        reportDir,
      },
      lighthouse,
      recommendations,
      mechanicalFixCount,
      config.dryRun,
      config.fix ? {
        mode: config.agentMode,
        provider: config.provider,
        model: config.model,
        analysisModel: config.analysisModel,
        requests: aiRequestCount,
        estimatedTokens,
        estimatedCostUsd,
        durationMs: Date.now() - agentStartedAt,
        changedFiles: changedFiles.size,
        specialists: specialistTaskCount,
        specialistStrategy: config.specialistStrategy ?? "standard",
      } : undefined,
      qualityGate,
      seoLab,
      lighthouseDesktop,
      architecture,
      await (async () => { const sources = architecture?.nodes.filter((node) => node.kind === "production").map((node) => node.file) ?? []; const mapping = await detectTests(repoRoot, sources); const coverage = await importCoverage(repoRoot).catch(() => []); return testHealth(mapping, coverage); })(),
      lighthouse ? performanceScores([metricsFromLighthouse(config.url ?? "/", "mobile", lighthouse), ...(lighthouseDesktop ? [metricsFromLighthouse(config.url ?? "/", "desktop", lighthouseDesktop)] : [])]) : undefined,
      problemCardIssues,
      sonar,
    );

    if (config.exportPath) {
      const exportDir = path.resolve(config.exportPath);
      await fs.mkdir(exportDir, { recursive: true });
      for (const entry of await fs.readdir(reportDir, { withFileTypes: true })) if (entry.isFile() && /^report\.(json|md|html|sarif)$/.test(entry.name)) await fs.copyFile(path.join(reportDir, entry.name), path.join(exportDir, entry.name));
      logger.info(`Report explicitly exported to ${exportDir}`);
    }

    if (config.json || config.md) logger.info(`Report written to ${reportDir}`);

    return { exitCode: qualityGate.passed ? (prioritized.length > 0 ? 1 : 0) : 3 };
  } catch (e) {
    logger.error(`Internal error: ${String(e)}`);
    if (e instanceof Error && e.stack) logger.trace(`Stack: ${e.stack}`);
    if (e instanceof Error && e.cause)
      logger.trace(`Caused by: ${String(e.cause)}`);
    return { exitCode: 2 };
  }
}
