import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyDiff } from "../fix/diffApplier";
import { PatchTransaction } from "../fix/patchTransaction";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "patch-transaction-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("PatchTransaction", () => {
  it("restores modified files byte-for-byte", async () => {
    const target = join(dir, "src", "value.ts");
    mkdirSync(dirname(target), { recursive: true });
    const original = Buffer.from("\uFEFFexport const value = 1;\r\n", "utf8");
    writeFileSync(target, original);
    const diff = `--- a/src/value.ts
+++ b/src/value.ts
@@ -1,1 +1,1 @@
-export const value = 1;
+export const value = 2;
`;
    const transaction = new PatchTransaction(dir, false);
    await transaction.capture(diff);
    expect((await applyDiff(diff, dir, false)).success).toBe(true);
    await transaction.rollback();
    expect(readFileSync(target).equals(original)).toBe(true);
  });

  it("removes files created during a rejected iteration", async () => {
    const diff = `--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,1 @@
+export const created = true;
`;
    const transaction = new PatchTransaction(dir, false);
    await transaction.capture(diff);
    expect((await applyDiff(diff, dir, false)).success).toBe(true);
    await transaction.rollback();
    expect(existsSync(join(dir, "src", "new.ts"))).toBe(false);
  });
});

