import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import type { CodeAuditPolicy } from "../code/application/policy";
import type { PrioritizedIssue } from "../core/types";

export type DecisionStatus = "green" | "yellow" | "red";
export interface ChangeImpact { importers: string[]; routes: string[]; publicApis: string[]; relatedTests: string[]; sensitiveFiles: string[]; policyViolations: string[]; }
export interface ConfidenceScores { diagnosis: number; patch: number; behavioral: number; status: DecisionStatus; reasons: string[]; }

const normal = (value: string) => value.replace(/\\/g, "/");
const matches = (file: string, patterns: string[]) => patterns.some((pattern) => file === normal(pattern) || file.startsWith(normal(pattern).replace(/\*.*$/, "")) || new RegExp("^" + normal(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(file));

/** Builds a bounded, source-only impact summary for the model and the preview. */
export async function analyzeChangeImpact(repoRoot: string, files: string[], policy: CodeAuditPolicy): Promise<ChangeImpact> {
  const candidates = (await glob("**/*.{js,jsx,ts,tsx,mjs,cjs}", { cwd: repoRoot, nodir: true, ignore: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] })).map(normal);
  const importers = new Set<string>(), routes = new Set<string>(), publicApis = new Set<string>(), relatedTests = new Set<string>();
  const stems = files.map((file) => path.posix.basename(normal(file)).replace(/\.[^.]+$/, "")).filter(Boolean);
  for (const candidate of candidates.slice(0, 5000)) {
    let source = ""; try { source = await fs.readFile(path.join(repoRoot, candidate), "utf8"); } catch { continue; }
    const references = stems.some((stem) => source.includes(stem));
    if (!references) continue;
    if (candidate !== files.find((file) => normal(file) === candidate) && /(?:from\s+|require\()["'][^"']+["']/.test(source)) importers.add(candidate);
    if (/(^|\/)(?:pages|app|routes|api)\//.test(candidate)) routes.add(candidate);
    if (/(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(candidate)) relatedTests.add(candidate);
    if (/\bexport\s+(?:default\s+)?(?:class|function|const|interface|type)\b/.test(source) && /(?:^|\/)(?:index|public|api)\./.test(candidate)) publicApis.add(candidate);
  }
  const sensitiveFiles = files.filter((file) => matches(normal(file), policy.sensitivePaths));
  const policyViolations: string[] = [];
  if (files.some((file) => matches(normal(file), policy.forbiddenPaths))) policyViolations.push("policy forbids modifying one or more target paths");
  if (files.length > policy.maxFilesPerChangeSet) policyViolations.push(`policy allows at most ${policy.maxFilesPerChangeSet} files per change set`);
  if (publicApis.size && policy.protectedPublicApis.length) policyViolations.push("change may affect a protected public API");
  return { importers: [...importers], routes: [...routes], publicApis: [...publicApis], relatedTests: [...relatedTests], sensitiveFiles, policyViolations };
}

export function scoreDecision(input: { issues: PrioritizedIssue[]; fixedSelected: number; selected: number; introducedSevere: number; tests: "passed" | "failed" | "not-found"; impact: ChangeImpact; }): ConfidenceScores {
  const deterministic = input.issues.every((issue) => issue.tool === "eslint" || issue.tool === "tsc");
  const diagnosis = deterministic ? 95 : 65;
  let patch = input.fixedSelected === input.selected ? 90 : 20;
  let behavioral = input.tests === "passed" ? 90 : input.tests === "not-found" ? 45 : 10;
  const reasons: string[] = [];
  if (input.impact.sensitiveFiles.length) { patch -= 20; reasons.push("sensitive path affected"); }
  if (input.impact.policyViolations.length) { patch = 0; reasons.push(...input.impact.policyViolations); }
  if (input.tests === "not-found") reasons.push("test gap: no related test found");
  if (input.introducedSevere) reasons.push("new high/critical finding introduced");
  const status: DecisionStatus = input.fixedSelected !== input.selected || input.introducedSevere || input.tests === "failed" || input.impact.policyViolations.length ? "red" : input.tests === "not-found" ? "yellow" : "green";
  return { diagnosis, patch: Math.max(0, patch), behavioral, status, reasons };
}
