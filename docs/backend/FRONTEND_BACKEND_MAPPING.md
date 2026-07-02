# Poultry Hero — Frontend ↔ Backend Mapping

> Maps the existing frontend service boundary (`Poultry managment system/src/services/`)
> to future backend endpoints + models, so Phase 11 (frontend integration) is a drop-in
> replacement. Sources read: `API_BOUNDARY_PLAN.md`, `src/services/index.ts`,
> `src/services/mock/*`, `src/services/api/client.ts`, `src/shared/types/*`.

## Service boundary facts (current — Phase 2 integrated)

- All accessors are exported from `frontend/src/services/index.ts`; screens import from there.
- **Phase 1 live:** auth, admin companies, tenant dashboard.
- **Phase 2 live:** products, customers, suppliers, inventory, purchases, sales, payments, quotations, expenses, tax, reports module endpoints via dedicated `*Service.ts` files and `hooks/api/useTenantResources`.
- `createCrudService()` + `useListResource` / `useDetailResource` pattern for tenant CRUD.
- `IS_MOCK_MODE` gates mock data; forced off in production builds.

---

## Mapping table

| Frontend service fn | Current mock source | Future backend endpoint | Required model(s) | Notes |
| --- | --- | --- | --- | --- |
| `listCompanies()` | `data/mock/company.mock.ts` (`COMPANIES`) | `GET /api/v1/admin/companies/` ✅ Phase 1 | `Company`, `CompanySubscription` | Super-admin; wired via `adminService.listCompanies()` |
| `getCompanyById(id)` | `company.mock.ts` | `GET /api/v1/admin/companies/{id}/` ✅ Phase 1 | `Company`, `CompanySubscription` | Super-admin; `adminService.getCompanyById()` |
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
| `listExpenses()` | `GET/POST /api/v1/tenant/expenses/` (+ cancel, voucher-preview) | `Expense`, `ExpenseCategory` |
| `getReportSummary()` | `reports.mock.ts` (`T_DAILY`,`T_MONTHLY_PROFIT`,`T_PAY_PIE`) | `GET /api/v1/tenant/reports/dashboard/` + module reports | Phase 10 `apps.reports` services | Not yet on service boundary; mock only |
| `getTenantDashboardSummary()` | `reportsService.ts` (mock maps legacy shape) | `GET /api/v1/tenant/reports/dashboard/` ✅ Phase 1 | `DashboardSummary` | Tenant dashboard KPIs + `sales_trend`; `date_from`/`date_to` query |
| `getTaxSummary()` | `GET /api/v1/tenant/tax/summary/` (+ sales/purchase/expense/net-vat, export-payload) | `TaxWarning`, `TaxAdjustment` |

---

## Future services to add (not yet on the frontend boundary)

These are needed once write/auth flows are wired (see `API_BOUNDARY_PLAN.md` §4 "missing
backend concepts"). Add them to `src/services/index.ts` with matching signatures:

| New frontend service (proposed) | Backend endpoint | Model(s) |
| --- | --- | --- |
| `login()/logout()/refresh()/me()` | `/api/v1/auth/*` ✅ Phase 1 | `User`, JWT | `authService.ts` + `authStore.tsx` |
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

## Production data hygiene (Phase 2)

`IS_MOCK_MODE` forces mock off in production builds. Phase 2 wired tenant module list/detail screens to live APIs via `*Service.ts` + hooks; mock arrays (`MOCK_*`) are only used when `IS_MOCK_MODE=true`. API failures show error/empty states — never silent mock fallback.

See `docs/frontend/PHASE_2_ERP_API_INTEGRATION_NOTES.md`.

## Integration mechanics (Phase 3+)

1. ~~Implement `request<T>(path, init)` in `src/services/api/client.ts`~~ ✅ Phase 1
2. Wire remaining service modules with the **same exported names/signatures** as mocks (Phase 2).
3. In `src/services/index.ts`, switch each export from `./mock/*` to live impl (or keep `pick()`).
4. Map `ListParams.pageSize → page_size` query param.
5. ~~Add auth/login + token storage~~ ✅ Phase 1; tenant from JWT `/auth/me/`.
6. Keep mock mode working (`VITE_USE_MOCK_DATA=true`) for offline dev.
