// FILE: tests/analyzers.test.ts
import { mapCategory as eslintMapCategory } from "../analyzers/eslint";
import { mapCategory as tscMapCategory } from "../analyzers/tscParse";
import { parseTscOutput } from "../analyzers/tscParse";

describe("eslint category mapping", () => {
  it("maps security rules", () => {
    expect(eslintMapCategory("no-eval")).toBe("security");
  });
  it("maps a11y rules", () => {
    expect(eslintMapCategory("jsx-a11y/alt-text")).toBe("a11y");
  });
  it("maps undefined-reference rules to bug", () => {
    expect(eslintMapCategory("no-undef")).toBe("bug");
  });
  it("maps unused variables to maintainability", () => {
    expect(eslintMapCategory("no-unused-vars")).toBe("maintainability");
  });
  it("maps formatting rules to style", () => {
    expect(eslintMapCategory("semi")).toBe("style");
  });
  it("defaults unknown rules to maintainability", () => {
    expect(eslintMapCategory("some-unknown-rule")).toBe("maintainability");
  });
});

describe("tsc category mapping", () => {
  it("maps unused-declaration codes to maintainability", () => {
    expect(tscMapCategory("TS6133")).toBe("maintainability");
  });
  it("maps implicit-any codes to maintainability", () => {
    expect(tscMapCategory("TS7006")).toBe("maintainability");
  });
  it("maps type errors to bug", () => {
    expect(tscMapCategory("TS2304")).toBe("bug");
    expect(tscMapCategory("TS2339")).toBe("bug");
  });
});

describe("tsc output parser", () => {
  it("parses file(line,col) errors", () => {
    const issues = parseTscOutput(
      "src/a.ts(1,2): error TS2304: Cannot find name 'x'.",
      process.cwd(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].tool).toBe("tsc");
    expect(issues[0].ruleId).toBe("TS2304");
    expect(issues[0].message).toContain("Cannot find name");
    expect(issues[0].severity).toBe("high");
    expect(issues[0].category).toBe("bug");
    expect(issues[0].location?.filePath).toBe("src/a.ts");
    expect(issues[0].location?.startLine).toBe(1);
    expect(issues[0].location?.startColumn).toBe(2);
  });

  it("parses file(line) errors without a column", () => {
    const issues = parseTscOutput(
      "lib/util.js(42): error TS2307: Cannot find module './x'.",
      process.cwd(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].location?.startLine).toBe(42);
    expect(issues[0].location?.startColumn).toBeUndefined();
  });

  it("parses global errors without a location", () => {
    const issues = parseTscOutput(
      "error TS18003: No inputs were found in config file 'tsconfig.json'.",
      process.cwd(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe("TS18003");
    expect(issues[0].location?.filePath).toBe("-");
  });

  it("normalizes Windows backslash paths", () => {
    const issues = parseTscOutput(
      "C:\\repo\\src\\a.ts(3,4): error TS2322: Type 'string' is not assignable.",
      process.cwd(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].location?.filePath).toBe("C:/repo/src/a.ts");
  });

  it("skips summary and non-error lines", () => {
    const issues = parseTscOutput(
      "Found 3 errors. Watching for file changes.\nCompilation complete.",
      process.cwd(),
    );
    expect(issues).toHaveLength(0);
  });

  it("parses multiple errors", () => {
    const issues = parseTscOutput(
      [
        "src/a.ts(1,1): error TS1005: ';' expected.",
        "src/b.ts(2,2): error TS2304: Cannot find name 'y'.",
      ].join("\n"),
      process.cwd(),
    );
    expect(issues).toHaveLength(2);
  });
});
