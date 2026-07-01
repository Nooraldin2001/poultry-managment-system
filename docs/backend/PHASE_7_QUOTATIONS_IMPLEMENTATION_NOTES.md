# Phase 7 — Quotations (implementation notes)

Status: ✅ DONE. 246 tests passing (219 prior + 27 new). No production demo seed.

## App created

`apps.quotations` at `/api/v1/tenant/quotations/`.

## Models

- **Quotation** — header with lifecycle statuses draft/sent/accepted/rejected/expired/converted/cancelled.
- **QuotationLine** — product lines with pricing sources (special price, free, manual override).
- **QuotationStatusHistory** — append-only status trail.

`QuotationAttachment` deferred (not needed for this phase).

## Services

`create_quotation`, `recalculate_quotation`, `send_quotation`, `accept_quotation`,
`reject_quotation`, `cancel_quotation`, `expire_quotations`, `convert_quotation_to_sales_draft`,
`build_quotation_print_preview`, `quotation_stock_warning`, `get_quotation_summary`,
`get_customer_quotation_history`, `resolve_quotation_line_pricing`, `price_preview`.

## No-side-effects rule

Quotations never touch inventory, customer ledger, or payments at any status.
Stock warning is informational only.

## Conversion behavior

`convert_quotation_to_sales_draft` allowed from **sent** or **accepted** only.
Creates `SalesInvoice` draft via `sales.create_sales_invoice(preserve_pricing=True)` copying
quotation line prices without re-resolving. Links `quotation.converted_sales_invoice`.
Idempotent (double conversion blocked).

## Print preview

Bilingual QUOTATION / عرض سعر with explicit “not a tax invoice” notice. JSON only, no PDF.

## Stock warning

`GET .../stock-warning/` compares line quantities to `InventoryBalance` without reserving stock.

## Expiry

`expire_quotations` marks **draft** and **sent** past `valid_until` as expired.
`POST .../expire-overdue/` for manual/scheduled use.

## Numbering

`QUO-YYYY-#####` via `DocumentType.QUOTATION` (prefix updated for new tenants).

## Permissions

`quotations.send`, `accept`, `reject`, `convert_to_sales`, `export`, `override_price`,
`free_product_override`. Cashier: view/create/send/print only (no convert/cancel/override).

## Tests

27 tests in `backend/tests/test_quotations.py`.

## Limitations

- No PDF, WhatsApp/email send, attachments
- Draft-only edits (sent cannot be patched)
- Accepted quotations do not auto-expire (conservative)
- Background expiry job not scheduled (endpoint/command foundation only)

## Next phase

Expenses Management (daily/monthly/recurring, purchase-linked, cancellation, vouchers).
