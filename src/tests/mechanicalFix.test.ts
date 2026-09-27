// FILE: tests/mechanicalFix.test.ts
import { runEslintAutofix } from "../analyzers/eslint";
import { buildConfig } from "../core/config";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

let dir: string;

function makeProject(files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mechfix-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runEslintAutofix", () => {
  it("writes a fix for an autofixable rule and returns its id", async () => {
    makeProject({ "a.js": "var count = 5;\n" });

    const issues = await runEslintAutofix(dir);

    expect(issues.length).toBeGreaterThan(0);
    const issue = issues[0];
    expect(issue.ruleId).toBe("no-var");
    expect(issue.fix?.strategy).toBe("mechanical");
    expect(issue.meta?.mechanicallyFixed).toBe(true);
    expect(String(issue.id)).toMatch(/^[0-9a-f]{16}$/);

    const content = readFileSync(join(dir, "a.js"), "utf8");
    expect(content).not.toContain("var count");
    expect(content).toMatch(/^(let|const) count/);
  });

  it("dry-run does NOT write files", async () => {
    makeProject({ "a.js": "var count = 5;\n" });

    const issues = await runEslintAutofix(dir, { dryRun: true });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].ruleId).toBe("no-var");
    expect(readFileSync(join(dir, "a.js"), "utf8")).toContain("var count");
  });

  it("never modifies node_modules, .env, or lockfiles", async () => {
    makeProject({
      "a.js": "var count = 5;\n",
      "node_modules/nested/n.js": "var n = 1;\n",
      ".env": "SECRET=supersecret\n",
      "package-lock.json": "{\"lockfileVersion\": 3}\n",
    });

    const issues = await runEslintAutofix(dir);

    // Only top-level source was fixed.
    expect(issues.some((i) => i.location?.filePath === "a.js")).toBe(true);
    expect(readFileSync(join(dir, "a.js"), "utf8")).not.toContain("var count");
    expect(readFileSync(join(dir, "node_modules/nested/n.js"), "utf8")).toBe(
      "var n = 1;\n",
    );
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(
      "SECRET=supersecret\n",
    );
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(
      '{"lockfileVersion": 3}\n',
    );
  });
});

describe("mechanicalAutofix config plumbing", () => {
  it("defaults the mechanical pre-pass to ON", () => {
    expect(buildConfig({}).mechanicalAutofix).toBe(true);
  });

  it("--no-mechanical disables it", () => {
    expect(buildConfig({ mechanicalAutofix: false }).mechanicalAutofix).toBe(
      false,
    );
  });
});