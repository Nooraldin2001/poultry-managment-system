# Tenant Create Workflow Audit

Production tenant: **First View** (`https://firstview.poultryhero.solutions`)  
API base: `https://firstview.poultryhero.solutions/api`  
Constraint: `VITE_USE_MOCK_DATA=false` — no fake success before API resolves.

Last updated: **2026-07-05**  
Code commits: `ded78f1` (customer), `bff86fe` (reports + dashboard), `c7d747a` (product/supplier/invoice services)

---

## Module audit table

| Module | Create screen | Calls POST API? | Loading? | DRF errors? | Refetches list? | Persists after refresh? | Status |
| ------ | ------------- | --------------: | -------: | ----------: | --------------: | ----------------------: | ------ |
| **Customers** | `CreateCustomerScreen` | Yes — `POST /api/v1/tenant/customers/` | Yes | Yes (`FormErrors`) | On navigate back (hook remount) | Yes | **Fixed** — deploy verify pending |
| **Customer edit** | `CreateCustomerScreen` (`customers-edit`) | Yes — `PATCH /api/v1/tenant/customers/{id}/` | Yes | Yes | Profile/list remount | Yes | **Fixed** (2026-07-05) |
| **Suppliers** | `CreateSupplierScreen` | Yes — `POST /api/v1/tenant/suppliers/` | Yes | Yes | On navigate back | Yes | **Fixed** in `c7d747a` |
| **Products** | `CreateProductScreen` | Yes — `POST /api/v1/tenant/products/` | Yes | Yes | On navigate back | Yes | **Fixed** in `c7d747a` |
| **Product categories** | `ProductCategoriesScreen` | Yes — `POST /api/v1/tenant/product-categories/` | Yes | Yes | Local state + reload on open | Yes | **Fixed** in `c7d747a` |
| **Sales invoices** | `LiveSalesInvoiceScreen` | Yes — `POST /api/v1/tenant/sales/` (+ lines) | Yes | Yes | List on remount; `onSaved` sets id | Yes | **Fixed** — Save draft + approve payload |
| **Purchase invoices** | `LivePurchaseInvoiceScreen` | Yes — `POST /api/v1/tenant/purchases/` (+ lines) | Yes | Yes | Same as sales | Yes | **Fixed** — Save draft + approve payload |
| **Quotations** | `QuotationsModule` builder | **No** — toast-only | No | No | No | No | **Open** — mock UI only |
| **Payments (collection)** | `LiveCustomerPaymentModal` | Yes — live modal in prod | Yes | Yes | Yes | Yes | **OK** in live mode |
| **Payments (mock modals)** | `CustomerCollectionModal` etc. | Mock only (`IS_MOCK_MODE`) | — | — | — | — | Dev mock only |
| **Expenses** | Expense create screens | Partial — check expense service | Varies | Varies | Varies | Varies | Not in client report |
| **Reports** | All report screens | GET report APIs | Yes | Yes | N/A | N/A | **Fixed** — `liveOrMockRows` never falls back in prod |
| **Users & Permissions** | `LiveUserPermissionsScreen` | `GET/PATCH /tenant/users/...` | Yes | Yes | Yes | Yes | **Fixed** (2026-07-05) — `users.view` on list GET |
| **Bulk product setup** | `BulkProductSetupScreen` | **No** — toast-only | No | No | No | No | Dev tool — not used in prod routing |

---

## Root cause pattern

Same anti-pattern as original **Add Customer** bug:

1. Save button shows success toast and navigates away
2. No tenant API call
3. DRF validation errors never surfaced
4. Lists never refresh because nothing persisted

Additional product-specific bugs (fixed):

- Category dropdown fell back to mock `PROD_CATEGORIES` string keys → `NaN` category id on POST
- SKU not required in UI but required by backend
- Fixed-weight products missing `weight_grams` / `default_pieces_per_carton`
- No product categories in tenant → blocked with clear banner (must create category first)

Additional invoice-specific bugs (fixed):

- Approve/cancel sent `approval_reason` / `cancel_reason`; backend expects `{ "reason": "..." }`
- `salesPricePreview` / `salesStockCheck` used POST; backend expects GET query params
- Credit override sent wrong field; backend expects `{ "credit_override": true, "reason": "..." }`
- No explicit **Save draft** — header-only draft impossible without adding a line first

---

## Fixes by module

### Customer (`CustomerModule.tsx`)

- `handleSave` → `createCustomer(buildCustomerCreatePayload(...))`
- Deployed in `ded78f1`

### Supplier (`SupplierModule.tsx`)

- `CreateSupplierScreen.handleSave` → `createSupplier(buildSupplierCreatePayload(...))`
- `FormErrors`, loading, permission check

### Product (`ProductModule.tsx`)

- Live categories from `listProductCategories()` only
- SKU + fixed-weight validation before POST
- `buildProductCreatePayload` maps to backend serializer fields

### Product categories (`ProductCategoriesScreen`)

- `listProductCategories()` on mount
- `createProductCategory()` on save with auto `code`

### Sales invoice (`LiveSalesInvoiceScreen.tsx`)

- Production route: `SalesNewScreen` → `LiveSalesInvoiceScreen` when `!IS_MOCK_MODE`
- Save draft → `POST /api/v1/tenant/sales/` then `PATCH`
- Lines → `POST .../lines/`
- Approve → `POST .../approve/` with `{ reason }`

### Purchase invoice (`LivePurchaseInvoiceScreen.tsx`)

