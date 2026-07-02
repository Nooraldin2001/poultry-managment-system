# Phase 4 — Production UX Polish (Frontend)

## Phase 4A (partial — prior pass)

- Role-based nav filtering and route permission gating
- Settings live: company, VAT, numbering, print templates
- Users list/create/suspend/reactivate
- Product edit (`products-edit`)
- Live payment collection/supplier payment modals
- Sales read-only detail for non-draft
- Partial print preview wiring (sales, purchase, receipt, expense voucher)
- Partial report export filter support

## Phase 4B (completed in this pass)

### Customer / supplier profile tabs
- `useCustomerProfileTabs` + `ProfileTabBody` wired into `CustomerModule`
- Live tabs: invoices, collections, statement, special prices, free products, overview KPIs from API
- Discounts and audit tabs: `ApiUnavailableState` in live mode (no mock rows)
- `useSupplierProfileTabs` wired into `SupplierModule`
- Live tabs: purchases, payments, statement, agreements/special prices
- Deductions and audit: unavailable in live mode
- Live collection/payment modals used from profile when `!IS_MOCK_MODE`

### Permissions UI
- `LiveUserPermissionsScreen` replaces mock permission matrix in live mode
- Loads permission catalog + user overrides; PATCH save with validation errors
- Owner-only gate; self-lockout warning for sensitive permission removal

### Refunds and cancellations
- `LiveCustomerRefundScreen` / `LiveSupplierRefundScreen`
- `payments-supplier-refund` route added in `App.tsx`
- `LiveCancelPaymentModal` for payment movement cancellation with reason
- `LiveExpenseDetailScreen` with cancel + attachments entry

### Attachments
- `attachmentService.ts` (purchase/expense list + multipart upload)
- `DocumentAttachmentsPanel` component

### Dashboard cleanup
- Tenant monthly KPIs use live dashboard summary (zero when absent)
- Chart fallbacks empty in live mode when no `sales_trend`
- Customer/supplier count sub-labels hidden in live mode (no fake counts)

### Report export
- `report_type` query param added to export payload
- Daily report export passes today's date range; live daily screen shows unavailable (no fake KPIs)

### Read-only detail
- Expense live read-only via `LiveExpenseDetailScreen`
- Sales non-draft already on `LiveDocumentReadOnly` (Phase 4A)
- Purchase still uses `LivePurchaseInvoiceScreen` (builder handles all statuses with cancel)

## Commands run (Phase 4B)

```bash
cd frontend
corepack pnpm run typecheck   # pass
corepack pnpm run build       # pass
```

Mock safety bash script: **skipped on Windows** — run on Linux/VPS before deploy.

## Build status

- TypeScript typecheck: pass
- Production build: pass

## Remaining limitations

- Purchase non-draft read-only view separate from builder (builder still used for approved invoices)
- Quotation read-only detail not split from builder
- Payment movement read-only detail screen not added
- Company logo/stamp/signature upload still unavailable (no backend upload endpoint wired)
- Role permissions overview and settings audit log remain mock-only
- Daily report full live table view pending dedicated backend daily report endpoint
- Quotation attachments (no backend endpoint)
- Super Admin revenue/activity charts empty until admin analytics API exists
- Bash mock safety script must run on deployment host

## Production readiness recommendation

Phase 4B closes the highest-risk production mock gaps (profile tabs, permissions, refunds/cancel, attachments, dashboard KPIs). Recommended next step: deployment readiness pass with full smoke test on staging VPS, env verification, and runbook validation.

## Recommended next Cursor prompt

Perform Production Deployment Readiness Pass: run full backend/frontend checks, fix build/runtime issues, verify env files, harden deployment scripts, prepare VPS deployment runbook, rollback plan, smoke test checklist, and launch notes.
