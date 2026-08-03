// FILE: tests/normalizer.test.ts
import { normalize } from "../normalize/normalizer.js";
import type { Issue } from "../core/types.js";

const base: Issue = {
  id: "abc123",
  tool: "eslint",
  message: "test issue",
  severity: "low",
  category: "style",
};

describe("normalizer", () => {
  it("removes invalid issues", () => {
    const bad = { ...base, severity: "invalid" } as unknown as Issue;
    expect(normalize([bad])).toHaveLength(0);
  });

  it("deduplicates by id", () => {
    expect(normalize([base, base])).toHaveLength(1);
  });

  it("normalizes filePath separators", () => {
    const issue: Issue = {
      ...base,
      id: "x1",
      location: { filePath: "src\\foo\\bar.ts", startLine: 1 },
    };
    const result = normalize([issue]);
    expect(result[0].location?.filePath).toBe("src/foo/bar.ts");
  });
});
