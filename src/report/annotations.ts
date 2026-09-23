// FILE: src/report/annotations.ts
import type { AnnotationInput } from "../code/infrastructure/ciAnnotations";
import { githubAnnotations, gitlabCodeQuality } from "../code/infrastructure/ciAnnotations";

export type AnnotationIssue = AnnotationInput;
export interface AnnotationArtifacts { github?: { kind: "github"; files: Array<{ name: string; content: string }> }; gitlab?: { kind: "gitlab"; files: Array<{ name: string; content: string }> }; count: number }

export function buildAnnotations(issues: AnnotationIssue[], options: { github?: boolean; gitlab?: boolean }): AnnotationArtifacts {
  const artifacts: AnnotationArtifacts = { count: issues.length };
  if (options.github) artifacts.github = { kind: "github", files: [{ name: "annotations.github.txt", content: githubAnnotations(issues).join("\n") }] };
  if (options.gitlab) artifacts.gitlab = { kind: "gitlab", files: [{ name: "annotations.gitlab.json", content: JSON.stringify(gitlabCodeQuality(issues), null, 2) }] };
  return artifacts;
}

export function annotationInstructions(format: "github" | "gitlab"): string {
  if (format === "github") {
    return "Copy the annotations.github.txt lines into the GitHub Actions step's stdout (or append to $GITHUB_STEP_SUMMARY) so workflow annotations appear on the run and pull request.";
  }
  return "Commit annotations.gitlab.json to the pipeline and upload it using gitlab codequality artifact (reportType: codequality) in gitlab-ci.yml.";
}