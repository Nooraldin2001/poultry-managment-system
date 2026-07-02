# Phase 10 — Reports & Analytics (implementation notes)

Status: ✅ DONE. 354 tests passing (324 prior + 30 new). No production demo seed.

## App created

`apps.reports` at `/api/v1/tenant/reports/`.

## Models

`ReportSnapshot` **skipped** — export payloads are computed on demand; snapshot persistence deferred to a future phase.

## Services

- `get_dashboard_summary` — KPI cards + sales trend for date range (default: current month).
- `get_sales_report` — invoice rows, totals, breakdowns (customer/product/payment/date).
- `get_purchase_report` — purchase rows, totals, breakdowns.
- `get_inventory_report` — balances, FIFO value, low/out-of-stock, chart status.
- `get_inventory_movement_report` — movement rows, inbound/outbound totals.
- `get_customer_statement` — opening/closing balance, ledger, open invoices, aging.
- `get_supplier_statement` — same for suppliers (credit − debit convention).
- `get_customers_aging_report` / `get_suppliers_aging_report` — company-wide aging.
- `get_payments_report` — collections, payments, refunds, net cash.
- `get_expenses_report` — posted operational expenses + category chart data.
- `get_profit_report` — FIFO gross profit, net profit foundation, margins, by-day/customer/product.
- `get_tax_summary_bridge` — delegates to `apps.tax` net VAT estimate when available.
- `build_export_payload` — structured JSON for CSV/Excel generation later.

## Endpoints

| Path | Permission |
| --- | --- |
| `GET /reports/dashboard/` | `reports.view_dashboard` |
| `GET /reports/sales/` | `reports.view_sales` |
| `GET /reports/purchases/` | `reports.view_purchases` |
| `GET /reports/inventory/` | `reports.view_inventory` |
| `GET /reports/inventory-valuation/` | `reports.view_inventory_valuation` (audited) |
| `GET /reports/inventory-movements/` | `reports.view_inventory` |
| `GET /reports/customers/{id}/statement/` | `reports.view_customer_statement` |
| `GET /reports/customers/aging/` | `reports.view_customer_statement` |
| `GET /reports/suppliers/{id}/statement/` | `reports.view_supplier_statement` |
| `GET /reports/suppliers/aging/` | `reports.view_supplier_statement` |
| `GET /reports/payments/` | `reports.view_payments` |
| `GET /reports/expenses/` | `reports.view_expenses` |
| `GET /reports/profit/` | `reports.view_profit` (audited) |
| `GET /reports/tax-summary/` | `reports.view_tax_summary` (audited when available) |
| `GET /reports/export-payload/` | `reports.export` (audited) |

Common query params: `date_from`, `date_to`, `customer`, `supplier`, `product`, `category`,
`payment_status`, `status`, `payment_method`, `movement_type`, `expense_scope`,
`include_cancelled`, `include_drafts`, `group_by`.

## Permissions added

Granular codes via `EXTRA_PERMISSIONS`: `reports.view_dashboard`, `.view_sales`,
`.view_purchases`, `.view_inventory`, `.view_inventory_valuation`, `.view_customer_statement`,
`.view_supplier_statement`, `.view_payments`, `.view_expenses`, `.view_profit`,
`.view_tax_summary`, `.save_snapshot`, `.view_audit` (plus existing `reports.export`).

**Role defaults:**
- Owner/Admin — all report permissions.
- Accountant — all except `reports.save_snapshot`.
- Cashier/Sales — `reports.view_dashboard`, `reports.view_sales` only.

## Dashboard behavior

Current-month default range. Financial totals from approved/partially_paid/paid sales and
purchases; drafts and cancelled excluded. Quotations counted as open pipeline only.
Empty tenant returns zeros and empty trend arrays.

## Sales / purchase report behavior

Operational invoices only by default. Totals include VAT, paid, balance, FIFO cost, gross profit
(sales). Breakdowns by customer/supplier, payment status, date, and product (sales lines).

## Inventory report behavior

Live balances + per-product FIFO value from remaining layers. Low/out-of-stock from
`stock_status`. Movement report groups inbound/outbound kg/cartons/pieces and FIFO cost consumed.

## Customer / supplier statement behavior

Ledger convention: customer balance = debit − credit; supplier balance = credit − debit.
Period opening from entries before `date_from`. Aging buckets on open invoice `due_date`.
Cross-tenant party IDs rejected (404 on API, ValidationError in service).

## Payments / expenses report behavior

Posted payment movements only (cancelled excluded by default). Expenses: posted operational
expenses (purchase-linked payable/cost adjustments excluded, same as Phase 8).

## Tax bridge behavior

Calls `apps.tax.services.get_net_vat_estimate` and open warning count. Returns
`available: false` with message if tax app unavailable.

## Profit report behavior

Gross profit from approved sales `gross_profit` / FIFO cost. Net profit foundation =
gross profit − posted operational expenses. Quotations excluded. Margin % safe-divides by zero.

## Export payload behavior

JSON only (no PDF/Excel). Includes metadata, company info, filters, nested report data.
Creates `report_export` audit log when `user` is passed.

## Production data hygiene

No report demo seed. No automatic production data. Reports compute from real tenant
transactions only; empty production tenant shows zeros/empty arrays.

## Tests added

`backend/tests/test_reports.py` — 30 tests covering dashboard, sales/purchases, inventory,
statements, aging, payments, expenses, profit, tax bridge, export audit, permissions,
cross-tenant isolation.

## Limitations

- No PDF/Excel file generation, scheduled email, or snapshot persistence.
- No background pre-aggregation; large tenants may need pagination/caching later.
- Stock age summary from FIFO layers not implemented (deferred).
- `reports.view` legacy code retained for backward compatibility; granular codes preferred.

## Next recommended phase

Phase 11 — Frontend API integration (auth, tenant context, live dashboard, empty states).
