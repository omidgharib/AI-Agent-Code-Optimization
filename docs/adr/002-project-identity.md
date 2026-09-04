# ADR-002: Separate project identities

- Status: Proposed
- Date: 2026-09-03

## Context

Code audits need repository semantics, while SEO work can begin with only a URL. Treating both as one repository-backed entity makes `package.json` and local paths accidental product requirements.

## Decision

`CodeProject` and `SeoProject` are distinct entities owned by their domains. Both belong to a platform `Workspace`. An optional `RepositoryLink` relates an SEO project to a code project for source correlation or patch proposals; it does not merge their lifecycle or policy.

## Alternatives

- One project with nullable fields: rejected because invalid state combinations become normal.
- Require a repository for SEO: rejected because URL-only analysis is a core workflow.

## Consequences

Code project creation may validate repository metadata such as `package.json`; no platform or SEO entity may require it. Combined Audit stores references to independent runs.
