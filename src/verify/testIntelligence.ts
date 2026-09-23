import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { glob } from "glob";
const exec = promisify(execFile);

export type TestFramework = "jest" | "vitest" | "playwright" | "react-testing-library";
export interface TestMap { frameworks: TestFramework[]; tests: string[]; related: Record<string, string[]> }
export interface CoverageRisk { file: string; lines: number; branches: number; functions: number; risk: "low" | "medium" | "high" }
export async function detectTests(root: string, sources: string[] = []): Promise<TestMap> { const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }; const deps = { ...pkg.dependencies, ...pkg.devDependencies }; const frameworks: TestFramework[] = []; if (deps.jest || await exists(root, "jest.config.js") || await exists(root, "jest.config.ts")) frameworks.push("jest"); if (deps.vitest || await exists(root, "vitest.config.ts")) frameworks.push("vitest"); if (deps["@playwright/test"] || await exists(root, "playwright.config.ts")) frameworks.push("playwright"); if (deps["@testing-library/react"]) frameworks.push("react-testing-library"); const tests = (await glob("**/*.{test,spec}.{js,jsx,ts,tsx}", { cwd: root, nodir: true, ignore: ["**/node_modules/**", "**/dist/**"] })).map((f) => f.replace(/\\/g, "/")); const related: Record<string, string[]> = {}; for (const source of sources) { const stem = path.basename(source).replace(/\.[^.]+$/, ""); related[source] = []; for (const test of tests) { const content = await fs.readFile(path.join(root, test), "utf8").catch(() => ""); if (path.basename(test).startsWith(`${stem}.`) || content.includes(stem)) related[source].push(test); } } return { frameworks, tests, related }; }
async function exists(root: string, name: string) { return fs.access(path.join(root, name)).then(() => true).catch(() => false); }
export async function importCoverage(root: string, file = "coverage/coverage-summary.json"): Promise<CoverageRisk[]> { const data = JSON.parse(await fs.readFile(path.join(root, file), "utf8")) as Record<string, Record<string, { pct?: number }>>; return Object.entries(data).filter(([name]) => name !== "total").map(([name, metrics]) => { const lines = metrics.lines?.pct ?? 0, branches = metrics.branches?.pct ?? 0, functions = metrics.functions?.pct ?? 0, minimum = Math.min(lines, branches, functions); return { file: path.isAbsolute(name) ? path.relative(root, name).replace(/\\/g, "/") : name, lines, branches, functions, risk: minimum < 50 ? "high" : minimum < 80 ? "medium" : "low" }; }); }
export async function detectFlakyTest(root: string, command: string, args: string[], repetitions = 3, timeoutMs = 60_000) { const outcomes: Array<{ passed: boolean; output: string }> = []; for (let i = 0; i < Math.max(2, Math.min(10, repetitions)); i++) { try { const result = await exec(command, args, { cwd: root, timeout: timeoutMs, maxBuffer: 2_000_000 }); outcomes.push({ passed: true, output: `${result.stdout}${result.stderr}`.slice(-2000) }); } catch (error) { const value = error as { stdout?: string; stderr?: string }; outcomes.push({ passed: false, output: `${value.stdout ?? ""}${value.stderr ?? ""}`.slice(-2000) }); } } return { flaky: outcomes.some((o) => o.passed) && outcomes.some((o) => !o.passed), outcomes }; }
export function testHealth(mapping: TestMap, coverage: CoverageRisk[]) { const tested = Object.values(mapping.related).filter((tests) => tests.length).length; const total = Object.keys(mapping.related).length; const coveragePenalty = coverage.reduce((sum, item) => sum + (item.risk === "high" ? 8 : item.risk === "medium" ? 3 : 0), 0); const mappingPenalty = total ? Math.round((1 - tested / total) * 40) : 0; return { score: Math.max(0, 100 - coveragePenalty - mappingPenalty), testedSources: tested, totalSources: total, gaps: coverage.filter((item) => item.risk !== "low") }; }
export function verificationGate(input: { requiredPassed: boolean; runtimePassed: boolean; visualDifference?: number; visualThreshold?: number }) { const reasons: string[] = []; if (!input.requiredPassed) reasons.push("Required tests failed"); if (!input.runtimePassed) reasons.push("Runtime checks failed"); if ((input.visualDifference ?? 0) > (input.visualThreshold ?? 0.01)) reasons.push(`Visual difference ${input.visualDifference} exceeds threshold ${input.visualThreshold ?? 0.01}`); return { passed: reasons.length === 0, reasons }; }
export interface UnitTestSuggestion { target: string; kind: "unit" | "edge" | "error"; title: string; case: string; confidence: "low" | "medium" | "high" }
export function suggestUnitTests(source: string, meta: { filePath?: string; framework?: TestFramework } = {}): UnitTestSuggestion[] {
  const suggestions: UnitTestSuggestion[] = [];
  const fragment = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
  for (const match of fragment.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
    const name = match[1], args = match[2].split(",").map((arg) => arg.trim().split(/[:=]/)[0].trim()).filter(Boolean);
    const body = fragment.slice(match.index ?? 0, (match.index ?? 0) + 1200);
    const branches = (body.match(/\b(?:if|for|while|switch|catch)\b/g) ?? []).length;
    const returnsValue = /\breturn\b/.test(body);
    if (returnsValue && args.length) suggestions.push({ target: name, kind: "unit", title: `${name} returns the expected value`, case: `expect(${name}(${args.map((a) => "fixture" + a).join(", ")})).toBe(...)`, confidence: "high" });
    if (branches > 1) suggestions.push({ target: name, kind: "edge", title: `${name} handles alternate branches`, case: `cover both true and false paths across ${branches} branch(es)`, confidence: "medium" });
    if (/\bcatch\b|\bthrow\b/.test(body)) suggestions.push({ target: name, kind: "error", title: `${name} rejects invalid input`, case: `expect(() => ${name}(bad)).toThrow()`, confidence: "high" });
  }
  for (const match of fragment.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g)) {
    const name = match[1], args = match[2].split(",").map((arg) => arg.trim().split(/[:=]/)[0].trim()).filter(Boolean);
    const body = fragment.slice(match.index ?? 0, (match.index ?? 0) + 1000);
    if (/\breturn\b/.test(body) && args.length) suggestions.push({ target: name, kind: "unit", title: `${name} computes deterministic output`, case: `${name}(${args.map(() => "fixture").join(", ")}) produces the expected result`, confidence: "medium" });
    if (/\?\.|\([^)]*\?\s*[^:]+:/.test(body)) suggestions.push({ target: name, kind: "edge", title: `${name} handles missing/null inputs`, case: `pass undefined or null inputs and assert safe defaults`, confidence: "high" });
  }
  const defaultExportCount = (fragment.match(/(?:export\s+default)/g) ?? []).length;
  if (defaultExportCount > 0) suggestions.push({ target: "default-export", kind: "unit", title: "default export renders without errors", case: `render <Component /> and expect no console errors`, confidence: "low" });
  const seen = new Set<string>();
  return suggestions.filter((s) => { const key = `${s.target}:${s.kind}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 20);
}
export interface PlaywrightJourney { name: string; steps: Array<{ action: "goto" | "click" | "type" | "expect" | "screenshot"; selector?: string; text?: string; timeoutMs?: number }>; budgetMs: number }
export function buildPlaywrightJourney(routes: string[], memo: { selectors: string[]; formSelector?: string; budgetMs?: number } = { selectors: [] }): PlaywrightJourney {
  const steps: PlaywrightJourney["steps"] = [];
  const home = routes[0] ?? "/";
  steps.push({ action: "goto", text: home, timeoutMs: 30_000 });
  steps.push({ action: "expect", selector: memo.formSelector ?? "body", timeoutMs: 10_000 });
  if (memo.selectors.length >= 2) steps.push({ action: "click", selector: memo.selectors[0], text: "primary action", timeoutMs: 8_000 });
  if (memo.selectors.length >= 3) steps.push({ action: "type", selector: memo.selectors[1], text: "search term", timeoutMs: 8_000 });
  for (const route of routes.slice(1)) steps.push({ action: "goto", text: route, timeoutMs: 15_000 });
  steps.push({ action: "screenshot", timeoutMs: 10_000 });
  const budgetMs = memo.budgetMs ?? steps.length * 5_000;
  return { name: `journey-${home.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "home"}`, steps, budgetMs };
}
export function isJourneyWithinBudget(journey: PlaywrightJourney, elapsedMs: number) { return { met: elapsedMs <= journey.budgetMs, budgetMs: journey.budgetMs, elapsedMs }; }
