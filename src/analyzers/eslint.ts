// src/analyzers/eslint.ts
import { ESLint } from "eslint";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Category, Issue, Severity } from "../core/types";

const EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/ai-auditor-report/**",
];

const CONFIG_FILES = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.mjs",
  ".eslintrc.ts",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config",
  "eslint.config.js",
  "eslint.config.cjs",
  "eslint.config.mjs",
  "eslint.config.ts",
  "eslint.config.json",
];

const DEFAULT_RULES: Record<string, "error" | "warn"> = {
  "no-undef": "error",
  "no-unused-vars": "error",
  "no-redeclare": "error",
  "no-const-assign": "error",
  "no-dupe-args": "error",
  "no-dupe-keys": "error",
  "no-dupe-class-members": "error",
  "no-func-assign": "error",
  "no-class-assign": "error",
  "no-constant-condition": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-cond-assign": "error",
  "no-unexpected-multiline": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "getter-return": "error",
  "no-extra-boolean-cast": "warn",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-fallthrough": "warn",
  "no-case-declarations": "error",
  "no-empty": "warn",
  "no-useless-escape": "warn",
  "no-prototype-builtins": "warn",
  "no-extra-semi": "warn",
  "no-var": "warn",
  "prefer-const": "warn",
  "eqeqeq": "warn",
  "no-debugger": "error",
  "no-console": "warn",
  "no-duplicate-imports": "warn",
};

const SNIPPET_MAX = 200;

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

function toPosix(p: string): string {
  return p.split("\\").join("/");
}

function relativePosix(cwd: string, p: string): string {
  const rel = relative(cwd, p);
  return toPosix(rel || ".");
}

function mapSeverity(sev: number): Severity {
  return sev === 2 ? "high" : sev === 1 ? "medium" : "low";
}

const CATEGORY_RULES: Array<[Category, RegExp]> = [
  [
    "security",
    /security|no-eval|no-implied-eval|no-new-func|no-script-url|no-secrets|no-hardcoded/,
  ],
  ["a11y", /a11y/],
  [
    "performance",
    /performance|exhaustive-deps|no-async-promise-executor|no-await-in-loop/,
  ],
  ["test", /test|vitest|jest|no-only-tests|no-nested-tests/],
  [
    "style",
    /indent|quotes|semi|comma|space|keyword-spacing|object-curly|array-bracket|brace-style|linebreak-style|max-len|no-trailing-spaces|no-multiple-empty-lines|no-multi-spaces|padded-blocks|prettier|no-tabs|eol-last/,
  ],
  [
    "bug",
    /no-undef|no-dupe-|no-const-assign|no-func-assign|no-class-assign|no-constant-condition|no-unreachable|no-unsafe-finally|constructor-super|no-this-before-super|no-invalid-this|use-isnan|valid-typeof|getter-return|no-extra-boolean-cast|no-unexpected-multiline|no-import-assign|no-setter-return|no-prototype-builtins|no-empty-character-class|no-regex-spaces|no-control-regex|no-misleading-character-class|no-explicit-any|rules-of-hooks/,
  ],
  [
    "maintainability",
    /no-unused|no-redeclare|no-useless|no-empty|no-duplicate-imports|prefer-const|no-var|eqeqeq|no-shadow|no-unused-expressions|consistent-return|no-magic-numbers|complexity|max-|no-else-return|no-nested-ternary|no-lonely-if|no-param-reassign|default-case|no-fallthrough|no-case-declarations|no-mixed-operators|no-bitwise|no-plusplus|no-restricted-|no-console|no-debugger|require-await|no-return-await|no-floating-promises|no-misused-promises|no-unnecessary-condition|no-non-null-assertion|@typescript-eslint/,
  ],
];

export function mapCategory(ruleId: string): Category {
  const id = ruleId.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(id)) return cat;
  }
  return "maintainability";
}

function snippetFor(
  source: string | undefined,
  line: number | undefined,
): string | undefined {
  if (!source || !line || line < 1) return undefined;
  const lines = source.split(/\r?\n/);
  if (line > lines.length) return undefined;
  let text = (lines[line - 1] ?? "").trim();
  if (text.length > SNIPPET_MAX) text = text.slice(0, SNIPPET_MAX) + "…";
  return text || undefined;
}

export async function runEslint(cwd: string): Promise<Issue[]> {
  try {
    const absCwd = resolve(cwd);
    const hasConfig = CONFIG_FILES.some((f) => existsSync(join(absCwd, f)));

    const eslint = new ESLint({
      cwd: absCwd,
      useEslintrc: hasConfig,
      resolvePluginsRelativeTo: __dirname,
      errorOnUnmatchedPattern: false,
      overrideConfig: {
        ignorePatterns: EXCLUDES,
        ...(hasConfig
          ? {}
          : {
              parserOptions: { ecmaVersion: "latest", sourceType: "module" },
              env: { node: true, es2022: true, browser: true },
              rules: DEFAULT_RULES,
            }),
      },
    } as ConstructorParameters<typeof ESLint>[0]);

    const results = await eslint.lintFiles(["."]);
    const issues: Issue[] = [];

    for (const file of results) {
      const relPath = relativePosix(absCwd, file.filePath);
      for (const msg of file.messages) {
        const ruleId = msg.ruleId ?? "unknown";
        issues.push({
          id: makeId("eslint", ruleId, relPath, msg.line ?? 0, msg.message),
          tool: "eslint",
          ruleId,
          message: msg.message,
          severity: mapSeverity(msg.severity),
          category: mapCategory(ruleId),
          location: {
            filePath: relPath,
            startLine: msg.line || undefined,
            startColumn: msg.column || undefined,
            endLine: msg.endLine || undefined,
            endColumn: msg.endColumn || undefined,
          },
          evidence: { snippet: snippetFor(file.source, msg.line) },
          fix: { canAutoFix: !!msg.fix },
          meta: {
            eslintSeverity: msg.severity,
            messageId: msg.messageId,
            suggestions: msg.suggestions?.length ?? 0,
            fixable: !!msg.fix,
          },
        });
      }
    }
    return issues;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return [
      {
        id: makeId("eslint", "eslint-error", "", 0, "ESLint failed"),
        tool: "eslint",
        ruleId: "eslint-error",
        message: `ESLint failed to run: ${detail}`,
        severity: "medium",
        category: "maintainability",
        meta: { error: detail },
      },
    ];
  }
}
