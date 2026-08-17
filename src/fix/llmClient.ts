// FILE: src/fix/llmClient.ts
import * as nodeNet from "node:net";
import type { FixRequest, FixResponse } from "../core/types";
import { FixResponseSchema } from "../core/schemas";
import { buildChatUrl } from "../core/models";
import {
  describeNetworkError,
  isTimeoutLike,
} from "../core/errorDiagnosis";
import { logger } from "../core/logger";

export interface LLMClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
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

// Normalize anything near FixResponse (bare patch object / patches array)
// into the wrapper shape before schema validation.
function coerceFixResponse(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    const patches = raw
      .filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === "object",
      )
      .filter((p) => typeof p.unifiedDiff === "string")
      .map((p) => ({
        description:
          asString(p.description) ??
          (p.unifiedDiff as string).split("\n")[0].slice(0, 80),
        unifiedDiff: p.unifiedDiff,
        touches: Array.isArray(p.touches)
          ? p.touches.filter((t): t is string => typeof t === "string")
          : [],
      }));
    return { patches, notes: [] };
  }

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
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
          notes: Array.isArray(o.notes) ? o.notes : [],
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

function tcpProbe(
  url: URL,
  timeoutMs: number,
): Promise<string | null> {
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
      () => finish(`TCP connect to ${host}:${port} timed out after ${timeoutMs}ms`),
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
): Promise<FixResponse> {
  const label = requestLabel(init.method ?? "POST", url);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
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
    logger.debug(`Raw model output that failed FixResponse validation:\n${content}`);
    const first = parsed.error.issues[0];
    const preview =
      content.length > 200 ? `${content.slice(0, 200)}…` : content;
    throw new Error(
      `invalid FixResponse from ${label}: ${first?.message ?? parsed.error.message} (model output preview: ${preview})`,
    );
  }
  if (parsed.data.patches.length === 0) {
    logger.debug(
      `LLM returned no patches — notes: ${JSON.stringify(parsed.data.notes).slice(0, 500)}`,
    );
  }
  return parsed.data as FixResponse;
}

export async function requestFix(
  config: LLMClientConfig,
  req: FixRequest,
): Promise<FixResponse> {
  const url = buildChatUrl(config.baseUrl);
  const body = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You are an expert code-fixing agent. Return ONLY valid JSON matching FixResponse. Do not include markdown. Provide unified diffs only. When fixing an undefined reference (e.g. missing function, variable, import), you are expected to ADD the missing declaration in the affected file. If the provided file excerpt is truncated or shows only issue lines, rely on the issue message and line numbers to construct an accurate unified diff.",
      },
      { role: "user", content: JSON.stringify(req) },
    ],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const init: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };

  let lastError: unknown;
  for (let attemptNo = 1; attemptNo <= MAX_ATTEMPTS; attemptNo++) {
    const label = requestLabel(init.method ?? "POST", url);
    logger.debug(
      `LLM attempt ${attemptNo}/${MAX_ATTEMPTS}: requesting fix from ${label} (timeout ${requestTimeoutMs()}ms)`,
    );
    const retry = (e: unknown, ms: number) => {
      logger.debug(
        `LLM attempt ${attemptNo}/${MAX_ATTEMPTS} for ${label} failed: ${String(e)} — retrying in ${ms}ms`,
      );
    };
    try {
      return await attempt(url, init);
    } catch (e) {
      const transient =
        e instanceof TransientError &&
        !(e as TransientError).noRetry;
      const retryableHttp =
        e instanceof Error && (e as { retryable?: boolean }).retryable;
      if (!transient && !retryableHttp) throw e;
      lastError = e;
      if (attemptNo < MAX_ATTEMPTS) {
        const ms = RETRY_DELAY_MS * attemptNo;
        retry(e, ms);
        await delay(ms);
      }
    }
  }
  throw lastError;
}