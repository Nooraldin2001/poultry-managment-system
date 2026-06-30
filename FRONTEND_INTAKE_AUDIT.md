# Poultry Hero — Frontend Intake Audit

> Imported Figma Make UI codebase. Goal of this pass: **inspect, make it run, fix build/runtime
> issues, and prepare for future Django backend integration.** No backend code was created.
> No business screens were removed, no UI redesign, no business-logic rewrites.

Date: 2026-06-29

---

## A. Project structure summary

| Item | Detail |
|---|---|
| **Frontend folder** | `Poultry managment system/` (note the space in the folder name) |
| **Framework / tooling** | React 18.3.1 + TypeScript (`.tsx`), bundled with **Vite 6.3.5** |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`), custom CSS in `src/styles/` |
| **UI primitives** | Radix UI + a local shadcn-style component library in `src/app/components/ui/` |
| **Charts / misc** | recharts 2.15.2, lucide-react icons, sonner (toasts), motion, MUI (present in deps) |
| **Package manager** | **pnpm** (has `pnpm-workspace.yaml` + `pnpm.overrides` in `package.json`) |
| **Node used** | v22.17.0; pnpm 10.9.0 invoked via `corepack` (pnpm was not globally installed) |

### Main entry files

| File | Role |
|---|---|
| `index.html` | HTML shell, mounts `#root`, loads `/src/main.tsx` |
| `src/main.tsx` | React entry — `createRoot(...).render(<App />)`, imports `./styles/index.css` |
| `src/app/App.tsx` | **Root application** (~3,300 lines). Holds Super Admin app, `TenantApp`, screen state, and all screen-render mappings |
| `vite.config.ts` | Vite config: React + Tailwind plugins, `@` alias → `src`, custom `figma:asset/` resolver |
| `src/styles/index.css` | Aggregates `fonts.css`, `tailwind.css`, `globals.css`, `theme.css` |

### Major module files (`src/app/`)

`ProductModule.tsx`, `InventoryModule.tsx`, `PurchaseModule.tsx`, `SupplierModule.tsx`,
`CustomerModule.tsx`, `ExpensesModule.tsx`, `ReportsModule.tsx`, `SettingsModule.tsx`,
`QuotationsModule.tsx`, `PaymentsModule.tsx`, `TaxModule.tsx`.

Each module exports a set of "Screen"/"Modal" components that `App.tsx` imports and renders based
on the current `TenantScreen` state. The Super Admin screens (login, companies, plans, audit log,
etc.) and the sales-invoice workflow live directly inside `App.tsx`.

> `src/imports/pasted_text/` contains the original Figma Make source dumps + design notes (`.md`,
> `.tsx`). They are **not imported by the app** and are kept for reference only.

---

## B. Commands used

All commands run from inside the `Poultry managment system/` folder.

| Purpose | Command |
|---|---|
| Install dependencies | `corepack pnpm install` |
| Dev server | `corepack pnpm run dev`  (→ `vite`, served on `http://localhost:5173`) |
| Production build | `corepack pnpm run build`  (→ `vite build`) |
| Typecheck | **Not available** — no `tsconfig.json` and no `typescript` dependency in the project |
| Lint | **Not available** — no ESLint/Prettier config in the project |

> If global `pnpm` is preferred over `corepack`, run `corepack enable` once **from an elevated
> shell** (it needs write access to the Node install dir on Windows) or `npm i -g pnpm`.

---

## C. Issues found & fixes applied

| # | File | Problem | Fix applied | Risk |
|---|---|---|---|---|
| 1 | `package.json` | `react` / `react-dom` were declared **only as optional `peerDependencies`**, not as real `dependencies`. For an app (not a library) this means the bundler may not resolve React after a clean install. | Added `react@18.3.1` and `react-dom@18.3.1` to `dependencies` (kept versions identical to the existing peer pins). | Low |
| 2 | `pnpm-workspace.yaml` | `supportedArchitectures.os` was locked to **`linux` only**. On this Windows machine that blocks installation of platform-native binaries (esbuild, rollup, `@tailwindcss/oxide`, lightningcss) → broken install/build. | Expanded `os` to `linux`, `win32`, `darwin` (cpu/libc unchanged) so native deps install cross-platform. | Low |
| 3 | Environment | `pnpm` not installed globally; project is pnpm-based. | Used `corepack pnpm …` (Corepack ships with Node 22) — no global install or PATH change required. | None |
| 4 | `src/app/App.tsx` | Sidebar link **"المستخدمين والصلاحيات" (`users`)** rendered the generic "coming soon" fallback even though a real `UsersListScreen` exists. Broken mapping for an existing screen. | Added a renderer `users → UsersListScreen` and added `"users"` to the fallback exclude-list so it no longer double-renders. | Low |
| 5 | `src/app/App.tsx` | **`payment-receipt-detail`** is navigated to from the payments movements list (`PaymentsModule`), but had **no renderer** → rendered a blank area. A `ReceiptPreviewScreen` (receipt-by-id) already existed. | Wired `payment-receipt-detail → ReceiptPreviewScreen` (reuses the existing receipt-by-id screen; same data, no logic change). | Low |
| 6 | `src/app/App.tsx` | **`payments-supplier-refund`** (Payments quick-action) and **`settings-print-templates`** (Tax & Settings buttons) are navigated to but have **no screen** → blank area (they were inside the fallback exclude-list). | Removed both from the exclude-list so they fall through to the polished "coming soon" placeholder instead of a blank screen. | Low |
| 7 | `src/app/App.tsx` | Generic placeholder lacked a "قريباً" badge requested for unbuilt screens. | Enhanced the shared tenant fallback placeholder: Arabic title + **"قريباً" badge** + explanation + "back to dashboard" button. | Low |

