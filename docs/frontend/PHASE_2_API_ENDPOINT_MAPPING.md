# Phase 2 — API Endpoint Mapping

Maps tenant ERP screens to backend endpoints, frontend services, and connected components.

| Module | Screen | Endpoint | Service method | Component | Gaps |
|--------|--------|----------|----------------|-----------|------|
| Products | List | `GET /tenant/products/` | `listProductRows` | `ProductsListScreen` | Stock columns need inventory merge |
| Products | Detail | `GET /tenant/products/{id}/` | `getProductRow` | `ProductDetailScreen` | Special prices tab mock-only |
| Products | Create | `POST /tenant/products/` | `createProduct` | `AddProductScreen` | Form submit not fully wired |
| Products | Categories | `GET /tenant/product-categories/` | `listProductCategories` | `ProductCategoriesScreen` | Pending |
| Customers | List | `GET /tenant/customers/` | `listCustomerRows` | `CustomersListScreen` | — |
| Customers | Profile | `GET /tenant/customers/{id}/` | `getCustomerRow` | `CustomerProfileScreen` | Invoice/collection tabs mock in live |
| Customers | Ledger | `GET /tenant/customers/{id}/ledger/` | `getCustomerLedger` | Profile tab | Tab UI pending live wire |
| Customers | Statement | `GET /tenant/customers/{id}/statement/` | reports customer statement | `CustomerStatementScreen` | — |
| Suppliers | List | `GET /tenant/suppliers/` | `listSupplierRows` | `SuppliersListScreen` | — |
| Suppliers | Profile | `GET /tenant/suppliers/{id}/` | `getSupplierRow` | `SupplierProfileScreen` | Agreements tab mock |
| Inventory | Overview | `GET /tenant/inventory/` | `listInventoryRows` | `InventoryOverviewScreen` | — |
| Inventory | Summary | `GET /tenant/inventory/summary/` | `getInventorySummary` | Overview KPIs | — |
| Inventory | Low stock | `GET /tenant/inventory/low-stock/` | `listLowStockRows` | `LowStockScreen` | — |
| Inventory | Movements | `GET /tenant/inventory/movements/` | `listStockMovements` | `MovementScreen` | List still mock-enriched |
| Inventory | Valuation | `GET /tenant/inventory/valuation/` | `getInventoryValuation` | `ValuationScreen` | Permission 403 handled |
| Purchases | List | `GET /tenant/purchases/` | `listPurchaseRows` | `PurchListScreen` | — |
| Purchases | Detail | `GET /tenant/purchases/{id}/` | `getPurchaseDetail` | `PurchDetailScreen` | No selected ID from App router |
| Purchases | Approve/Cancel | `POST .../approve/`, `.../cancel/` | `approvePurchase`, `cancelPurchase` | Modals | UI actions pending |
| Sales | List | `GET /tenant/sales/` | `listSalesRows` | `SalesListScreen` (App.tsx) | Detail navigation ID pending |
| Sales | Detail | `GET /tenant/sales/{id}/` | `getSalesDetail` | `SalesDetailScreen` | Partial |
| Payments | Movements | `GET /tenant/payments/movements/` | `listPaymentMovementRows` | `PaymentMovementsScreen` | — |
| Payments | Summary | `GET /tenant/payments/summary/` | `getPaymentsSummary` | `PaymentsOverviewScreen` | — |
| Payments | Collection | `POST /tenant/payments/customer-collections/` | `createCustomerCollection` | Modals | Form submit pending |
| Quotations | List | `GET /tenant/quotations/` | `listQuotationRows` | `QuotationsListScreen` | — |
| Quotations | Detail | `GET /tenant/quotations/{id}/` | `getQuotationDetail` | `QuotationDetailScreen` | Line CRUD pending |
| Expenses | List | `GET /tenant/expenses/` | `listExpenseRows` | `ExpensesListScreen` | — |
| Expenses | Summary | `GET /tenant/expenses/summary/` | `getExpensesSummary` | `ExpensesOverviewScreen` | — |
| Tax | Summary | `GET /tenant/tax/summary/` | `getTaxSummaryLive` | `TaxDashboardScreen` | — |
| Tax | Sales VAT | `GET /tenant/tax/sales-vat/` | `getTaxSalesVat` | `SalesVATReportScreen` | — |
| Tax | Purchase VAT | `GET /tenant/tax/purchase-vat/` | `getTaxPurchaseVat` | `PurchaseVATReportScreen` | — |
| Tax | Net VAT | `GET /tenant/tax/net-vat/` | `getTaxNetVat` | `NetVATScreen` | — |
| Tax | Warnings | `GET /tenant/tax/warnings/` | `listTaxWarnings` | `TaxWarningsScreen` | — |
| Reports | Dashboard | `GET /tenant/reports/dashboard/` | `getTenantDashboardSummary` | `TenantDashboardScreen` | Phase 1 |
| Reports | Sales | `GET /tenant/reports/sales/` | `getSalesReport` | `SalesReportScreen` | — |
| Reports | Purchases | `GET /tenant/reports/purchases/` | `getPurchasesReport` | `PurchaseReportScreen` | — |
| Reports | Inventory | `GET /tenant/reports/inventory/` | `getInventoryReport` | `InventoryReportScreen` | — |
| Reports | Profit | `GET /tenant/reports/profit/` | `getProfitReport` | `ProfitReportScreen` | — |
| Reports | Tax bridge | `GET /tenant/reports/tax-summary/` | `getTaxSummaryReport` | `TaxReportScreen` | — |

## Shared foundation

- CRUD: `services/crud/createCrudService.ts`
- Hooks: `hooks/api/useListResource`, `useDetailResource`, `useResourceMutation`, `useTenantResources`
- UI: `ApiStates`, `FormErrors`, `ModuleDataGate`
- Mappers: `app/moduleMappers.ts`
