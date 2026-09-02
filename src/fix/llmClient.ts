// FILE: src/fix/llmClient.ts
import * as nodeNet from "node:net";
import { randomUUID } from "node:crypto";
import type { FixRequest, FixResponse } from "../core/types";
import type { FixTracer } from "../core/fixTrace";
import { FixResponseSchema } from "../core/schemas";
import { buildChatUrl } from "../core/models";
import { describeNetworkError, isTimeoutLike } from "../core/errorDiagnosis";
import { logger } from "../core/logger";

export interface LLMClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider?: string;
  userId?: string;
  sessionId?: string;
}

export const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 700;
const REQUEST_TIMEOUT_MS = 120_000;
const PREFLIGHT_TIMEOUT_MS = 4_000;
const TCP_PROBE_TIMEOUT_MS = 2_000;

function requestTimeoutMs(): number {
  const fromEnv = Number(process.env.AI_AUDITOR_REQUEST_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return REQUEST_TIMEOUT_MS;
}

class TransientError extends Error {
  noRetry?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestLabel(method: string, url: string): string {
  return `${method} ${url}`;
}

// ---- response parsing ---------------------------------------------------------
// Models rarely emit the exact `FixResponse` object cleanly: they wrap JSON in
// markdown fences, pad it with prose, return a bare array of patches, or omit
// `notes`. Coerce defensively instead of failing on the first deviation.

function extractLLMJson(content: string): unknown {
  let text = content.trim();
  const fenced = text.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)(?=\n```|$)/);
  if (fenced) text = fenced[1].trim();

  try {
    const direct = JSON.parse(text) as unknown;
    if (direct !== null && typeof direct === "object") return direct;
  } catch {
    // fall through to substring extraction
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      return JSON.parse(slice) as unknown;
    } catch {
      // fall through
    }
  }

  throw new SyntaxError("no JSON object found in model output");
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Normalize anything near FixResponse (bare patch object / patches array /
// {fixes:[{filePath,diff}]} style) into the wrapper shape before schema validation.
// Exported for tests.
export function coerceFixResponse(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    const patches = raw
      .filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === "object",
      )
      .filter(
        (p) =>
          typeof p.unifiedDiff === "string" ||
          typeof p.diff === "string" ||
          typeof p.patch === "string",
      )
      .map((p) => {
        const diff =
          asString(p.unifiedDiff) ?? asString(p.diff) ?? asString(p.patch);
        return {
          description:
            asString(p.description) ??
            asString(p.message) ??
            (diff as string).split("\n")[0].slice(0, 80),
          unifiedDiff: diff,
          touches: Array.isArray(p.touches)
            ? p.touches.filter((t): t is string => typeof t === "string")
            : asString(p.filePath)
              ? [asString(p.filePath) as string]
              : [],
        };
      });
    return { patches, notes: [] };
  }

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const topLevelMessage = asString(o.message);

    // ForgetMeAI / some proxies respond with { message, actions:[{action,
    // file, diff}] }. Each action is a single-file unified diff.
    if (Array.isArray(o.actions)) {
      const patches = o.actions
        .filter(
          (a): a is Record<string, unknown> =>
            a !== null && typeof a === "object",
        )
        .filter(
          (a) =>
            typeof a.diff === "string" ||
            (typeof a.action === "string" && typeof a.file === "string"),
        )
        .map((a) => {
          const diff = asString(a.diff) ?? "";
          // The proxy returns bare unified diffs (no `diff --git` / `--- /`+ /`
          // `+++ /` wrapper). If headers are missing, synthesize them so the
          // applier can resolve the target and rebuild the file safely.
          const hasHeaders = /^--- .+\n\+\+\+ /.test(diff);
          const file = asString(a.file);
          const fullDiff =
            !hasHeaders && file
              ? `--- a/${file}\n+++ b/${file}\n${diff}`
              : diff;
          return {
            description:
              asString(a.description) ??
              asString(a.message) ??
              `Fix in ${file ?? "?"}`,
            unifiedDiff: fullDiff,
            touches: file ? [file] : [],
          };
        });
      return {
        patches,
        notes: Array.isArray(o.notes)
          ? o.notes
          : topLevelMessage
            ? [topLevelMessage]
            : [],
      };
    }

    if (Array.isArray(o.fixes)) {
      const patches = o.fixes
        .filter(
          (f): f is Record<string, unknown> =>
            f !== null && typeof f === "object",
        )
        .filter(
          (f) =>
            typeof f.diff === "string" ||
            typeof f.unifiedDiff === "string" ||
            typeof f.patch === "string",
        )
        .map((f) => {
          const diff =
            asString(f.unifiedDiff) ?? asString(f.diff) ?? asString(f.patch);
          return {
            description:
              asString(f.description) ??
              `Fix in ${asString(f.filePath) ?? "?"}`,
            unifiedDiff: diff,
            touches: asString(f.filePath)
              ? [asString(f.filePath) as string]
              : [],
          };
        });
      return {
        patches,
        notes: Array.isArray(o.notes)
          ? o.notes
          : topLevelMessage
            ? [topLevelMessage]
            : [],
      };
    }

    // DeepSeek often returns { changes: [{ filePath, unifiedDiff }] }
    if (Array.isArray(o.changes)) {
      const patches = o.changes
        .filter(
          (c): c is Record<string, unknown> =>
            c !== null && typeof c === "object",
        )
        .filter(
          (c) =>
            typeof c.diff === "string" ||
            typeof c.unifiedDiff === "string" ||
            typeof c.patch === "string",
        )
        .map((c) => {
          const diff =
            asString(c.unifiedDiff) ?? asString(c.diff) ?? asString(c.patch);
          return {
            description:
              asString(c.description) ??
              asString(c.message) ??
              `Fix in ${asString(c.filePath) ?? "?"}`,
            unifiedDiff: diff,
            touches: asString(c.filePath)
              ? [asString(c.filePath) as string]
              : [],
          };
        });
      return {
        patches,
        notes: Array.isArray(o.notes)
          ? o.notes
          : topLevelMessage
            ? [topLevelMessage]
            : [],
      };
    }

    // Some OpenAI-compatible models keep the expected `patches` wrapper but
    // use common aliases inside it ({ filePath, diff }). Normalize the array
    // through the same path used for bare patch arrays before validation.
    if (Array.isArray(o.patches)) {
      const normalized = coerceFixResponse(o.patches) as {
        patches: unknown[];
        notes: string[];
      };
      return {
        patches: normalized.patches,
        notes: Array.isArray(o.notes)
          ? o.notes.filter((n): n is string => typeof n === "string")
          : topLevelMessage
            ? [topLevelMessage]
            : [],
      };
    }

    if (!Array.isArray(o.patches)) {
      if (typeof o.unifiedDiff === "string") {
        return {
          patches: [
            {
              description: asString(o.description) ?? "LLM-proposed fix",
              unifiedDiff: o.unifiedDiff,
              touches: Array.isArray(o.touches)
                ? o.touches.filter((t): t is string => typeof t === "string")
                : [],
            },
          ],
          notes: Array.isArray(o.notes)
            ? o.notes
            : topLevelMessage
              ? [topLevelMessage]
              : [],
        };
      }
    }
  }
  return raw;
}

