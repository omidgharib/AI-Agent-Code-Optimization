import type { Issue } from "./types";

const words = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 3));
const conceptOverlap = (a: Issue, b: Issue) => {
  if (a.category !== b.category) return false;
  const left = words(`${a.ruleId ?? ""} ${a.message}`), right = words(`${b.ruleId ?? ""} ${b.message}`);
  const common = [...left].filter((word) => right.has(word)).length;
  return common >= 1 || a.ruleId?.split(":").pop() === b.ruleId?.split(":").pop();
};

/** Collapses cross-tool duplicates while preserving Sonar as evidence. */
export function mergeOverlappingIssues(issues: Issue[]): Issue[] {
  const merged: Issue[] = [];
  for (const issue of issues) {
    const match = merged.find((candidate) => candidate.location?.filePath === issue.location?.filePath && candidate.location?.startLine === issue.location?.startLine && candidate.tool !== issue.tool && conceptOverlap(candidate, issue));
    if (!match) { merged.push(issue); continue; }
    match.meta = { ...match.meta, evidenceTools: [...new Set([...(Array.isArray(match.meta?.evidenceTools) ? match.meta.evidenceTools as string[] : [match.tool]), issue.tool])], sonar: issue.tool === "sonar" ? issue.meta : match.meta?.sonar };
    if (issue.tool === "sonar" && issue.evidence?.url) match.evidence = { ...match.evidence, url: issue.evidence.url };
  }
  return merged;
}
