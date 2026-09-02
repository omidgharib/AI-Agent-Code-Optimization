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
  lines.push("### Fix flows");
  lines.push(`- Mechanical (${data.fixSummary.mechanicalMode}): ${data.fixSummary.mechanical}`);
  lines.push(`- AI patches accepted: ${data.fixSummary.aiPatches}`);
  lines.push(`- Advisory recommendations: ${data.fixSummary.advisoryRecommendations}`);

  if (data.lighthouse) {
    const lhr = data.lighthouse;
    lines.push("\n## Lighthouse details");
    lines.push(`- Requested URL: ${mdEscape(lhr.requestedUrl ?? "-")}`);
    lines.push(`- Final URL: ${mdEscape(lhr.finalDisplayedUrl ?? lhr.mainDocumentUrl ?? "-")}`);
    lines.push(`- Version: ${mdEscape(lhr.lighthouseVersion ?? "-")}`);
    lines.push(`- Fetch time: ${mdEscape(lhr.fetchTime ?? "-")}`);
    lines.push("\n### Category scores");
    lines.push("\n| Category | Title | Score |");
    lines.push("|---|---|---:|");
    for (const [id, category] of Object.entries(lhr.categories))
      lines.push(`| ${mdEscape(id)} | ${mdEscape(category.title)} | ${category.score === null ? "n/a" : Math.round(category.score * 100)} |`);
    lines.push("\n### All audits");
    lines.push("\n| Audit | Score | Mode | Value | Description / evidence |");
    lines.push("|---|---:|---|---|---|");
    for (const [id, audit] of Object.entries(lhr.audits)) {
      const details = audit.details;
      const evidence = [
        audit.description,
        audit.warnings?.length ? `Warnings: ${audit.warnings.join("; ")}` : "",
        audit.errorMessage ? `Error: ${audit.errorMessage}` : "",
        details?.overallSavingsMs !== undefined ? `Savings: ${details.overallSavingsMs} ms` : "",
        details?.overallSavingsBytes !== undefined ? `Savings: ${details.overallSavingsBytes} bytes` : "",
        details?.items?.length ? `Detail rows: ${details.items.length}` : "",
      ].filter(Boolean).join(" — ");
      lines.push(`| ${mdEscape(id)} | ${audit.score === null ? "n/a" : Math.round(audit.score * 100)} | ${mdEscape(audit.scoreDisplayMode ?? "-")} | ${mdEscape(audit.displayValue ?? String(audit.numericValue ?? "-"))} | ${mdEscape(evidence || audit.title)} |`);
    }
    if (lhr.runWarnings?.length) {
      lines.push("\n### Lighthouse warnings");
      for (const warning of lhr.runWarnings) lines.push(`- ${mdEscape(warning)}`);
    }
  }

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
