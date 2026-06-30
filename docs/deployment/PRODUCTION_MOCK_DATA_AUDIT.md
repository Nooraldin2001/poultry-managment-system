# Production Mock-Data Audit (Phase 4A)

**Goal:** when the frontend runs in live/production mode
(`VITE_USE_MOCK_DATA` not `true`, or `import.meta.env.PROD === true`) it must
**never** display hardcoded demo business data — only real API data or clean
empty states.

This note records where demo/mock data lived, whether it was production-visible,
and the fix applied.

---

## Root cause

The Figma-exported UI (`frontend/src/app/App.tsx`, a ~3000-line monolith) read
demo data from two places, **regardless of any flag**:

1. **The `@/data/mock` barrel** — arrays of fake companies, revenue, customers,
   suppliers, products, invoices, etc. (extracted from `App.tsx` into
   `frontend/src/data/mock/*.ts`).
2. **Inline hardcoded literals inside `App.tsx`** — KPI numbers (e.g. `value="5"`,
   `425,000`, VAT `2,975`), a settings company profile, and an invoice-template
   preview with a fake company/customer identity.

Nothing gated either source, so the deployed prototype showed fake companies,
revenue, subscriptions and dashboard numbers as if real.

## Fix model

A single source of truth now decides mock vs live:
`frontend/src/services/config.ts` → `IS_MOCK_MODE`.

* `IS_MOCK_MODE = (VITE_USE_MOCK_DATA === "true") && !import.meta.env.PROD`.
* **Forced `false` in any production build**, even if the flag is set.

Two gates consume it:

* **`data/mock/index.ts`** wraps every business array in `gate()` → real demo
  data in mock mode, **empty array** in live/production mode.
* **Inline literals in `App.tsx`** use `demoNum()` / `demoStr()` helpers → real
  sample value in mock mode, `0` / `""` (or neutral placeholder) in production.

Screens then render their existing empty states, plus new reusable
`ProductionEmptyState` / `ApiUnavailableState` components.

---

## Findings & fixes

| File | Demo/mock data found | Visibility | Fix applied |
|------|----------------------|-----------|-------------|
| `frontend/src/data/mock/company.mock.ts` | `COMPANIES` (5 fake poultry companies), `REVENUE_DATA`, `STATUS_PIE`, `PAYMENTS_DATA`, `AUDIT_LOGS`, `PLANS_DATA`, `RECENT_ACTIVITY` | Production-visible (via barrel) | Raw data kept for dev; **gated to empty** in `data/mock/index.ts`. `ALL_MODULES` (config) kept. |
| `frontend/src/data/mock/{products,customers,suppliers,sales,purchases,reports,notifications,inventory,expenses,payments,tax,users}.mock.ts` | `T_*` / `S_*` tenant demo arrays | Production-visible (via barrel) | **Gated to empty** in `data/mock/index.ts`. |
| `frontend/src/data/mock/index.ts` | Re-exported all of the above ungated (`export *`) | Production-visible | Rewritten: business arrays pass through `gate(IS_MOCK_MODE)`; empty in production. |
| `frontend/src/services/index.ts` | Statically re-exported mock service impls | Live mode would still return mock | Branches on `IS_MOCK_MODE`: live mode returns empty lists / throws `ApiUnavailableError`; never demo data. |
| `frontend/src/app/App.tsx` — Super Admin dashboard | Hardcoded KPIs `5/3/1/1/24`, money `17,800 / 14,800 / 6,900`, overdue `2`; charts/lists/activity bound to demo arrays | Production-visible | KPIs **derived** from (gated) `COMPANIES`; charts/renewals/activity get empty states; production notice banner when no data. |
| `frontend/src/app/App.tsx` — Login hero | Fake stat tiles `5+` companies / `3` plans | Production-visible | Replaced with non-numeric brand labels (no fake counts). |
| `frontend/src/app/App.tsx` — Tenant dashboard | Inline `todaySales=18450`, `todayPurchases=11200`, `todayExpenses=850`; monthly `425,000/298,000/34,000/93,000`; cashier `3`; VAT `2,975/850/2,125`; expense breakdown `350/300/120/80` | Production-visible | Wrapped in `demoNum()` → `0` in production. |
| `frontend/src/app/App.tsx` — Settings company profile | Prefilled `شركة الوطنية للدواجن`, `Al Wataniyah …`, TRN `100345678901203`, address, phone | Production-visible | Wrapped in `demoStr()` → empty in production. |
| `frontend/src/app/App.tsx` — Invoice-template preview | Fake company header + bill-to `مطعم الخليج`, TRN, invoice `INV-2025-0086`, date | Production-visible | Wrapped in `demoStr()` → neutral placeholders / empty in production. |
| `frontend/src/app/App.tsx` — `CompanyDetailScreen`, `TenantApp` | `COMPANIES[0]` fallback would crash on empty list | Production crash risk | Guarded: render empty state when no company. |
| `frontend/src/services/mock/*.mock.ts` | Import raw demo arrays from `@/data/mock/<file>` | Dev-only (mock layer) | Left as-is (dev mock layer); neutralised in live mode by `services/index.ts`. |
| `frontend/src/services/api/client.ts` | `useMock` flag handling | n/a | Now derives from `IS_MOCK_MODE`; exposes `ApiUnavailableError`. |

> Note: the raw demo literals still exist in `data/mock/*.ts` (and are therefore
> present in the JS bundle) but are **never rendered** in production because the
> gate evaluates to empty at runtime. Keeping them lets local dev keep a fully
> populated UI.

---

## Verification

* `bash scripts/check_no_production_mock_data.sh` — static guard, passes.
* `corepack pnpm run typecheck` and `corepack pnpm run build` — pass.
* `python manage.py check` + `pytest` — 164 passing.

## Known limitations / follow-ups

* App.tsx still reads from the gated `@/data/mock` barrel rather than calling the
  live service layer; the real REST client is not implemented yet. In production
  this yields empty states (correct) but not yet live data. Wiring screens to the
  backend APIs is the next integration step.
* Some deep tenant sub-screens (e.g. quotations/sales sample documents) may still
  contain template scaffolding numbers; these are gated where visible as identity,
  and will be replaced when those modules are wired to live APIs.
