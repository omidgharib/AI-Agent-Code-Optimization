# Phase 3 — Controllable AI agent

## Objective

Turn model-assisted fixing into a bounded, observable and user-controlled workflow.

## Planned acceptance criteria

- [x] Support Suggest, Dry run and Apply modes.
- [x] Allow separate analysis and fix models.
- [x] Isolate provider sessions per request/job.
- [x] Add time, request, token/cost and changed-file budgets.
- [x] Redact secrets from model context and trace output.
- [x] Let users choose issues before generating patches.
- [x] Require verification before a patch is accepted.
- [x] Preserve full prompt/response diagnostics with safe redaction.
- [x] Add provider capability and health diagnostics.

## Implementation note

2026-09-01: Added bounded agent modes, per-request session isolation, separate advisory model, issue scope selection, budgets, safe traces, and verified transactional acceptance.

## Start instruction

Ask: `Implement Phase 3 using docs/phases/PHASE-03-AI-AGENT.md`.
