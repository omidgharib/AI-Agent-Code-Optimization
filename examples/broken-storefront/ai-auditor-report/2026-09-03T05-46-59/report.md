# AI Auditor Report

## Summary
- Total: 10
### By Severity
- high: 4
- low: 6
### By Category
- bug: 2
- maintainability: 8
### By Tool
- tsc: 4
- custom: 6
### Fix flows
- Mechanical (applied): 0
- AI patches accepted: 0
- Advisory recommendations: 0

## TypeScript (tsc) (4)

| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |
|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|
| 1 | high | bug | TS2322 | `src/main.ts` | 16 | 7 | - | no | Type '({ id: number; name: string; price: string; image: string; } \| { id: number; name: string; price: number; image: string; })[]' is not assignable to type 'Product[]'. | `const products: Product[] = featuredProducts;` |
| 2 | high | bug | TS2322 | `src/pricing.ts` | 2 | 3 | - | no | Type 'string' is not assignable to type 'number'. | `return `$${value.toFixed(2)}`;` |
| 3 | high | maintainability | TS6133 | `src/main.ts` | 4 | 1 | - | no | 'unusedPromotion' is declared but its value is never read. | `import { unusedPromotion } from "./unusedPromotion";` |
| 4 | high | maintainability | TS6133 | `src/main.ts` | 17 | 7 | - | no | 'debugLabel' is declared but its value is never read. | `const debugLabel = "catalog-ready";` |

## Custom (6)

| # | Severity | Category | Rule/Code | File | Line | Col | End | Fixable | Message | Snippet |
|---|----------|----------|-----------|------|------|-----|-----|---------|---------|---------|
| 1 | low | maintainability | outdated-audit-unavailable | `package.json` | - | - | - | no | Registry version checks could not complete | `{"registry":"https://registry.npmjs.org","packagesChecked":4}` |
| 2 | low | maintainability | dependency-audit-unavailable | `package.json` | - | - | - | no | Registry vulnerability audit could not complete | `{"error":"Error: ENOENT: no such file or directory, open 'C:\\Users\\omidg\\OneDrive\\Documents\\AI-Agent-Code-Optimization\\AI-Agent-Code-Optimization\\examples\\broken-storefront\\package-lock.json'","request":"POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk"}` |
| 3 | low | maintainability | possibly-unused-file | `src/legacyCatalog.ts` | - | - | - | no | Source file is not referenced by another local module | `{"file":"src/legacyCatalog.ts","method":"static import graph"}` |
| 4 | low | maintainability | unused-exports | `src/legacyCatalog.ts` | - | - | - | no | 1 export(s) in src/legacyCatalog.ts have no known consumers | - |
| 5 | low | maintainability | unused-file | `src/legacyCatalog.ts` | - | - | - | no | src/legacyCatalog.ts has no known importers | - |
| 6 | low | maintainability | unused-import | `src/main.ts` | - | - | - | yes | Imported binding 'unusedPromotion' is not used | `{"import":"import { unusedPromotion } from \"./unusedPromotion\";","binding":"unusedPromotion"}` |

## Verification
- Passed: true