// ---- preflight connectivity check -------------------------------------------
/**
 * Result of the preflight probe:
 *  - "ok":    server is listening on TCP and answered an HTTP probe.
 *  - "warn":  server is listening but did not answer HTTP / answered with an
 *             unexpected status — the real request will be authoritative.
 *  - "fatal": nothing is listening at the configured endpoint; abort now.
 */
export type EndpointDiagnosis =
  | { status: "ok" }
  | { status: "warn"; message: string }
  | { status: "fatal"; message: string };

function tcpProbe(url: URL, timeoutMs: number): Promise<string | null> {
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const host = url.hostname;
  return new Promise((resolve) => {
    let done = false;
    const finish = (reason: string | null) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(reason);
    };
    const timer = setTimeout(
      () =>
        finish(`TCP connect to ${host}:${port} timed out after ${timeoutMs}ms`),
      timeoutMs,
    );
    const sock = nodeNet.createConnection({ host, port });
    sock.once("connect", () => {
      clearTimeout(timer);
      finish(null);
    });
    sock.once("error", (e) => {
      clearTimeout(timer);
      const code = (e as NodeJS.ErrnoException & { code?: string }).code;
      finish(`${host}:${port} — ${code ?? e.message}`);
    });
  });
}

/**
 * Lightweight readiness probe used before the fix loop. Distinguishes "nothing
 * is listening" (fatal) from "listening but HTTP unresponsive" (warning) so a
 * stalling proxy doesn't kill the run before the real request can confirm.
 */
