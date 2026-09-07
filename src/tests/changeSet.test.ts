import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPreparedChangeSet, type PreparedChangeSet } from "../fix/changeSet";

const sha = (value: string) => createHash("sha256").update(Buffer.from(value)).digest("hex");
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "change-set-test-"));
  mkdirSync(join(root, "src"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function prepared(a: string, b: string): PreparedChangeSet {
  return {
    id: "logical-fix",
    description: "update producer and consumer",
    issueIds: ["issue-1", "issue-2"],
    touches: ["src/a.ts", "src/b.ts"],
    baseSha256: { "src/a.ts": sha(a), "src/b.ts": sha(b) },
    patches: [
      { description: "producer", touches: ["src/a.ts"], unifiedDiff: `--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-${a.trim()}\n+export const value = 2;\n` },
      { description: "consumer", touches: ["src/b.ts"], unifiedDiff: `--- a/src/b.ts\n+++ b/src/b.ts\n@@ -1,1 +1,1 @@\n-${b.trim()}\n+export const used = 2;\n` },
    ],
    verification: {
      passed: true,
      fixedIssueIds: ["issue-1", "issue-2"],
      beforeIssueCount: 2,
      afterIssueCount: 0,
      introducedSevere: 0,
      checks: { eslint: "passed", typescript: "passed", relatedTests: "not-found" },
      relatedTests: [],
      attempts: 1,
    },
  };
}

describe("logical change sets", () => {
  it("applies dependent files as one approval unit", async () => {
    const a = "export const value = 1;\n", b = "export const used = 1;\n";
    writeFileSync(join(root, "src/a.ts"), a); writeFileSync(join(root, "src/b.ts"), b);
    await applyPreparedChangeSet(root, prepared(a, b));
    expect(readFileSync(join(root, "src/a.ts"), "utf8")).toContain("value = 2");
    expect(readFileSync(join(root, "src/b.ts"), "utf8")).toContain("used = 2");
  });

  it("rejects a stale preview before writing any member", async () => {
    const a = "export const value = 1;\n", b = "export const used = 1;\n";
    writeFileSync(join(root, "src/a.ts"), a); writeFileSync(join(root, "src/b.ts"), "user edit\n");
    await expect(applyPreparedChangeSet(root, prepared(a, b))).rejects.toThrow(/changed since preview/i);
    expect(readFileSync(join(root, "src/a.ts"), "utf8")).toBe(a);
    expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("user edit\n");
  });
});
