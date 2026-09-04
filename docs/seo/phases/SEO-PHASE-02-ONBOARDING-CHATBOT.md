# SEO Phase 2 — Conversational Onboarding Chatbot

## Objective

Turn a conversation into a confirmed, structured SEO project brief.

## Acceptance criteria

- [ ] Ask adaptive questions about goals, markets, audiences, conversions, priority pages, competitors, resources and approval constraints.
- [ ] Store memory as Facts, Assumptions, Decisions and Open Questions with source, confidence and confirmation state.
- [ ] Detect missing or contradictory answers and never silently invent business facts.
- [ ] Generate a reviewable Project Brief and proposed project configuration.
- [ ] Let users edit, confirm, reject, export and reset memory.
- [ ] Keep sessions isolated by project and campaign and free of detected secrets.
- [ ] Explain why each requested input is needed and allow users to skip it.
- [ ] Add bilingual onboarding, resume and completion journeys.

## Verification

- Conversation contract, contradiction, isolation, reset and secret-leakage tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 2 using `docs/seo/phases/SEO-PHASE-02-ONBOARDING-CHATBOT.md`.

## Implementation notes

- 2026-09-03: Core onboarding questions, typed memory, contradiction handling, redaction, isolation, edit/reject/review/complete lifecycle, brief generation and server persistence are implemented. The dedicated conversational UI remains unchecked.
