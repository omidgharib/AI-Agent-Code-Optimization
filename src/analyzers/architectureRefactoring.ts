// FILE: src/analyzers/architectureRefactoring.ts
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ArchitectureReport } from "./architecture";

export interface DuplicateGroup {
  id: string;
  signature: string;
  files: string[];
  originFile: string;
  instances: number;
  lines: number;
  confidence: "high" | "medium";
}

export interface RefactoringStage {
  order: number;
  name: string;
  rationale: string;
  actions: string[];
  preservesPublicApi: boolean;
  validatesWith: string[];
}

export interface RefactoringPlan {
  target: string;
  kind: "production" | "test" | "generated";
  lines: number;
  incoming: number;
  outgoing: number;
  debtScoreBefore: number;
  debtScoreAfter: number;
  stages: RefactoringStage[];
}

export interface BoundaryViolation {
  ruleId: string;
  message: string;
  files: string[];
  severity: "medium" | "high";
  confidence: "high" | "medium";
}

const WINDOW = 20;
const MIN_SHARED_WINDOWS = 2;

export function normalizeDuplicationToken(source: string): string[] {
  const tokens = source
    .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, " ")
    .replace(/\b(?:const|let|var|function|return|if|else|for|while|export|import|async|await|new|typeof|instanceof|try|catch|throw)\b/g, " ")
    .replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g, " ")
    .replace(/[A-Za-z_$][\w$]*/g, "N")
    .replace(/\s+/g, " ")
    .trim();
  return tokens ? tokens.split(" ") : [];
}

export async function groupDuplicatedLogic(report: ArchitectureReport, readSource: (file: string) => Promise<string> | string): Promise<DuplicateGroup[]> {
  const production = report.nodes.filter((node) => node.kind === "production" && node.lines > WINDOW);
  const windowed = new Map<string, Set<string>>();
  for (const node of production) {
    const source = await Promise.resolve(readSource(node.file));
    windowed.set(node.file, duplicationWindows(normalizeDuplicationToken(source)));
  }
  const sharedKeys = new Map<string, Set<string>>();
  for (const [file, windows] of windowed) for (const window of windows) { const set = sharedKeys.get(window) ?? new Set<string>(); set.add(file); sharedKeys.set(window, set); }
  const groups = new Map<string, DuplicateGroup>();
  for (const [window, files] of sharedKeys) {
    if (files.size < 2) continue;
    const key = [...files].sort().join("|");
    const existing = groups.get(key) ?? { id: "", signature: window, originFile: [...files][0], files: [...files], instances: 0, lines: 0, confidence: files.size >= 3 ? "medium" as const : "high" as const };
    existing.instances++;
    if (window.length > existing.signature.length) existing.signature = window;
    groups.set(key, existing);
  }
  return [...groups.values()].filter((group) => group.instances >= MIN_SHARED_WINDOWS).map((group) => ({ ...group, id: createHash("sha256").update(`${group.files.join(",")}:${group.signature}`).digest("hex").slice(0, 16), lines: Math.min(...group.files.map((file) => report.nodes.find((node) => node.file === file)?.lines ?? 0)) })).sort((a, b) => b.instances - a.instances);
}

export function duplicationWindows(tokens: string[]): Set<string> {
  const windows = new Set<string>();
  for (let i = 0; i + WINDOW <= tokens.length; i++) windows.add(tokens.slice(i, i + WINDOW).join(" "));
  return windows;
}

