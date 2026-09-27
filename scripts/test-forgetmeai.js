const { requestFix } = require("../dist/fix/llmClient");

const config = {
  baseUrl: process.env.AI_AUDITOR_BASE_URL || "http://127.0.0.1:9655",
  apiKey: process.env.DEEPSEEK_API_KEY || "local",
  model: process.env.AI_AUDITOR_MODEL || "deepseek-reasoner",
};

const constraints = {
  maxFilesChanged: 1,
  preferMinimalDiff: true,
  doNotChangePublicAPI: true,
  keepFormatting: true,
};

const metadata = {
  filePath: "package.json",
  excerpt: JSON.stringify({
    name: "forgetmeai-smoke-test",
    scripts: { build: "tsc" },
    dependencies: {},
    devDependencies: { typescript: "^5.0.0" },
  }),
};

const cases = [
  {
    name: "advisory-only Lighthouse issue",
    request: {
      repoRoot: "C:\\sample-js-project",
      issues: [{
        id: "sample-lighthouse",
        tool: "lighthouse",
        ruleId: "largest-contentful-paint",
        message: "Largest Contentful Paint is 4.2 seconds",
        severity: "high",
        category: "performance",
        location: { filePath: "-" },
        evidence: { url: "http://localhost:3000" },
        fix: { canAutoFix: false, strategy: "advisory" },
        score: 80,
        effort: "m",
        rationale: ["User-visible performance regression"],
      }],
      context: [metadata],
      constraints,
    },
    validate(output) {
      if (output.patches.length !== 0) throw new Error("advisory issue returned a patch");
      if (output.notes.length < 1) throw new Error("advisory issue returned no notes");
    },
  },
  {
    name: "single-file TypeScript diff",
    request: {
      repoRoot: "C:\\sample-js-project",
      issues: [{
        id: "sample-ts",
        tool: "eslint",
        ruleId: "prefer-const",
        message: "'total' is never reassigned. Use 'const' instead.",
        severity: "low",
        category: "style",
        location: { filePath: "src/sum.ts", startLine: 2, startColumn: 7 },
        evidence: { snippet: "export function sum(values: number[]) {\n  let total = values.reduce((a, b) => a + b, 0);\n  return total;\n}" },
        fix: { canAutoFix: true, strategy: "local" },
        score: 20,
        effort: "xs",
        rationale: ["Deterministic local change"],
      }],
      context: [metadata, {
        filePath: "src/sum.ts",
        excerpt: "export function sum(values: number[]) {\n  let total = values.reduce((a, b) => a + b, 0);\n  return total;\n}\n",
      }],
      constraints,
    },
    validate(output) {
      if (output.patches.length < 1) throw new Error("fixable issue returned no patch");
      const patch = output.patches[0];
      if (!patch.unifiedDiff.includes("--- ") || !patch.unifiedDiff.includes("+++ ") || !patch.unifiedDiff.includes("@@"))
        throw new Error("patch is not a unified diff");
      if (!patch.touches.includes("src/sum.ts")) throw new Error("touches does not contain src/sum.ts");
    },
  },
  {
    name: "undefined reference repair",
    request: {
      repoRoot: "C:\\sample-js-project",
      issues: [{
        id: "sample-undefined",
        tool: "tsc",
        ruleId: "TS2304",
        message: "Cannot find name 'double'.",
        severity: "high",
        category: "bug",
        location: { filePath: "src/calculate.ts", startLine: 2, startColumn: 10 },
        evidence: { snippet: "export function calculate(value: number) {\n  return double(value);\n}" },
        fix: { canAutoFix: true, strategy: "local", hint: "Add the missing helper" },
        score: 75,
        effort: "s",
        rationale: ["Compilation is blocked"],
      }],
      context: [metadata, {
        filePath: "src/calculate.ts",
        excerpt: "export function calculate(value: number) {\n  return double(value);\n}\n",
      }],
      constraints,
    },
    validate(output) {
      if (output.patches.length < 1) throw new Error("undefined reference returned no patch");
      if (!output.patches[0].unifiedDiff.includes("double")) throw new Error("patch does not define/use double");
      if (output.notes.some((note) => /lighthouse|largest contentful paint|\bLCP\b/i.test(note)))
        throw new Error("response leaked Lighthouse notes from another session");
    },
  },
];

async function main() {
  console.log(`ForgetMeAI smoke test: ${config.baseUrl} / ${config.model}`);
  const results = [];
  for (const testCase of cases) {
    const startedAt = Date.now();
    try {
      const output = await requestFix(config, testCase.request);
      testCase.validate(output);
      const result = {
        name: testCase.name,
        ok: true,
        durationMs: Date.now() - startedAt,
        patches: output.patches.length,
        notes: output.notes.length,
        output,
      };
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const result = { name: testCase.name, ok: false, durationMs: Date.now() - startedAt, error: String(error) };
      results.push(result);
      console.error(JSON.stringify(result, null, 2));
    }
  }
  const passed = results.filter((result) => result.ok).length;
  console.log(`RESULT: ${passed}/${results.length} passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
