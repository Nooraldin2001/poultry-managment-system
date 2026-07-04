# Tenant Create Workflow Audit

Production tenant: **First View** (`https://firstview.poultryhero.solutions`)

Constraint: `VITE_USE_MOCK_DATA=false` — live API only; no fake success toasts without POST.

## Summary

| Module | Live POST wired | Status |
|--------|-----------------|--------|
| Customer create | `POST /api/v1/tenant/customers/` | Fixed & deployed (`ded78f1`) |
| Supplier create | `POST /api/v1/tenant/suppliers/` | Fixed locally — `CreateSupplierScreen` → `createSupplier()` |
| Product create | `POST /api/v1/tenant/products/` | Fixed locally — SKU + category validation, no mock category fallback |
| Product category create | `POST /api/v1/tenant/product-categories/` | Fixed locally — `ProductCategoriesScreen` |
| Sales invoice draft | `POST /api/v1/tenant/sales/` | Live via `LiveSalesInvoiceScreen`; Save draft button added |
| Sales approve/cancel | `POST .../approve/`, `.../cancel/` | Fixed — body uses `{ reason }`; credit override `{ credit_override: true }` |
| Purchase invoice draft | `POST /api/v1/tenant/purchases/` | Live via `LivePurchaseInvoiceScreen`; Save draft button added |
| Purchase approve/cancel | Same pattern as sales | Fixed — body uses `{ reason }` |
| Reports | Tenant dashboard + reports module | Fixed locally — no hardcoded `R_*` demo rows in live mode |
| Quotations | — | Still mock toast-only (out of scope for ops create) |
| Bulk product setup | — | Still mock toast-only (dev/setup tool) |

## Root cause pattern

Several screens followed the same anti-pattern as the original **Add Customer** bug:

1. Save button shows success toast and navigates away
2. No call to tenant API
3. Validation errors from API never surfaced
4. List views never refresh because nothing was persisted

## Fixes by module

### Customer (`CustomerModule.tsx`)

- `handleSave` → `createCustomer(buildCustomerCreatePayload(...))`
- Loading state, `FormErrors`, field validation
- Deployed to VPS in commit `ded78f1`

### Supplier (`SupplierModule.tsx`)

- `CreateSupplierScreen.handleSave` → `createSupplier(buildSupplierCreatePayload(...))`
- Buttons disabled while saving; requires name + phone
- Mock mode preserved for local demos only

### Product (`ProductModule.tsx`)

- Live mode loads categories from `listProductCategories()` — no fallback to `PROD_CATEGORIES` string keys (which caused `NaN` category ID)
- SKU required in UI; fixed-weight products require `weight_grams` + `default_pieces_per_carton`
- Empty category banner directs user to Product Categories screen

### Product categories (`ProductCategoriesScreen`)

- Loads from API in live mode; empty state when none exist
- Add category → `createProductCategory()` with auto-generated `code`

### Sales invoice (`LiveSalesInvoiceScreen.tsx`)

- Draft created on first line add or explicit **Save draft**
- `salesPricePreview` / `salesStockCheck` use GET with query params (matches backend)
- Approve sends `{ reason }`; credit limit retry sends `{ reason, credit_override: true }`

### Purchase invoice (`LivePurchaseInvoiceScreen.tsx`)

- Same draft pattern as sales
- **Save draft** persists header without requiring a line first

### Reports (`ReportsModule.tsx`, `reportLiveData.ts`, `App.tsx`)

- Live mode fetches tenant data or shows empty states
- Removed hardcoded demo customer/supplier names from tenant dashboard lists

## Backend endpoints (reference)

| Action | Method | Path |
|--------|--------|------|
| Create customer | POST | `/api/v1/tenant/customers/` |
| Create supplier | POST | `/api/v1/tenant/suppliers/` |
| Create product | POST | `/api/v1/tenant/products/` |
| Create category | POST | `/api/v1/tenant/product-categories/` |
| Create sales draft | POST | `/api/v1/tenant/sales/` |
| Approve sale | POST | `/api/v1/tenant/sales/{id}/approve/` body `{ "reason": "..." }` |
| Price preview | GET | `/api/v1/tenant/sales/price-preview/?customer=&product=&price_type=` |
| Stock check | GET | `/api/v1/tenant/sales/stock-check/?product=&cartons=&pieces=&kg=` |
| Create purchase draft | POST | `/api/v1/tenant/purchases/` |
| Approve purchase | POST | `/api/v1/tenant/purchases/{id}/approve/` body `{ "reason": "..." }` |

## Production verification checklist (First View)

- [ ] Create customer → 201, appears in list
- [ ] Create supplier → 201, appears in list
- [ ] Create product category → 201
- [ ] Create product (fixed weight) → 201
- [ ] Sales: Save draft (header only) → 201
- [ ] Sales: Add line, approve with reason → 200
- [ ] Purchase: Save draft → 201
- [ ] Reports: no demo names (`مطعم الخليج`, `WESTLAND`) in live bundle after deploy

## Demo data cleanup (optional, tenant-scoped)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
```

Do not run without `--dry-run` review on production.
