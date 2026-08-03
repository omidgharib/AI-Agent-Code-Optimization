// FILE: src/normalize/normalizer.ts
import { IssueSchema } from "../core/schemas.js";
import type { Issue } from "../core/types.js";
import path from "node:path";

function posixPath(p: string): string {
  return p.split(path.sep).join("/");
}

export function normalize(rawIssues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const valid: Issue[] = [];

  for (const raw of rawIssues) {
    const parsed = IssueSchema.safeParse(raw);
    if (!parsed.success) continue;
    const issue = parsed.data as Issue;
    if (issue.location) {
      issue.location.filePath = posixPath(issue.location.filePath);
    }
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    valid.push(issue);
  }

  return valid.sort((a, b) => {
    if (a.tool !== b.tool) return a.tool.localeCompare(b.tool);
    const fa = a.location?.filePath ?? "\uffff";
    const fb = b.location?.filePath ?? "\uffff";
    if (fa !== fb) return fa.localeCompare(fb);
    const la = a.location?.startLine ?? Infinity;
    const lb = b.location?.startLine ?? Infinity;
    if (la !== lb) return la - lb;
    return a.message.localeCompare(b.message);
  });
}