export function generateRefactoringPlan(report: ArchitectureReport, target: string): RefactoringPlan {
  const node = report.nodes.find((candidate) => candidate.file === target);
  if (!node) throw new Error(`Architecture report has no node for "${target}"`);
  const importers = report.nodes.filter((other) => other.imports.includes(target));
  const importeeNames = new Set(report.nodes.filter((other) => node.imports.includes(other.file)).map((other) => other.file));
  const delta = (incoming: number, outgoing: number) => Math.min(100, (incoming > 10 ? 8 : 0) + (outgoing > 15 ? 8 : 0) + (report.cycles.some((cycle) => cycle.includes(target)) ? 12 : 0));
  const stages: RefactoringStage[] = [];
  let order = 0;
  if (node.lines > 500 || node.incoming + node.outgoing > 25) stages.push({ order: ++order, name: "Extract cohesive module", rationale: `Module has ${node.lines} line(s) and coupling ${node.incoming + node.outgoing}`, actions: ["Identify cohesive clusters by import/export association", "Move each cluster into a dedicated module", "Re-export the original surface from the new modules", "Run the static graph and tests at every step"], preservesPublicApi: true, validatesWith: ["ESLint", "TypeScript", "architecture analysis", "related tests"] });
  if (importers.length === 0 && !/(?:^|\/)(?:pages|routes|app)\//.test(node.file)) stages.push({ order: ++order, name: "Remove or adopt orphan module", rationale: `${target} is not imported by any production module`, actions: ["Confirm no dynamic import references the module", "Remove it or wire it into a consumer", "Delete only after the graph shows zero importers"], preservesPublicApi: true, validatesWith: ["architecture analysis", "related tests"] });
  const cycles = report.cycles.filter((cycle) => cycle.includes(target));
  if (cycles.length) stages.push({ order: ++order, name: "Break circular dependency", rationale: `${target} participates in ${cycles.length} cycle(s)`, actions: ["Extract the shared invariant into a leaf module", "Point one edge of the cycle at the new leaf", "Re-run the cycle detector after each edge change"], preservesPublicApi: true, validatesWith: ["architecture analysis", "TypeScript", "related tests"] });
  if (node.outgoing > 15 || importeeNames.size > 10) stages.push({ order: ++order, name: "Introduce boundary facade", rationale: `Module depends on ${importeeNames.size} sibling module(s)`, actions: ["Create an explicit facade listing the accepted imports", "Move cross-boundary imports behind the facade", "Keep the public exports byte-identical"], preservesPublicApi: true, validatesWith: ["ESLint", "architecture analysis"] });
  if (!stages.length) stages.push({ order: ++order, name: "Targeted cleanup", rationale: "No structural issues require large-scale refactoring", actions: ["Apply mechanical lint fixes only", "Extract repeated blocks detected by duplication analysis", "Do not alter any public export"], preservesPublicApi: true, validatesWith: ["ESLint", "TypeScript", "related tests"] });
  const before = report.debtScore;
  return { target, kind: node.kind, lines: node.lines, incoming: node.incoming, outgoing: node.outgoing, debtScoreBefore: before, debtScoreAfter: Math.min(100, before + delta(importers.length, node.outgoing)), stages };
}

export function findBoundaryViolations(report: ArchitectureReport, boundaries: Array<{ from: string; to: string }> = []): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const boundaryRules = new Map(boundaries.map((b) => [`${b.from}->${b.to}`, b]));
  for (const node of report.nodes) {
    for (const imported of node.imports) {
      const rule = boundaryRules.get(`${node.file}->${imported}`);
      if (rule) violations.push({ ruleId: "boundary-violation", message: `${node.file} imports across declared boundary ${rule.from} -> ${rule.to}`, files: [node.file, imported], severity: "high", confidence: "high" });
    }
    if (node.kind === "test" && node.imports.some((imported) => /(?:^|\/)(?:dist|build|generated|coverage)\//.test(imported))) violations.push({ ruleId: "test-production-boundary", message: `${node.file} imports generated output`, files: [node.file, ...node.imports.filter((imported) => /(?:^|\/)(?:dist|build|generated|coverage)\//.test(imported))], severity: "medium", confidence: "medium" });
  }
  return violations;
}

export async function analyzeDuplicationFromDisk(report: ArchitectureReport, root: string): Promise<DuplicateGroup[]> {
  return groupDuplicatedLogic(report, async (file) => fs.readFile(path.join(root, file), "utf8").catch(() => ""));
}