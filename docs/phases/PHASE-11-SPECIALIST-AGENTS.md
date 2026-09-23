# Phase 11 — Specialist AI agents

## Objective

Provide bounded specialist agents that share evidence but keep scopes, models, budgets and approvals independent.

## Planned acceptance criteria

- [x] Add Code Quality, Security, Performance, SEO, Test and Architecture agent profiles.
- [x] Enforce the workflow `Analyze → Explain → Plan → Diff → Review → Verify → Apply`.
- [x] Allow independent provider, model, endpoint and budget selection per specialist.
- [x] Add issue-level conversations with isolated project and agent sessions.
- [x] Support Minimal, Standard and Refactor solution strategies.
- [x] Produce multiple alternatives and compare risk, blast radius and verification results.
- [x] Group issues by probable root cause before requesting fixes.
- [x] Preserve human approval boundaries across agent handoffs.
- [x] Add a model arena for comparing normalized responses and patches.
- [x] Keep project memory local, inspectable, resettable and free of detected secrets.

## Out of scope

- Fully autonomous unapproved repository changes.

## Verification

- Contract tests for every specialist profile and handoff.
- Session-isolation, budget and approval-boundary tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 11 using docs/phases/PHASE-11-SPECIALIST-AGENTS.md`.

## 2026-09-21 implementation note

`src/core/specialistAgents.ts` provides the six profiles, workflow enforcement (`advanceSpecialist`), isolated sessions (`createSpecialistSession`), solution strategies, root-cause grouping (`groupRootCauses`), issue routing (`routeIssuesToSpecialists`), alternative comparison (`compareAlternatives`), the model arena (`modelArena`) and per-specialist input budgets (`specialistInputBudget`). `src/fix/specialistPlanner.ts` plans bounded specialist tasks with approval stages and budget caps (`planSpecialistWork`). Project memory is appended through `addProjectMemory` with secret redaction. Covered by Phase 11 tests in `src/tests/finalPhases.test.ts`. The planner is wired into the engine fix loop: every fix and advisory batch in `src/core/engine.ts` is routed through `planSpecialistWork` under the configured `specialistStrategy` (default `standard`), injected into the LLM context via `specialistPromptContext`, logged as specialist tasks with the active approval stages, and surfaced as `agent.specialists`/`agent.specialistStrategy` in the report. The strategy is selectable with the CLI `--strategy minimal|standard|refactor` flag and is passed through the web server when a job is started.
