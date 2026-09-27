import type { PrioritizedIssue } from "../core/types";

export function toSarif(issues: PrioritizedIssue[]): Record<string, unknown> {
  const rules = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();
  for (const issue of issues) {
    const id = `${issue.tool}/${issue.ruleId ?? "unknown"}`;
    if (!rules.has(id)) rules.set(id, { id, name: issue.ruleId ?? "unknown", shortDescription: { text: issue.message } });
  }
  const level = (severity: string) => severity === "critical" || severity === "high" ? "error" : severity === "medium" ? "warning" : "note";
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{
      tool: { driver: { name: "ai-auditor", informationUri: "https://github.com/", rules: [...rules.values()] } },
      results: issues.map((issue) => ({
        ruleId: `${issue.tool}/${issue.ruleId ?? "unknown"}`,
        level: level(issue.severity),
        message: { text: issue.message },
        locations: issue.location?.filePath && issue.location.filePath !== "-" ? [{ physicalLocation: { artifactLocation: { uri: issue.location.filePath.replace(/\\/g, "/") }, region: { startLine: issue.location.startLine ?? 1, startColumn: issue.location.startColumn ?? 1 } } }] : [],
        properties: { category: issue.category, severity: issue.severity, issueId: issue.id },
      })),
    }],
  };
}
