# Frontend API Integration — Phase 3 Advanced Workflows

## Summary

Phase 3 wires advanced ERP workflows to live tenant APIs while keeping mock mode for local development only. Production (`import.meta.env.PROD` or `VITE_USE_MOCK_DATA=false`) never uses hardcoded default entity IDs or silent mock fallbacks on the screens touched in this phase.

## Detail navigation

**Approach:** In-app screen state in `TenantApp` (`App.tsx`) — no React Router added.

- Added `selectedSalesId` and `selectedPurchaseId` alongside existing selection state.
- All default selection IDs cleared (`""`) — no more `cu1`, `pr1`, `sp1`, etc. in production.
- List screens call `setSelected*Id(recordId)` before `onNavigate(detail-screen)`.
- Purchase list uses `recordId` (API numeric id) separate from display invoice number.
- Sales list maps `recordId: row.id` from `useSales()`.
- Detail/builder screens receive the ID prop and fetch via service (`getSalesDetail`, `getPurchaseDetail`, etc.).
- Empty ID → `EmptyState` in live mode (not mock record).

## Invoice builder foundation

Shared under `frontend/src/features/invoices/`:

| File | Role |
|------|------|
| `types.ts` | `InvoiceLineDraft`, header/totals types |
| `invoiceApi.ts` | Draft CRUD for sales/purchase/quotation lines |
| `ReasonModal.tsx` | Approve/cancel/dismiss reason capture |
| `LiveSalesInvoiceScreen.tsx` | Full sales draft builder |
| `LivePurchaseInvoiceScreen.tsx` | Full purchase draft builder |
| `LiveQuotationScreen.tsx` | Quotation draft + lifecycle |

Mock builders in `App.tsx` / modules remain for `IS_MOCK_MODE=true` only.

## Product create

`AddProductScreen` (`ProductModule.tsx`):

- `createProduct` + `buildProductCreatePayload`
- Live categories from `listProductCategories()`
- DRF field errors via `FormErrors`
- Save loading state + success toast
- Navigates back to list after save

Product edit on detail screen: **not yet wired** (Phase 4).

## Sales workflow

- New/edit: `LiveSalesInvoiceScreen` when `!IS_MOCK_MODE`
- Lines: POST/PATCH/DELETE via `invoiceApi`
- Price preview: `salesPricePreview`
- Stock check before approve: `salesStockCheck`
- Approve/cancel: `approveSale` / `cancelSale` with `approval_reason` / `cancel_reason`
- Print: `LivePrintPreviewScreen` + `getSalesPrintPreview`

## Purchase workflow

- New/edit/detail (live): `LivePurchaseInvoiceScreen`
- Approve/cancel with reason modals
- Print endpoint: `getPurchasePrintPreview` (service added; preview screen wiring optional)

## Quotation workflow

- New/detail (live): `LiveQuotationScreen`
- Send, accept, reject, cancel, convert-to-sales
- After conversion: `TenantApp` sets `selectedSalesId` and opens `sales-detail`
- Print: `QuotationPreviewScreen` → `LivePrintPreviewScreen`

## Payment allocation

**Partial:** Existing `CustomerCollectionModal` / `SupplierPaymentModal` UI remains; live POST wiring for allocations is **not complete** in this phase. Services exist (`createCustomerCollection`, `createSupplierPayment`). Use sales list filters for open invoices where dedicated allocation endpoint is absent.

## Inventory / stocktaking

- Movements: `MovementScreen` uses `listStockMovements()` only in live mode (no mock enrichment)
- Stocktaking: `StocktakingScreen` loads live inventory, creates session, posts lines, applies with reason via `applyStocktaking`
- Opening stock / manual adjustment services exist; dedicated form polish deferred

## Print preview

- `PrintPreviewLayout` + `LivePrintPreviewScreen`
- `window.print()` + print CSS in `tailwind.css`
- Wired: sales, quotations
- Receipt/expense voucher: existing screens; extend with `getPaymentPrintPreview` in Phase 4

## Tax warnings

- Generate: `generateTaxWarnings`
- Dismiss / resolve with `ReasonModal`
- Live list from `listTaxWarnings`
- 403 → `PermissionDeniedState`

## Report export UX

- `ExportBar` on report screens: JSON preview via `ExportPayloadModal` + `getReportsExportPayload`
- PDF/Excel buttons disabled and labeled “soon”

## Customer / supplier profile tabs

**Partial:** Statement tabs were live in Phase 2. Sub-tabs (sales, collections, special prices, agreements) still use mock enrichment where API tab endpoints are missing — show empty/live list only, no new fake rows added in production paths touched.

## Mobile responsiveness

- Invoice builders: `overflow-x-auto` on line tables, stacked grids (`lg:grid-cols-3`), full-width action buttons
- Existing mobile card layouts on list screens preserved
- Modals: `max-h-[90vh]` on export modal

## Production mock safety

- Removed hardcoded `TenantApp` selection defaults
- Live builders gated with `!IS_MOCK_MODE`
- Inventory movements no longer merge mock rows in live mode
- Stocktaking uses API products only when live

## Commands run

```bash
cd frontend
corepack pnpm run typecheck   # pass
corepack pnpm run build       # pass
```

Bash mock script skipped on Windows — manual grep/static review performed.

## Known limitations

1. Product **edit** form not POST-wired on detail screen
2. Payment allocation modals not fully live
3. Customer/supplier profile sub-tabs incomplete
4. Purchase print preview screen not routed (service ready)
5. Expense voucher / receipt print layouts need `LivePrintPreviewScreen` hookup
6. Sales detail in live mode uses builder screen (not read-only multi-tab view)
7. Quotation mock screens still exist for dev mock mode
8. Report export JSON does not pass per-report date filters yet

## Recommended next phase

Phase 4: role-based navigation, settings/users, print template settings, attachment upload, payment allocation completion, customer/supplier tab APIs, product edit, accessibility, deployment smoke tests.
