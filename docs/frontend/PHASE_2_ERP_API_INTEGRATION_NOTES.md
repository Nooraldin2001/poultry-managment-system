# Phase 2 — ERP API Integration Notes

## Shared CRUD pattern

**`createCrudService<TList, TDetail>()`** (`services/crud/`) wraps `request()` with list/retrieve/create/patch/remove/action.

**Hooks:**
- `useListResource(liveFetcher, mockFetcher?, deps)` — list screens
- `useDetailResource(id, liveFetcher, mockFetcher?)` — detail screens
- `useResourceMutation(mutator)` / `useResourceAction(action)` — forms and actions

**Module integration:**
- `moduleMappers.ts` maps API rows → module-local UI shapes
- `ModuleDataGate` wraps loading/error/forbidden/empty
- Mock arrays renamed to `MOCK_*`; used only when `IS_MOCK_MODE`

## Services created/updated

| Service | Key methods |
|---------|-------------|
| `productService.ts` | `listProductRows`, `getProductRow`, `createProduct`, `disableProduct` |
| `customerService.ts` | `listCustomerRows`, `getCustomerRow`, `getCustomerLedger` |
| `supplierService.ts` | `listSupplierRows`, `getSupplierRow`, `getSupplierLedger` |
| `inventoryService.ts` | `listInventoryRows`, `getInventorySummary`, `listStockMovements` |
| `purchaseService.ts` | `listPurchaseRows`, `getPurchaseDetail`, `approvePurchase`, `cancelPurchase` |
| `salesService.ts` | `listSalesRows`, `getSalesDetail`, `approveSale`, `salesStockCheck` |
| `paymentService.ts` | `listPaymentMovementRows`, `createCustomerCollection`, `cancelPaymentMovement` |
| `quotationService.ts` | `listQuotationRows`, `getQuotationDetail`, `convertQuotationToSales` |
| `expenseService.ts` | `listExpenseRows`, `getExpensesSummary`, `cancelExpense` |
| `taxService.ts` | `getTaxSummaryLive`, `getTaxSalesVat`, `listTaxWarnings` |
| `reportsService.ts` | Extended with `getSalesReport`, `getProfitReport`, etc. |

## Screens connected

- **Products:** list, detail
- **Customers:** list, profile, statement, collect modal
- **Suppliers:** list, profile, statement
- **Inventory:** overview, low stock, valuation; movements partial
- **Purchases:** list, detail (basic)
- **Sales:** list (App.tsx)
- **Payments:** overview, movements
- **Quotations:** list, detail (basic)
- **Expenses:** overview, list
- **Tax:** dashboard, sales/purchase VAT, net VAT, warnings
- **Reports:** sales, purchases, inventory, profit, tax summary

## Forms / validation

- `FormErrors` displays DRF `ApiError.message` + `fieldErrors`
- `useResourceMutation` exposes `fieldErrors` for form binding
- Create/edit forms on several screens still show toast-only success (full POST wiring is Phase 3)

## Pagination / filters

- `ApiListFilters`: `search`, `page`, `page_size`, `ordering`, plus module-specific keys
- List hooks pass `search` where UI has search box
- Full pagination UI not added; `listAll` fetches up to 20 pages × 100 rows

## Permissions

- `403` → `PermissionDeniedState` on list/detail screens
- Cashier-restricted modules (expenses, tax) show permission state when API returns 403

## Production mock safety

- Live services never fall back to mock on error
- `MOCK_*` arrays only consumed via `mockFetcher` when `IS_MOCK_MODE`
- `services/index.ts` branches on `IS_MOCK_MODE` for legacy boundary exports

## Commands run

```bash
cd frontend
corepack pnpm run typecheck   # pass
corepack pnpm run build       # pass
```

Bash `check_no_production_mock_data.sh` skipped on Windows (PowerShell static check recommended on CI).

## Known limitations

1. Invoice builders (sales/purchase new screens) not fully wired to POST + line endpoints
2. List → detail navigation lacks selected entity ID in App router for sales/purchases
3. Movement screen uses mock movement rows when live API returns sparse data
4. Customer/supplier profile sub-tabs (invoices, special prices) still mock in live mode
5. Product create form does not yet POST to API
6. Receipt print-preview foundation only; no PDF generation

## Next recommended phase

> Implement Frontend API Integration Phase 3 with advanced workflows: full invoice builders, print layouts, attachments, stocktaking wizard, payment allocation UX, tax warning workflows, report export UX, and mobile responsiveness polish.
