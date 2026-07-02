# Phase 9 — Tax / VAT (implementation notes)

Status: ✅ DONE. 324 tests passing (288 prior + 36 new). No production demo seed.

## App created

`apps.tax` at `/api/v1/tenant/tax/`.

## Models

- **TaxPeriod** — optional reporting period (open/reviewed/closed).
- **TaxWarning** — compliance warnings (TRN, VAT disabled, mismatch, cancelled docs).
- **TaxAdjustment** — manual VAT adjustment foundation.

`TaxReportSnapshot` skipped (export payload is computed on demand).

## Services

`get_sales_vat_report`, `get_purchase_vat_report`, `get_expense_vat_report`,
`get_net_vat_estimate`, `get_tax_summary`, `generate_tax_warnings`,
`dismiss_tax_warning`, `resolve_tax_warning`, `create_tax_adjustment`,
`cancel_tax_adjustment`, `build_tax_export_payload`, `get_disabled_vat_documents`,
`get_tax_audit_entries`, `review_tax_period`, `close_tax_period`.

## Sales VAT behavior

Approved/partially_paid/paid sales only. Draft/cancelled excluded from totals.
Cancelled count reported separately. Quotations never included.

## Purchase VAT behavior

Approved/partially_paid/paid purchases only. Draft/cancelled excluded.

## Expense VAT behavior

Posted expenses only. Purchase-linked payable/cost expenses excluded (same as Phase 8).
Cancelled excluded.

## Net VAT behavior

`output_vat = sales VAT + output adjustments`
`input_vat = purchase VAT + expense VAT + input adjustments`
`net_vat = output_vat - input_vat` → payable/recoverable/zero status.
Disclaimer: internal estimate, not official filing.

## Warning behavior

Idempotent open-warning upsert per company/type/source. Dismiss requires reason + audit.
TRN missing, VAT disabled, VAT mismatch, cancelled docs, print template checks.

## Adjustment behavior

`TAX-` numbering via `DocumentType.TAX_ADJUSTMENT`. Posted adjustments affect net VAT.
Cancellation requires reason. Blocked in closed tax periods.

## Export payload behavior

Structured JSON with metadata, company, date range, report data, warnings summary.
Audited on export when user provided.

## Seed command behavior

No demo seed. Reports calculated from real transactional data only.

## Limitations

- No FTA submission, e-invoicing, PDF/Excel file generation.
- Tax credit notes placeholder only (future).
- Closed period does not lock source invoices.
- VAT mismatch tolerance: 0.01 AED.

## Next recommended phase

Phase 10 — Reports and Analytics (dashboard summaries, profit, statements, export APIs).
