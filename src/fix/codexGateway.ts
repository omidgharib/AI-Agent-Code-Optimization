import { describeNetworkError, isTimeoutLike } from "../core/errorDiagnosis";

export function gatewayRoot(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error("Codex gateway requires a local HTTP URL without credentials or query parameters");
  }
  return url.toString().replace(/\/+$/, "").replace(/\/v1(?:\/responses|\/chat\/completions)?$/, "");
}

export async function gatewayJson(baseUrl: string, token: string, route: string, body?: unknown): Promise<any> {
  const root = gatewayRoot(baseUrl);
  if (route !== "/health" && !token) throw new Error("Configure LOCAL_CODEX_GATEWAY_TOKEN on the local server");
  const configured = Number(process.env.AI_AUDITOR_REQUEST_TIMEOUT_MS);
  const timeout = body ? (configured > 0 && Number.isFinite(configured) ? configured : 310000) : 20000;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(root + route, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json", ...(route !== "/health" ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });
      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        // Do not echo upstream bodies: they may include credentials or prompts.
        const error = new Error(`Codex gateway HTTP ${response.status}${requestId ? ` (request ${requestId})` : ""}`);
        Object.assign(error, { retryable: [429, 502, 503, 504].includes(response.status) });
        throw error;
      }
      try { return await response.json(); }
      catch { throw new Error("Gateway did not return JSON. Check the address: AI Auditor and Codex Gateway must use separate ports."); }
    } catch (cause) {
      const retryable = cause instanceof TypeError || (cause as { retryable?: boolean })?.retryable;
      if (!retryable || isTimeoutLike(cause) || attempt >= 2) {
        if (cause instanceof TypeError || isTimeoutLike(cause)) throw new Error(`Codex gateway connection failed: ${describeNetworkError(cause, timeout)}`);
        throw cause;
      }
      await new Promise(resolve => setTimeout(resolve, 700 * 2 ** attempt));
    }
  }
}

export async function gatewayModels(baseUrl: string, token: string): Promise<Array<{ id: string; is_default?: boolean }>> {
  const health = await gatewayJson(baseUrl, token, "/health");
  if (health.status !== "ok") throw new Error("Codex gateway is unhealthy");
  const catalog = await gatewayJson(baseUrl, token, "/v1/models");
  const models = Array.isArray(catalog.data) ? catalog.data.filter((item: any) => typeof item?.id === "string" && !item.hidden) : [];
  if (!models.length) throw new Error("Codex gateway returned no available models");
  return models;
}

export async function gatewayText(config: { baseUrl: string; apiKey: string; model: string }, messages: Array<{ role: string; content: string }>): Promise<string> {
  const models = await gatewayModels(config.baseUrl, config.apiKey);
  if (config.model && !models.some(item => item.id === config.model)) throw new Error("Selected model is absent from the Codex gateway catalog; refresh models");
  const result = await gatewayJson(config.baseUrl, config.apiKey, "/v1/responses", {
    ...(config.model ? { model: config.model } : {}),
    input: messages.filter(item => item.role !== "system"),
    instructions: "Use only the supplied context. Do not modify files or execute commands. Return the requested output for the client to validate.\n" + messages.filter(item => item.role === "system").map(item => item.content).join("\n"),
    mode: "read-only", include_events: false, store: false,
  });
  if (result.status !== "completed" || result.error || result.output?.some((item: any) => item.type === "function_call") || typeof result.output_text !== "string" || !result.output_text.trim()) {
    throw new Error("Codex gateway returned no completed text response");
  }
  return result.output_text;
}
