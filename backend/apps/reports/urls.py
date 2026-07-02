from django.urls import path

from .views import (
    CustomersAgingReportView,
    CustomerStatementReportView,
    DashboardReportView,
    ExpensesReportView,
    ExportPayloadView,
    InventoryMovementReportView,
    InventoryReportView,
    InventoryValuationReportView,
    PaymentsReportView,
    ProfitReportView,
    PurchaseReportView,
    SalesReportView,
    SuppliersAgingReportView,
    SupplierStatementReportView,
    TaxSummaryBridgeView,
)

urlpatterns = [
    path("reports/dashboard/", DashboardReportView.as_view(), name="reports-dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="reports-sales"),
    path("reports/purchases/", PurchaseReportView.as_view(), name="reports-purchases"),
    path("reports/inventory/", InventoryReportView.as_view(), name="reports-inventory"),
    path(
        "reports/inventory-valuation/",
        InventoryValuationReportView.as_view(),
        name="reports-inventory-valuation",
    ),
    path(
        "reports/inventory-movements/",
        InventoryMovementReportView.as_view(),
        name="reports-inventory-movements",
    ),
    path(
        "reports/customers/<int:customer_id>/statement/",
        CustomerStatementReportView.as_view(),
        name="reports-customer-statement",
    ),
    path("reports/customers/aging/", CustomersAgingReportView.as_view(), name="reports-customers-aging"),
    path(
        "reports/suppliers/<int:supplier_id>/statement/",
        SupplierStatementReportView.as_view(),
        name="reports-supplier-statement",
    ),
    path("reports/suppliers/aging/", SuppliersAgingReportView.as_view(), name="reports-suppliers-aging"),
    path("reports/payments/", PaymentsReportView.as_view(), name="reports-payments"),
    path("reports/expenses/", ExpensesReportView.as_view(), name="reports-expenses"),
    path("reports/profit/", ProfitReportView.as_view(), name="reports-profit"),
    path("reports/tax-summary/", TaxSummaryBridgeView.as_view(), name="reports-tax-summary"),
    path("reports/export-payload/", ExportPayloadView.as_view(), name="reports-export-payload"),
]
