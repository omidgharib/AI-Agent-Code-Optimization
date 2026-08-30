import type { ReportData } from "./summary";

const TOOL_LABELS: Record<string, string> = {
  eslint: "ESLint",
  tsc: "TypeScript (tsc)",
  lighthouse: "Lighthouse",
  playwright: "Playwright",
  sonarqube: "SonarQube",
  custom: "Custom",
};

const TOOL_ORDER = [
  "eslint",
  "tsc",
  "lighthouse",
  "playwright",
  "sonarqube",
  "custom",
];

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

export function toMarkdown(data: ReportData): string {
  const lines: string[] = ["# AI Auditor Report\n"];
  lines.push(`## Summary\n- Total: ${data.summary.total}`);
  lines.push("### By Severity");
  for (const [k, v] of Object.entries(data.summary.bySeverity))
    lines.push(`- ${k}: ${v}`);
  lines.push("### By Category");
  for (const [k, v] of Object.entries(data.summary.byCategory))
    lines.push(`- ${k}: ${v}`);
  lines.push("### By Tool");
  for (const [k, v] of Object.entries(data.summary.byTool))
    lines.push(`- ${k}: ${v}`);

  const tools = data.tools ?? {};
  for (const tool of TOOL_ORDER) {
    const list = tools[tool];
    if (!list || list.length === 0) continue;

    lines.push("\n## " + toolLabel(tool) + " (" + list.length + ")");
    lines.push(
      "\n| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |",
    );
    lines.push(
      "|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|",
    );
    for (const [i, issue] of list.entries()) {
      const loc = issue.location;
      const end =
        loc?.endLine !== undefined
          ? `${loc.endLine}${loc.endColumn !== undefined ? `:${loc.endColumn}` : ""}`
          : "-";
      const snippet = issue.evidence?.snippet;
      lines.push(
        `| ${i + 1} | ${issue.severity} | ${issue.category} | ${issue.ruleId ?? "-"} | \`${mdEscape(loc?.filePath ?? "-")}\` | ${loc?.startLine ?? "-"} | ${loc?.startColumn ?? "-"} | ${end} | ${issue.fix?.canAutoFix ? "yes" : "no"} | ${mdEscape(issue.message)} | ${snippet ? `\`${mdEscape(snippet)}\`` : "-"} |`,
      );
    }
  }

  if (data.patches.length > 0) {
    lines.push("\n## Applied Patches");
    for (const p of data.patches)
      lines.push(`- ${p.description} (touches: ${p.touches.join(", ")})`);
  }
  if (data.recommendations.length > 0) {
    lines.push("\n## Recommendations (LLM)");
    for (const r of data.recommendations) lines.push(`- ${mdEscape(r)}`);
  }
  lines.push(`\n## Verification\n- Passed: ${data.verification.passed}`);
  if (data.verification.errors.length > 0) {
    lines.push("### Errors");
    for (const e of data.verification.errors) lines.push(`- ${e}`);
  }
  return lines.join("\n");
}