- Production route: `PurchNewScreen` → `LivePurchaseInvoiceScreen` when `!IS_MOCK_MODE`
- **New draft:** `purchases-new` — no `purchaseId`; Save Draft → `POST /api/v1/tenant/purchases/`
- **Edit draft:** `purchases-edit` — requires `selectedPurchaseId`; detail → `GET /api/v1/tenant/purchases/{id}/`
- **404:** `NotFoundState` (AR: فاتورة الشراء غير موجودة أو تم حذفها)

### Product edit (`ProductModule.tsx` — `88822cd`)

- List **Edit** → `setSelectedProductId` + `products-edit` (not `products-new`)
- Save → `PATCH /api/v1/tenant/products/{id}/` via `buildProductUpdatePayload()`
- Sensitive price/carton changes → `ReasonModal` with `reason` in body

### Supplier edit (`SupplierModule.tsx` — `88822cd`)

- List/profile **Edit** → `suppliers-edit` with `selectedSupplierId`
- Save → `PATCH /api/v1/tenant/suppliers/{id}/` via `buildSupplierUpdatePayload()`
- Opening balance / ledger totals not sent in PATCH

---
- Same draft/approve pattern as sales

### Reports (`ReportsModule.tsx`, `reportLiveData.ts`, `App.tsx`)

- `liveOrMockRows()` / `liveOrMockChart()` return `[]` in live mode when API empty
- Tenant dashboard KPIs from `useTenantDashboard` API, not `T_*` mock arrays
- Daily report shows `ApiUnavailableState` until daily endpoint exists (no fake rows)

### Shared rule (`liveFormSubmit.ts`)

- `submitLiveResource()` — success toast only after `await run()` resolves

---

## Backend endpoints (confirmed)

| Action | Method | Path | Body (key fields) |
|--------|--------|------|-------------------|
| Create customer | POST | `/api/v1/tenant/customers/` | `name_ar`, `phone`, … |
| Create supplier | POST | `/api/v1/tenant/suppliers/` | `name_ar`, `phone`, … |
| Create category | POST | `/api/v1/tenant/product-categories/` | `name_ar`, `code` |
| Create product | POST | `/api/v1/tenant/products/` | `name_ar`, `sku`, `category`, `product_type`, `weight_grams`, … |
| Create sales draft | POST | `/api/v1/tenant/sales/` | `customer`, `invoice_date`, `payment_method`, … |
| Add sales line | POST | `/api/v1/tenant/sales/{id}/lines/` | `product`, `quantity_kg`, `unit_price`, … |
| Approve sale | POST | `/api/v1/tenant/sales/{id}/approve/` | `{ "reason": "...", "credit_override": true? }` |
| Price preview | GET | `/api/v1/tenant/sales/price-preview/?customer=&product=&price_type=` | — |
| Stock check | GET | `/api/v1/tenant/sales/stock-check/?product=&cartons=&pieces=&kg=` | — |
| Create purchase draft | POST | `/api/v1/tenant/purchases/` | `supplier`, `invoice_date`, … |
| Approve purchase | POST | `/api/v1/tenant/purchases/{id}/approve/` | `{ "reason": "..." }` |

---

## Request/response examples

### Product create (201)

```http
POST /api/v1/tenant/products/
Authorization: Bearer <tenant_token>
Content-Type: application/json

{
  "name_ar": "1000 جرام",
  "name_en": "1000 GRAM",
  "sku": "CHK-1000",
  "category": 1,
  "product_type": "fixed_weight",
  "weight_grams": 1000,
  "default_pieces_per_carton": 10,
  "sales_price": "14.75",
  "sales_price_type": "kg",
  "purchase_price": "1.15",
  "purchase_price_type": "piece",
  "track_inventory": true,
  "vat_taxable": true
}
```

### Sales draft (201)

```http
POST /api/v1/tenant/sales/
{
  "customer": 1,
  "invoice_date": "2026-07-05",
  "payment_method": "cash",
  "amount_paid": "0",
  "vat_rate": "5.00"
}
```

### Sales approve (200)

```http
POST /api/v1/tenant/sales/42/approve/
{ "reason": "Approved for delivery" }
```

---

## Dependency chain for First View

1. **Product category** must exist before product create
2. **Customer** must exist before sales invoice
3. **Supplier** must exist before purchase invoice
4. **Product** must exist before invoice line items
5. **Inventory** must exist (from approved purchase) before sales approval stock check passes

---

## Production verification checklist

- [ ] Add customer → POST 201, list refresh, browser refresh persists
- [ ] Add supplier → POST 201
- [ ] Add product category → POST 201
- [ ] Add product → POST 201, appears in invoice product dropdown
- [ ] Purchase: **New** invoice opens without Not Found; Save draft POST 201
- [ ] Purchase: Edit existing draft; Approve → stock increases
- [ ] Product: Edit from list → PATCH 200; refresh persists
- [ ] Supplier: Edit from list/profile → PATCH 200; refresh persists
- [ ] Sales list opens without white screen (including partially-paid invoices)
- [ ] Sales: **New** invoice opens; Save draft POST 201; credit balance updates
- [ ] Reports: no demo transaction rows; empty/zero states when no data

---

## Demo data cleanup (tenant-scoped, optional)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
# Review output, then:
python manage.py purge_tenant_demo_data --company-subdomain firstview --confirm-delete-demo-data
```

Do not run without reviewing dry-run output.

---

## Remaining open items

| Item | Priority | Notes |
|------|----------|-------|
| Quotations create | Low | Mock toast-only; `LiveQuotationScreen` exists for edit flow |
| Bulk product setup | Low | Dev tool; toast-only |
| Customer credit limit modal | Low | Toast-only special price save |
| Production manual smoke | **High** | Requires First View owner credentials |
| DB demo purge on VPS | Medium | After dry-run review |
