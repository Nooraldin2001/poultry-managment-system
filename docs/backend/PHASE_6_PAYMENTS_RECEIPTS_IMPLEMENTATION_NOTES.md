# Phase 6 — Payments and Receipts (implementation notes)

Status: ✅ DONE. 219 tests passing (197 prior + 22 new). OpenAPI schema generates.
No production demo seed added.

## App created

`apps.payments` registered in `config/settings/base.py` and mounted at
`/api/v1/tenant/` in `config/urls.py`.

## Models created

- **PaymentMovement** — unified record for collections, payments, refunds.
  Statuses `posted / cancelled`. Party type `customer / supplier`.
- **PaymentAllocation** — links movement to sales/purchase invoice or account level.
- **PaymentStatusHistory** — append-only status trail.

Print snapshots are built dynamically (no `ReceiptPrintSnapshot` model).

## Services created (`apps/payments/services.py`)

- `record_customer_collection` — ledger credit + optional invoice allocations.
- `record_supplier_payment` — ledger debit + optional purchase allocations.
- `record_customer_refund` — ledger debit (reason required); blocks invalid balances.
- `record_supplier_refund` — ledger credit (reason required).
- `cancel_payment_movement` — reverses ledger + invoice allocations (reason required).
- `build_receipt_preview` — structured JSON for print templates.
- `get_payment_summary`, `reconcile_customer_balance`, `reconcile_supplier_balance`.

Ledger helpers added to `apps/customers/services.py` and `apps/suppliers/services.py`.

## Customer collection behavior

Collection creates `CustomerLedgerEntry` (`entry_type=collection`, credit=amount).
Reduces `customer.current_balance`. Optional allocations increase
`sales_invoice.amount_paid` and recalculate `balance_due`, `payment_status`, and
workflow `status` (partially_paid / paid). Unallocated portion remains account credit.

## Supplier payment behavior

Payment creates `SupplierLedgerEntry` (`entry_type=supplier_payment`, debit=amount).
Reduces supplier payable (`current_balance` = Σcredit − Σdebit). Purchase invoice
allocation logic mirrors sales.

## Refund behavior

- **Customer refund:** debit ledger entry (`customer_refund`). Allowed when customer
  has credit balance (negative `current_balance`) or zero; blocked when customer owes
  us unless `allow_override` + `payments.sensitive`.
- **Supplier refund:** credit ledger entry (`supplier_refund`). Blocks when refund
  exceeds payable unless override.

## Cancellation/reversal behavior

Cancellation requires reason. Reverses ledger via opposite `manual_adjustment` entry.
Reverses each `PaymentAllocation` (reduces invoice `amount_paid`). Movement marked
`cancelled`; history and allocations retained.

## Receipt numbering

Uses `NumberingSettings` via `generate_document_number`:
- Collections → `customer_receipt` (`REC-YYYY-#####`)
- Supplier payments → `supplier_payment_receipt` (`PAY-`)
- Customer refunds → `customer_refund` (`REF-C-`)
- Supplier refunds → `supplier_refund` (`REF-S-`)

Default prefixes updated in `apps/tenants/services.py` for new tenants.

## Print preview behavior

`GET .../print-preview/` and `GET /receipts/{id}/print-preview/` return bilingual
titles, company/party info, amount, method, allocations. No PDF yet.

## Reconciliation behavior

Compares cached `current_balance` vs ledger-derived balance. Reports open invoice
balances and `matched` / `mismatch` status. Does not auto-fix.

## Endpoints

| Path | Method | Permission |
|------|--------|------------|
| `/payments/summary/` | GET | `payments.view` |
| `/payments/movements/` | GET | `payments.view` |
| `/payments/movements/{id}/` | GET | `payments.view` |
| `/payments/movements/{id}/cancel/` | POST | `payments.cancel` |
| `/payments/movements/{id}/print-preview/` | GET | `payments.print` |
| `/payments/customer-collections/` | POST | `payments.create_customer_collection` |
| `/payments/supplier-payments/` | POST | `payments.create_supplier_payment` |
| `/payments/customer-refunds/` | POST | `payments.create_customer_refund` |
| `/payments/supplier-refunds/` | POST | `payments.create_supplier_refund` |
| `/customers/{id}/collections/` | GET | `payments.view` |
| `/suppliers/{id}/payments/` | GET | `payments.view` |
| `/payments/reconciliation/customers/{id}/` | GET | `payments.reconcile` |
| `/payments/reconciliation/suppliers/{id}/` | GET | `payments.reconcile` |
| `/receipts/` | GET | `receipts.view` |
| `/receipts/{id}/` | GET | `receipts.view` |
| `/receipts/{id}/print-preview/` | GET | `receipts.print` |

## Permissions added

`payments.create_customer_collection`, `create_supplier_payment`, `create_customer_refund`,
`create_supplier_refund`, `allocate`, `export`, `reconcile`, plus `receipts.view`,
`receipts.print`. Cashier: collection + receipts only. Accountant: create/reconcile,
no cancel by default.

## Tests

`backend/tests/test_payments.py` — 22 tests covering collections, payments, refunds,
cancellation, print preview, reconciliation, permissions, tenant isolation.

## Production data hygiene

No payment demo seed. `purge_demo_data` deletes payment models first.

## Limitations / deferred

- Payment gateway / card payments
- Bank reconciliation import
- Full double-entry GL
- PDF rendering
- Expenses, tax reports, full reports module
- Post-posting allocation edits (blocked; cancel and re-post)

## Next recommended phase

Phase 8 — Quotations (or Phase 7 Expenses per roadmap).
