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

function severityColor(s: string): string {
  return (
    { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#65a30d" }[
      s
    ] ?? "#6b7280"
  );
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
    "\n## Issues\n| # | Severity | Category | Tool | Rule | File | Line | Col | Message |",
  );
  lines.push(
    "|---|----------|----------|------|------|------|------|-----|---------|",
  );
  for (const [i, issue] of data.topIssues.slice(0, 50).entries()) {
    const file = issue.location?.filePath ?? "-";
    const line = issue.location?.startLine ?? "-";
    const col = issue.location?.startColumn ?? "-";
    const rule = issue.ruleId ?? "-";
    lines.push(
      `| ${i + 1} | ${issue.severity} | ${issue.category} | ${issue.tool} | ${rule} | \`${file}\` | ${line} | ${col} | ${issue.message.slice(0, 80)} |`,
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

function toHtml(data: ReportData): string {
  const severityOrder = ["critical", "high", "medium", "low"];
  const rows = data.topIssues
    .slice(0, 200)
    .map((issue, i) => {
      const file = issue.location?.filePath ?? "-";
      const line = issue.location?.startLine ?? "-";
      const col = issue.location?.startColumn ?? "-";
      const rule = issue.ruleId ?? "-";
      const color = severityColor(issue.severity);
      const fileRef =
        line !== "-"
          ? `<span class="file">${file}</span><span class="loc">:${line}${col !== "-" ? `:${col}` : ""}</span>`
          : `<span class="file">${file}</span>`;
      return `<tr>
      <td class="num">${i + 1}</td>
      <td><span class="badge" style="background:${color}">${issue.severity}</span></td>
      <td><span class="cat">${issue.category}</span></td>
      <td>${issue.tool}</td>
      <td class="rule" title="${rule}">${rule}</td>
      <td class="filepath">${fileRef}</td>
      <td class="msg">${issue.message.replace(/</g, "&lt;")}</td>
    </tr>`;
    })
    .join("\n");

  const severityBadges = severityOrder
    .filter((s) => data.summary.bySeverity[s])
    .map(
      (s) =>
        `<div class="stat-card"><span class="badge lg" style="background:${severityColor(s)}">${s}</span><span class="count">${data.summary.bySeverity[s]}</span></div>`,
    )
    .join("");

  const patchRows = data.patches
    .map(
      (p) =>
        `<tr><td>${p.description}</td><td>${p.touches.map((f) => `<code>${f}</code>`).join(", ")}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Auditor Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
  header{background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid #1e293b;padding:24px 32px;display:flex;align-items:center;gap:16px}
  header h1{font-size:1.5rem;font-weight:700;color:#f8fafc}
  header .subtitle{color:#94a3b8;font-size:.875rem;margin-top:2px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.05em}
  .badge.lg{font-size:.875rem;padding:4px 12px}
  .container{max-width:1400px;margin:0 auto;padding:24px 32px}
  .stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  .stat-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:12px;min-width:140px}
  .stat-card .count{font-size:1.5rem;font-weight:700;color:#f8fafc}
  .total-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:8px}
  .total-card .label{color:#94a3b8;font-size:.875rem}
  .total-card .num{font-size:2rem;font-weight:800;color:#38bdf8}
  .section{background:#1e293b;border:1px solid #334155;border-radius:10px;margin-bottom:20px;overflow:hidden}
  .section-header{padding:14px 20px;background:#162032;border-bottom:1px solid #334155;font-weight:600;font-size:.9rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{padding:10px 14px;text-align:left;color:#64748b;font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #334155;background:#162032}
  td{padding:10px 14px;border-bottom:1px solid #1e293b;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#162032}
  .num{color:#64748b;font-size:.8rem;width:36px}
  .rule{font-family:'SF Mono',Consolas,monospace;font-size:.78rem;color:#7dd3fc;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .filepath{font-family:'SF Mono',Consolas,monospace;font-size:.78rem;max-width:260px}
  .file{color:#a5b4fc}
  .loc{color:#f472b6;font-weight:600}
  .msg{color:#cbd5e1;max-width:400px;line-height:1.4}
  .cat{display:inline-block;padding:1px 7px;border-radius:3px;font-size:.72rem;background:#0f172a;color:#94a3b8;border:1px solid #334155}
  .verification{padding:16px 20px;display:flex;align-items:center;gap:10px}
  .pass{color:#4ade80;font-weight:600}
  .fail{color:#f87171;font-weight:600}
  code{background:#0f172a;padding:1px 5px;border-radius:3px;font-size:.8rem;color:#a5b4fc}
  .empty{padding:24px;text-align:center;color:#475569}
  .icon{font-size:1.4rem}
</style>
</head>
<body>
<header>
  <span class="icon">🔍</span>
  <div>
    <h1>AI Auditor Report</h1>
    <div class="subtitle">Generated ${new Date().toISOString()}</div>
  </div>
</header>
<div class="container">
  <div class="stats">
    <div class="total-card"><span class="label">Total Issues</span><span class="num">${data.summary.total}</span></div>
    ${severityBadges}
  </div>

  <div class="section">
    <div class="section-header">Issues (${data.topIssues.length})</div>
    ${
      data.topIssues.length === 0
        ? '<div class="empty">No issues found 🎉</div>'
        : `
    <table>
      <thead><tr><th>#</th><th>Severity</th><th>Category</th><th>Tool</th><th>Rule</th><th>File : Line : Col</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    }
  </div>

  ${
    data.patches.length > 0
      ? `
  <div class="section">
    <div class="section-header">Applied Patches (${data.patches.length})</div>
    <table>
      <thead><tr><th>Description</th><th>Files Touched</th></tr></thead>
      <tbody>${patchRows}</tbody>
    </table>
  </div>`
      : ""
  }

  <div class="section">
    <div class="section-header">Verification</div>
    <div class="verification">
      ${
        data.verification.passed
          ? '<span class="pass">✓ Passed</span>'
          : `<span class="fail">✗ Failed</span>`
      }
      ${data.verification.errors.map((e) => `<span style="color:#f87171;font-size:.85rem">${e}</span>`).join("")}
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function writeReport(
  issues: PrioritizedIssue[],
  patches: FixResponse["patches"],
  verification: { passed: boolean; errors: string[] },
  config: { json: boolean; md: boolean; html: boolean; outDir: string },
): Promise<void> {
  await fs.mkdir(config.outDir, { recursive: true });
  const data: ReportData = {
    summary: buildSummary(issues),
    topIssues: issues.slice(0, 200),
    patches: patches.map((p) => ({
      description: p.description,
      touches: p.touches,
    })),
    verification,
  };
  const neither = !config.json && !config.md && !config.html;
  if (config.json || neither)
    await fs.writeFile(
      path.join(config.outDir, "report.json"),
      JSON.stringify(data, null, 2),
    );
  if (config.md || neither)
    await fs.writeFile(path.join(config.outDir, "report.md"), toMarkdown(data));
  if (config.html || neither)
    await fs.writeFile(path.join(config.outDir, "report.html"), toHtml(data));
}
