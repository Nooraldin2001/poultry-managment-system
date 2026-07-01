# Poultry Hero — Frontend ↔ Backend Mapping

> Maps the existing frontend service boundary (`Poultry managment system/src/services/`)
> to future backend endpoints + models, so Phase 11 (frontend integration) is a drop-in
> replacement. Sources read: `API_BOUNDARY_PLAN.md`, `src/services/index.ts`,
> `src/services/mock/*`, `src/services/api/client.ts`, `src/shared/types/*`.

## Service boundary facts (current)

- All accessors are exported from `src/services/index.ts`; screens import from there.
- Every function returns a `Promise` (`ListResponse<T> = Promise<T[]>`,
  `ItemResponse<T> = Promise<T|null>`, `ObjectResponse<T> = Promise<T>`) via
  `services/mock/mockDelay.ts` — so swapping mock → `fetch` is signature-compatible.
- `src/services/api/client.ts` exposes `API_CONFIG { baseUrl, useMock }` and a stub
  `request<T>()`. `useMock=true` today; flip to `false` after `request()` is implemented.
- `ListParams { search?, page?, pageSize? }` is the pagination/filter contract
  (`page_size` on the wire).

---

## Mapping table

| Frontend service fn | Current mock source | Future backend endpoint | Required model(s) | Notes |
| --- | --- | --- | --- | --- |
| `listCompanies()` | `data/mock/company.mock.ts` (`COMPANIES`) | `GET /api/v1/admin/companies/` | `Company`, `CompanySubscription` | Super-admin scope; not tenant-isolated |
| `getCompanyById(id)` | `company.mock.ts` | `GET /api/v1/admin/companies/{id}/` | `Company`, `CompanySubscription`, `SubscriptionPayment` | Super-admin scope |
| `listCustomers()` | `customers.mock.ts` (`S_CUSTOMERS`) | `GET /api/v1/tenant/customers/` ✅ | `Customer` | Tenant-scoped; `?search=&customer_type=&has_balance=&credit_exceeded=` |
| `getCustomerById(id)` | `customers.mock.ts` | `GET /api/v1/tenant/customers/{id}/` ✅ | `Customer` (+ `/ledger/`, `/statement/`) | `404` when out of scope |
| `listSuppliers()` | `suppliers.mock.ts` | `GET /api/v1/tenant/suppliers/` ✅ | `Supplier` | Tenant-scoped; `?search=&supplier_type=&has_balance=` |
| `getSupplierById(id)` | `suppliers.mock.ts` | `GET /api/v1/tenant/suppliers/{id}/` ✅ | `Supplier`, `SupplierAgreement` (`/agreements/`) | |
| `listProducts()` | `products.mock.ts` (`S_PRODUCTS`) | `GET /api/v1/tenant/products/` ✅ | `Product`, `ProductCategory` | Tenant-scoped; `?product_type=&is_active=&category=&search=` |
| `getProductById(id)` | `products.mock.ts` | `GET /api/v1/tenant/products/{id}/` ✅ | `Product` (+ `/prices/`, `/usage/`) | `disable`/`reactivate` actions |
| `listInventoryItems()` | `inventory.mock.ts` | `GET /api/v1/tenant/inventory/` ✅ | `InventoryBalance`, `Product` | UI shows total stock; backend reads balances; `?product=&category=&status=&low_stock=&out_of_stock=&search=` |
| `listSalesInvoices()` | `sales.mock.ts` (`S_INVOICES`) | `GET /api/v1/tenant/sales/` | `SalesInvoice`, `SalesInvoiceLine` | `?status=&date_*=&customer=` |
| `getSalesInvoiceById(id)` | `sales.mock.ts` | `GET /api/v1/tenant/sales/{id}/` | `SalesInvoice`+lines | Detail includes lines |
| `listPurchaseInvoices()` | `purchases.mock.ts` | `GET /api/v1/tenant/purchases/` ✅ | `PurchaseInvoice`, `PurchaseInvoiceLine` | `?supplier=&status=&payment_status=&date_from=&date_to=&supplier_invoice_number=&search=&has_balance=&vat_enabled=` |
| `listPaymentMovements()` | `payments.mock.ts` | `GET /api/v1/tenant/payments/movements/` | `PaymentMovement`, `PaymentAllocation` | `?party_type=&movement_type=` |
| `listExpenses()` | `expenses.mock.ts` | `GET /api/v1/expenses/` | `Expense`, `ExpenseCategory` | `?category=&date_*=` |
| `getReportSummary()` | `reports.mock.ts` (`T_DAILY`,`T_MONTHLY_PROFIT`,`T_PAY_PIE`) | `GET /api/v1/reports/summary/` | aggregates over `SalesInvoice`/`PurchaseInvoice`/`Expense` (+ optional `ReportSnapshot`) | Returns `{daily, monthlyProfit, paymentSplit}` (`ReportSummaryData`) |
| `getDashboardSummary()` | derived from `T_DAILY`,`T_INVOICES`,`T_CUSTOMERS` | `GET /api/v1/dashboard/summary/` | aggregates (sales today, open invoices, overdue customers) | Returns `DashboardSummary {totalSalesToday, openInvoices, overdueCustomers}` |
| `getTaxSummary()` | `tax.mock.ts` (`TAX_SUMMARY`) | `GET /api/v1/tax/summary/` | `VatRecord`, `VatSettings` | Returns `TaxSummary` (sales/purchase/net VAT) |

