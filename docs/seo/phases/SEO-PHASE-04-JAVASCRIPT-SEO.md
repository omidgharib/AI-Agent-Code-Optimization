# SEO Phase 4 — JavaScript SEO Laboratory

## Objective

Expose SEO differences between HTTP source, rendered DOM and hydrated/interactive states.

## Acceptance criteria

- [ ] Capture raw HTML, rendered DOM and bounded post-interaction DOM for selected routes.
- [ ] Compare title, robots, canonical, hreflang, schema, primary content, images and crawlable links across states.
- [ ] Detect client-only content, metadata mutation, hydration errors, blocked resources and interaction-gated links.
- [ ] Compare Googlebot smartphone, regular mobile and desktop rendering profiles.
- [ ] Detect framework and route rendering mode for Next.js, Remix, React Router, Nuxt, Astro, Gatsby and Vite SPA.
- [ ] Map runtime evidence to source files where sourcemaps or framework manifests allow it.
- [ ] Store screenshots and bounded DOM diffs without persisting secrets or personal form data.
- [ ] Add side-by-side bilingual review UI.

## Verification

- SSR, CSR, hydration-failure, lazy-content and metadata-mutation fixtures.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 4 using `docs/seo/phases/SEO-PHASE-04-JAVASCRIPT-SEO.md`.

## Implementation notes

- 2026-09-03: Added deterministic raw/rendered/interactive comparison, Googlebot/mobile/desktop profiles, hydration/resource signals and framework-mode detection. Screenshot persistence, source mapping and side-by-side UI remain unchecked.
