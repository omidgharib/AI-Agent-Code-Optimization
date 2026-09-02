import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MODEL_PROVIDERS, resolveModel } from "../core/models";
import { applyDiff, getDiffTargetPath } from "../fix/diffApplier";
import { PatchTransaction } from "../fix/patchTransaction";
import { runEslint } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { normalize } from "../normalize/normalizer";
import { assessPatches, createPersistentSnapshot, restorePersistentSnapshot } from "../core/trustSecurity";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

interface AuditJob {
  id: string;
  projectPath: string;
  url?: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  exitCode?: number;
  logs: string[];
  reportPath?: string;
  child?: ChildProcessWithoutNullStreams;
}

const HOST = "127.0.0.1";
const PORT = Number(process.env.AI_AUDITOR_UI_PORT ?? 4317);
const jobs = new Map<string, AuditJob>();
const listeners = new Map<string, Set<ServerResponse>>();
const uiRoot = path.resolve(__dirname, "../../ui/dist");
const browserTestContract = {
  version: 1,
  product: "ai-auditor",
  baseUrl: `http://${HOST}:${PORT}`,
  optionalController: "Chrome MCP",
  runtimeAnalyzers: ["playwright", "lighthouse"],
  selectors: {
    language: "[data-testid=language-toggle]",
    projectPath: "[data-testid=project-path]",
    folderBrowser: "[data-testid=folder-browser]",
    auditUrl: "[data-testid=audit-url]",
    provider: "[data-testid=provider-select]",
    model: "[data-testid=model-select]",
    fix: "[data-testid=fix-toggle]",
    dryRun: "[data-testid=dry-run-toggle]",
    severity: "[data-testid=severity-select]",
    start: "[data-testid=start-audit]",
    error: "[data-testid=form-error]",
    liveLog: "[data-testid=live-log]",
    issues: "[data-testid=issue-list]",
    folderDialog: "[data-testid=folder-dialog]",
  },
} as const;

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function publicJob(job: AuditJob) {
  const { child: _child, ...safeJob } = job;
  return safeJob;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function validateProject(input: unknown): Promise<string> {
  if (typeof input !== "string" || input.trim().length === 0)
    throw new Error("Project path is required");
  if (/[\0\r\n]/.test(input)) throw new Error("Project path is invalid");
  const real = await fs.realpath(path.resolve(input.trim()));
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) throw new Error("Project path must be a directory");
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(real, "package.json"), "utf8"));
    if (!pkg || typeof pkg !== "object") throw new Error();
  } catch {
    throw new Error("Only JavaScript/TypeScript projects with package.json are supported");
  }
  return real;
}

function validateAuditUrl(input: unknown): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input !== "string") throw new Error("Lighthouse URL is invalid");
  const parsed = new URL(input.trim());
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Lighthouse URL must use http or https");
  return parsed.toString();
}

