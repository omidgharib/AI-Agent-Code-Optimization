import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateQualityGate } from "../core/qualityGate";
import { toSarif } from "../report/sarif";
import type { PrioritizedIssue } from "../core/types";

const issue = (id: string, severity: "low" | "high" | "critical" = "high"): PrioritizedIssue => ({
  id, tool: "eslint", ruleId: "demo", message: `Issue ${id}`, severity, category: "bug",
  location: { filePath: "src/a.ts", startLine: 2 }, fix: { canAutoFix: false },
  score: 50, effort: "s", rationale: ["test"],
});

describe("quality gates and SARIF", () => {
  it("detects new and resolved baseline issues and fails configured thresholds", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-auditor-gate-"));
    const baselinePath = path.join(root, "report.json");
    await fs.writeFile(baselinePath, JSON.stringify({ topIssues: [{ id: "old" }] }));
    try {
      const result = await evaluateQualityGate([issue("new", "critical")], undefined, { baselinePath, maxCritical: 0, maxHigh: 5, failOnNew: true, minScores: {} });
      expect(result.passed).toBe(false);
      expect(result.newIssueIds).toEqual(["new"]);
      expect(result.resolvedIssueIds).toEqual(["old"]);
      expect(result.reasons).toHaveLength(2);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it("emits SARIF 2.1 with source locations", () => {
    const sarif = toSarif([issue("one")]) as { version: string; runs: Array<{ results: unknown[] }> };
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(JSON.stringify(sarif)).toContain("src/a.ts");
  });
});
