import type { AnalyzerManifest } from "../domain/analyzer";
const eslintPackage = require("eslint/package.json") as { version: string };
const tsPackage = require("typescript/package.json") as { version: string };

export const CODE_ANALYZERS: readonly AnalyzerManifest[] = Object.freeze([
  { id: "eslint", version: eslintPackage.version, ecosystems: ["javascript", "typescript"], requiredFiles: ["package.json"], timeoutMs: 120_000, resourceProfile: { memoryMb: 512, outputBytes: 4_000_000 } },
  { id: "typescript", version: tsPackage.version, ecosystems: ["typescript"], requiredFiles: ["tsconfig.json"], timeoutMs: 120_000, resourceProfile: { memoryMb: 512, outputBytes: 4_000_000 } },
]);
export const analyzerVersions = () => Object.fromEntries(CODE_ANALYZERS.map((item) => [item.id, item.version]));
