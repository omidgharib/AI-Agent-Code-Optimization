# Phase 2 — Code, SEO and runtime analyzers

## Objective

Add evidence-rich analysis for code quality, browser runtime, SEO, accessibility,
dependencies and bundle performance.

## Planned acceptance criteria

- [x] Implement real Playwright console, network and smoke-route checks.
- [x] Render complete Lighthouse category/audit details in every report format.
- [x] Audit title, description, canonical, robots, sitemap, headings and status codes.
- [x] Validate Open Graph, Twitter Cards and JSON-LD structured data.
- [x] Detect broken internal links and redirect chains.
- [x] Report vulnerable/outdated dependencies without modifying lockfiles.
- [x] Detect unused imports/files, duplication and oversized bundles.
- [x] Add framework-aware React, Vite, Next.js and Node.js rules.
- [x] Attach reproducible evidence to every finding.

## Verification

```bash
npm run build
npm test -- --runInBand
```

## Implementation notes

- 2026-09-01: Replaced the Playwright stub with Chromium runtime, console, network, navigation, SEO metadata, robots/sitemap and internal-link checks.
- 2026-09-01: Added read-only npm registry advisory/latest-version analysis; package and lock files are never modified.
- 2026-09-01: Added static import/file reachability, duplicate block, generated bundle-size and React/Vite/Next.js/Node.js rules.
- 2026-09-01: Added full Lighthouse category/audit evidence to Markdown; JSON and interactive HTML retain complete Lighthouse data.
- 2026-09-01: Verified a real Playwright run against the local Web UI using installed Chrome.
- 2026-09-01: Verification passed: TypeScript build plus 11 Jest suites / 92 tests.

## Start instruction

Ask: `Implement Phase 2 using docs/phases/PHASE-02-ANALYZERS.md`.
