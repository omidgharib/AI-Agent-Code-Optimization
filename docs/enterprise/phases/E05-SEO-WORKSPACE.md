# E05 - Independent SEO Workspace

## Objective

Create a standalone SEO product page and backend domain that works with a public or private URL without requiring a local JavaScript/TypeScript repository.

## User experience

### Routes

- `/seo` - SEO project list and creation.
- `/seo/projects/:projectId` - project overview and environments.
- `/seo/projects/:projectId/audits/new` - single-page or crawl configuration.
- `/seo/runs/:runId` - progress, findings and evidence.
- `/seo/projects/:projectId/pages/:pageId` - URL history and signals.
- `/seo/projects/:projectId/settings` - crawl, indexability, schema and performance policy.

### Project creation

Required input is project name and primary site URL. Optional inputs include environment URLs, markets, languages, authentication profile and repository link. The UI must never show a repository picker unless source correlation is enabled.

## Domain model

- SeoProject: business identity and tenant ownership.
- SeoEnvironment: production, staging or custom base URL.
- CrawlPolicy: allowed hosts, include/exclude patterns, budgets and authentication reference.
- SeoRun: immutable configuration snapshot and analyzer versions.
- PageObservation: HTTP, source HTML, rendered state and derived signals.
- SeoFinding: evidence-backed issue attached to URL, template or site.
- SeoBaseline: approved reference run or time window.
- RepositoryLink: optional relation to a CodeProject and framework metadata.

## API surface

- `POST /api/v1/seo/projects`
- `POST /api/v1/seo/projects/:id/environments`
- `POST /api/v1/seo/runs`
- `GET /api/v1/seo/runs/:id`
- `GET /api/v1/seo/runs/:id/events`
- `GET /api/v1/seo/runs/:id/findings`
- `POST /api/v1/seo/projects/:id/repository-link`
- `DELETE /api/v1/seo/projects/:id/repository-link`

All write routes require tenant membership and an idempotency key where retry is plausible.

## Analysis layers

- HTTP: status, redirects, MIME, headers and response constraints.
- Crawlability: robots and discoverability.
- Indexability: robots directives, canonical, status and content eligibility.
- International: hreflang syntax, targets, reciprocity and canonical consistency.
- Structured data: normalized entities, eligibility and visible-content support.
- Rendering: raw, rendered and bounded interactive states.
- Content: title/H1/purpose, duplicates and template-aware main content.
- Architecture: internal links, depth, hubs, dead ends and orphan evidence.
- Experience: Lighthouse lab metrics and separately imported field data.

## Implementation tasks

- [ ] Introduce SeoProject persistence independent of filesystem paths.
- [ ] Create dedicated SEO route handlers and application services.
- [ ] Create the SEO React route tree and navigation entry.
- [ ] Move SEO profile, onboarding and campaign state into platform storage.
- [ ] Replace report-directory project identity with opaque project IDs.
- [ ] Add environment-specific crawl policy and baselines.
- [ ] Add optional repository linking after project creation.
- [ ] Add a combined-run command that references existing code and SEO projects.
- [ ] Provide project import/export without credentials.
- [ ] Migrate current SEO reports into the new project model.

## Tests

- URL-only project browser journey.
- Project isolation and repository-link lifecycle tests.
- Production/staging environment separation tests.
- Validation for domain, IDN, IPv6 and authenticated targets.
- Migration fixtures from existing filesystem SEO profiles.

## Acceptance criteria

- [ ] A user can crawl a public site without selecting a local folder.
- [ ] SEO reports are stored outside the target repository.
- [ ] Code and SEO jobs have separate forms, state, APIs and reports.
- [ ] Linking a repository enriches source mapping but never changes crawl semantics.
- [ ] Removing a repository link does not delete SEO history.
- [ ] Environment data and baselines cannot leak into another project.

## UX quality gate

Run keyboard, RTL/LTR, screen-reader, empty/error/loading and mobile layout tests. A failed crawl must show a classified reason and recovery action, not only `fetch failed`.

