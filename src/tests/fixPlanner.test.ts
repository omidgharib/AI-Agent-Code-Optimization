// FILE: tests/fixPlanner.test.ts
import { selectStrategy } from "../fix/strategy";
import { selectIssuesForFix } from "../fix/fixPlanner";
import type { Issue, PrioritizedIssue } from "../core/types";

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  id: Math.random().toString(36).slice(2),
  tool: "eslint",
  message: "msg",
  severity: "low",
  category: "style",
  ...overrides,
});

const makePrioritized = (overrides: Partial<Issue>): PrioritizedIssue => ({
  ...makeIssue(overrides),
  score: 25,
  effort: "xs",
  rationale: ["severity=low(+10)", "category=style(+5)"],
});

describe("selectStrategy", () => {
  it("returns mechanical for eslint autofix rule", () => {
    const issue = makeIssue({
      tool: "eslint",
      ruleId: "some/autofix-rule",
      fix: { canAutoFix: true },
    });
    expect(selectStrategy(issue)).toBe("mechanical");
  });

  it("returns local for tsc diagnostic with a single file/line", () => {
    const issue = makeIssue({
      tool: "tsc",
      category: "maintainability",
      location: { filePath: "src/a.ts", startLine: 3 },
    });
    expect(selectStrategy(issue)).toBe("local");
  });

  it("returns advisory for lighthouse issue with no file", () => {
    const issue = makeIssue({ tool: "lighthouse", category: "performance" });
    expect(selectStrategy(issue)).toBe("advisory");
  });

  it("returns advisory for custom finding with no source location", () => {
    const issue = makeIssue({ tool: "custom" });
    expect(selectStrategy(issue)).toBe("advisory");
  });

  it("prefers advisory over mechanical for lighthouse without location", () => {
    const issue = makeIssue({
      tool: "lighthouse",
      fix: { canAutoFix: true },
    });
    expect(selectStrategy(issue)).toBe("advisory");
  });
});

describe("selectIssuesForFix", () => {
  it("returns separable strategy buckets", () => {
    const mechanical = makePrioritized({
      tool: "eslint",
      ruleId: "no-console",
      fix: { canAutoFix: true },
    });
    const local = makePrioritized({
      tool: "tsc",
      category: "maintainability",
      location: { filePath: "src/a.ts", startLine: 3 },
    });
    const advisory = makePrioritized({
      tool: "lighthouse",
      category: "style",
    });

    const result = selectIssuesForFix([mechanical, local, advisory]);

    expect(result).toHaveLength(3);
    expect(result.map((p) => p.strategy).sort()).toEqual([
      "advisory",
      "local",
      "mechanical",
    ]);
    const mechanicalBucket = result.find((p) => p.strategy === "mechanical");
    const localBucket = result.find((p) => p.strategy === "local");
    const advisoryBucket = result.find((p) => p.strategy === "advisory");
    expect(mechanicalBucket?.issues).toContain(mechanical);
    expect(localBucket?.issues).toContain(local);
    expect(advisoryBucket?.issues).toContain(advisory);
  });

  it("skips issues that do not pass the selection filter", () => {
    const skipped = makePrioritized({
      tool: "tsc",
      category: "bug",
      location: { filePath: "src/a.ts", startLine: 1 },
    });
    expect(selectIssuesForFix([skipped])).toHaveLength(0);
  });
});
