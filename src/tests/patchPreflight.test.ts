import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { issueVerificationFingerprint, preflightSuggestedPatch } from "../fix/patchPreflight";
import { matchVerificationIssues } from "../fix/changeSet";
import { runTsc } from "../analyzers/tsc";
import { normalize } from "../normalize/normalizer";
import { prioritize } from "../prioritize/prioritize";
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "patch-preflight-test-")); mkdirSync(join(root, "src")); writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true })); writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noUnusedLocals: true, skipLibCheck: true }, include: ["src"] })); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
describe("suggested patch preflight", () => {
  it("keeps verification identity stable when a patch only shifts line numbers", () => { const base = { tool: "tsc" as const, ruleId: "TS2322", message: "Type mismatch", location: { filePath: "SRC/Main.ts", startLine: 20 } }; expect(issueVerificationFingerprint(base)).toBe(issueVerificationFingerprint({ ...base, location: { ...base.location, filePath: "src/main.ts", startLine: 12 } })); });
  it("does not classify changed diagnostic wording as a new severe issue", () => { const before = [{ tool: "tsc" as const, ruleId: "TS2322", message: "Type 'string' is not assignable to type 'number'.", location: { filePath: "src/main.ts", startLine: 4 } }]; const after = [{ ...before[0], message: "Type 'boolean' is not assignable to type 'number'.", location: { ...before[0].location, startLine: 9 } }]; const matching = matchVerificationIssues(before, after); expect([...matching.matchedBefore]).toEqual([0]); expect([...matching.matchedAfter]).toEqual([0]); });
  it("still detects an additional diagnostic in the same rule/file bucket", () => { const issue = { tool: "tsc" as const, ruleId: "TS2322", message: "first", location: { filePath: "src/main.ts", startLine: 4 } }; const matching = matchVerificationIssues([issue], [issue, { ...issue, message: "second", location: { ...issue.location, startLine: 8 } }]); expect(matching.matchedAfter.size).toBe(1); expect(matching.matchedAfter.has(1)).toBe(false); });
  it("validates in isolation and never changes the source repository", async () => { const file = join(root, "src", "index.ts"); const original = "const unused = 1;\nexport const value = 2;\n"; writeFileSync(file, original); const baseline = prioritize(normalize(await runTsc(root))); const diff = `--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,2 +1,1 @@\n-const unused = 1;\n export const value = 2;\n`; await expect(preflightSuggestedPatch(root, diff, baseline)).resolves.toEqual({ success: true }); expect(readFileSync(file, "utf8")).toBe(original); });
  it("blocks a patch that introduces a severe issue", async () => { const file = join(root, "src", "index.ts"); const original = "export const value: number = 2;\n"; writeFileSync(file, original); const diff = `--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n-export const value: number = 2;\n+export const value: number = \"broken\";\n`; const result = await preflightSuggestedPatch(root, diff, []); expect(result.success).toBe(false); expect(result.error).toMatch(/introduced.*severe/i); expect(readFileSync(file, "utf8")).toBe(original); });
});
