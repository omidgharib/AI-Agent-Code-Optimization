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

  it("refuses a create-file hunk against a file that already has content (no corruption)", async () => {
    const p = join(dir, "package.json");
    writeFileSync(p, `{\n  "name": "x",\n  "type": "module"\n}\n`);

    // This is exactly the diff that used to corrupt package.json by splicing
    // a second JSON object into the existing one.
    const diff = `--- a/package.json
+++ b/package.json
@@ -0,0 +1,3 @@
+{
+  "type": "module"
+}
`;
    const result = await applyDiff(diff, dir, false);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists with content/);
    expect(readFileSync(p, "utf8")).toBe(`{\n  "name": "x",\n  "type": "module"\n}\n`);
  });

  it("rejects a rename-only diff", async () => {
    const diff = `diff --git a/eslint.config.js b/eslint.config.mjs
similarity index 100%
rename from eslint.config.js
rename to eslint.config.mjs
`;
    const result = await applyDiff(diff, dir, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot rename files/);
  });

  it("rejects multi-file diffs", async () => {
    const diff = `diff --git a/src/a.js b/src/a.js
@@ -1,1 +1,2 @@
+x
diff --git a/src/b.js b/src/b.js
@@ -1,1 +1,2 @@
+y
`;
    const result = await applyDiff(diff, dir, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/multiple files/);
  });

  it("rejects empty diffs with no hunks", async () => {
    const result = await applyDiff(
      "diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n",
      dir,
      false,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no @@ hunks/);
  });

  it("refuses diffs that escape the repo root via ../", async () => {
    const p = join(dir, "src", "index.js");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `const a = 1;\n`);
    const diff = `--- a/../outside.js
+++ b/../outside.js
@@ -1,1 +1,2 @@
+const b = 2;
`;
    const result = await applyDiff(diff, dir, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside the repo root/);
  });

  it("refuses absolute diff targets", async () => {
    const diff = `--- a/C:/Windows/win.ini
+++ b/C:/Windows/win.ini
@@ -1,1 +1,2 @@
+evil
`;
    const result = await applyDiff(diff, dir, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/absolute diff target/);
  });

  it("refuses to modify generated and protected files", async () => {
    const gen = await applyDiff(
      `--- a/dev-dist/sw.js
+++ b/dev-dist/sw.js
@@ -1,1 +1,2 @@
+/* eslint-disable */
`,
      dir,
      false,
    );
    expect(gen.success).toBe(false);
    expect(gen.error).toMatch(/generated/i);

    const secret = await applyDiff(
      `--- a/.env
+++ b/.env
@@ -1,1 +1,2 @@
+API_KEY=123
`,
      dir,
      false,
    );
    expect(secret.success).toBe(false);
    expect(secret.error).toMatch(/protected/);
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