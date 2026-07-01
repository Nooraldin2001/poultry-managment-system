# Phase 5 — Sales Invoices (implementation notes)

Status: ✅ DONE. 197 tests passing (164 prior + 33 new). OpenAPI schema generates
(same pre-existing spectacular warnings as prior phases). No production demo seed added.

## App created

`apps.sales` registered in `config/settings/base.py` `LOCAL_APPS` and mounted at
`/api/v1/tenant/` in `config/urls.py`. Services-first design consistent with
`apps.purchases` and `apps.inventory`.

## Models created (`apps/sales/models.py`)

- **SalesInvoice** — header with statuses `draft / approved / partially_paid / paid /
  cancelled`; payment statuses `unpaid / partially_paid / paid`; payment methods
  `cash / bank_transfer / cheque / credit / other`. Money fields: `subtotal`,
  `discount_total`, `taxable_amount`, `vat_rate`, `vat_amount`, `total_amount`,
  `amount_paid`, `balance_due`, `fifo_cost_total`, `gross_profit`, and
  `posted_receivable` (ledger amount posted on approval for cancellation reversal).
  Customer snapshots, credit-limit snapshot + override flags, approval/cancel audit
  fields.
- **SalesInvoiceLine** — product/by-product/service/other; quantities; `unit_price` +
  `price_type`; `price_source` (default_product_price, customer_special_price,
  manual_override, free_product); FIFO cost + gross profit per line after approval.
- **SalesInvoiceAdjustment** — draft invoice discounts or post-approval collection
  adjustment foundation (`collection_adjustment`, `commercial_discount`, etc.).
- **SalesStatusHistory** — append-only status trail.
- **SalesInventoryAllocation** — FIFO layer consumption trace per line (profit +
  cancellation stock return).

## Calculations (`apps/sales/calculations.py`)

`line_subtotal` (kg/piece/carton; tray simplified to pieces basis), `vat_amount`,
`gross_profit = revenue − fifo_cost` (never uses product default purchase price).

## Services created (`apps/sales/services.py`)

- `create_sales_invoice(...)` — draft only; applies special prices / free-product rules;
  **no stock, no customer ledger.**
- `recalculate_sales_invoice(invoice)` — line + header totals, VAT, payment state.
- `approve_sales_invoice(invoice, user, reason, credit_override=None)` — FIFO consumption
  via `inventory.consume_stock_fifo_detailed`, `SalesInventoryAllocation` records,
  customer ledger debit for **unpaid `balance_due` only**, credit-limit validation +
  optional override (`sales.credit_override` + reason), gross profit from FIFO cost.
- `cancel_sales_invoice(invoice, user, reason)` — returns stock per allocation via
  `inventory.add_stock` (`sales_cancelled` movement), reverses `posted_receivable`,
  audit + status history. Draft cancel is safe (no stock/ledger).
- `create_collection_adjustment(...)` — reduces customer balance only; does not edit lines.
- `get_sales_summary`, `get_customer_sales_history`, `build_print_preview`,
  `price_preview`, `check_stock_availability`, `resolve_line_pricing`.

### Inventory FIFO deduction

On approval, each stock-tracked line calls `consume_stock_fifo_detailed` with
`reference_type=sales_invoice`, `movement_type=sales_approved`. Layer allocations are
stored in `SalesInventoryAllocation`. On cancellation, stock is returned via `add_stock`
with original `unit_cost_per_kg` where possible (`source_type=sales_invoice`).

### Customer ledger behavior

On approval: `CustomerLedgerEntry` with `entry_type=sales_invoice`, **debit =
`balance_due`** (unpaid portion). `amount_paid` is stored on the invoice for the future
payments module; full collection receipts are **not** implemented in this phase.

On cancellation: credit via `entry_type=sales_return` for `posted_receivable`. Original
entries are never deleted.

### Credit limit behavior

For credit customers with `block_sales_when_credit_exceeded`, approval blocks when
`current_balance + balance_due > credit_limit`. Override requires `sales.credit_override`,
reason, and records `credit_limit_snapshot` + `CustomerCreditLimitChange`
(`TEMPORARY_FOR_INVOICE`). Cash customers must have `amount_paid >= total_amount` at
approval.

### Collection adjustment foundation

Post-approval `create_collection_adjustment` creates `SalesInvoiceAdjustment` +
`CustomerLedgerEntry` (`collection_discount` credit). Invoice lines and inventory are
unchanged.

### Print preview API

`GET /api/v1/tenant/sales/{id}/print-preview/` returns structured JSON (company, customer,
lines, totals, bilingual title). No PDF rendering yet.

## Endpoints created

Base: `/api/v1/tenant/sales/`

| Endpoint | Methods | Permission highlights |
|----------|---------|----------------------|
| `/sales/` | GET, POST | `sales.view`, `sales.create` |
| `/sales/{id}/` | GET, PATCH | draft-only PATCH |
| `/sales/{id}/approve/` | POST | `sales.approve`, `{reason, credit_override?}` |
| `/sales/{id}/cancel/` | POST | `sales.cancel`, `{reason}` |
| `/sales/{id}/collection-adjustment/` | POST | `sales.collection_adjustment` |
| `/sales/summary/` | GET | `sales.view` (profit hidden without `sales.view_profit`) |
| `/sales/{id}/print-preview/` | GET | `sales.print` |
| `/sales/price-preview/` | GET | `customer`, `product`, `price_type` query params |
| `/sales/stock-check/` | GET | `product`, optional qty params |
| `/sales/{id}/lines/` | GET, POST | draft-only write |
| `/sales/{id}/adjustments/` | GET, POST | draft discounts |
| `/customers/{id}/sales/` | GET | customer sales history |

Cost/profit fields stripped from API responses unless `sales.view_cost` /
`sales.view_profit`.

## Permissions added

`sales.view_cost`, `sales.view_profit`, `sales.override_price`, `sales.override_kg`,
`sales.apply_discount`, `sales.collection_adjustment`, `sales.credit_override`.

Role defaults: Owner/Admin all; Accountant create/edit/approve/print/export/discount/cost/
profit (no cancel/override/credit override by default); Cashier view/create/print only.

## Audit actions

`approve_sales_invoice`, `cancel_sales_invoice`, `override_sales_price`, `free_product_override`,
`credit_limit_override`, `collection_adjustment`, `vat_change_on_sales`, `invoice_discount`.

## Tests added

`backend/tests/test_sales.py` — 33 tests covering draft side effects, line subtotals,
special/free pricing, approval FIFO + ledger + profit + audit, credit limit + override,
cancellation reversal, collection adjustment, print preview, permissions, tenant isolation.

## Production data hygiene

- No automatic sales demo seed in deploy scripts or migrations.
- Optional local seed command **not added** (not required for this phase).
- `purge_demo_data` updated to delete sales models before purchases/inventory.

## Limitations / deferred

- Full customer collections / payment receipts module (Phase 6).
- `amount_paid` on invoice is stored but collection ledger entries are not created until
  payments phase.
- Quotations conversion, sales returns, tax credit notes, PDF generation, expenses, reports.
- Tray price_type uses simplified pieces basis (documented).
- Post-approval invoice discounts must use `collection-adjustment`, not line edits.

## Next recommended phase

Phase 6 — Payments and Receipts: customer collections, supplier payments, refunds, receipt
numbering, payment reversal, balance reconciliation.
