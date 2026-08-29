// FILE: tests/errorAndDiagnosis.test.ts
import { describeNetworkError } from "../core/errorDiagnosis";
import { coerceFixResponse } from "../fix/llmClient";

// llmClient transitively imports the logger (chalk, ESM). Stub it so Jest's
// ts-jest pipeline doesn't try to transform chalk.
jest.mock("../core/logger", () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("describeNetworkError", () => {
  it("extracts ECONNREFUSED from the fetch cause chain", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9655"), {
      code: "ECONNREFUSED",
      errno: -4078,
      syscall: "connect",
      addr: "127.0.0.1",
      port: 9655,
    });
    const err = new TypeError("fetch failed", { cause });
    expect(describeNetworkError(err, 60_000)).toBe(
      "network error ECONNREFUSED (connect ECONNREFUSED 127.0.0.1:9655)",
    );
  });

  it("detects a timeout / missing response headers", () => {
    const timeout = new DOMException("The operation was aborted due to timeout");
    const err = new TypeError("fetch failed", { cause: timeout });
    expect(describeNetworkError(err, 5_000)).toContain(
      "request timed out after 5000ms",
    );
  });

  it("surfaces TLS errors", () => {
    const tls = Object.assign(
      new Error("certificate has expired"),
      { code: "CERT_HAS_EXPIRED" },
    );
    const err = new TypeError("fetch failed", { cause: tls });
    expect(describeNetworkError(err, 60_000)).toBe(
      "TLS certificate error: certificate has expired",
    );
  });

  it("falls back to the deepest message", () => {
    const inner = new Error("some internal detail");
    const err = new TypeError("fetch failed", { cause: inner });
    expect(describeNetworkError(err, 60_000)).toBe("fetch failed: some internal detail");
  });
});

describe("coerceFixResponse (ForgetMeAI actions format)", () => {
  it("parses { message, actions:[{action,file,diff}] } into FixResponse patches", () => {
    const raw = {
      message: "done",
      actions: [
        {
          action: "fix",
          file: "eslint.config.js",
          diff: "--- a/eslint.config.js\n+++ b/eslint.config.js\n@@ -1,2 +1,2 @@\n-a\n+b\n",
        },
      ],
    };
    const coerced = coerceFixResponse(raw) as {
      patches: Array<{ unifiedDiff: string; touches: string[] }>;
      notes: string[];
    };
    expect(coerced.patches).toHaveLength(1);
    expect(coerced.patches[0].touches).toEqual(["eslint.config.js"]);
    expect(coerced.patches[0].unifiedDiff).toContain("+++ b/eslint.config.js");
    expect(coerced.notes).toEqual(["done"]);
  });

  it("synthesizes headers when a bare hunks diff lacks ---/+++ headers", () => {
    const raw = {
      actions: [
        {
          action: "fix",
          file: "src/a.ts",
          diff: "@@ -1,1 +1,2 @@\n+a\n",
        },
      ],
    };
    const coerced = coerceFixResponse(raw) as {
      patches: Array<{ unifiedDiff: string }>;
    };
    expect(coerced.patches[0].unifiedDiff).toBe(
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,2 @@\n+a\n",
    );
  });

  it("handles a nested FixResponse object correctly", () => {
    const raw = {
      patches: [
        {
          description: "Fix in src/a.ts",
          unifiedDiff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,2 @@\n+x\n",
          touches: ["src/a.ts"],
        },
      ],
      notes: ["note"],
    };
    const coerced = coerceFixResponse(raw) as { patches: unknown[] };
    expect(coerced.patches).toHaveLength(1);
  });
});