// src/analyzers/eslint.ts
import { ESLint } from "eslint";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Issue } from "../core/types";

const EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/ai-auditor-report/**",
];

const CONFIG_FILES = [
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  ".eslintrc",
  "eslint.config",
  "eslint.config.mjs",
  "eslint.config.cjs",
];

function makeId(
  tool: string,
  ruleId: string,
  filePath: string,
  line: number,
  msg: string,
) {
  return createHash("sha256")
    .update(`${tool}:${ruleId}:${filePath}:${line}:${msg}`)
    .digest("hex")
    .slice(0, 16);
}

function mapSeverity(sev: number): Issue["severity"] {
  return sev === 2 ? "high" : sev === 1 ? "medium" : "low";
}

function mapCategory(ruleId: string): Issue["category"] {
  if (ruleId.includes("security")) return "security";
  if (ruleId.includes("test")) return "test";
  return "style";
}

export async function runEslint(cwd: string): Promise<Issue[]> {
  try {
    const hasConfig = CONFIG_FILES.some((f) => existsSync(join(cwd, f)));

    const eslint = new ESLint({
      cwd,
      useEslintrc: hasConfig,
      resolvePluginsRelativeTo: __dirname,
      ignorePattern: EXCLUDES,
      errorOnUnmatchedPattern: false,
      ...(hasConfig
        ? {}
        : {
            overrideConfig: {
              parserOptions: { ecmaVersion: "latest", sourceType: "module" },
              env: { node: true, es2022: true, browser: true },
              extends: ["eslint:recommended"],
            },
          }),
    } as ConstructorParameters<typeof ESLint>[0]);

    const results = await eslint.lintFiles(["."]);
    const issues: Issue[] = [];

    for (const file of results) {
      for (const msg of file.messages) {
        const ruleId = msg.ruleId ?? "unknown";
        issues.push({
          id: makeId(
            "eslint",
            ruleId,
            file.filePath,
            msg.line ?? 0,
            msg.message,
          ),
          tool: "eslint",
          ruleId,
          message: msg.message,
          severity: mapSeverity(msg.severity),
          category: mapCategory(ruleId),
          location: {
            filePath: file.filePath,
            startLine: msg.line,
            startColumn: msg.column,
            endLine: msg.endLine,
            endColumn: msg.endColumn,
          },
          fix: { canAutoFix: !!msg.fix },
        });
      }
    }
    return issues;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return [
      {
        id: makeId("custom", "eslint-failure", "", 0, "ESLint failed"),
        tool: "custom",
        message: `ESLint failed to run: ${detail}`,
        severity: "medium",
        category: "maintainability",
      },
    ];
  }
}