---

## Future services to add (not yet on the frontend boundary)

These are needed once write/auth flows are wired (see `API_BOUNDARY_PLAN.md` §4 "missing
backend concepts"). Add them to `src/services/index.ts` with matching signatures:

| New frontend service (proposed) | Backend endpoint | Model(s) |
| --- | --- | --- |
| `login()/logout()/refresh()/me()` | `/api/v1/auth/*` | `User`, JWT |
| `createSalesInvoice()/approveSalesInvoice()/cancelSalesInvoice()` | `POST /api/v1/tenant/sales/`, `.../approve/`, `.../cancel/` | `SalesInvoice` + inventory side effects on approve |
| `createPurchaseInvoice()/approve/cancel` | `/api/v1/tenant/purchases/*` ✅ (Phase 4) | `PurchaseInvoice` + inventory side effects |
| `listQuotations()/convertQuotation()` | `GET/POST /api/v1/tenant/quotations/` (+ send/accept/convert-to-sales) | `Quotation` |
| `createCollection()/createSupplierPayment()/cancelPayment()` | `POST /api/v1/tenant/payments/customer-collections/`, `supplier-payments/`, `movements/{id}/cancel/` | `PaymentMovement` |
| `createStockAdjustment()/stocktaking*` | `/api/v1/tenant/inventory/adjustments/`, `.../inventory/stocktaking/*` ✅ | `StockAdjustment`, `StocktakingSession` |
| `listUsers()/createUser()/setUserPermissions()` | `/settings/users/*` | `User`, `UserPermissionOverride` |
| `getCustomerStatement()/getSupplierStatement()` | `/customers/{id}/statement/`, `/suppliers/{id}/statement/` | statements |
| `listAuditLogs()` | `/audit/` | `AuditLog` |
| `uploadFile()` | `/files/` | `FileAttachment` |

---

## Type alignment notes (frontend `src/shared/types/*` → backend)

- `Company` (tenant.ts) ↔ `Company` + `CompanySubscription`. Frontend flattens
  plan/price/renewal/outstanding onto `Company`; backend splits subscription out — the
  serializer for `/admin/companies/` should flatten back to match the current shape.
- `Product` (tenant.ts) is a light shape (`priceKg`, `cartons`, `pieces`, `weightKg`,
  `variable`, `isPart`). Backend `Product` is richer (price types, VAT flag, code,
  bilingual names). Serializer must expose at least the frontend fields; extra fields are
  additive.
- `SProduct`/`SInvLine`/`SInvoice` (documents.ts) are the **sales workflow working types**
  used inside `App.tsx`. The API-boundary `SalesInvoice`/`PurchaseInvoice` types are the
  ones the list services return. Backend list serializers target `SalesInvoice`/
  `PurchaseInvoice`; the workflow types stay frontend-internal until write endpoints land.
- `Customer.balance/creditLimit`, `Supplier.balance` use `MoneyAmount` (currently
  `number`). Backend returns decimal — confirm wire format (string vs number) in
  OPEN_QUESTIONS; `MoneyAmount` may need to become `string`.
- `PaymentMovement`, `Expense`, `InventoryItem` shapes map directly to their models'
  list serializers.
- Roles `owner|accountant|cashier` (roles.ts) match backend `User.role`. The UI uses them
  only for show/hide; backend enforces.

---

## Production data hygiene (Phase 4)

`API_CONFIG.useMock` is now driven by the `VITE_USE_MOCK_DATA` env var and **defaults
to false** in production (see `src/services/api/client.ts` + `frontend/.env.production.example`).
When false, a console warning is emitted because the live REST client is not implemented
yet, so mock data is never silently presented as real production data.

> **Known limitation / follow-up:** screens still import mock services from
> `services/index.ts` regardless of `useMock`. Removing mock data from the production UI
> and wiring screens to the live APIs is a tracked follow-up:
> _"Frontend API integration and mock-data removal from production UI."_

## Integration mechanics (Phase 11)

1. Implement `request<T>(path, init)` in `src/services/api/client.ts`: prefix `baseUrl`,
   attach `Authorization: Bearer <access>`, parse JSON, map errors, and convert paginated
   `{count,next,previous,results}` → `T[]` for `ListResponse`.
2. Create real service modules (e.g. `services/http/customerService.ts`) with the **same
   exported names/signatures** as the mocks.
3. In `src/services/index.ts`, switch each export from `./mock/*` to `./http/*` (or branch
   on `API_CONFIG.useMock`). No screen imports change.
4. Map `ListParams.pageSize → page_size` query param.
5. Add an auth/login screen + token storage; resolve tenant from subdomain.
6. Keep mock mode working (`useMock=true`) for offline dev + tests.
