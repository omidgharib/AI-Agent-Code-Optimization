// FILE: src/fix/llmClient.ts
import type { FixRequest, FixResponse } from "../core/types";
import { FixResponseSchema } from "../core/schemas";

export interface LLMClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function requestFix(
  config: LLMClientConfig,
  req: FixRequest,
): Promise<FixResponse> {
  const url = `${config.baseUrl}/v1/chat/completions`;
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  const parsed = FixResponseSchema.safeParse(JSON.parse(content));
  if (!parsed.success)
    throw new Error(`Invalid FixResponse: ${parsed.error.message}`);
  return parsed.data as FixResponse;
}
