// FILE: tests/fixPlanner.test.ts
import { selectStrategy } from "../fix/strategy";
import {
  selectAdvisoryIssues,
  selectIssuesForFix,
} from "../fix/fixPlanner";
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
      location: { filePath: "src/c.js", startLine: 1 },
    });
    const local = makePrioritized({
      tool: "tsc",
      category: "maintainability",
      location: { filePath: "src/a.ts", startLine: 3 },
    });
    const local2 = makePrioritized({
      tool: "eslint",
      category: "style",
      location: { filePath: "src/b.ts", startLine: 5 },
    });

    const result = selectIssuesForFix([mechanical, local, local2]);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.strategy).sort()).toEqual(["local", "mechanical"]);
    const mechanicalBucket = result.find((p) => p.strategy === "mechanical");
    const localBucket = result.find((p) => p.strategy === "local");
    expect(mechanicalBucket?.issues).toContain(mechanical);
    expect(localBucket?.issues).toContain(local);
    expect(localBucket?.issues).toContain(local2);
  });

  it("skips issues that do not pass the selection filter", () => {
    const skipped = makePrioritized({
      tool: "tsc",
      category: "bug",
      location: { filePath: "src/a.ts", startLine: 1 },
    });
    expect(selectIssuesForFix([skipped])).toHaveLength(0);
  });

  it("excludes advisory (no-file) issues from the diff-based fix pool", () => {
    const lighthouse = makePrioritized({
      tool: "lighthouse",
      category: "maintainability",
      location: { filePath: "-" },
    });
    const perf = makePrioritized({
      tool: "lighthouse",
      category: "performance",
      location: { filePath: "-" },
    });
    expect(selectIssuesForFix([lighthouse, perf])).toHaveLength(0);
  });

  it("still excludes no-file issues from tools without an advisory strategy", () => {
    const tscGlobal = makePrioritized({
      tool: "tsc",
      category: "maintainability",
      location: undefined,
    });
    expect(selectIssuesForFix([tscGlobal])).toHaveLength(0);
    expect(selectAdvisoryIssues([tscGlobal])).toHaveLength(0);
  });

  it("selects advisory (no-file) lighthouse issues into the advisory pool", () => {
    const lighthouse = makePrioritized({
      tool: "lighthouse",
      category: "maintainability",
      location: { filePath: "-" },
    });
    const perf = makePrioritized({
      tool: "lighthouse",
      category: "performance",
      location: { filePath: "-" },
    });
    expect(selectAdvisoryIssues([lighthouse, perf])).toEqual([
      lighthouse,
      perf,
    ]);
  });

  it("drops seo/a11y/bug advisory issues that the LLM does not handle", () => {
    const seo = makePrioritized({
      tool: "lighthouse",
      category: "seo",
      location: { filePath: "-" },
    });
    expect(selectAdvisoryIssues([seo])).toHaveLength(0);
  });

  it("excludes generated dirs and tool config files from the LLM fix pool", () => {
    const generated = makePrioritized({
      tool: "eslint",
      category: "maintainability",
      location: { filePath: "dev-dist/sw.js", startLine: 1 },
    });
    const config = makePrioritized({
      tool: "eslint",
      category: "maintainability",
      location: { filePath: "eslint.config.js", startLine: 1 },
    });
    const lockfile = makePrioritized({
      tool: "eslint",
      category: "maintainability",
      location: { filePath: "package-lock.json", startLine: 1 },
    });
    expect(selectIssuesForFix([generated, config, lockfile])).toHaveLength(0);
  });
});
