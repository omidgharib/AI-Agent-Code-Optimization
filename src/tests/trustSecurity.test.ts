import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assessPatches, createPersistentSnapshot, isSecretFile, redactSecrets, restorePersistentSnapshot } from "../core/trustSecurity";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "auditor-trust-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("trust and security", () => {
  it("redacts provider tokens and rejects secret-bearing paths", () => {
    expect(redactSecrets("api_key=sk-live_12345678901234567890")).not.toContain("12345678901234567890");
    expect(redactSecrets("token=ghp_123456789012345678901234567890123456")).toContain("<REDACTED>");
    expect(isSecretFile("config/.env.production")).toBe(true);
    expect(isSecretFile("certs/server.pem")).toBe(true);
    expect(isSecretFile("src/index.ts")).toBe(false);
  });

  it("calculates explainable confidence and blast radius", async () => {
    mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, "tests"), { recursive: true });
    writeFileSync(join(root, "src", "consumer.ts"), "import { value } from './value';\n");
    writeFileSync(join(root, "tests", "value.test.ts"), "import { value } from '../src/value';\n");
    const diff = "--- a/src/value.ts\n+++ b/src/value.ts\n@@ -1,1 +1,1 @@\n-export const value = 1;\n+export const value = 2;\n";
    const assessment = await assessPatches(root, [diff]);
    expect(assessment.confidence).toBeGreaterThan(70);
    expect(assessment.blastRadius.imports).toContain("src/consumer.ts");
    expect(assessment.blastRadius.tests).toContain("tests/value.test.ts");
  });

  it("persists and restores byte-exact snapshots", async () => {
    const file = join(root, "src", "value.ts"); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, "old\r\n");
    const diff = "--- a/src/value.ts\n+++ b/src/value.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n";
    const snapshots = join(root, "ai-auditor-report", "run", "snapshots");
    const id = await createPersistentSnapshot(root, [diff], snapshots); writeFileSync(file, "new\n");
    expect(await restorePersistentSnapshot(root, snapshots, id)).toBe(1);
    expect(readFileSync(file, "utf8")).toBe("old\r\n");
  });
});
