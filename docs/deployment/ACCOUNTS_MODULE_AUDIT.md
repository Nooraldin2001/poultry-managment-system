# Accounts / Statements Module Audit

**Date:** 2026-07-05  
**Tenant context:** Production multi-tenant (`firstview.poultryhero.solutions`)

## Root cause — infinite loading / blank statement

1. **React Rules of Hooks violation** in `CustomerStatementScreen` and `SupplierStatementScreen`: `useState` for date filters ran **after** early returns (`loading`, `forbidden`). When loading transitioned from `true` → `false`, hook order changed → runtime failure / stuck UI.
2. **Statements center did not pass party IDs**: `StatementsScreen` navigated to statement routes without setting `selectedCustomerId` / `selectedSupplierId` in `App.tsx`. Live mode opened statement with empty ID.
3. **Mock-only statement tables** in live mode (`STMT_MOVEMENTS`, `SUPP_STMT`) instead of report API.
4. **Ledger mapper bug**: `getCustomerLedger` / `getSupplierLedger` read `balance` instead of API field `balance_after`.

## Fix

| Area | Change |
|---|---|
| Statement screens | All hooks at top; default date range via `getDefaultStatementDateRange()` |
| Live data | `GET /api/v1/tenant/reports/customers/{id}/statement/` and suppliers equivalent |
| Statements center | Pass numeric/string IDs; `onOpenCustomerStatement` / `onOpenSupplierStatement` in `App.tsx` |
| Empty/error states | Loading resolves to data, empty, 403, 404/501, or network error |
| Ledger tabs | Map `balance_after` for profile statement preview |

## API endpoints

- `GET /api/v1/tenant/reports/customers/{id}/statement/?date_from=&date_to=`
- `GET /api/v1/tenant/reports/suppliers/{id}/statement/?date_from=&date_to=`
- `GET /api/v1/tenant/customers/{id}/ledger/` (profile tab preview)

Backend date filters optional (defaults to current month). Existing tests in `tests/test_reports.py`.

## Production verification (pending deploy)

1. Reports → كشوف الحساب → select customer → View Statement → loads or empty state (no spinner forever).
2. Customer profile → Statement tab → ledger rows or empty.
3. Repeat for supplier.
