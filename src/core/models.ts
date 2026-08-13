// FILE: src/core/models.ts

export interface ModelProvider {
  id: string;
  label: string;
  model: string;
  baseUrl: string;
  keyRequired: boolean;
  keyEnv?: string;
  free: boolean;
  description: string;
}

export interface ResolvedModel {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  keyRequired: boolean;
}

export const DEFAULT_PROVIDER = "openai";
export const FREE_DEFAULT_PROVIDER = "ollama";

export const MODEL_PROVIDERS: Record<string, ModelProvider> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com",
    keyRequired: true,
    keyEnv: "OPENAI_API_KEY",
    free: false,
    description:
      "OpenAI paid models. Default provider when OPENAI_API_KEY is set.",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local, free)",
    model: "llama3.2",
    baseUrl: "http://localhost:11434",
    keyRequired: false,
    free: true,
    description:
      "Free local models via Ollama. No API key needed; requires Ollama running (`ollama serve`) with `ollama pull llama3.2`. Used as the default when no key is configured.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (free models)",
    model: "openai/gpt-oss-20b:free",
    baseUrl: "https://openrouter.ai/api",
    keyRequired: true,
    keyEnv: "OPENROUTER_API_KEY",
    free: true,
    description:
      "Free :free models (Llama, Qwen, Mistral, etc.) behind one OpenAI-compatible endpoint. Free API key required. Free model list rotates — run --list-models or check openrouter.ai/models?max_price=0.",
  },
  groq: {
    id: "groq",
    label: "Groq (free tier)",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai",
    keyRequired: true,
    keyEnv: "GROQ_API_KEY",
    free: true,
    description:
      "Fast LPU inference with a generous free tier. Fully OpenAI-compatible. Free API key required.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini (free tier)",
    model: "gemini-2.5-flash",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyRequired: true,
    keyEnv: "GEMINI_API_KEY",
    free: true,
    description:
      "Google AI Studio free tier via its OpenAI-compatible endpoint. Free API key required.",
  },
  mistral: {
    id: "mistral",
    label: "Mistral (free Experiment tier)",
    model: "open-mistral-nemo",
    baseUrl: "https://api.mistral.ai",
    keyRequired: true,
    keyEnv: "MISTRAL_API_KEY",
    free: true,
    description:
      "Mistral's free Experiment tier (~1B tokens/month). Free API key required.",
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras (free tier)",
    model: "llama-3.3-70b",
    baseUrl: "https://api.cerebras.ai",
    keyRequired: true,
    keyEnv: "CEREBRAS_API_KEY",
    free: true,
    description:
      "Very high throughput free tier for Llama and other open models. Free API key required.",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    keyRequired: true,
    keyEnv: "DEEPSEEK_API_KEY",
    free: false,
    description: "DeepSeek chat models at low cost.",
  },
  zhipu: {
    id: "zhipu",
    label: "Zhipu GLM (free)",
    model: "glm-4-flash",
    baseUrl:
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    keyRequired: true,
    keyEnv: "ZHIPU_API_KEY",
    free: true,
    description:
      "Zhipu AI GLM-4-Flash, a genuinely free model via an OpenAI-compatible endpoint. Widely accessible (no geo-blocking). Free API key from open.bigmodel.cn.",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com",
    keyRequired: true,
    free: false,
    description:
      "Any OpenAI-compatible endpoint. Set --model and --base-url (and --api-key if required) explicitly.",
  },
};

const LOCAL_ENDPOINT = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export function buildChatUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export function resolveModel(opts: {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}): ResolvedModel {
  const providerId = opts.provider ?? process.env.AI_AUDITOR_PROVIDER;
  const preset = providerId ? MODEL_PROVIDERS[providerId] : undefined;
  if (providerId && !preset) {
    throw new Error(
      `Unknown provider "${providerId}". Run --list-models to see available providers.`,
    );
  }

  const envKey = preset?.keyEnv ? process.env[preset.keyEnv] : undefined;
  const apiKey = opts.apiKey ?? envKey ?? process.env.OPENAI_API_KEY ?? "";

  const hasExplicitModel = Boolean(opts.model || process.env.AI_AUDITOR_MODEL);
  const hasExplicitBase = Boolean(
    opts.baseUrl || process.env.AI_AUDITOR_BASE_URL,
  );

  let effectiveProvider = preset?.id;
  if (!effectiveProvider) {
    if (hasExplicitModel || hasExplicitBase) effectiveProvider = "custom";
    else if (apiKey) effectiveProvider = DEFAULT_PROVIDER;
    else effectiveProvider = FREE_DEFAULT_PROVIDER;
  }

  const effective =
    preset ??
    MODEL_PROVIDERS[effectiveProvider] ??
    MODEL_PROVIDERS[DEFAULT_PROVIDER];

  const model =
    opts.model ?? process.env.AI_AUDITOR_MODEL ?? effective.model;
  const baseUrl =
    opts.baseUrl ?? process.env.AI_AUDITOR_BASE_URL ?? effective.baseUrl;

  const localEndpoint = LOCAL_ENDPOINT.test(baseUrl);
  const keyRequired = effective.keyRequired && !localEndpoint;

  return {
    provider: effectiveProvider,
    model,
    baseUrl,
    apiKey,
    keyRequired,
  };
}

export function listModels(): string {
  const rows = Object.values(MODEL_PROVIDERS).map((p) => {
    const key = p.keyRequired ? `key: ${p.keyEnv ?? "OPENAI_API_KEY"}` : "no key";
    const cost = p.free ? "free" : "paid";
    return `${p.id.padEnd(12)} ${cost.padEnd(5)} ${key.padEnd(22)} ${p.label} — ${p.description}`;
  });
  return [
    "Available model providers:",
    ...rows.map((r) => `  ${r}`),
    "",
    "Usage:",
    "  ai-auditor audit . --fix --provider ollama",
    "  ai-auditor audit . --fix --provider groq --api-key <key>",
    "  ai-auditor audit . --fix --model gpt-4o --base-url https://api.openai.com",
  ].join("\n");
}