export async function diagnoseEndpoint(
  baseUrl: string,
  model: string,
  hint: string,
): Promise<EndpointDiagnosis> {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (e) {
    return {
      status: "fatal",
      message: `invalid --base-url "${baseUrl}" (${String(e)}) — it must be a full URL like http://localhost:11434 or https://api.example.com`,
    };
  }

  const tcp = await tcpProbe(parsed, TCP_PROBE_TIMEOUT_MS);
  if (tcp) {
    return {
      status: "fatal",
      message: `endpoint "${hint}" is not listening at ${tcp}. Start the proxy/daemon (or fix --base-url / --provider) and re-run.`,
    };
  }

  const chatUrl = buildChatUrl(baseUrl);
  const probeUrl = chatUrl.replace(/\/chat\/completions\/?$/, "/models");
  try {
    const res = await fetch(probeUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });
    if (res.ok || [401, 403, 404, 405].includes(res.status)) {
      return { status: "ok" };
    }
    return {
      status: "warn",
      message: `preflight GET ${probeUrl} → HTTP ${res.status} ${res.statusText} — the server is listening but answered with an error; the fix request below will surface the real failure.`,
    };
  } catch (e) {
    const why = describeNetworkError(e, PREFLIGHT_TIMEOUT_MS);
    return {
      status: "warn",
      message: `"${hint}" is listening on TCP but did not answer ${probeUrl} in ${PREFLIGHT_TIMEOUT_MS}ms (${why}). It may be stuck waiting on an upstream or an unfinished login. Trying the actual request...`,
    };
  }
}

// ---- fix request ---------------------------------------------------------------
async function attempt(
  url: string,
  init: RequestInit,
): Promise<{ rawContent: string; data: FixResponse }> {
  const label = requestLabel(init.method ?? "POST", url);
  let res: Response;
  try {
    const headers = new Headers(init.headers);
    if (headers.has("x-request-id")) headers.set("x-request-id", randomUUID());
    res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(requestTimeoutMs()),
    });
  } catch (e) {
    // Network-level failure (refused, DNS, TLS reset, hang ...).
    const err = new TransientError(describeNetworkError(e, requestTimeoutMs()));
    // A full request timeout (no HTTP response) is not worth retrying — the
    // endpoint won't magically come up 1.4s later. Fail once, fail clearly.
    if (isTimeoutLike(e)) err.noRetry = true;
    throw err;
  }

  if (!res.ok) {
    const msg = `HTTP ${res.status} ${res.statusText} from ${label}`;
    const retryable = res.status === 429 || res.status >= 500;
    const err = new Error(msg);
    if (retryable) Object.assign(err, { retryable: true });
    if (res.status === 404) {
      err.message +=
        " — path not found. If this is a proxy/LocalAI-style server, check its actual route and match --base-url (OpenAI-compatible servers usually use .../v1)";
    }
    throw err;
  }

  let data: { choices?: Array<{ message: { content: string } }> };
  try {
    data = (await res.json()) as {
      choices?: Array<{ message: { content: string } }>;
    };
  } catch {
    throw new Error(
      `endpoint at ${label} returned HTTP ${res.status} with a non-JSON body — it is probably not an OpenAI-compatible server`,
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    // Models that spend tokens on reasoning can return empty content.
    throw new TransientError(
      `empty response from ${label} (has "choices" but no message content) — the model may have only produced reasoning`,
    );
  }

  let raw: unknown;
  try {
    raw = extractLLMJson(content);
  } catch (e) {
    throw new Error(
      `model output was not JSON (${e instanceof Error ? e.message : String(e)}). Raw response: ${JSON.stringify(content.slice(0, 300))}${content.length > 300 ? "…" : ""}`,
    );
  }

  const parsed = FixResponseSchema.safeParse(coerceFixResponse(raw));
  if (!parsed.success) {
    logger.debug(
      `Raw model output that failed FixResponse validation:\n${content}`,
    );
    const first = parsed.error.issues[0];
    const preview =
      content.length > 200 ? `${content.slice(0, 200)}…` : content;
    const err = new Error(
      `invalid FixResponse from ${label}: ${first?.message ?? parsed.error.message} (model output preview: ${preview})`,
    );
    Object.assign(err, { rawContent: content });
    throw err;
  }
  if (parsed.data.patches.length === 0) {
    logger.debug(
      `LLM returned no patches — notes: ${JSON.stringify(parsed.data.notes).slice(0, 500)}`,
    );
  }
  return { rawContent: content, data: parsed.data as FixResponse };
}

