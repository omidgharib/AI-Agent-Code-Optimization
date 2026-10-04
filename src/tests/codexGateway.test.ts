import { gatewayRoot, gatewayText } from "../fix/codexGateway";
import { resolveModel } from "../core/models";

describe("Codex gateway integration", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it("requires its local token even on loopback and never inherits OpenAI credentials", () => {
    const saved = process.env.OPENAI_API_KEY;
    const token = process.env.LOCAL_CODEX_GATEWAY_TOKEN;
    process.env.OPENAI_API_KEY = "other-provider-secret";
    delete process.env.LOCAL_CODEX_GATEWAY_TOKEN;
    try {
      const config = resolveModel({ provider: "codex-gateway" });
      expect(config.keyRequired).toBe(true);
      expect(config.apiKey).toBe("");
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved;
      if (token !== undefined) process.env.LOCAL_CODEX_GATEWAY_TOKEN = token;
    }
  });
  it("rejects remote endpoints and credentials in URLs", () => {
    expect(() => gatewayRoot("https://example.com")).toThrow();
    expect(() => gatewayRoot("http://secret@127.0.0.1:4317")).toThrow();
    expect(gatewayRoot("http://127.0.0.1:4317/v1")).toBe("http://127.0.0.1:4317");
  });
  it("checks health and models before requesting read-only Responses output", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "test-model", is_default: true }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", output_text: "result", output: [] })));
    global.fetch = fetchMock;
    expect(await gatewayText({ baseUrl: "http://127.0.0.1:4317", apiKey: "local-secret", model: "test-model" }, [{ role: "user", content: "task" }])).toBe("result");
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://127.0.0.1:4317/health", "http://127.0.0.1:4317/v1/models", "http://127.0.0.1:4317/v1/responses"]);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
    const request = fetchMock.mock.calls[2][1];
    expect(request.headers.authorization).toBe("Bearer local-secret");
    expect(JSON.parse(request.body)).toMatchObject({ mode: "read-only", include_events: false, store: false });
    expect(request.body).not.toContain("local-secret");
  });
  it("does not accept HTTP 200 with empty or incomplete output", async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith("/health") ? { status: "ok" } : url.endsWith("/models") ? { data: [{ id: "test" }] } : { status: "incomplete", output_text: "partial" })));
    await expect(gatewayText({ baseUrl: "http://127.0.0.1:4317", apiKey: "secret", model: "test" }, [])).rejects.toThrow("completed text");
  });
});
