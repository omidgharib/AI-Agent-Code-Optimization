# E11 - Validation Corpus, Accuracy and Performance Benchmarks

## Objective

Prove the system is accurate, resilient and cost-efficient on representative codebases and websites before general availability.

## Validation corpus

### Code repositories

- Small npm application.
- TypeScript strict-mode service.
- React/Vite application.
- Next.js application.
- npm, pnpm and Yarn workspaces.
- Large monorepo with generated and ignored files.
- Repositories with intentional path, script and prompt-injection traps.

### Websites

- Static HTML, SSR, SPA and hydration failure.
- Ecommerce, publisher, documentation and multilingual sites.
- Redirect, canonical, hreflang, robots and sitemap edge cases.
- CDN/WAF, 429, TLS, DNS and intermittent timeout behavior.
- Large sitemap indexes and faceted crawl traps.
- Authenticated staging fixture with isolated credentials.

## Ground truth

- Store expected observations separately from expected findings.
- Require human-reviewed labels for high-severity rules.
- Version corpus, rule set and evaluator.
- Track disagreements and adjudication decisions.
- Compare selected outputs with trusted reference tools, not their wording.

## Accuracy metrics

- Precision, recall and false-positive rate by rule and severity.
- Agreement on HTTP status, canonical, indexability and discovered URLs.
- Duplicate clustering quality and orphan-confidence calibration.
- Patch apply and verification success rate.
- Analyzer unavailable/failed classification accuracy.
- Report consistency across formats.

## Performance benchmarks

- API and job-creation latency.
- Code scan duration by repository size.
- Crawl throughput and memory by URL tier.
- Browser render time and crash rate.
- Database, queue and artifact growth per 10,000 URLs.
- Connector sync time and quota consumption.
- AI token/cost distribution by finding and proposal.

## Implementation tasks

- [ ] Create a licensed, reproducible internal corpus manifest.
- [ ] Add synthetic deterministic web and repository fixtures.
- [ ] Add evaluation scripts and machine-readable benchmark output.
- [ ] Add nightly correctness and weekly scale suites.
- [ ] Establish performance budgets for supported deployment profiles.
- [ ] Track regressions against an approved baseline.
- [ ] Add flaky-test and measurement-variance handling.
- [ ] Publish supported limits and known blind spots.
- [ ] Create a rule release checklist requiring corpus evidence.

## Acceptance criteria

- [ ] Status, canonical and indexability agreement is at least 98% on the approved corpus.
- [ ] High-severity false-positive rate is below 5% after adjudication.
- [ ] Critical security-policy tests have zero false negatives in seeded cases.
- [ ] 10,000 URL benchmark completes within published CPU, memory and time budgets.
- [ ] Crash/restart benchmark loses no accepted job or completed observation.
- [ ] Every supported analyzer and connector has failure-mode fixtures.
- [ ] Performance regression thresholds run in CI or scheduled infrastructure.

## Release evidence

Attach corpus version, environment, commit, rule versions, result summary and known exclusions to the implementation note. Do not claim production readiness from unit test count alone.