// Shared retry loop: connection-level errors and 5xx/429 are retried with
// backoff; timeouts (endpoint alive but unresponsive) and 4xx are fatal.
async function withRetries(
  label: string,
  run: () => Promise<{ rawContent: string; data: FixResponse }>,
): Promise<{ rawContent: string; data: FixResponse }> {
  let lastError: unknown;
  for (let attemptNo = 1; attemptNo <= MAX_ATTEMPTS; attemptNo++) {
    logger.debug(
      `LLM attempt ${attemptNo}/${MAX_ATTEMPTS}: requesting fix from ${label} (timeout ${requestTimeoutMs()}ms)`,
    );
    try {
      return await run();
    } catch (e) {
      const transient =
        e instanceof TransientError && !(e as TransientError).noRetry;
      const retryableHttp =
        e instanceof Error && (e as { retryable?: boolean }).retryable;
      if (!transient && !retryableHttp) throw e;
      lastError = e;
      if (attemptNo < MAX_ATTEMPTS) {
        const ms = RETRY_DELAY_MS * attemptNo;
        logger.debug(
          `LLM attempt ${attemptNo}/${MAX_ATTEMPTS} for ${label} failed: ${String(e)} — retrying in ${ms}ms`,
        );
        await delay(ms);
      }
    }
  }
  throw lastError;
}

export function buildChatHeaders(config: LLMClientConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.provider === "aifa") {
    headers["x-request-id"] = randomUUID();
    if (config.userId) headers["x-user-id"] = config.userId;
    if (config.sessionId) headers["x-session-id"] = config.sessionId;
    headers.Accept = "application/json";
  }
  try {
    const endpoint = new URL(config.baseUrl);
    if (
      endpoint.port === "9655" &&
      (endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost")
    ) {
      // ForgetMeAI reuses a default agent session when this header is absent,
      // which can leak recommendations from an earlier independent request.
      // One id per chatInit keeps retries stable but isolates separate calls.
      headers["x-agent-session"] = `ai-auditor-${randomUUID()}`;
    }
  } catch {
    // URL validation and diagnostics happen elsewhere; keep request setup pure.
  }
  return headers;
}

function chatInit(
  config: LLMClientConfig,
  messages: Array<{ role: string; content: string }>,
): RequestInit {
  return {
    method: "POST",
    headers: buildChatHeaders(config),
    body: JSON.stringify({ model: config.model, messages }),
  };
}

