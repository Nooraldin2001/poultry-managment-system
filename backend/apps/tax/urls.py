from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DisabledVATDocumentsView,
    ExpenseVATReportView,
    NetVATReportView,
    PurchaseVATReportView,
    SalesVATReportView,
    TaxAdjustmentViewSet,
    TaxAuditView,
    TaxExportPayloadView,
    TaxPeriodViewSet,
    TaxSummaryView,
    TaxWarningViewSet,
)

router = DefaultRouter()
router.register("tax/warnings", TaxWarningViewSet, basename="tax-warnings")
router.register("tax/adjustments", TaxAdjustmentViewSet, basename="tax-adjustments")
router.register("tax/periods", TaxPeriodViewSet, basename="tax-periods")

urlpatterns = [
    path("tax/summary/", TaxSummaryView.as_view(), name="tax-summary"),
    path("tax/sales-vat/", SalesVATReportView.as_view(), name="tax-sales-vat"),
    path("tax/purchase-vat/", PurchaseVATReportView.as_view(), name="tax-purchase-vat"),
    path("tax/expense-vat/", ExpenseVATReportView.as_view(), name="tax-expense-vat"),
    path("tax/net-vat/", NetVATReportView.as_view(), name="tax-net-vat"),
    path("tax/export-payload/", TaxExportPayloadView.as_view(), name="tax-export-payload"),
    path("tax/disabled-vat-documents/", DisabledVATDocumentsView.as_view(), name="tax-disabled-vat"),
    path("tax/audit/", TaxAuditView.as_view(), name="tax-audit"),
]
urlpatterns += router.urls