### Notes on things that looked suspicious but are **OK** (no change made)

- **Duplicate component names across modules** (e.g. `ProductDetailScreen`, `SupplierPayModal`,
  `CustomerCollectionModal`/`SupplierPaymentModal`) are already disambiguated in `App.tsx` via
  import aliases (`ProductDetailScreen as InvProductDetailScreen`,
  `CustomerCollectionModal as PayCollectModal`, etc.). No conflict at build time.
- **`payments-customer-collection` / `payments-supplier-payment`** screen keys exist in the type
  union but are never navigated to — the collect/pay flows are handled by **local modal state**
  inside `PaymentsModule` (`showCollectModal` / `showPayModal`). Harmless dead keys; left as-is.
- `showCollectModal` / `showPayModal` state declared in `TenantApp` is currently unused (the module
  manages its own). Harmless; left as-is to avoid touching logic.

---

## D. Current module status

| Module / Workflow | File / Component | Status | Notes |
|---|---|---|---|
| Super Admin SaaS dashboard | `App.tsx` → `DashboardScreen`, `CompaniesScreen`, `CompanyDetailScreen`, `CreateCompanyWizard`, `PlansScreen`, `OutstandingScreen`, `AuditLogScreen` | working | Super-admin "settings" screen is an inline "coming soon". |
| Tenant dashboard | `App.tsx` → `TenantApp` + `TenantDashboardScreen` | working | RTL Arabic default, role switch (owner/accountant/cashier). |
| Sales invoice workflow | `App.tsx` → `SalesListScreen`, `SalesNewScreen`, `SalesPreviewScreen`, `SalesDetailScreen`, collect/adjust/cancel modals | working | Lives inside `App.tsx`. |
| Purchase invoice workflow | `PurchaseModule.tsx` | working | list / new / detail / preview + supplier-pay & cancel modals. |
| Inventory workflow | `InventoryModule.tsx` | working | overview / product / stocktaking / alerts / movement / valuation. |
| Products workflow | `ProductModule.tsx` | working | list / add / detail / categories / bulk / by-products / import-export. |
| Customers workflow | `CustomerModule.tsx` | working | list / create / profile / statement + collect & credit-override modals. |
| Suppliers workflow | `SupplierModule.tsx` | working | list / create / profile / statement. |
| Expenses workflow | `ExpensesModule.tsx` | working | overview / list / recurring / report / detail / voucher + add modal. |
| Reports workflow | `ReportsModule.tsx` | working | home + daily/sales/purchase/inventory/customer/supplier/tax/profit/statements/builder. |
| Settings & permissions | `SettingsModule.tsx` | working | company / users / roles / sensitive-actions / audit / numbering / VAT / transactions / plan / security. |
| Quotations workflow | `QuotationsModule.tsx` | working | list / new / detail / preview / convert / analytics. |
| Payments & receipts | `PaymentsModule.tsx` | working | overview / movements / refund / receipt preview / method-summary / cash-bank / report. |
| Tax management | `TaxModule.tsx` | working | dashboard / sales VAT / purchase VAT / net / warnings / audit / credit-notes / non-taxable / settings / export. |
| Accounts (الحسابات) | `App.tsx` → `AccountsComingSoonScreen` | placeholder | Intentional polished placeholder — module not built yet. |
| Users sidebar entry | `App.tsx` → `UsersListScreen` | working (fixed) | Was a broken mapping; now routed to the existing users screen. |
| Print templates | — | placeholder (fixed) | No screen yet; now shows the "قريباً" placeholder instead of blank. |
| Supplier refund | — | placeholder (fixed) | No screen yet; now shows the "قريباً" placeholder instead of blank. |