function validateModelSelection(input: Record<string, unknown>) {
  const provider = typeof input.provider === "string" ? input.provider : undefined;
  if (!provider) return {};
  if (!MODEL_PROVIDERS[provider])
    throw new Error("Unknown or unsupported model provider");
  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (!model || model.length > 160 || /[\0\r\n]/.test(model))
    throw new Error("Model ID is invalid");
  let baseUrl: string | undefined;
  if (typeof input.baseUrl === "string" && input.baseUrl.trim()) {
    const parsed = new URL(input.baseUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Endpoint must use HTTP or HTTPS");
    baseUrl = parsed.toString().replace(/\/$/, "");
  }
  if (provider === "custom" && !baseUrl) throw new Error("Custom provider requires an endpoint URL");
  return { provider, model, baseUrl };
}

function modelCatalog() {
  return Object.values(MODEL_PROVIDERS)
    .map((provider) => {
      const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(provider.baseUrl);
      const keyRequired = provider.keyRequired && !local;
      const keyConfigured = !keyRequired || Boolean(provider.keyEnv && process.env[provider.keyEnv]);
      return {
        id: provider.id,
        label: provider.label,
        defaultModel: provider.model,
        baseUrl: provider.baseUrl,
        keyRequired,
        keyConfigured,
        local,
      };
    });
}

async function discoverModels(providerId: string, overrideBaseUrl?: string) {
  const provider = MODEL_PROVIDERS[providerId];
  if (!provider) throw new Error("Unknown model provider");
  if (providerId === "aifa")
    return {
      provider: providerId,
      online: true,
      models: [{ id: "assistance-model" }, { id: "developer-model" }],
    };
  const resolved = resolveModel({ provider: providerId, baseUrl: overrideBaseUrl });
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(resolved.baseUrl);
  if (resolved.keyRequired && !resolved.apiKey && !local)
    return { provider: providerId, online: false, models: [{ id: provider.model }], error: "API key is not configured on the server" };
  let endpoint = resolved.baseUrl.replace(/\/+$/, "");
  if (endpoint.endsWith("/chat/completions")) endpoint = endpoint.slice(0, -"/chat/completions".length);
  if (!endpoint.endsWith("/v1")) endpoint += "/v1";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${endpoint}/models`, {
      signal: controller.signal,
      headers: resolved.apiKey ? { authorization: `Bearer ${resolved.apiKey}` } : undefined,
    });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
    const payload = await response.json() as { data?: unknown[] };
    const models = (Array.isArray(payload.data) ? payload.data : [])
      .map((item) => {
        if (!item || typeof item !== "object") return undefined;
        const record = item as Record<string, unknown>;
        if (typeof record.id !== "string") return undefined;
        const caps = record.capabilities && typeof record.capabilities === "object" ? record.capabilities as Record<string, unknown> : {};
        return {
          id: record.id,
          realModel: typeof record.real_model === "string" ? record.real_model : undefined,
          reasoning: caps.reasoning === true,
          webSearch: caps.web_search === true,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return { provider: providerId, online: true, models: models.length ? models : [{ id: provider.model }] };
  } catch (error) {
    return { provider: providerId, online: false, models: [{ id: provider.model }], error: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timer); }
}

function isTrustedLocalRequest(req: IncomingMessage): boolean {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  return !origin || origin === `http://${HOST}:${PORT}`;
}

async function listDirectories(input: string | null) {
  const requested = input?.trim() || process.cwd();
  if (/[/\\]\.git(?:[/\\]|$)/i.test(requested))
    throw new Error("Browsing .git is not allowed");
  const current = await fs.realpath(path.resolve(requested));
  if (!(await fs.stat(current)).isDirectory()) throw new Error("Path is not a directory");
  const entries = await fs.readdir(current, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name !== ".git")
    .map((entry) => ({ name: entry.name, path: path.join(current, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  let isProject = false;
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(current, "package.json"), "utf8"));
    isProject = Boolean(pkg && typeof pkg === "object");
  } catch { /* not a JS/TS project */ }
  const parent = path.dirname(current);
  return { current, parent: parent === current ? null : parent, directories, isProject };
}

function emit(job: AuditJob, event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of listeners.get(job.id) ?? []) res.write(payload);
}

function addLog(job: AuditJob, source: "stdout" | "stderr", chunk: Buffer): void {
  for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
    const entry = `${source === "stderr" ? "!" : ">"} ${line}`;
    job.logs.push(entry);
    if (job.logs.length > 500) job.logs.shift();
    emit(job, "log", entry);
  }
}

async function newestReport(projectPath: string): Promise<string | undefined> {
  const root = path.join(projectPath, "ai-auditor-report");
  try {
    const dirs = await fs.readdir(root, { withFileTypes: true });
    const candidates = dirs.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    for (const dir of candidates) {
      const candidate = path.join(root, dir, "report.json");
      try { await fs.access(candidate); return candidate; } catch { /* continue */ }
    }
  } catch { /* no report yet */ }
  return undefined;
}

