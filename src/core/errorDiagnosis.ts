// FILE: src/core/errorDiagnosis.ts

// undici collapses every fetch failure into `TypeError: fetch failed`; the real
// reason (ECONNREFUSED, DNS, TLS, hang, reset ...) is nested under `error.cause`,
// sometimes through an AggregateError. These helpers walk that chain so errors
// surface the truth instead of a useless double-wrapped generic message.

interface CauseNode {
  name?: string;
  code?: string;
  message?: string;
  errno?: number | string;
  syscall?: string;
  addr?: string;
  hostname?: string;
  port?: number;
}

function causeNodes(e: unknown): CauseNode[] {
  const out: CauseNode[] = [];
  const seen = new Set<unknown>();

  function visit(node: unknown): void {
    if (node === undefined || node === null) return;
    if (seen.has(node) || seen.size > 16) return;
    seen.add(node);
    const o = node as Record<string, unknown>;
    out.push({
      name: typeof o.name === "string" ? o.name : undefined,
      code: typeof o.code === "string" ? o.code : undefined,
      message: typeof o.message === "string" ? o.message : undefined,
      errno:
        typeof o.errno === "number" || typeof o.errno === "string"
          ? o.errno
          : undefined,
      syscall: typeof o.syscall === "string" ? o.syscall : undefined,
      addr: typeof o.addr === "string" ? o.addr : undefined,
      hostname: typeof o.hostname === "string" ? o.hostname : undefined,
      port: typeof o.port === "number" ? o.port : undefined,
    });
    if (Array.isArray(o.errors)) o.errors.forEach(visit);
    else if (o.cause !== undefined && o.cause !== node) visit(o.cause);
  }

  visit(e);
  return out;
}

const CONNECT_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const TIMEOUT_CODES = new Set([
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "ETIMEDOUT",
]);

const TLS_MARKERS = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
];

/**
 * True when the fetch failure is a timeout/abort (i.e. the endpoint accepted
 * the connection but never delivered a response) rather than a livelier
 * connection-level error that is worth retrying.
 */
export function isTimeoutLike(e: unknown): boolean {
  return causeNodes(e).some(
    (n) =>
      TIMEOUT_CODES.has(n.code ?? "") ||
      n.name === "TimeoutError" ||
      n.name === "AbortError" ||
      n.message?.match(/aborted|timed? ?out/i),
  );
}

/**
 * Turn a thrown fetch error into a single-line, actionable message that
 * includes the real underlying cause. `timeoutMs` is used to phrase timeouts.
 */
export function describeNetworkError(e: unknown, timeoutMs: number): string {
  const nodes = causeNodes(e);
  const timedOut = isTimeoutLike(e);

  const connect = nodes.find(
    (n) =>
      n.code !== undefined &&
      CONNECT_CODES.has(n.code) &&
      n.code !== "ETIMEDOUT",
  );
  const tls = nodes.find((n) =>
    TLS_MARKERS.some((m) => n.code === m || n.message?.includes(m)),
  );

  if (connect) {
    const at = connect.addr
      ? `${connect.addr}${connect.port !== undefined ? `:${connect.port}` : ""}`
      : connect.code;
    return `network error ${connect.code ?? "?"} (${connect.message ?? at})`;
  }
  if (timedOut) {
    return `request timed out after ${timeoutMs}ms — the endpoint accepted the connection but never returned an HTTP response (it may be starting up, hung, or not an OpenAI-compatible server)`;
  }
  if (tls) {
    return `TLS certificate error: ${tls.message ?? tls.code}`;
  }

  const deepest = nodes.filter((n) => n.message).at(-1)?.message ?? String(e);
  return `fetch failed: ${deepest}`;
}