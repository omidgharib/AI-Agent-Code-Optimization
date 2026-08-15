// FILE: src/fix/llmClient.ts
import type { FixRequest, FixResponse } from "../core/types";
import { FixResponseSchema } from "../core/schemas";
import { buildChatUrl } from "../core/models";

export interface LLMClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 700;

class TransientError extends Error {}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attempt(
  url: string,
  init: RequestInit,
): Promise<FixResponse> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    // Network-level failure (DNS, TLS reset, etc.) — worth retrying.
    throw new TransientError(`LLM request failed: ${String(e)}`);
  }

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    // Models that spend tokens on reasoning can return empty content.
    throw new TransientError("Empty LLM response");
  }

  const parsed = FixResponseSchema.safeParse(JSON.parse(content));
  if (!parsed.success)
    throw new Error(`Invalid FixResponse: ${parsed.error.message}`);
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
          "Return ONLY valid JSON matching FixResponse. Do not include markdown. Provide unified diffs only.",
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
    try {
      return await attempt(url, init);
    } catch (e) {
      if (!(e instanceof TransientError)) throw e;
      lastError = e;
      if (attemptNo < MAX_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attemptNo);
      }
    }
  }
  throw lastError;
}
