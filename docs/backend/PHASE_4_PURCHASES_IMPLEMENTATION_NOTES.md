# Phase 4 — Purchase Invoices + Production Data Hygiene (implementation notes)

Status: ✅ DONE. 158 tests passing (127 prior + 31 new). OpenAPI schema generates.
Deploy scripts pass `bash -n`. Frontend typecheck + build pass.

## App created

`apps.purchases` (registered in `config/settings/base.py` `LOCAL_APPS` and mounted
at `/api/v1/tenant/` in `config/urls.py`). Tenant-owned models, services-first,
DRF viewset + serializers — consistent with products/suppliers/inventory.

## Models created (`apps/purchases/models.py`)

- **PurchaseInvoice** — header. Statuses `draft / approved / partially_paid / paid /
  cancelled`; payment statuses `unpaid / partially_paid / paid`; payment methods
  `cash / bank_transfer / cheque / credit / other`. Money fields: `subtotal`,
  `adjustment_total` (net payable impact; deductions are negative), `taxable_amount`,
  `vat_rate`, `vat_amount`, `total_amount`, `amount_paid`, `balance_due`, and a
  **separate** `inventory_cost_total` (FIFO cost basis). Supplier name/TRN snapshots,
  approval/cancel reason + actor + timestamp, created/updated by.
  - Constraints: unique `(company, invoice_number)`; partial unique
    `(company, supplier, supplier_invoice_number)` when supplier number is non-blank.
  - Indexes: `(company, supplier)`, `(company, status)`, `(company, invoice_date)`,
    `(company, payment_status)`.
- **PurchaseInvoiceLine** — product/by-product/service/other line. Quantities
  (cartons/pieces/kg), `unit_price` + `price_type`, computed `line_subtotal`,
  `vat_amount`, `line_total`, and `unit_cost_per_kg` (set at approval). Product name/SKU
  snapshots.
- **PurchaseAdjustment** — `adjustment_type` (supplier_deduction, add_to_inventory_cost,
  normal_expense_later, commercial_discount, transport_cost, slaughter_cost,
  loading_unloading, other) + `effect` (reduce_supplier_payable, increase_inventory_cost,
  expense_only_later, no_financial_effect). Non-negative `amount`, optional VAT.
- **PurchaseAttachment** — supplier invoice / delivery note / receipt upload
  (`FileField`, local media for prototype).
- **PurchaseStatusHistory** — append-style status trail (audit log also covers this).

Precision: cartons/pieces `(14,2)`, kg `(14,3)`, unit_price `(12,2)`,
unit_cost_per_kg `(12,4)`, money `(16,2)`, vat_rate `(5,2)`.

## Calculations (`apps/purchases/calculations.py`)

Pure, DB-free helpers: `line_subtotal` (kg/piece/carton; **tray simplified to a
pieces basis — documented limitation**), `vat_amount = taxable × rate / 100`,
`unit_cost_per_kg` (allocated cost ÷ kg, 0 when kg not meaningful), and
`allocate_inventory_cost` (spreads `increase_inventory_cost` adjustments across product
lines proportionally by subtotal).

**Supplier payable and inventory cost basis are kept distinct and never mixed.**

## Services created (`apps/purchases/services.py`)

- `create_purchase_invoice(...)` — creates a DRAFT invoice + lines + adjustments,
  generates the invoice number, recalculates totals. **No stock, no supplier ledger.**
- `recalculate_purchase_invoice(invoice)` — recomputes line totals, adjustment totals,
  VAT, total, balance due, payment status. VAT uses the header `vat_rate` when set,
  else the sum of per-line VAT.
- `approve_purchase_invoice(invoice, user, reason)` — requires reason; draft-only;
  atomic + row-locked. Allocates inventory-cost adjustments, calls inventory
  `add_stock(source_type=purchase_invoice, source_id=invoice.id,
  source_reference=invoice_number, unit_cost_per_kg=...)` for each stock-tracked line,
  posts a supplier payable ledger entry for the **gross** `total_amount`, sets
  approved_by/at, writes an audit log + status history. Idempotent (approving twice is
  blocked).
- `cancel_purchase_invoice(invoice, user, reason)` — requires reason; atomic. Reverses
  inventory via `inventory.reverse_source_layers` (only if every FIFO layer from this
  purchase is still fully intact) and reverses the supplier payable (new debit entry,
  original entry kept). If any layer was already consumed it raises:
  _"Cannot cancel purchase because stock from this purchase has already been consumed."_
  Idempotent (cancelling twice is blocked).
- `create_purchase_attachment(...)`, `get_purchase_summary(company)`,
  `get_supplier_purchase_history(company, supplier)`.

### Inventory integration

Only the inventory service layer is used. New inventory service:
`reverse_source_layers(company, source_type, source_id, ...)` depletes the layers
created by a source and posts an outbound `purchase_cancelled` movement, raising
`StockConsumedError` when reversal is unsafe. The purchases app never edits
`InventoryBalance` / `FIFOStockLayer` directly.

### Supplier ledger behavior

