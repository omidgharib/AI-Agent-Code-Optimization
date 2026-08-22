import fs from "node:fs/promises";
import path from "node:path";
import type { FixRequest, FixResponse, PrioritizedIssue } from "./types";

interface TraceMeta {
  model: string;
  provider: string;
  baseUrl: string;
  startedAt: string;
}

interface TraceIteration {
  iteration: number;
  selectedIssues: Array<{
    id: string;
    tool: string;
    ruleId?: string;
    message: string;
    severity: string;
    category: string;
    location?: { filePath: string; startLine?: number; endLine?: number };
  }>;
  context: Array<{ filePath: string; excerpt: string; charCount: number }>;
  aiRequests: TraceAiRequest[];
  patches: TracePatchResult[];
  repairs: TraceRepairResult[];
}

interface TraceAiRequest {
  type: "request" | "repair";
  request: FixRequest;
  rawContent?: string;
  response?: FixResponse;
  error?: string;
  durationMs?: number;
  attemptNo?: number;
}

interface TracePatchResult {
  description: string;
  targetFile: string;
  unifiedDiff: string;
  success: boolean;
  error?: string;
}

interface TraceRepairResult {
  description: string;
  applyError: string;
  repairedDiff?: string;
  success: boolean;
  error?: string;
}

interface TraceData {
  meta: TraceMeta;
  iterations: TraceIteration[];
}

const REDACT_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /AKIA[A-Z0-9]{16}/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /Bearer\s+[A-Za-z0-9._-]{20,}/g,
];

function redact(obj: unknown): unknown {
  if (typeof obj === "string") {
    let out = obj;
    for (const p of REDACT_PATTERNS) out = out.replace(p, "<REDACTED>");
    return out;
  }
  if (Array.isArray(obj)) return obj.map(redact);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = redact(v);
    }
    return result;
  }
  return obj;
}

export class FixTracer {
  private data: TraceData;
  private outPath: string;
  private currentIteration: TraceIteration | null = null;

  constructor(reportDir: string, model: string, provider: string, baseUrl: string) {
    this.outPath = path.join(reportDir, "trace.json");
    this.data = {
      meta: {
        model,
        provider,
        baseUrl,
        startedAt: new Date().toISOString(),
      },
      iterations: [],
    };
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.outPath), { recursive: true });
  }

  logIterationStart(
    iteration: number,
    issues: PrioritizedIssue[],
    context: Array<{ filePath: string; excerpt: string }>,
  ): void {
    this.currentIteration = {
      iteration,
      selectedIssues: issues.map((i) => ({
        id: i.id,
        tool: i.tool,
        ruleId: i.ruleId,
        message: i.message,
        severity: i.severity,
        category: i.category,
        location: i.location
          ? {
              filePath: i.location.filePath,
              startLine: i.location.startLine,
              endLine: i.location.endLine,
            }
          : undefined,
      })),
      context: context.map((c) => ({
        filePath: c.filePath,
        excerpt: c.excerpt,
        charCount: c.excerpt.length,
      })),
      aiRequests: [],
      patches: [],
      repairs: [],
    };
    this.data.iterations.push(this.currentIteration);
  }

  logAiRequest(
    type: "request" | "repair",
    req: FixRequest,
    attemptNo?: number,
  ): void {
    if (!this.currentIteration) return;
    this.currentIteration.aiRequests.push({
      type,
      request: redact(req) as FixRequest,
      attemptNo,
    });
  }

  logAiResponse(
    type: "request" | "repair",
    rawContent: string,
    parsed: FixResponse,
    durationMs: number,
  ): void {
    if (!this.currentIteration) return;
    const last = [...this.currentIteration.aiRequests]
      .reverse()
      .find((r) => r.type === type);
    if (!last) return;
    last.rawContent = rawContent;
    last.response = parsed;
    last.durationMs = durationMs;
  }

  logAiError(type: "request" | "repair", error: string, durationMs: number, rawContent?: string): void {
    if (!this.currentIteration) return;
    const last = [...this.currentIteration.aiRequests]
      .reverse()
      .find((r) => r.type === type);
    if (!last) return;
    last.error = error;
    last.durationMs = durationMs;
    if (rawContent) last.rawContent = rawContent;
  }

  logPatchApply(
    description: string,
    targetFile: string,
    unifiedDiff: string,
    success: boolean,
    error?: string,
  ): void {
    if (!this.currentIteration) return;
    this.currentIteration.patches.push({
      description,
      targetFile,
      unifiedDiff,
      success,
      error,
    });
  }

  logPatchRepair(
    description: string,
    applyError: string,
    repairedDiff: string | undefined,
    success: boolean,
    error?: string,
  ): void {
    if (!this.currentIteration) return;
    this.currentIteration.repairs.push({
      description,
      applyError,
      repairedDiff,
      success,
      error,
    });
  }

  async flush(): Promise<void> {
    await fs.mkdir(path.dirname(this.outPath), { recursive: true });
    await fs.writeFile(this.outPath, JSON.stringify(this.data, null, 2));
  }
}

export async function createFixTrace(
  reportDir: string,
  model: string,
  provider: string,
  baseUrl: string,
): Promise<FixTracer> {
  const tracer = new FixTracer(reportDir, model, provider, baseUrl);
  await tracer.init();
  return tracer;
}
