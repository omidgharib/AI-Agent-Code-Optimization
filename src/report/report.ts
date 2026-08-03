// FILE: src/report/report.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { PrioritizedIssue, FixResponse } from "../core/types.js";

interface ReportData {
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byTool: Record<string, number>;
  };
  topIssues: PrioritizedIssue[];
  patches: Array<{ description: string; touches: string[] }>;
  verification: { passed: boolean; errors: string[] };
}

function buildSummary(issues: PrioritizedIssue[]): ReportData["summary"] {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  for (const i of issues) {
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    byTool[i.tool] = (byTool[i.tool] ?? 0) + 1;
  }
  return { total: issues.length, bySeverity, byCategory, byTool };
}

function toMarkdown(data: ReportData): string {
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
    "\n## Top Issues\n| # | Tool | Severity | Category | Score | Message | File | Line |",
  );
  lines.push(
    "|---|------|----------|----------|-------|---------|------|------|",
  );
  for (const [i, issue] of data.topIssues.slice(0, 20).entries()) {
    const file = issue.location?.filePath ?? "-";
    const line = issue.location?.startLine ?? "-";
    lines.push(
      `| ${i + 1} | ${issue.tool} | ${issue.severity} | ${issue.category} | ${issue.score} | ${issue.message.slice(0, 60)} | ${file} | ${line} |`,
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

export async function writeReport(
  issues: PrioritizedIssue[],
  patches: FixResponse["patches"],
  verification: { passed: boolean; errors: string[] },
  config: { json: boolean; md: boolean; outDir: string },
): Promise<void> {
  await fs.mkdir(config.outDir, { recursive: true });
  const data: ReportData = {
    summary: buildSummary(issues),
    topIssues: issues.slice(0, 20),
    patches: patches.map((p) => ({
      description: p.description,
      touches: p.touches,
    })),
    verification,
  };
  if (config.json)
    await fs.writeFile(
      path.join(config.outDir, "report.json"),
      JSON.stringify(data, null, 2),
    );
  if (config.md)
    await fs.writeFile(path.join(config.outDir, "report.md"), toMarkdown(data));
}
