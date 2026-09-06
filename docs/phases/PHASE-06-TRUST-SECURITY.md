# Phase 6 — Trust, security and reversible changes

## Objective

Make every model-assisted action observable, bounded and safely reversible before expanding autonomous capabilities.

## Planned acceptance criteria

- [ ] Add a bilingual Trust Center showing exactly which files and excerpts may be sent to a model.
- [ ] Expand secret detection for environment files, credentials, certificates, private keys and common provider tokens.
- [ ] Enforce file, directory, command and changed-line allowlists for every agent action.
- [ ] Calculate a Fix Confidence score and explain the factors that affect it.
- [ ] Calculate patch blast radius from imports, tests and affected routes.
- [ ] Persist reversible patch snapshots and expose one-click Undo in the Web UI.
- [ ] Require additional approval for large, cross-file or public-API changes.
- [ ] Record redacted prompt, response, diff, verification and approval events in an audit trail.
- [ ] Add security regression tests for path traversal, symlinks, ignored files and secret leakage.

## Out of scope

- Cloud synchronization and team permissions.
- Support for non-JavaScript/TypeScript repositories.

## Verification

- `npm run build:all`
- `npm test -- --runInBand`
- Manual Undo and secret-redaction journey in the local Web UI.

## Start instruction

Ask: `Implement Phase 6 using docs/phases/PHASE-06-TRUST-SECURITY.md`.