---

## E. Navigation status

**Tenant sidebar (`T_NAV`)** — all sections now resolve to a real screen or a polished placeholder:

| Sidebar (AR) | Target | Result |
|---|---|---|
| الرئيسية | `dashboard` | working |
| المبيعات | `sales` / `sales-list` | working |
| عروض الأسعار | `quotations` | working |
| المشتريات | `purchases` | working |
| المخزون | `inventory` | working |
| المنتجات | `products` | working |
| العملاء | `customers` | working |
| الموردين | `suppliers` | working |
| المدفوعات والتحصيلات | `payments` | working |
| المصروفات | `expenses` | working |
| الحسابات | `accounts` | placeholder (`AccountsComingSoonScreen`) |
| الضريبة | `tax` | working |
| التقارير | `reports` | working |
| المستخدمين والصلاحيات | `users` | **working (fixed)** — now `UsersListScreen` |
| الإعدادات | `settings` | working |

- **Working sidebar links:** all 15 tenant sidebar sections + Super Admin nav (dashboard, companies,
  payments, outstanding, plans, audit-log).
- **Broken links fixed:** `users` (→ `UsersListScreen`), `payment-receipt-detail`
  (→ `ReceiptPreviewScreen`).
- **Placeholder links (graceful "قريباً"):** `accounts`, `settings-print-templates`,
  `payments-supplier-refund`, and any other unimplemented `TenantScreen` that falls through.

---

## F. Remaining technical debt

1. **`App.tsx` is very large (~3,300 lines).** It mixes Super Admin app, `TenantApp`, the sales
   workflow, shared components, mock data, and the full screen-render switchboard. Should be split
   (e.g. `superadmin/`, `tenant/`, `shared/`, `data/`) before heavy feature work.
2. **No TypeScript config / no typecheck.** Project ships `.tsx` but has no `tsconfig.json` and no
   `typescript` dependency, so type errors are invisible. Adding a non-strict `tsconfig.json` +
   `typescript` (typecheck only, not wired into build) would be a safe next step.
3. **No linting/formatting.** No ESLint/Prettier. Optional but recommended for a growing codebase.
4. **Mock data is inlined and duplicated** across `App.tsx` and the modules (companies, customers,
   invoices, etc.). This is the natural seam for the future API layer.
5. **Business logic is 100% frontend-only / in-memory.** Navigation, "saving", toasts, and totals
   are simulated; nothing persists. No API client, no data-fetching layer yet.
6. **Module naming / prop contracts are ad-hoc.** Screens take `lang`, `role`, `onNavigate`, and
   assorted `selected*Id` props passed down from `App.tsx` state. A typed navigation/context layer
   would reduce prop-drilling before backend wiring.
7. **Bundle size:** single JS chunk ~1.59 MB (~369 KB gzip). Non-blocking Vite warning; consider
   code-splitting per module when convenient.
8. **`recharts@2.15.2` is deprecated** (install warning). Non-blocking; upgrade later.
9. **pnpm build-scripts** for `@tailwindcss/oxide` and `esbuild` are not approved (`pnpm
   approve-builds`). Build/dev currently work via the platform optional-dependency binaries, so this
   is informational only.

---

## G. Recommended next Cursor step

> **Frontend modularization and API boundary preparation before Django backend integration.**

Concretely: split `App.tsx` into `superadmin/`, `tenant/`, `shared/`, and `data/` folders without
changing behavior; extract the inlined mock data into a single `data/` layer; introduce a thin,
typed data-access seam (e.g. `services/`/`api/` returning the current mock data) so screens stop
reading literals directly. Optionally add a non-strict `tsconfig.json` + `typescript` for typecheck.
This creates a clean API boundary that the future Django REST backend can plug into with minimal
screen changes.

---

## Build status (this pass)

- `corepack pnpm install` — success (316 packages).
- `corepack pnpm run build` — **success** (`✓ 2230 modules transformed`, built in ~11–16 s).
- `corepack pnpm run dev` — **success** (Vite ready in ~2 s).
- Lint / typecheck — not available (no config in project).
- Only non-blocking warnings: chunk size > 500 kB, and `recharts` deprecation notice.

**No backend code, Django project, models, migrations, schema, or API endpoints were created.**

---

> **Update (Phase 2):** TypeScript project support, a typed shared layer, a
> centralized mock-data layer, and a thin (mock-backed) service boundary were
> added without changing the UI or business behavior. `typecheck` is now wired
> and passes with 0 errors. See `FRONTEND_MODULARIZATION_AUDIT.md` and
> `API_BOUNDARY_PLAN.md` for details.
