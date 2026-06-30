# Frontend Modularization Audit — Poultry Hero (Phase 2)

Follow-up to `FRONTEND_INTAKE_AUDIT.md`. Goal of this phase: prepare the imported
Figma Make frontend for future Django REST integration by introducing TypeScript
project support, a typed shared layer, a centralized mock-data layer, and a thin
service boundary — **without** redesigning the UI or changing business behavior.

App path: `Poultry managment system/` · Main file: `src/app/App.tsx`

---

## A. Summary

**Refactored**
- Added real TypeScript project support (`tsconfig.json`, `tsconfig.node.json`,
  `typescript` + `@types/react(-dom)` dev deps, `typecheck` script).
- Resolved a duplicate `@types/react` (v18 vs v19) conflict via pnpm overrides.
- Extracted shared **types** → `src/shared/types/`.
- Extracted **navigation** config + screen titles → `src/app/navigation/`.
- Extracted **mock data** → `src/data/mock/` (centralized, barrelled).
- Added a thin **service boundary** → `src/services/` (mock-backed, async-shaped).
- Extracted a shared **`ComingSoonPlaceholder`** component → `src/shared/components/`.
- Introduced a typed tenant-navigation wrapper (`navTenant`) replacing 88 raw
  `setTScreen` call sites — this also cleared ~200 latent type errors.

**Intentionally left unchanged**
- All business screens, layouts, styling, copy, and displayed numbers.
- Module files (`SalesModule`-style screens inside `App.tsx`, `ProductModule.tsx`,
  `InventoryModule.tsx`, etc.) keep their own internal mock data for now.
- Arabic-first RTL, English switch, role switching, Super Admin ↔ Tenant switching.
- No backend, no Django, no DB models.

## B. Folder structure created

```
src/
  shared/
    types/        common, roles, money, navigation, tenant, documents, index
    components/   ComingSoonPlaceholder.tsx
  app/
    navigation/   tenantNavigation, superAdminNavigation, screenTitles
  data/
    mock/         company, products, customers, suppliers, sales, purchases,
                  reports, notifications, inventory, expenses, payments, tax,
                  users, index
  services/
    api/          types.ts, client.ts (stub)
    mock/         mockDelay + per-domain *Service.mock.ts
    index.ts      service boundary entry point
```

## C. Files changed
- `package.json` — added `typecheck` script, `typescript`, `@types/react`,
  `@types/react-dom`; pnpm overrides for `@types/react(-dom)` to dedupe to v18.
- `tsconfig.json`, `tsconfig.node.json` — new (permissive, `noEmit`, `react-jsx`,
  `@/*` path alias, excludes `src/imports` reference dumps).
- `src/app/App.tsx` — removed inline types, nav config, title maps, and mock data
  in favour of imports; added `navTenant` wrapper; uses `ComingSoonPlaceholder`.
- `src/app/QuotationsModule.tsx` — removed 4 redundant dead-code comparisons
  (behavior-preserving; the other meaningful `!== "converted"` checks restored).
- `src/app/TaxModule.tsx` — widened a local `KpiCard` icon prop type to
  `React.ElementType` (lucide compatibility).
- New files under `src/shared`, `src/app/navigation`, `src/data/mock`, `src/services`.

## D. Shared types created (`src/shared/types/`)
`Language`/`Lang`, `StatusBadgeType`, `AppMode`, `TenantRole`, `MoneyAmount`,
`PaymentMethod`, `SuperAdminScreen`, `TenantScreen`, `TenantNavigate`,
`Company`, `CompanyStatus`, `CompanyPlan`, `Product`, `Customer`, `Supplier`,
`InventoryItem`, `Expense`, `PaymentMovement`, `ReportSummary`, `DocumentStatus`,
`SProduct`, `SInvLine`, `SInvStatus`, `SInvoice`, `SalesInvoice`, `PurchaseInvoice`.

## E. Mock data files created (`src/data/mock/`)
`company.mock` (ALL_MODULES, COMPANIES, REVENUE_DATA, STATUS_PIE, PAYMENTS_DATA,
AUDIT_LOGS, PLANS_DATA, RECENT_ACTIVITY), `products.mock` (T_PRODUCTS, S_PRODUCTS),
`customers.mock` (T_CUSTOMERS, S_CUSTOMERS), `suppliers.mock` (T_SUPPLIERS),
`sales.mock` (T_INVOICES, S_INVOICES), `purchases.mock` (T_PURCHASES),
`reports.mock` (T_DAILY, T_MONTHLY_PROFIT, T_PAY_PIE), `notifications.mock`
(T_NOTIFS), plus representative `inventory.mock`, `expenses.mock`, `payments.mock`,
`tax.mock`, `users.mock`, and `index.ts` barrel. Sample data (Prime Fresh Meat LLC,
مطعم الخليج, سوبر ماركت المدينة, مطبخ الإمارات, 900/1000 GRAM, Liver, Gizzard, AED
values, etc.) is preserved verbatim.

## F. Service boundary created (`src/services/`)
See `API_BOUNDARY_PLAN.md` for the full function list and Django mapping. All
functions return mock data as Promises. `services/api/client.ts` is a documented
stub (`request()` throws) and `API_CONFIG.useMock = true`.

## G. App.tsx changes
- **Extracted:** super-admin & tenant types, `Company`, sales types
  (`SProduct/SInvLine/SInvStatus/SInvoice`), all top-level mock constants,
  `T_NAV`, `SA_NAV`, `TENANT_TITLES`, super-admin `titles`, and the inline
  "coming soon" placeholder.
- **Line count:** ~3,318 → **2,873** (~445 lines / ~13% removed). Build stability
  was prioritized over maximal reduction; the bulk of remaining lines are the
  many self-contained screen components, which were intentionally left in place.

## H. Build status
- Install: OK (`corepack pnpm install`, with pnpm overrides deduping `@types/react`).
- Build: **PASS** (`corepack pnpm run build` → `vite build`, ~8–10s).
- Typecheck: **PASS — 0 errors** (`corepack pnpm run typecheck` → `tsc --noEmit`).
  - Reference dumps under `src/imports/pasted_text/` are excluded from tsconfig
    (markdown/JSX snippets that are not part of the app).
- Warnings: recharts 2.x deprecation notice (informational); pnpm "ignored build
  scripts" for `@tailwindcss/oxide`/`esbuild` (pre-existing, build still succeeds).

## I. Risks / known debt
- **Screens still use inline mock data.** The service boundary + centralized mocks
  exist, but most screens have not yet been switched to call services. This is the
  recommended next refactor (incremental, screen-by-screen).
- **Module-domain mocks are representative, not exhaustive.** `inventory/expenses/
  payments/tax/users` mock files back the services with small sample sets; the
  richer data still lives inside the module screens.
- **`App.tsx` is still large (~2,873 lines)** — it holds most tenant + super-admin
  screen components inline. Splitting those into `src/app/modules/*` is a larger,
  higher-risk follow-up deferred for stability.
- **Module-local type copies** (e.g. each module redefines `Lang`/`TenantScreen`).
  These are structurally identical to the shared types so they interoperate; a
  future pass can replace them with the shared imports.
- **No backend yet** — services are mock-only by design.

## J. Recommended next Cursor prompt
> **“Django SaaS backend architecture and database schema design.”**
> Use `API_BOUNDARY_PLAN.md` as the contract: model tenants, companies, products,
> customers, suppliers, sales/purchase invoices, inventory, payments, expenses,
> tax, and users; design tenant isolation, auth, and the REST endpoints listed
> there; then wire `src/services/api/client.ts` to the live API and flip
> `API_CONFIG.useMock`.
