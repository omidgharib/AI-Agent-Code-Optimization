import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectProject } from "../core/projectDetector";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "project-detect-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("detectProject", () => {
  it("detects a TypeScript Vite project", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "sample-vite",
      scripts: { build: "vite build" },
      dependencies: { react: "latest" },
      devDependencies: { vite: "latest", typescript: "latest" },
    }));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "main.tsx"), "export const App = () => null;\n");
    writeFileSync(join(dir, "package-lock.json"), "{}");

    const profile = await detectProject(dir);
    expect(profile.name).toBe("sample-vite");
    expect(profile.framework).toBe("vite");
    expect(profile.packageManager).toBe("npm");
    expect(profile.languages).toEqual(["typescript"]);
  });

  it("rejects a directory without package.json", async () => {
    writeFileSync(join(dir, "main.py"), "print('no')\n");
    await expect(detectProject(dir)).rejects.toThrow(/valid package\.json/);
  });

  it("rejects an empty non-JS package", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "empty" }));
    writeFileSync(join(dir, "main.py"), "print('no')\n");
    await expect(detectProject(dir)).rejects.toThrow(/no JavaScript\/TypeScript/);
  });
});