export async function requestFix(
  config: LLMClientConfig,
  req: FixRequest,
  trace?: FixTracer,
): Promise<FixResponse> {
  const url = buildChatUrl(config.baseUrl);
  const messages = [
    {
      role: "system",
      content:
        "You are an expert code-fixing agent specialized in security, performance, style, and maintainability issues. Return ONLY valid JSON with exactly this shape: {\"patches\":[{\"description\":\"string\",\"unifiedDiff\":\"string\",\"touches\":[\"relative/file/path\"]}],\"notes\":[\"string\"]}. Never rename `description`, `unifiedDiff`, or `touches` to other field names. Do not include markdown. Provide unified diffs only. Treat the provided package.json metadata as the source of truth for the project's framework and tooling; never recommend framework-specific APIs, commands, or packages unless that framework is present in dependencies or devDependencies. When fixing security issues, ensure all inputs are validated and sanitized. When fixing performance issues, optimize without breaking functionality. When fixing an undefined reference (e.g. missing function, variable, import), you are expected to ADD the missing declaration in the affected file. If the provided file excerpt is truncated or shows only issue lines, rely on the issue message and line numbers to construct an accurate unified diff. When an issue has NO source file target (e.g. Lighthouse/custom audits, location.filePath is \"-\"), do NOT invent a file or diff — instead return concrete, actionable recommendations in the `notes` array and omit `patches` for those issues. Diff rules: emit exactly one file per patch; do NOT rename, delete, or mode-change files; include --- / +++ headers (a/ and b/ prefixes optional on the +++ side) and at least one @@ hunk; never use @@ -0,0 +1,N @@ to create a file that already has content; never return an empty or whitespace-only diff.",
    },
    { role: "user", content: JSON.stringify(req) },
  ];
  const init = chatInit(config, messages);
  if (trace) trace.logAiRequest("request", req);
  const t0 = Date.now();
  try {
    const result = await withRetries(requestLabel("POST", url), () =>
      attempt(url, init),
    );
    if (trace)
      trace.logAiResponse(
        "request",
        result.rawContent,
        result.data,
        Date.now() - t0,
      );
    return result.data;
  } catch (e) {
    const rawContent = (e as { rawContent?: string }).rawContent;
    if (trace)
      trace.logAiError("request", String(e), Date.now() - t0, rawContent);
    throw e;
  }
}

/**
 * Re-request a single corrected patch after a unified diff failed to apply.
 * The exact apply error and the current file contents are sent back so the
 * model can regenerate context lines that match the file byte-for-byte.
 */
export async function repairPatch(
  config: LLMClientConfig,
  req: FixRequest,
  failedPatch: { description: string; unifiedDiff: string; touches: string[] },
  error: string,
  fileContents: Record<string, string>,
  trace?: FixTracer,
): Promise<FixResponse> {
  const url = buildChatUrl(config.baseUrl);
  const messages = [
    {
      role: "system",
      content:
        "You generate unified diffs for a lint-fixing tool. A diff you produced earlier did not apply cleanly. Return ONLY valid JSON matching FixResponse (exactly one patch). The diff MUST apply cleanly and exactly against the CURRENT file contents provided below — copy context lines character-for-character, keep the correct file paths in the --- / +++ headers (strip any a/ b/ prefixes on the +++ side), and include enough exact context. Rules: exactly one file per patch; do NOT rename/delete/mode-change files; never use @@ -0,0 +1,N @@ to re-create an existing file — emit a context-based hunk instead; never return an empty or whitespace-only diff.",
    },
    {
      role: "user",
      content: JSON.stringify({
        originalRequest: req,
        failedPatch,
        applyError: error,
        currentFileContents: fileContents,
      }),
    },
  ];
  const init = chatInit(config, messages);
  if (trace) trace.logAiRequest("repair", req);
  const t0 = Date.now();
  try {
    const result = await withRetries(requestLabel("POST", url), () =>
      attempt(url, init),
    );
    if (trace)
      trace.logAiResponse(
        "repair",
        result.rawContent,
        result.data,
        Date.now() - t0,
      );
    return result.data;
  } catch (e) {
    const rawContent = (e as { rawContent?: string }).rawContent;
    if (trace)
      trace.logAiError("repair", String(e), Date.now() - t0, rawContent);
    throw e;
  }
}
