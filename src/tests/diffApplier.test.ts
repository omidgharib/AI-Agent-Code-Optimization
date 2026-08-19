// FILE: tests/diffApplier.test.ts
import { applyDiff, getDiffTargetPath } from "../fix/diffApplier";
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

const DIFF = (header: string) =>
  `${header}
--- a/src/index.js
+++ b/src/index.js
@@ -1,2 +1,3 @@
 const greeting = makeGreeting("world");
 console.log(greeting);
+// eslint-disable-line no-console
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "diffapply-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("applyDiff", () => {
  it("applies an LF diff to a CRLF file and preserves CRLF line endings", async () => {
    const p = join(dir, "src", "index.js");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      `const greeting = makeGreeting("world");\r\nconsole.log(greeting);\r\n`,
    );

    const result = await applyDiff(DIFF("autotest"), dir, false);

    expect(result.success).toBe(true);
    expect(readFileSync(p, "utf8")).toBe(
      `const greeting = makeGreeting("world");\r\nconsole.log(greeting);\r\n// eslint-disable-line no-console\r\n`,
    );
  });

  it("applies a CRLF diff to an LF file", async () => {
    const p = join(dir, "src", "index.js");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `const greeting = makeGreeting("world");\nconsole.log(greeting);\n`);

    const crlfDiff = DIFF("autotest").replace(/\n/g, "\r\n");
    const result = await applyDiff(crlfDiff, dir, false);

    expect(result.success).toBe(true);
    expect(readFileSync(p, "utf8")).toBe(
      `const greeting = makeGreeting("world");\nconsole.log(greeting);\n// eslint-disable-line no-console\n`,
    );
  });

  it("reports a hunk mismatch with context when the file is stale", async () => {
    const p = join(dir, "src", "index.js");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `const greeting = somethingElse();\nconsole.log(greeting);\n`);

    const result = await applyDiff(DIFF("autotest"), dir, false);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Hunk mismatch at line 1/);
    expect(readFileSync(p, "utf8")).toBe(
      `const greeting = somethingElse();\nconsole.log(greeting);\n`,
    );
  });

  it("creates a new file when the hunk has no old lines and the file is absent", async () => {
    const diff = `--- /dev/null
+++ b/src/new.js
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`;
    const result = await applyDiff(diff, dir, false);

    expect(result.success).toBe(true);
    expect(readFileSync(join(dir, "src", "new.js"), "utf8")).toBe(
      "const a = 1;\nconst b = 2;",
    );
  });
});

describe("getDiffTargetPath", () => {
  it("extracts the +++ target path and strips b/ prefixes", () => {
    const diff = `--- a/src/index.js
+++ b/src/index.js
@@ -1,2 +1,3 @@
`;
    expect(getDiffTargetPath(diff)).toBe("src/index.js");
  });

  it("returns null when the diff has no +++ header", () => {
    expect(getDiffTargetPath("@@ -1,1 +1,1 @@\n x\n")).toBeNull();
  });
});