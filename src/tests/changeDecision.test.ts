import { scoreDecision } from "../fix/changeDecision";
import { groupRootCauses } from "../core/rootCause";
import { CodeAuditPolicySchema } from "../code/application/policy";
import type { PrioritizedIssue } from "../core/types";

const issue = (id: string, line: number): PrioritizedIssue => ({ id, tool: "tsc", ruleId: "TS2322", message: "Type mismatch", severity: "high", category: "maintainability", location: { filePath: "src/products.ts", startLine: line }, rationale: [], score: 1, effort: "xs", fix: { canAutoFix: true, strategy: "local" } });
const impact = { importers: [], routes: [], publicApis: [], relatedTests: [], sensitiveFiles: [], policyViolations: [] };

describe("safe change decisions", () => {
  it("groups same-file TypeScript diagnostics into one root cause", () => {
    const groups = groupRootCauses([issue("a", 3), issue("b", 9)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].issueIds).toEqual(["a", "b"]);
  });
  it("uses green, yellow and red confidence states without treating a test gap as passed", () => {
    expect(scoreDecision({ issues: [issue("a", 1)], fixedSelected: 1, selected: 1, introducedSevere: 0, tests: "passed", impact }).status).toBe("green");
    expect(scoreDecision({ issues: [issue("a", 1)], fixedSelected: 1, selected: 1, introducedSevere: 0, tests: "not-found", impact }).status).toBe("yellow");
    expect(scoreDecision({ issues: [issue("a", 1)], fixedSelected: 0, selected: 1, introducedSevere: 0, tests: "passed", impact }).status).toBe("red");
  });
  it("loads policy constraints used to block unsafe change sets", () => {
    const policy = CodeAuditPolicySchema.parse({ schemaVersion: 1, forbiddenPaths: ["src/public/**"], maxFilesPerChangeSet: 2, maxLinesPerChangeSet: 10, requiredTestsForPaths: [], protectedPublicApis: [], autoApplySeverities: [], maxAiRequests: 2, maxAiTokens: 50 });
    expect(policy.forbiddenPaths).toContain("src/public/**");
    expect(policy.maxLinesPerChangeSet).toBe(10);
  });
});
