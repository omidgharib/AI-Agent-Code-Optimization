# SEO Intelligence Roadmap

This roadmap evolves AI Auditor's SEO area into a project-aware, campaign-driven SEO operating system. Implement phases in order and do not mark a phase complete while any acceptance criterion is unchecked.

## Product invariants

- Separate configuration, history, memory, credentials and campaigns by project.
- Merge configuration in this order: global defaults → project → campaign → run override.
- Treat model output as a proposal until evidence, preview, approval and verification are complete.
- Distinguish facts, assumptions, decisions and open questions in assistant memory.
- Never claim an invented ranking factor or guarantee ranking/rich-result outcomes.
- Follow Google Search Essentials, current Google Search documentation, Schema.org where applicable, and RFC 9309 for robots.txt.
- Keep external integrations read-only and least-privilege by default.

## Phases

| Phase | Goal | Status | File |
| --- | --- | --- | --- |
| SEO-01 | Project SEO profiles | Complete | [SEO-PHASE-01-PROJECT-PROFILE.md](phases/SEO-PHASE-01-PROJECT-PROFILE.md) |
| SEO-02 | Conversational onboarding | Core implemented | [SEO-PHASE-02-ONBOARDING-CHATBOT.md](phases/SEO-PHASE-02-ONBOARDING-CHATBOT.md) |
| SEO-03 | Advanced technical SEO | Core implemented | [SEO-PHASE-03-TECHNICAL-ENGINE.md](phases/SEO-PHASE-03-TECHNICAL-ENGINE.md) |
| SEO-04 | JavaScript rendering lab | Core implemented | [SEO-PHASE-04-JAVASCRIPT-SEO.md](phases/SEO-PHASE-04-JAVASCRIPT-SEO.md) |
| SEO-05 | Structured Data Studio | Core implemented | [SEO-PHASE-05-STRUCTURED-DATA.md](phases/SEO-PHASE-05-STRUCTURED-DATA.md) |
| SEO-06 | Site architecture intelligence | Core implemented | [SEO-PHASE-06-SITE-ARCHITECTURE.md](phases/SEO-PHASE-06-SITE-ARCHITECTURE.md) |
| SEO-07 | Content and entity intelligence | Core implemented | [SEO-PHASE-07-CONTENT-ENTITIES.md](phases/SEO-PHASE-07-CONTENT-ENTITIES.md) |
| SEO-08 | Keyword, topic and intent system | Core implemented | [SEO-PHASE-08-KEYWORDS-TOPICS.md](phases/SEO-PHASE-08-KEYWORDS-TOPICS.md) |
| SEO-09 | Campaign and strategy engine | Core implemented | [SEO-PHASE-09-CAMPAIGNS.md](phases/SEO-PHASE-09-CAMPAIGNS.md) |
| SEO-10 | Strategy-aware SEO copilot | Core implemented | [SEO-PHASE-10-SEO-COPILOT.md](phases/SEO-PHASE-10-SEO-COPILOT.md) |
| SEO-11 | Search performance integrations | Core implemented | [SEO-PHASE-11-SEARCH-DATA.md](phases/SEO-PHASE-11-SEARCH-DATA.md) |
| SEO-12 | Core Web Vitals lab | Core implemented | [SEO-PHASE-12-CWV-LAB.md](phases/SEO-PHASE-12-CWV-LAB.md) |
| SEO-13 | SEO experiments | Core implemented | [SEO-PHASE-13-EXPERIMENTS.md](phases/SEO-PHASE-13-EXPERIMENTS.md) |
| SEO-14 | Monitoring and alerting | Core implemented | [SEO-PHASE-14-MONITORING.md](phases/SEO-PHASE-14-MONITORING.md) |
| SEO-15 | Team workspace and digital twin | Core implemented | [SEO-PHASE-15-DIGITAL-TWIN.md](phases/SEO-PHASE-15-DIGITAL-TWIN.md) |

`Core implemented` means the deterministic domain model and analysis engine exist and are tested. It is deliberately not `Complete`: unchecked acceptance criteria such as live third-party connectors, interactive graph/dashboard surfaces, scheduled delivery, and PDF export remain product-integration work.

## 2026-09-03 implementation audit

- Completed onboarding memory edit/reject/review/confirm lifecycle guards.
- Added the technical SEO conflict engine and integrated it with the controlled crawler: RFC-style robots groups, wildcard/end matching, redirect chains/loops, MIME and X-Robots-Tag evidence, soft-404, canonical chains/loops, hreflang reciprocity and sitemap validation.
- Added deterministic JavaScript render-state comparison and framework/render-mode detection.
- Added normalized JSON-LD/Microdata/RDFa entities, Google-required property checks, visible-content checks, conflict detection and non-guaranteed rich-result eligibility; wired findings into SEO Lab.
- Added project-scoped read-only search metrics, lab/field CWV separation, experiment decisions, stateful deduplicated alerts and a versioned digital twin with impact simulation.
- Added cross-phase deterministic tests. Live connectors, interactive visualization, persistent schedulers and multi-user deployment remain unchecked in their phase files.

## Completion rule

For every phase: implement only unchecked items, add deterministic fixtures, run `npm run build:all` and `npm test -- --runInBand`, update its checklist, append a dated implementation note, then update this table.