function startJob(job: AuditJob, options: Record<string, unknown>): void {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  const cliPath = path.resolve(__dirname, "../cli/index.js");
  const args = [cliPath, "audit", job.projectPath, "--json"];
  if (options.fix === true) args.push("--fix");
  if (typeof options.agentMode === "string" && ["suggest", "dry-run", "apply"].includes(options.agentMode))
    args.push("--agent-mode", options.agentMode);
  else if (options.dryRun === true) args.push("--dry-run");
  if (Array.isArray(options.issueIds)) {
    const ids = options.issueIds.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{16}$/.test(id));
    if (ids.length) args.push("--issue-ids", ids.join(","));
  }
  const boundedNumber = (name: string, flag: string, min: number, max: number) => {
    const value = options[name];
    if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max)
      args.push(flag, String(Math.floor(value)));
  };
  boundedNumber("maxAiRequests", "--max-ai-requests", 1, 100);
  boundedNumber("maxAgentSeconds", "--max-agent-seconds", 10, 3600);
  boundedNumber("maxChangedFiles", "--max-changed-files", 1, 50);
  boundedNumber("maxAgentTokens", "--max-agent-tokens", 1000, 2_000_000);
  if (typeof options.analysisModel === "string" && options.analysisModel.trim()) args.push("--analysis-model", options.analysisModel.trim());
  boundedNumber("maxCritical", "--max-critical", 0, 100000);
  boundedNumber("maxHigh", "--max-high", 0, 100000);
  if (options.failOnNew === true) args.push("--fail-on-new");
  if (options.sarif === true) args.push("--sarif");
  if (options.changedOnly === true) args.push("--changed-only");
  if (typeof options.baselinePath === "string" && options.baselinePath.trim()) args.push("--baseline", options.baselinePath.trim());
  if (job.url) args.push("--url", job.url);
  if (job.provider) args.push("--provider", job.provider);
  if (job.model) args.push("--model", job.model);
  if (job.baseUrl) args.push("--base-url", job.baseUrl);
  if (typeof options.severity === "string" && ["low", "medium", "high", "critical"].includes(options.severity))
    args.push("--severity", options.severity);

  const childEnv = { ...process.env };
  if (typeof options.apiKey === "string" && options.apiKey.trim()) {
    const keyEnv = job.provider && MODEL_PROVIDERS[job.provider]?.keyEnv;
    if (keyEnv) childEnv[keyEnv] = options.apiKey.trim();
  }
  if (job.provider === "aifa") {
    if (typeof options.aifaUserId === "string") childEnv.AIFA_USER_ID = options.aifaUserId.trim();
    if (typeof options.aifaSessionId === "string" && options.aifaSessionId.trim())
      childEnv.AIFA_SESSION_ID = options.aifaSessionId.trim();
  }
  const child = spawn(process.execPath, args, { cwd: job.projectPath, shell: false, windowsHide: true, env: childEnv });
  job.child = child;
  child.stdout.on("data", (chunk: Buffer) => addLog(job, "stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => addLog(job, "stderr", chunk));
  child.on("error", (error) => addLog(job, "stderr", Buffer.from(error.message)));
  child.on("close", async (code) => {
    job.exitCode = code ?? 2;
    job.status = job.status === "cancelled" ? "cancelled" : code === 2 ? "failed" : "completed";
    job.completedAt = new Date().toISOString();
    job.reportPath = await newestReport(job.projectPath);
    delete job.child;
    emit(job, "status", publicJob(job));
    for (const res of listeners.get(job.id) ?? []) res.end();
    listeners.delete(job.id);
  });
  emit(job, "status", publicJob(job));
}

async function serveStatic(reqPath: string, res: ServerResponse): Promise<void> {
  const relative = reqPath === "/" ? "index.html" : reqPath.slice(1);
  let file = path.resolve(uiRoot, relative);
  if (!file.startsWith(`${uiRoot}${path.sep}`) && file !== path.join(uiRoot, "index.html")) {
    json(res, 403, { error: "Forbidden" }); return;
  }
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, "index.html");
  } catch { file = path.join(uiRoot, "index.html"); }
  const ext = path.extname(file);
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
  try {
    await fs.access(file);
    res.writeHead(200, { "content-type": `${types[ext] ?? "application/octet-stream"}; charset=utf-8` });
    createReadStream(file).pipe(res);
  } catch { json(res, 404, { error: "UI is not built. Run npm run build:ui." }); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, product: "ai-auditor" });
    if (req.method === "GET" && url.pathname === "/api/browser-test-contract")
      return json(res, 200, browserTestContract);
    if (req.method === "GET" && url.pathname === "/api/model-providers")
      return json(res, 200, modelCatalog());
    if (req.method === "GET" && url.pathname === "/api/models") {
      const provider = url.searchParams.get("provider") ?? "forgetmeai";
      const endpoint = url.searchParams.get("baseUrl") ?? undefined;
      return json(res, 200, await discoverModels(provider, endpoint));
    }
    if (req.method === "GET" && url.pathname === "/api/directories") {
      if (!isTrustedLocalRequest(req)) return json(res, 403, { error: "Cross-site request rejected" });
      return json(res, 200, await listDirectories(url.searchParams.get("path")));
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") return json(res, 200, [...jobs.values()].map(publicJob).reverse());
    if (req.method === "GET" && url.pathname === "/api/history") {
      const projectPath = await validateProject(url.searchParams.get("path"));
      const root = path.join(projectPath, "ai-auditor-report");
      let names: string[] = [];
      try { names = (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse().slice(0, 50); } catch { /* empty history */ }
      const history = [];
      for (const name of names) {
        try {
          const reportPath = path.join(root, name, "report.json");
          const report = JSON.parse(await fs.readFile(reportPath, "utf8")) as { summary?: unknown; qualityGate?: unknown; lighthouse?: { categories?: Record<string, { score?: number }> } };
          history.push({ id: name, reportPath, summary: report.summary, qualityGate: report.qualityGate, lighthouseScores: Object.fromEntries(Object.entries(report.lighthouse?.categories ?? {}).map(([key, value]) => [key, value.score])) });
        } catch { /* skip corrupt report */ }
      }
      return json(res, 200, history);
    }
    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const input = await body(req);
      const projectPath = await validateProject(input.projectPath);
      const auditUrl = validateAuditUrl(input.url);
      const selection = validateModelSelection(input);
      if (selection.provider === "aifa" && input.fix === true) {
        const token = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
        const userId = typeof input.aifaUserId === "string" ? input.aifaUserId.trim() : "";
        if (!token && !process.env.AIFA_ACCESS_TOKEN) throw new Error("AIFA access token is required");
        if (!userId && !process.env.AIFA_USER_ID) throw new Error("AIFA user ID is required");
        if ([token, userId, typeof input.aifaSessionId === "string" ? input.aifaSessionId : ""].some((value) => value.length > 512 || /[\0\r\n]/.test(value)))
          throw new Error("AIFA credentials contain invalid characters or are too long");
      }
      const job: AuditJob = { id: randomUUID(), projectPath, url: auditUrl, ...selection, status: "queued", createdAt: new Date().toISOString(), logs: [] };
      jobs.set(job.id, job);
      json(res, 202, publicJob(job));
      setImmediate(() => startJob(job, input));
      return;
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      return job ? json(res, 200, publicJob(job)) : json(res, 404, { error: "Job not found" });
    }
    const eventMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/events$/);
    if (req.method === "GET" && eventMatch) {
      const job = jobs.get(eventMatch[1]);
      if (!job) return json(res, 404, { error: "Job not found" });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: status\ndata: ${JSON.stringify(publicJob(job))}\n\n`);
      for (const log of job.logs) res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
      if (["completed", "failed", "cancelled"].includes(job.status)) return res.end();
      const set = listeners.get(job.id) ?? new Set<ServerResponse>(); set.add(res); listeners.set(job.id, set);
      req.on("close", () => set.delete(res));
      return;
    }
    const reportMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/report$/);
    if (req.method === "GET" && reportMatch) {
      const job = jobs.get(reportMatch[1]);
      if (!job?.reportPath) return json(res, 404, { error: "Report not available" });
      return json(res, 200, JSON.parse(await fs.readFile(job.reportPath, "utf8")));
    }
    const trustMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/trust$/);
    if (req.method === "GET" && trustMatch) {
      const job = jobs.get(trustMatch[1]);
      if (!job?.reportPath) return json(res, 404, { error: "Report not available" });
      const report = JSON.parse(await fs.readFile(job.reportPath, "utf8")) as { patches?: Array<{ unifiedDiff?: string }> };
      const diffs = (report.patches ?? []).map((patch) => patch.unifiedDiff).filter((diff): diff is string => Boolean(diff));
      return json(res, 200, { ...(await assessPatches(job.projectPath, diffs)), disclosure: diffs.map((diff) => ({ file: getDiffTargetPath(diff), changedLines: diff.split(/\r?\n/).filter((line) => /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line)).slice(0, 40) })) });
    }
    const downloadMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/download$/);
    if (req.method === "GET" && downloadMatch) {
      const job = jobs.get(downloadMatch[1]);
      if (!job?.reportPath) return json(res, 404, { error: "Report not available" });
      const format = url.searchParams.get("format") ?? "json";
      if (!["json", "md", "html", "sarif"].includes(format)) return json(res, 400, { error: "Unsupported format" });
      const file = path.join(path.dirname(job.reportPath), `report.${format}`);
      await fs.access(file);
      res.writeHead(200, { "content-type": format === "json" || format === "sarif" ? "application/json" : format === "html" ? "text/html" : "text/markdown", "content-disposition": `attachment; filename=ai-auditor-report.${format}` });
      return createReadStream(file).pipe(res);
    }
    const applyMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/patches\/apply$/);
    if (req.method === "POST" && applyMatch) {
      if (!isTrustedLocalRequest(req)) return json(res, 403, { error: "Cross-site request rejected" });
      const job = jobs.get(applyMatch[1]);
      if (!job?.reportPath || job.status !== "completed") return json(res, 409, { error: "A completed preview job is required" });
      const input = await body(req);
      const indexes = Array.isArray(input.indexes) ? [...new Set(input.indexes.filter((value): value is number => Number.isInteger(value) && Number(value) >= 0))] : [];
      if (!indexes.length) return json(res, 400, { error: "Select at least one patch" });
      const report = JSON.parse(await fs.readFile(job.reportPath, "utf8")) as { topIssues?: Array<{ id: string; tool: string; severity: string }>; patches?: Array<{ description: string; touches: string[]; unifiedDiff?: string; status?: string }>; trust?: { snapshotId?: string; assessment?: unknown; auditTrail?: unknown[] } };
      const patches = report.patches ?? [];
      const selected = indexes.map((index) => ({ index, patch: patches[index] })).filter((entry) => entry.patch?.unifiedDiff);
      if (selected.length !== indexes.length) return json(res, 400, { error: "One or more selected patches are unavailable" });
      const selectedDiffs = selected.map(({ patch }) => patch.unifiedDiff!);
      const assessment = await assessPatches(job.projectPath, selectedDiffs);
      if (assessment.approvalRequired && input.elevatedApproval !== true) return json(res, 428, { error: "Additional approval is required for this patch", assessment });
      const transaction = new PatchTransaction(job.projectPath, false);
      try {
        const snapshotRoot = path.join(path.dirname(job.reportPath), "snapshots");
        const snapshotId = await createPersistentSnapshot(job.projectPath, selectedDiffs, snapshotRoot);
        for (const { patch } of selected) {
          await transaction.capture(patch.unifiedDiff!);
          const result = await applyDiff(patch.unifiedDiff!, job.projectPath, false);
          if (!result.success) throw new Error(result.error ?? "Patch could not be applied");
        }
        const before = (report.topIssues ?? []).filter((issue) => issue.tool === "eslint" || issue.tool === "tsc");
        const after = normalize([...(await runEslint(job.projectPath)), ...(await runTsc(job.projectPath))]);
        const beforeIds = new Set(before.map((issue) => issue.id));
        const introducedSevere = after.filter((issue) => !beforeIds.has(issue.id) && (issue.severity === "high" || issue.severity === "critical"));
        if (introducedSevere.length || after.length > before.length) throw new Error(introducedSevere.length ? `Verification introduced ${introducedSevere.length} high/critical issue(s)` : `Verification regressed issue count (${before.length} -> ${after.length})`);
        for (const [index, patch] of patches.entries()) patch.status = indexes.includes(index) ? "applied" : patch.status === "preview" ? "rejected" : patch.status;
        report.trust = { snapshotId, assessment, auditTrail: [{ at: new Date().toISOString(), event: "approval", patchIndexes: indexes, elevated: input.elevatedApproval === true }, { at: new Date().toISOString(), event: "verification", passed: true, before: before.length, after: after.length }, { at: new Date().toISOString(), event: "apply", snapshotId }] };
        await fs.writeFile(job.reportPath, JSON.stringify(report, null, 2));
        return json(res, 200, { ok: true, applied: selected.length, snapshotId, assessment, verification: { passed: true, before: before.length, after: after.length } });
      } catch (error) {
        await transaction.rollback();
        return json(res, 409, { error: error instanceof Error ? error.message : String(error), rolledBack: true });
      }
    }
    const undoMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/undo$/);
    if (req.method === "POST" && undoMatch) {
      if (!isTrustedLocalRequest(req)) return json(res, 403, { error: "Cross-site request rejected" });
      const job = jobs.get(undoMatch[1]); if (!job?.reportPath) return json(res, 404, { error: "Report not available" });
      const report = JSON.parse(await fs.readFile(job.reportPath, "utf8")) as { trust?: { snapshotId?: string; auditTrail?: unknown[] }; patches?: Array<{ status?: string }> };
      const snapshotId = report.trust?.snapshotId; if (!snapshotId) return json(res, 409, { error: "No reversible snapshot is available" });
      const restored = await restorePersistentSnapshot(job.projectPath, path.join(path.dirname(job.reportPath), "snapshots"), snapshotId);
      report.trust = { ...report.trust, snapshotId: undefined, auditTrail: [...(report.trust?.auditTrail ?? []), { at: new Date().toISOString(), event: "undo", restored }] };
      for (const patch of report.patches ?? []) if (patch.status === "applied") patch.status = "preview";
      await fs.writeFile(job.reportPath, JSON.stringify(report, null, 2)); return json(res, 200, { ok: true, restored });
    }
    const cancelMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const job = jobs.get(cancelMatch[1]);
      if (!job?.child || job.status !== "running") return json(res, 409, { error: "Job is not running" });
      job.status = "cancelled"; job.child.kill(); return json(res, 202, publicJob(job));
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "Not found" });
    await serveStatic(url.pathname, res);
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => console.log(`AI Auditor UI: http://${HOST}:${PORT}`));
