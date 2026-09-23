import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Issue, Severity, SonarSummary } from "../core/types";

const execFileAsync = promisify(execFile);
export interface SonarConfig { enabled: boolean; required?: boolean; hostUrl: string; projectKey: string; sources: string[]; tests?: string[]; exclusions?: string[]; token?: string; timeoutMs?: number; }
export interface SonarRunResult { issues: Issue[]; summary: SonarSummary; }
export interface RawSonarIssue { rule: string; component?: string; project?: string; line?: number; message: string; severity: string; type?: "BUG" | "VULNERABILITY" | "CODE_SMELL"; key?: string; }
export interface RawSonarHotspot { ruleKey?: string; component?: string; line?: number; message: string; vulnerabilityProbability?: string; key?: string; }

const severityMap: Record<string, Severity> = { BLOCKER: "critical", CRITICAL: "high", MAJOR: "medium", MINOR: "low", INFO: "low", HIGH: "high", MEDIUM: "medium", LOW: "low" };
const redact = (value: string, token?: string) => token ? value.split(token).join("<REDACTED>") : value;
const fileOf = (component = "", projectKey = "") => component.startsWith(projectKey + ":") ? component.slice(projectKey.length + 1) : component;
export function sonarIssueId(rule: string, filePath: string, line: number, message: string): string { return createHash("sha256").update(`sonar:${rule}:${filePath}:${line}:${message}`).digest("hex").slice(0, 16); }
export function mapSonarIssue(raw: RawSonarIssue, hostUrl = "http://127.0.0.1:9000", projectKey = raw.project ?? ""): Issue {
  const filePath = fileOf(raw.component, projectKey), line = raw.line ?? 1, type = raw.type ?? "CODE_SMELL";
  return { id: sonarIssueId(raw.rule, filePath, line, raw.message), tool: "sonar", ruleId: raw.rule, message: raw.message, severity: severityMap[raw.severity] ?? "low", category: type === "VULNERABILITY" ? "security" : type === "BUG" ? "bug" : "maintainability", location: { filePath, startLine: line }, evidence: { url: raw.key ? `${hostUrl.replace(/\/$/, "")}/project/issues?id=${encodeURIComponent(projectKey)}&issues=${encodeURIComponent(raw.key)}&open=${encodeURIComponent(raw.key)}` : undefined }, fix: { canAutoFix: true, hint: `Resolve SonarQube ${type.toLowerCase().replace("_", " ")} ${raw.rule}`, strategy: "local" }, meta: { sonarType: type, sonarKey: raw.key } };
}
export function mapSonarHotspot(raw: RawSonarHotspot, hostUrl: string, projectKey: string): Issue {
  const rule = raw.ruleKey ?? "security-hotspot", filePath = fileOf(raw.component, projectKey), line = raw.line ?? 1;
  return { id: sonarIssueId(rule, filePath, line, raw.message), tool: "sonar", ruleId: rule, message: raw.message, severity: severityMap[raw.vulnerabilityProbability ?? "MEDIUM"] ?? "medium", category: "security", location: { filePath, startLine: line }, evidence: { url: raw.key ? `${hostUrl.replace(/\/$/, "")}/security_hotspots?id=${encodeURIComponent(projectKey)}&hotspots=${encodeURIComponent(raw.key)}` : undefined }, fix: { canAutoFix: false, hint: "Review this Security Hotspot manually before changing code", strategy: "advisory" }, meta: { sonarType: "SECURITY_HOTSPOT", sonarKey: raw.key } };
}
export function findNewBlockingSonarIssues(before: Issue[], after: Issue[]): Issue[] {
  const known = new Set(before.filter((issue) => issue.tool === "sonar").map((issue) => issue.id));
  return after.filter((issue) => issue.tool === "sonar" && !known.has(issue.id) && (issue.severity === "high" || issue.severity === "critical") && (issue.meta?.sonarType === "BUG" || issue.meta?.sonarType === "VULNERABILITY"));
}
async function api(host: string, endpoint: string, token: string | undefined, timeout: number): Promise<any> { const headers = token ? { authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` } : undefined; const response = await fetch(`${host.replace(/\/$/, "")}${endpoint}`, { headers, signal: AbortSignal.timeout(timeout) }); if (!response.ok) throw new Error(`SonarQube API ${endpoint} returned HTTP ${response.status}`); return response.json(); }
export async function runSonar(repoRoot: string, config: SonarConfig): Promise<SonarRunResult> {
  const base: SonarSummary = { status: "not-run", hostUrl: config.hostUrl, projectKey: config.projectKey, issueCount: 0 };
  if (!config.enabled) return { issues: [], summary: { ...base, reason: "SonarQube is disabled" } };
  if (!config.projectKey) return { issues: [], summary: { ...base, reason: "SonarQube project key is missing" } };
  const timeout = config.timeoutMs ?? 300_000, token = config.token || process.env.SONAR_TOKEN;
  const workingDirectory = path.join(repoRoot, `.scannerwork-ai-auditor-${process.pid}-${Date.now()}`);
  try {
    await api(config.hostUrl, "/api/system/status", token, Math.min(timeout, 15_000));
    const scannerArgs = [`-Dsonar.host.url=${config.hostUrl}`, `-Dsonar.projectKey=${config.projectKey}`, `-Dsonar.sources=${config.sources.join(",")}`, `-Dsonar.exclusions=${(config.exclusions ?? []).join(",")}`];
    scannerArgs.push(`-Dsonar.working.directory=${workingDirectory}`);
    if (config.tests?.length) scannerArgs.push(`-Dsonar.tests=${config.tests.join(",")}`);
    const execution = { cwd: repoRoot, timeout, maxBuffer: 2_000_000, env: { ...process.env, ...(token ? { SONAR_TOKEN: token } : {}) }, windowsHide: true };
    const scannerPackage = require.resolve("@sonar/scan/package.json");
    const scannerScript = path.join(path.dirname(scannerPackage), "bin", "sonar-scanner.js");
    // Execute the bundled scanner through Node. This avoids .cmd handling on
    // Windows and removes runtime dependence on npx, registry access and cache.
    try { await execFileAsync(process.execPath, [scannerScript, ...scannerArgs], execution); }
    catch (error) { throw new Error(`SonarScanner failed within ${timeout}ms: ${error instanceof Error ? error.message : String(error)}`); }
    const [rawIssues, rawHotspots, gate] = await Promise.all([api(config.hostUrl, `/api/issues/search?componentKeys=${encodeURIComponent(config.projectKey)}&ps=500`, token, timeout), api(config.hostUrl, `/api/hotspots/search?projectKey=${encodeURIComponent(config.projectKey)}&ps=500`, token, timeout).catch(() => ({ hotspots: [] })), api(config.hostUrl, `/api/qualitygates/project_status?projectKey=${encodeURIComponent(config.projectKey)}`, token, timeout).catch(() => ({ projectStatus: { status: "NONE" } }))]);
    const issues = [...(rawIssues.issues ?? []).map((item: RawSonarIssue) => mapSonarIssue(item, config.hostUrl, config.projectKey)), ...(rawHotspots.hotspots ?? []).map((item: RawSonarHotspot) => mapSonarHotspot(item, config.hostUrl, config.projectKey))];
    const qualityGate = (["OK", "ERROR", "WARN", "NONE"].includes(gate.projectStatus?.status) ? gate.projectStatus.status : "NONE") as SonarSummary["qualityGate"];
    return { issues, summary: { ...base, status: qualityGate === "ERROR" ? "failed" : "passed", qualityGate, issueCount: issues.length } };
  } catch (error) { return { issues: [], summary: { ...base, reason: redact(error instanceof Error ? error.message : String(error), token) } }; }
  finally { await fs.rm(workingDirectory, { recursive: true, force: true }).catch(() => undefined); }
}
