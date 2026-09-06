# Phase 11 — Specialist AI agents

## Objective

Provide bounded specialist agents that share evidence but keep scopes, models, budgets and approvals independent.

## Planned acceptance criteria

- [ ] Add Code Quality, Security, Performance, SEO, Test and Architecture agent profiles.
- [ ] Enforce the workflow `Analyze → Explain → Plan → Diff → Review → Verify → Apply`.
- [ ] Allow independent provider, model, endpoint and budget selection per specialist.
- [ ] Add issue-level conversations with isolated project and agent sessions.
- [ ] Support Minimal, Standard and Refactor solution strategies.
- [ ] Produce multiple alternatives and compare risk, blast radius and verification results.
- [ ] Group issues by probable root cause before requesting fixes.
- [ ] Preserve human approval boundaries across agent handoffs.
- [ ] Add a model arena for comparing normalized responses and patches.
- [ ] Keep project memory local, inspectable, resettable and free of detected secrets.

## Out of scope

- Fully autonomous unapproved repository changes.

## Verification

- Contract tests for every specialist profile and handoff.
- Session-isolation, budget and approval-boundary tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 11 using docs/phases/PHASE-11-SPECIALIST-AGENTS.md`.
