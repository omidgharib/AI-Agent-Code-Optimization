// FILE: tests/models.test.ts
import {
  buildChatUrl,
  resolveModel,
  MODEL_PROVIDERS,
} from "../core/models";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "AI_AUDITOR_MODEL",
  "AI_AUDITOR_BASE_URL",
  "AI_AUDITOR_PROVIDER",
  "OPENROUTER_API_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "MISTRAL_API_KEY",
  "CEREBRAS_API_KEY",
  "DEEPSEEK_API_KEY",
  "ZHIPU_API_KEY",
  "DASHSCOPE_API_KEY",
  "CF_API_TOKEN",
  "CF_ACCOUNT_ID",
  "CF_GATEWAY_SLUG",
];

const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("resolveModel", () => {
  it("defaults to a free local provider when no key is configured", () => {
    const r = resolveModel({});
    expect(r.provider).toBe("ollama");
    expect(r.keyRequired).toBe(false);
    expect(r.model).toBe("llama3.2");
    expect(r.baseUrl).toBe("http://localhost:11434");
  });

  it("defaults to OpenAI when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const r = resolveModel({});
    expect(r.provider).toBe("openai");
    expect(r.model).toBe("gpt-4.1-mini");
    expect(r.keyRequired).toBe(true);
    expect(r.apiKey).toBe("sk-test");
  });

  it("auto-selects a free provider when its key is set", () => {
    process.env.ZHIPU_API_KEY = "zp-test";
    const r = resolveModel({});
    expect(r.provider).toBe("zhipu");
    expect(r.model).toBe("glm-4.7-flash");
    expect(r.apiKey).toBe("zp-test");
  });

  it("prefers dashscope key over zhipu when both are set", () => {
    process.env.DASHSCOPE_API_KEY = "sk-ds";
    process.env.ZHIPU_API_KEY = "zp-test";
    const r = resolveModel({});
    expect(r.provider).toBe("dashscope");
  });

  it("builds the cloudflare gateway URL from env vars", () => {
    process.env.CF_API_TOKEN = "cf-token";
    process.env.CF_ACCOUNT_ID = "acc-123";
    process.env.CF_GATEWAY_SLUG = "gw-1";
    const r = resolveModel({ provider: "cloudflare" });
    expect(r.baseUrl).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc-123/gw-1/openai/chat/completions",
    );
    expect(r.apiKey).toBe("cf-token");
  });

  it("throws for cloudflare without account/gateway env", () => {
    process.env.CF_API_TOKEN = "cf-token";
    expect(() => resolveModel({ provider: "cloudflare" })).toThrow(
      "CF_ACCOUNT_ID",
    );
  });

  it("uses provider preset and its own key env var", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    const r = resolveModel({ provider: "groq" });
    expect(r.provider).toBe("groq");
    expect(r.model).toBe("llama-3.3-70b-versatile");
    expect(r.baseUrl).toBe("https://api.groq.com/openai");
    expect(r.apiKey).toBe("gsk-test");
    expect(r.keyRequired).toBe(true);
  });

  it("ollama preset needs no key", () => {
    const r = resolveModel({ provider: "ollama" });
    expect(r.keyRequired).toBe(false);
    expect(r.apiKey).toBe("");
  });

  it("zhipu free preset resolves to a flash model", () => {
    process.env.ZHIPU_API_KEY = "zp-test";
    const r = resolveModel({ provider: "zhipu" });
    expect(r.model).toBe("glm-4.7-flash");
    expect(r.baseUrl).toBe(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    );
    expect(r.apiKey).toBe("zp-test");
    expect(r.keyRequired).toBe(true);
  });

  it("dashscope free preset resolves to qwen-flash", () => {
    process.env.DASHSCOPE_API_KEY = "sk-ds";
    const r = resolveModel({ provider: "dashscope" });
    expect(r.model).toBe("qwen-flash");
    expect(r.baseUrl).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );
    expect(r.apiKey).toBe("sk-ds");
    expect(r.keyRequired).toBe(true);
  });

  it("explicit apiKey overrides env", () => {
    process.env.GROQ_API_KEY = "gsk-env";
    const r = resolveModel({ provider: "groq", apiKey: "gsk-explicit" });
    expect(r.apiKey).toBe("gsk-explicit");
  });

  it("explicit model/baseUrl map to the custom provider", () => {
    const r = resolveModel({
      model: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: "sk-test",
    });
    expect(r.provider).toBe("custom");
    expect(r.model).toBe("gpt-4o");
    expect(r.keyRequired).toBe(true);
  });

  it("treats localhost endpoints as keyless", () => {
    const r = resolveModel({
      model: "qwen2.5",
      baseUrl: "http://127.0.0.1:1234",
    });
    expect(r.provider).toBe("custom");
    expect(r.keyRequired).toBe(false);
  });

  it("throws for unknown provider", () => {
    expect(() => resolveModel({ provider: "nope" })).toThrow(
      'Unknown provider "nope"',
    );
  });
});

describe("buildChatUrl", () => {
  it("appends /v1/chat/completions to a base URL", () => {
    expect(buildChatUrl("https://api.openai.com")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("does not double-append for /v1 base URLs", () => {
    expect(buildChatUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });

  it("keeps a full chat completions URL untouched", () => {
    const full = MODEL_PROVIDERS.gemini.baseUrl;
    expect(buildChatUrl(full)).toBe(full);
  });

  it("strips trailing slashes", () => {
    expect(buildChatUrl("https://api.groq.com/openai/")).toBe(
      "https://api.groq.com/openai/v1/chat/completions",
    );
  });
});
