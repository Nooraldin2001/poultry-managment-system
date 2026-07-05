# Tax Module Audit — First View Production Fix

**Date:** 2026-07-05  
**Tenant:** `firstview` (`https://firstview.poultryhero.solutions`)

## Root cause

1. **Missing date filters:** `TaxDashboardScreen` called `GET /api/v1/tenant/tax/summary/` without `date_from` / `date_to`. Backend `_date_params()` returns HTTP 400: `"date_from and date_to are required."`
2. **Wrong response field mapping:** `taxService.getTaxSummaryLive()` expected `output_vat` / `input_vat` but API returns `sales_vat`, `purchase_vat`, `expense_vat`, `open_warnings_count`.
3. **Report row mapping:** Sales/purchase VAT screens read `data.rows` but API returns `data.records` with different field names (`invoice_number`, `customer_name`, etc.).
4. **Mock/demo leakage in live mode:** Hardcoded KPIs (`86` invoices, `21250` AED), `VAT_TREND` chart, and June 2025 date defaults shown even when `VITE_USE_MOCK_DATA=false`.

## Fix (frontend)

- Added `frontend/src/shared/utils/dateRanges.ts` → `getDefaultTaxDateRange()` (current calendar month).
- `taxService.ts`: `withTaxDateRange()` auto-merges defaults; corrected summary mapping; added `mapSalesVatRecords` / `mapPurchaseVatRecords`.
- `TaxModule.tsx`: dashboard + sales/purchase/net screens use shared date filters, live API totals, mock-only charts/KPIs gated by `IS_MOCK_MODE`.

## Backend audit

- Date filters required on summary, sales/purchase/expense/net VAT, export payload, disabled VAT docs — returns structured DRF 400.
- Empty tenant returns zero tax summary (test added).
- Tenant isolation, draft/cancelled exclusion, quotation exclusion — existing tests pass.
- VAT disabled / missing TRN → warnings, not module crash.

## Tests added

- `test_tax_summary_requires_date_filters`
- `test_tax_summary_empty_tenant_returns_zeros`
- `test_sales_vat_requires_date_filters`
- `test_no_vat_purchase_has_zero_input_vat_in_tax_bridge` (Phase 9)

## Purchase no-VAT behavior (Phase 9)

- Purchase with header `vat_rate=0` and line `vat_rate=0` → `vat_amount=0`, `total=subtotal`.
- Tax bridge `input_vat` remains 0 for no-VAT approved purchases.
- No supplier TRN required when VAT is off.

## Production verification (pending deploy)

After `git pull` + `deploy_vps.sh` on VPS:

1. Open **الضريبة** — no raw `date_from and date_to are required` error.
2. Default period = current month; change dates → refetch.
3. Empty tenant → zeros / empty warnings list.
4. Network: same-origin `https://firstview.poultryhero.solutions/api/v1/tenant/tax/summary/?date_from=...&date_to=...`

## Remaining blockers

- **Deploy required** — production bundle last modified before this fix (`2026-07-05 07:26 UTC`).
- Tax export preview still uses mock PDF flow; live `getTaxExportPayload` wired in service but export UI not fully connected.
- Multi-month trend chart not available in live mode (by design until backend trend API exists).
