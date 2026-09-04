# AI Auditor Report

## Summary
- Total: 19
### By Severity
- high: 7
- medium: 4
- low: 8
### By Category
- security: 1
- maintainability: 16
- bug: 2
### By Tool
- eslint: 7
- tsc: 4
- custom: 8
### Fix flows
- Mechanical (applied): 0
- AI patches accepted: 0
- Advisory recommendations: 0

## ESLint (7)

| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |
|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|
| 1 | high | security | no-eval | `src/analytics.js` | 9 | 1 | 9:5 | no | eval can be harmful. | `eval("window.__legacyAnalytics = true");` |
| 2 | high | maintainability | @typescript-eslint/no-unused-vars | `src/analytics.js` | 3 | 7 | 3:26 | no | 'unusedTrackerOption' is assigned a value but never used. | `const unusedTrackerOption = "debug";` |
| 3 | high | maintainability | no-debugger | `src/analytics.js` | 10 | 1 | 10:10 | no | Unexpected 'debugger' statement. | `debugger;` |
| 4 | medium | maintainability | no-var | `src/analytics.js` | 1 | 1 | 1:20 | yes | Unexpected var, use let or const instead. | `var visitCount = 0;` |
| 5 | medium | maintainability | prefer-const | `src/analytics.js` | 2 | 5 | 2:16 | yes | 'trackerName' is never reassigned. Use 'const' instead. | `let trackerName = "legacy-store-tracker";` |
| 6 | medium | maintainability | eqeqeq | `src/analytics.js` | 5 | 16 | 5:18 | no | Expected '===' and instead saw '=='. | `if (visitCount == "0") {` |
| 7 | medium | maintainability | no-console | `src/analytics.js` | 6 | 3 | 6:14 | no | Unexpected console statement. | `console.log(trackerName, "started");` |

## TypeScript (tsc) (4)

| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |
|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|
| 1 | high | bug | TS2322 | `src/main.ts` | 16 | 7 | - | no | Type '({ id: number; name: string; price: string; image: string; } \| { id: number; name: string; price: number; image: string; })[]' is not assignable to type 'Product[]'. | `const products: Product[] = featuredProducts;` |
| 2 | high | bug | TS2322 | `src/pricing.ts` | 2 | 3 | - | no | Type 'string' is not assignable to type 'number'. | `return `$${value.toFixed(2)}`;` |
| 3 | high | maintainability | TS6133 | `src/main.ts` | 4 | 1 | - | no | 'unusedPromotion' is declared but its value is never read. | `import { unusedPromotion } from "./unusedPromotion";` |
| 4 | high | maintainability | TS6133 | `src/main.ts` | 17 | 7 | - | no | 'debugLabel' is declared but its value is never read. | `const debugLabel = "catalog-ready";` |

## Custom (8)

| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |
|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|
| 1 | low | maintainability | outdated-audit-unavailable | `package.json` | - | - | - | no | Registry version checks could not complete | `{"registry":"https://registry.npmjs.org","packagesChecked":4}` |
| 2 | low | maintainability | dependency-audit-unavailable | `package.json` | - | - | - | no | Registry vulnerability audit could not complete | `{"error":"Error: ENOENT: no such file or directory, open 'C:\\Users\\omidg\\OneDrive\\Documents\\AI-Agent-Code-Optimization\\AI-Agent-Code-Optimization\\examples\\broken-storefront\\package-lock.json'","request":"POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk"}` |
| 3 | low | maintainability | unused-file | `src/analytics.js` | - | - | - | no | src/analytics.js has no known importers | - |
| 4 | low | maintainability | possibly-unused-file | `src/analytics.js` | - | - | - | no | Source file is not referenced by another local module | `{"file":"src/analytics.js","method":"static import graph"}` |
| 5 | low | maintainability | possibly-unused-file | `src/legacyCatalog.ts` | - | - | - | no | Source file is not referenced by another local module | `{"file":"src/legacyCatalog.ts","method":"static import graph"}` |
| 6 | low | maintainability | unused-exports | `src/legacyCatalog.ts` | - | - | - | no | 1 export(s) in src/legacyCatalog.ts have no known consumers | - |
| 7 | low | maintainability | unused-file | `src/legacyCatalog.ts` | - | - | - | no | src/legacyCatalog.ts has no known importers | - |
| 8 | low | maintainability | unused-import | `src/main.ts` | - | - | - | yes | Imported binding 'unusedPromotion' is not used | `{"import":"import { unusedPromotion } from \"./unusedPromotion\";","binding":"unusedPromotion"}` |

## Verification
- Passed: true