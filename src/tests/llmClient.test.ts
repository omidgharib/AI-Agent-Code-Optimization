// FILE: tests/errorAndDiagnosis.test.ts
import { describeNetworkError } from "../core/errorDiagnosis";

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