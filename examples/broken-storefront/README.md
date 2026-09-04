# Broken Storefront

An intentionally flawed Vite + TypeScript project for testing `ai-auditor`.

## Run

```powershell
npm install
npm run dev
```

The app runs at `http://127.0.0.1:4173`.

From the parent AI Auditor project:

```powershell
npm start -- audit examples/broken-storefront --url http://127.0.0.1:4173 --json --md --html
```

Run the AI fix loop with your configured provider:

```powershell
npm start -- audit examples/broken-storefront --url http://127.0.0.1:4173 --fix --dry-run --json --md --html
```

## Seeded problems

- TypeScript type mismatches and an incorrect function return type.
- ESLint findings in `src/analytics.js`, including `no-var`, `prefer-const`, loose equality, unused bindings, `console`, `debugger`, and `eval`.
- A security issue caused by evaluating local-storage content.
- An unused source file and an unused import.
- Missing document language, meta description, canonical URL, and page-level H1.
- An unlabeled icon button and product images without alt text.
- Low color contrast and distorted images.
- Main-thread blocking work, large images, and no lazy loading.
- No automated tests.

This fixture is supposed to fail `npm run build` before it is repaired.
