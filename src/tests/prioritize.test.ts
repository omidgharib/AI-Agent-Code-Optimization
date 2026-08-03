// FILE: tests/prioritize.test.ts
import { prioritize } from "../prioritize/prioritize.js";
import type { Issue } from "../core/types.js";

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  id: Math.random().toString(36).slice(2),
  tool: "eslint",
  message: "msg",
  severity: "low",
  category: "style",
  ...overrides,
});

describe("prioritize", () => {
  it("sorts critical security higher than low style", () => {
    const low = makeIssue({ severity: "low", category: "style" });
    const crit = makeIssue({ severity: "critical", category: "security" });
    const result = prioritize([low, crit]);
    expect(result[0].severity).toBe("critical");
  });

  it("assigns correct score for eslint style issue", () => {
    const issue = makeIssue({
      tool: "eslint",
      severity: "low",
      category: "style",
    });
    const [r] = prioritize([issue]);
    // low=10, style=5, confidence=10, effort xs=0 => 25
    expect(r.score).toBe(25);
  });

  it("stable sort by file then line then id", () => {
    const a = makeIssue({
      id: "aaa",
      location: { filePath: "a.ts", startLine: 2 },
    });
    const b = makeIssue({
      id: "bbb",
      location: { filePath: "a.ts", startLine: 1 },
    });
    const result = prioritize([a, b]);
    expect(result[0].location?.startLine).toBe(1);
  });
});
