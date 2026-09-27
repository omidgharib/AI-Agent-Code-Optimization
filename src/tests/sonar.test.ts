import { findNewBlockingSonarIssues, mapSonarHotspot, mapSonarIssue, runSonar, sonarIssueId } from "../analyzers/sonar";
import { mergeOverlappingIssues } from "../core/issueMerge";
import { sanitizePersistentSnapshot } from "../platform/persistence/repositories";
import type { Issue } from "../core/types";

describe("local SonarQube analyzer", () => {
  it("maps BUG/BLOCKER to critical", () => expect(mapSonarIssue({ rule: "js:S1", component: "p:src/a.ts", line: 2, message: "broken", severity: "BLOCKER", type: "BUG" }, "http://127.0.0.1:9000", "p")).toMatchObject({ tool: "sonar", severity: "critical", category: "bug", location: { filePath: "src/a.ts" } }));
  it("maps VULNERABILITY/CRITICAL to high", () => expect(mapSonarIssue({ rule: "js:S2", component: "p:src/a.ts", line: 3, message: "unsafe", severity: "CRITICAL", type: "VULNERABILITY" }, "http://127.0.0.1:9000", "p")).toMatchObject({ severity: "high", category: "security" }));
  it("keeps Security Hotspots advisory", () => expect(mapSonarHotspot({ ruleKey: "js:S3", component: "p:src/a.ts", message: "review" }, "http://127.0.0.1:9000", "p").fix).toEqual(expect.objectContaining({ canAutoFix: false, strategy: "advisory" })));
  it("creates deterministic IDs", () => expect(sonarIssueId("r", "src/a.ts", 1, "m")).toBe(sonarIssueId("r", "src/a.ts", 1, "m")));
  it("returns not-run when local SonarQube is unavailable", async () => expect((await runSonar(process.cwd(), { enabled: true, hostUrl: "http://127.0.0.1:1", projectKey: "p", sources: ["src"], timeoutMs: 50 })).summary.status).toBe("not-run"));
  it("blocks only new severe Sonar bugs/vulnerabilities", () => { const old = mapSonarIssue({ rule: "js:S1", component: "p:src/a.ts", line: 1, message: "old", severity: "CRITICAL", type: "BUG" }, "http://127.0.0.1:9000", "p"); const fresh = mapSonarIssue({ rule: "js:S2", component: "p:src/b.ts", line: 2, message: "new", severity: "CRITICAL", type: "VULNERABILITY" }, "http://127.0.0.1:9000", "p"); expect(findNewBlockingSonarIssues([old], [old])).toEqual([]); expect(findNewBlockingSonarIssues([old], [old, fresh])).toEqual([fresh]); });
  it("redacts Sonar tokens from persisted snapshots", () => expect(JSON.stringify(sanitizePersistentSnapshot({ sonarToken: "secret-value" }))).not.toContain("secret-value"));
  it("merges overlapping ESLint and Sonar evidence", () => { const sonar = mapSonarIssue({ rule: "typescript:S1481", component: "p:src/a.ts", line: 4, message: "unused variable", severity: "MAJOR", type: "CODE_SMELL", key: "x" }, "http://127.0.0.1:9000", "p"); const eslint: Issue = { id: "e", tool: "eslint", ruleId: "no-unused-vars", message: "unused variable", severity: "medium", category: "maintainability", location: { filePath: "src/a.ts", startLine: 4 } }; const merged = mergeOverlappingIssues([eslint, sonar]); expect(merged).toHaveLength(1); expect(merged[0].meta?.evidenceTools).toEqual(expect.arrayContaining(["eslint", "sonar"])); });
});
