import fs from "node:fs/promises";
import path from "node:path";
import type { AnalyzerManifest, AnalyzerOutcome } from "../domain/analyzer";
import { LocalSandboxRunner } from "../../platform/security/sandboxRunner";
import { parseTscOutput } from "../../analyzers/tscParse";

export async function runBundledTypeScript(root: string, manifest: AnalyzerManifest): Promise<AnalyzerOutcome> {
  const started = Date.now();
  try { await fs.access(path.join(root, "tsconfig.json")); } catch { return { manifest, status: "not_applicable", issues: [], reason: "tsconfig.json is absent", evidence: { stdout: "", stderr: "", exitCode: null, truncated: false, durationMs: Date.now() - started } }; }
  let compiler: string; try { compiler = require.resolve("typescript/bin/tsc", { paths: [path.join(__dirname, "../../..")] }); } catch (error) { return { manifest, status: "unavailable", issues: [], reason: String(error), evidence: { stdout: "", stderr: "", exitCode: null, truncated: false, durationMs: Date.now() - started } }; }
  try { const result = await new LocalSandboxRunner().run({ executable: process.execPath, args: [compiler, "--noEmit", "--pretty", "false"], cwd: root, limits: { timeoutMs: manifest.timeoutMs, maxMemoryMb: manifest.resourceProfile.memoryMb, maxOutputBytes: manifest.resourceProfile.outputBytes } }); const issues = parseTscOutput(`${result.stdout}\n${result.stderr}`, root); const status = result.timedOut ? "timed_out" : result.exitCode !== 0 && issues.length === 0 ? "failed" : "completed"; return { manifest, status, issues, evidence: { ...result, durationMs: Date.now() - started } }; } catch (error) { return { manifest, status: "failed", issues: [], reason: String(error), evidence: { stdout: "", stderr: "", exitCode: null, truncated: false, durationMs: Date.now() - started } }; }
}
