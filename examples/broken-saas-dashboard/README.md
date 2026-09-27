# Broken SaaS Dashboard

A deliberately flawed multi-file Vite/TypeScript project for end-to-end testing of AI Auditor. It is visually usable in development, but contains intentional static-analysis, security, accessibility, runtime, performance, and test problems.

## Run

```powershell
npm install
npm run dev
```

Use this directory as the project path in AI Auditor:

```text
examples/broken-saas-dashboard
```

For browser audits, use `http://127.0.0.1:4180`. The dashboard can also start the dev server automatically.

## Intended audit coverage

- `src/analytics.ts`: `eval`, loose equality, debugger, console output, unused declarations, and unsafe non-null assertion behavior.
- `src/legacy.js`: bundled ESLint coverage for `eval`, loose equality, debugger, console output, `var`, and unused declarations.
- `src/api.ts`: a hard-coded credential-like value, an unvalidated JSON response, and an unnecessary async function.
- `src/main.ts`: unused import, console output, untrusted local-storage expression passed into `eval`, a long main-thread loop, and a deliberately failing API request.
- `src/render.ts`: `innerHTML`, inline event handlers, an icon-only button without an accessible name, an unlabeled search input, and an image without dimensions/alt text.
- `src/data.ts`: an unused duplicated data structure.
- `src/analytics.test.ts`: one passing behavior and one test exposing `findAccount`'s incorrect return contract.

## Suggested test sequence

1. Run audit only and record issue counts.
2. Run fix in `dry-run` mode and inspect every proposed change set.
3. Confirm multi-file proposals remain independently attributable and applicable.
4. Approve one change set and verify unrelated files remain unchanged.
5. Run the audit again and confirm fixed findings disappear without new high/critical findings.
6. Run `npm test` and `npm run typecheck` to test verification and rollback behavior.

This fixture is intentionally broken. Do not use it as production code or copy its credential, DOM, or `eval` patterns.
