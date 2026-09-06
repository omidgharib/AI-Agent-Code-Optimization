# E01 implementation note

- Implemented: 2026-09-03
- Status: Implemented and verified
- Compatibility: legacy CLI and HTTP routes retained for one release

## Delivered

- Runtime-validated, schema-versioned contracts for projects, audit commands, job events, findings, reports, and Problem Details.
- Opaque public project/environment identifiers; repository paths remain private local adapter configuration.
- Platform ports for projects, jobs, artifacts, policy, and audit log.
- Independently injectable `RunCodeAudit` and `RunSeoAudit` application services plus orchestration-only `RunCombinedAudit`.
- Injectable `/api/v1/platform/projects`, `/api/v1/code/audits`, and `/api/v1/seo/audits` route modules.
- URL-only SEO creation/audit path with no `projectPath` or `package.json` validation.
- Legacy API deprecation/sunset metadata and CLI compatibility adapter with migration warning for `audit --url`.
- Route-level React pages for `/code`, `/seo`, `/runs/:id`, and `/settings`; shared shell, error boundary, notifications, and feature API client.
- Architecture/contract tests wired into `prebuild`, so forbidden imports fail the build.

## Verification

- `npm run build:all`: passed (backend TypeScript and Vite production bundle).
- `npm test -- --runInBand`: 22 suites, 135 tests passed.
- Runtime smoke test: built server started successfully; `/api/health`, `/seo`, and `/api/v1/platform/projects` returned successfully and the v1 response carried `schemaVersion: 1`.

## Deferred compatibility removal

Legacy `/api/*` handlers and the internal `runAudit` implementation remain for one release. They are adapters, not the target public boundary. Physical extraction of existing analyzers proceeds incrementally behind the new application interfaces.
