# Poultry Hero — Frontend API Boundary Plan

> Status: **Mock-only.** No backend exists yet. This document describes the seam
> the frontend now exposes so a future Django REST API can be dropped in with
> minimal UI churn.

All data access is funnelled through `src/services/` (the service boundary).
Today every service function returns mock data from `src/data/mock/`. When the
Django backend lands, only `src/services/` changes — screens keep calling the
same functions.

---

## 1. Service functions created

Exposed from `src/services/index.ts`:

| Function | Returns | Backing mock |
| --- | --- | --- |
| `listCompanies()` | `Company[]` | `company.mock.ts` |
| `getCompanyById(id)` | `Company \| null` | `company.mock.ts` |
| `listCustomers()` | `Customer[]` | `customers.mock.ts` (`S_CUSTOMERS`) |
| `getCustomerById(id)` | `Customer \| null` | `customers.mock.ts` |
| `listSuppliers()` | `Supplier[]` | `suppliers.mock.ts` |
| `getSupplierById(id)` | `Supplier \| null` | `suppliers.mock.ts` |
| `listProducts()` | `Product[]` | `products.mock.ts` (`S_PRODUCTS`) |
| `getProductById(id)` | `Product \| null` | `products.mock.ts` |
| `listInventoryItems()` | `InventoryItem[]` | `inventory.mock.ts` |
| `listSalesInvoices()` | `SalesInvoice[]` | `sales.mock.ts` (`S_INVOICES`) |
| `getSalesInvoiceById(id)` | `SalesInvoice \| null` | `sales.mock.ts` |
| `listPurchaseInvoices()` | `PurchaseInvoice[]` | `purchases.mock.ts` |
| `listPaymentMovements()` | `PaymentMovement[]` | `payments.mock.ts` |
| `listExpenses()` | `Expense[]` | `expenses.mock.ts` |
| `getReportSummary()` | charts bundle | `reports.mock.ts` |
| `getDashboardSummary()` | KPI bundle | derived from mocks |
| `getTaxSummary()` | `TaxSummary` | `tax.mock.ts` |

Each returns a `Promise` (via `services/mock/mockDelay.ts`) so call sites already
look asynchronous — swapping to `fetch` is a drop-in change.

## 2. Which UI modules should call each service

| UI module / screen group | Service(s) |
| --- | --- |
| Super Admin dashboard, Companies | `listCompanies`, `getCompanyById` |
| Tenant dashboard | `getDashboardSummary`, `getReportSummary` |
| Sales (`SalesListScreen`, detail, preview) | `listSalesInvoices`, `getSalesInvoiceById`, `listProducts`, `listCustomers` |
| Purchases | `listPurchaseInvoices`, `listSuppliers`, `listProducts` |
| Inventory | `listInventoryItems`, `listProducts` |
| Products | `listProducts`, `getProductById` |
| Customers | `listCustomers`, `getCustomerById` |
| Suppliers | `listSuppliers`, `getSupplierById` |
| Payments & receipts | `listPaymentMovements`, `listCustomers`, `listSuppliers` |
| Expenses | `listExpenses` |
| Reports | `getReportSummary` |
| Tax / VAT | `getTaxSummary`, `listSalesInvoices`, `listPurchaseInvoices` |
| Settings → Users | (future) users service |

> NOTE: Screens currently still read their own internal mock data. Wiring each
> screen to these services is an intentional follow-up (see Risks in the
> modularization audit). The boundary + types exist so that migration is safe.

## 3. Future Django API resource mapping (proposed)

REST, tenant-scoped, JSON. Base path `/api/v1/`.

| Frontend service | Proposed endpoint(s) |
| --- | --- |
| `listCompanies` / `getCompanyById` | `GET /admin/companies/`, `GET /admin/companies/{id}/` (Super Admin scope) |
| `listCustomers` / `getCustomerById` | `GET /customers/`, `GET /customers/{id}/` |
| `listSuppliers` / `getSupplierById` | `GET /suppliers/`, `GET /suppliers/{id}/` |
| `listProducts` / `getProductById` | `GET /products/`, `GET /products/{id}/` |
| `listInventoryItems` | `GET /inventory/items/` |
| `listSalesInvoices` / `getSalesInvoiceById` | `GET /sales/invoices/`, `GET /sales/invoices/{id}/` |
| `listPurchaseInvoices` | `GET /purchases/invoices/` |
| `listPaymentMovements` | `GET /payments/movements/` |
| `listExpenses` | `GET /expenses/` |
| `getReportSummary` | `GET /reports/summary/` |
| `getDashboardSummary` | `GET /dashboard/summary/` |
| `getTaxSummary` | `GET /tax/summary/` |

### Proposed API naming style
- Plural, kebab/lowercase resource collections (`/sales/invoices/`).
- Sub-resources nested under owners where natural (`/customers/{id}/statement/`).
- Query params for filtering/pagination: `?search=&page=&page_size=`
  (mirrors `ListParams` in `src/services/api/types.ts`).
- ISO-8601 dates; money as decimal strings or integer minor units (TBD with backend).

## 4. Missing backend concepts (not yet modelled on the frontend)
- Authentication / session (login screen is mock).
- Tenant resolution (subdomain → tenant) — `Company.subdomain` exists in mock.
- Document numbering sequences (settings screen is UI-only).
- VAT return submission, audit trail persistence.
- Stock movement ledger (only summary rows exist).
- Role/permission enforcement server-side.

## 5. Data ownership / tenant isolation
- Every tenant resource MUST be scoped by `tenant_id` server-side; the frontend
  never sends it explicitly — it is derived from the authenticated session +
  subdomain. Super Admin endpoints (`/admin/...`) are the only cross-tenant scope.

## 6. Authentication (future)
- Token/session auth added in `src/services/api/client.ts` (`request()` is a
  stub today). Inject `Authorization` header + CSRF/session as required by Django.
- `API_CONFIG.useMock` flips the whole app between mock and live data.

## 7. Permissions (future)
- Roles already exist in the UI: `owner | accountant | cashier`
  (`src/shared/types/roles.ts`). Server must enforce these; the UI uses them
  only for show/hide affordances (e.g. `PermBtn`).
