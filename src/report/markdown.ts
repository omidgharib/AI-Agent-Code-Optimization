import type { ReportData } from "./summary";

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
  lines.push(
    "\n## Issues\n| # | Severity | Category | Tool | Rule | File | Line | Col | Message |",
  );
  lines.push(
    "|---|----------|----------|------|------|------|------|-----|---------|",
  );
  for (const [i, issue] of data.topIssues.slice(0, 50).entries()) {
    const file = issue.location?.filePath ?? "-";
    const line = issue.location?.startLine ?? "-";
    const col = issue.location?.startColumn ?? "-";
    lines.push(
      `| ${i + 1} | ${issue.severity} | ${issue.category} | ${issue.tool} | ${issue.ruleId ?? "-"} | \`${file}\` | ${line} | ${col} | ${issue.message.slice(0, 80)} |`,
    );
  }
  if (data.patches.length > 0) {
    lines.push("\n## Applied Patches");
    for (const p of data.patches)
      lines.push(`- ${p.description} (touches: ${p.touches.join(", ")})`);
  }
  lines.push(`\n## Verification\n- Passed: ${data.verification.passed}`);
  if (data.verification.errors.length > 0) {
    lines.push("### Errors");
    for (const e of data.verification.errors) lines.push(`- ${e}`);
  }
  return lines.join("\n");
}