`suppliers.services.record_purchase_invoice` posts `entry_type=purchase_invoice`,
`credit=total_amount`, `reference_type=purchase_invoice`, updating
`supplier.current_balance` (positive = we owe the supplier).
`reverse_purchase_invoice` posts `entry_type=purchase_cancellation`,
`debit=total_amount`.

**Payment ledger limitation:** approval always posts the gross payable. `amount_paid`
is stored on the invoice but the matching supplier-payment ledger entry is deferred to
the payments phase. So a cash purchase shows the gross payable on the supplier balance
until payments are implemented.

## Endpoints (`/api/v1/tenant/`)

- `GET/POST /purchases/`, `GET/PATCH /purchases/{id}/` (PATCH draft-only)
- `POST /purchases/{id}/approve/`, `POST /purchases/{id}/cancel/`
- `GET /purchases/summary/`
- `GET/POST /purchases/{id}/lines/`, `PATCH/DELETE /purchases/{id}/lines/{line_id}/`
- `GET/POST /purchases/{id}/adjustments/`, `PATCH/DELETE /purchases/{id}/adjustments/{id}/`
- `GET/POST /purchases/{id}/attachments/`
- `GET /suppliers/{supplier_id}/purchases/`

Filters: `supplier`, `status`, `payment_status`, `date_from`, `date_to`,
`supplier_invoice_number`, `search`, `has_balance`, `vat_enabled`.

## Permissions added

`purchases.view / create / edit / approve / cancel / print / export /
upload_attachment / view_cost / manage_adjustments / override_price`.
Role defaults: Owner/Admin = all. Accountant = view/create/edit/approve/print/export/
upload_attachment/view_cost/manage_adjustments (**not** cancel / override_price).
Cashier/Sales = none.

## Audit / sensitive actions

Added to `apps/audit/constants.py`: `approve_purchase_invoice` (medium),
`override_purchase_price` (high), `purchase_adjustment_change` (medium),
`vat_change_on_purchase` (high). Already present: `cancel_purchase_invoice`,
`edit_purchase_price`. Attachment uploads are recorded via `supplier_invoice_upload`
(non-reason-required). Approval + cancellation require a reason.

## Numbering

`apps/company_settings/services.generate_document_number(company, document_type)`
atomically increments the per-company `NumberingSettings` counter. Purchase invoices
use `DocumentType.PURCHASE_INVOICE` (default seeded prefix `PINV-`). No hardcoded
numbers.

## Seed command behavior (opt-in, staging/local only)

`python manage.py seed_purchase_demo --company-subdomain <sub> --confirm-demo-data`.
Prints a warning and refuses without `--confirm-demo-data`; idempotent (keyed on a
`DEMO-PUR-0001` supplier invoice number); never run by migrations or deploy scripts.

## Production data hygiene changes

- Deploy scripts (`scripts/deploy_vps.sh`, `scripts/local_release_deploy.sh`) run only
  check / migrate / collectstatic / build / restart — never demo seeds (asserted by a
  test). A comment in `deploy_vps.sh` documents the rule.
- All demo seed commands now require `--confirm-demo-data` and print a warning:
  `seed_initial --demo`, `seed_product_foundation`, `seed_customer_supplier_demo`,
  `seed_inventory_demo`, `seed_purchase_demo` (shared guard in
  `apps/core/management/demo_guard.py`).
- `backend/.env.production.example` adds `ENVIRONMENT=production` and
  `ENABLE_DEMO_DATA=False`. New `frontend/.env.production.example` sets
  `VITE_API_BASE=https://poultryhero.solutions/api` and `VITE_USE_MOCK_DATA=false`.
- Frontend `services/api/client.ts` `useMock` is now driven by `VITE_USE_MOCK_DATA`
  and **defaults to false** in production; a console warning is emitted in live-API
  mode so mock data is never silently presented as real.

## Tests added (`backend/tests/test_purchases.py`, 31)

Creation (no side effects, subtotal by kg/piece/carton, cross-tenant supplier/product
rejection, duplicate supplier invoice number), approval (reason required, layer +
movement + supplier ledger + balance + audit, twice blocked, no-lines blocked),
adjustments (payable deduction, inventory-cost raises unit cost, negative rejected),
cancellation (reason required, reverses ledger + inventory, blocked when consumed,
audited, twice blocked), API/permissions (owner full, accountant approve-not-cancel,
negative qty rejected, stock-tracked requires qty, cashier 403, cross-tenant 404,
summary gating), and production data-hygiene checks.

## Limitations / follow-ups

- **Supplier payment ledger** not implemented (payments phase). Approval posts gross
  payable; `amount_paid` is stored only on the invoice.
- **Tray pricing** simplified to a pieces basis (no dedicated tray quantity yet).
- **Frontend API integration** is not done in this phase. Screens still render mock
  data from `services/mock/*` regardless of `useMock`. Recommended follow-up:
  _"Frontend API integration and mock-data removal from production UI."_
- Purchase returns / tax credit notes are out of scope.

## Recommended next phase

Sales Invoices with approval, inventory FIFO deduction, customer balance updates,
credit-limit checks, collection adjustment foundation, cancellation stock return, and
invoice print API foundation.
