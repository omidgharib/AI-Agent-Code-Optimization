# E01 - Modular Monolith and Versioned Contracts

> Implementation status: complete and verified. See the [implementation note](../e01/implementation-note.md).

## Objective

Separate Code Audit and SEO logic inside the existing repository without prematurely creating distributed services.

## Target source layout

```text
src/
  contracts/
  platform/
    projects/
    jobs/
    artifacts/
    policy/
    audit-log/
  code/
    application/
    domain/
    infrastructure/
  seo/
    application/
    domain/
    infrastructure/
  combined/
  server/
    routes/code/
    routes/seo/
    routes/platform/
```

## Contract design

- Use discriminated unions for project and job types.
- Add `schemaVersion` to commands, events, reports and persisted snapshots.
- Use Zod at every HTTP, queue, configuration and persisted-data boundary.
- Keep internal domain objects separate from transport DTOs.
- Use opaque identifiers instead of filesystem paths as public API identity.
- Add structured `ProblemDetails` errors with stable machine codes.

```ts
type AuditCommand =
  | { schemaVersion: 1; kind: "code"; codeProjectId: string; options: CodeAuditOptions }
  | { schemaVersion: 1; kind: "seo"; seoProjectId: string; environmentId: string; options: SeoAuditOptions }
  | { schemaVersion: 1; kind: "combined"; codeProjectId: string; seoProjectId: string; options: CombinedAuditOptions };
```

## Implementation tasks

- [x] Create platform and domain folder boundaries.
- [x] Move shared `Issue`, report and job contracts into `src/contracts`.
- [x] Split the current `runAudit` orchestration into `RunCodeAudit` and `RunSeoAudit` application services.
- [x] Move crawl/SEO routes behind the SEO route boundary, separate from audit jobs.
- [x] Split the server into route modules and injectable services.
- [x] Split the React application into route-level pages: `/code`, `/seo`, `/runs/:id`, `/settings`.
- [x] Add a shared application shell, navigation, error boundary and notification layer.
- [x] Replace cross-workspace state with route-owned pages and feature API clients.
- [x] Add dependency-cycle and forbidden-import checks.
- [x] Preserve CLI compatibility through adapters and deprecation warnings.

## Migration strategy

1. Add contracts and adapters without moving implementations.
2. Introduce independent application services behind existing CLI/API behavior.
3. Move modules in small commits while preserving exports required by existing consumers.
4. Add new `/api/v1/code/*` and `/api/v1/seo/*` routes.
5. Keep legacy routes for one release and emit deprecation metadata.
6. Remove legacy orchestration only after compatibility tests pass.

## Tests

- Contract serialization and schema migration tests.
- Route tests proving SEO does not require `projectPath`.
- Import-boundary tests.
- CLI compatibility tests.
- Browser tests for navigation and independent form state.

## Acceptance criteria

- [x] Code and SEO application services can run independently.
- [x] No SEO v1 route calls `validateProject(package.json)` unless source linking was requested.
- [x] Code Audit domain/application does not import crawler, schema or campaign implementations.
- [x] UI state from one workspace cannot alter the other workspace's form or active run.
- [x] Existing CLI commands remain functional and combined URL compatibility emits migration output.
- [x] All public contracts validate at runtime and carry a schema version.

## Verification

```text
npm run build:all
npm test -- --runInBand
```

Add architecture tests to CI and fail the build on forbidden imports.
