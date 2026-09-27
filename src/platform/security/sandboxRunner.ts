import { spawn } from "node:child_process";
import path from "node:path";
import { redactSensitive } from "./secrets";

export interface SandboxLimits { timeoutMs: number; maxOutputBytes: number; maxMemoryMb: number; }
export interface SandboxRequest { executable: string; args: string[]; cwd: string; env?: Record<string,string>; limits?: Partial<SandboxLimits>; }
export interface SandboxResult { exitCode: number; stdout: string; stderr: string; timedOut: boolean; truncated: boolean; }
const defaults: SandboxLimits = { timeoutMs: 120_000, maxOutputBytes: 4_000_000, maxMemoryMb: 512 };
const ENV_ALLOWLIST = new Set(["PATH","Path","PATHEXT","SYSTEMROOT","SystemRoot","WINDIR","TEMP","TMP","TMPDIR","LANG","LC_ALL","CI"]);
export function allowedEnvironment(extra: Record<string,string> = {}) { const result: Record<string,string> = {}; for (const [key,value] of Object.entries(process.env)) if (value && ENV_ALLOWLIST.has(key)) result[key] = value; for (const [key,value] of Object.entries(extra)) if (/^AI_AUDITOR_[A-Z0-9_]+$/.test(key)) result[key] = value; result.npm_config_ignore_scripts = "true"; result.npm_config_offline = "true"; return result; }
export class LocalSandboxRunner {
  async run(input: SandboxRequest): Promise<SandboxResult> {
    const limits = { ...defaults, ...input.limits }; const cwd = path.resolve(input.cwd); const args = input.executable === process.execPath ? [`--max-old-space-size=${limits.maxMemoryMb}`, ...input.args] : input.args;
    return new Promise((resolve, reject) => { const child = spawn(input.executable, args, { cwd, env: allowedEnvironment(input.env), shell: false, windowsHide: true, stdio: ["ignore","pipe","pipe"] }); let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), truncated = false, timedOut = false; const collect = (current: Buffer, chunk: Buffer) => { const next = Buffer.concat([current, chunk]); if (next.length > limits.maxOutputBytes) { truncated = true; return next.subarray(0, limits.maxOutputBytes); } return next; }; child.stdout.on("data", (chunk: Buffer) => stdout = collect(stdout, chunk)); child.stderr.on("data", (chunk: Buffer) => stderr = collect(stderr, chunk)); const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, limits.timeoutMs); child.once("error", reject); child.once("close", (code) => { clearTimeout(timer); resolve({ exitCode: code ?? 2, stdout: redactSensitive(stdout.toString("utf8")), stderr: redactSensitive(stderr.toString("utf8")), timedOut, truncated }); }); });
  }
}
