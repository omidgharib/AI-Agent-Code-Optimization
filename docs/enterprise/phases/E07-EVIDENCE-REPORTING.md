# E07 - Evidence, Quality Gates and Reporting

## Objective

Make every finding reviewable, reproducible, versioned and suitable for technical, security and executive audiences.

## Finding contract

```ts
interface FindingV1 {
  schemaVersion: 1;
  id: string;
  fingerprint: string;
  engine: "code" | "seo";
  rule: { id: string; version: string };
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  asset: { type: "file" | "url" | "template" | "project"; id: string };
  evidence: EvidenceRef[];
  impact: string;
  remediation: string;
  reproducibility: ReproductionMetadata;
  observedAt: string;
}
```

## Evidence requirements

- HTTP evidence includes URL, request profile, status, selected headers and redirect chain.
- DOM evidence includes state, selector or bounded sanitized excerpt.
- Code evidence includes repository-relative path, line, analyzer and source hash.
- Search evidence includes connector, dimensions, period, timezone, freshness and sampling.
- Performance evidence identifies lab or field source, device, percentile and collection period.
- AI explanations reference finding and artifact IDs; they are never primary evidence.

## Quality gates

- Gate by severity, rule, confidence, project policy and baseline state.
- Support warn, fail and require-approval actions.
- Evaluate new, regressed and recurring findings separately.
- Reject a gate evaluation when required analyzers failed or evidence is incomplete.
- Version the policy and attach its resolved configuration to the run.
- Add exception owner, reason, scope and expiry.

## Reporting

- JSON is the canonical complete representation.
- SARIF maps code findings and URL findings using stable properties.
- CSV supports crawl/page inventory and finding export.
- Markdown and HTML are human review formats.
- PDF is generated from the same report view with deterministic layout.
- Reports distinguish facts, assumptions, decisions and recommendations.
- Executive summaries must not imply ranking guarantees or unsupported causality.

## Implementation tasks

- [ ] Version the finding and report schemas.
- [ ] Add rule registry with documentation and ownership.
- [ ] Persist evidence artifacts separately from finding summaries.
- [ ] Add baseline comparison and lifecycle states.
- [ ] Add policy evaluation with missing-analyzer handling.
- [ ] Add exception expiry and ownership.
- [ ] Implement deterministic exporters and schema validation.
- [ ] Add report redaction and artifact access checks.
- [ ] Add bilingual report copy without translating identifiers or evidence.
- [ ] Remove or quarantine stale duplicate report implementations.

## Tests

- Golden report fixtures for every format.
- Schema backward/forward compatibility tests.
- Secret and personal-data redaction fixtures.
- Baseline, regression, suppression and exception-expiry tests.
- Missing analyzer and partial evidence gate tests.
- RTL PDF and long URL/layout tests.

## Acceptance criteria

- [ ] Every finding has rule version, confidence, asset and evidence.
- [ ] Reports identify unavailable checks and cannot label them as passed.
- [ ] Exports from one run agree on finding IDs and summary totals.
- [ ] A reviewer can reproduce a high-severity finding from attached metadata.
- [ ] Baselines and exceptions are project-scoped, owned and auditable.
- [ ] Seeded secrets never appear in any export format.
