from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerCollectionCreateView,
    CustomerCollectionsListView,
    CustomerReconciliationView,
    CustomerRefundCreateView,
    PaymentMovementViewSet,
    PaymentSummaryView,
    ReceiptDetailView,
    ReceiptListView,
    ReceiptPrintPreviewView,
    SupplierPaymentCreateView,
    SupplierPaymentsListView,
    SupplierReconciliationView,
    SupplierRefundCreateView,
)

router = DefaultRouter()
router.register("payments/movements", PaymentMovementViewSet, basename="payment-movements")

urlpatterns = [
    path("payments/summary/", PaymentSummaryView.as_view(), name="payments-summary"),
    path(
        "payments/customer-collections/",
        CustomerCollectionCreateView.as_view(),
        name="customer-collections-create",
    ),
    path(
        "payments/supplier-payments/",
        SupplierPaymentCreateView.as_view(),
        name="supplier-payments-create",
    ),
    path(
        "payments/customer-refunds/",
        CustomerRefundCreateView.as_view(),
        name="customer-refunds-create",
    ),
    path(
        "payments/supplier-refunds/",
        SupplierRefundCreateView.as_view(),
        name="supplier-refunds-create",
    ),
    path(
        "customers/<int:customer_id>/collections/",
        CustomerCollectionsListView.as_view(),
        name="customer-collections-list",
    ),
    path(
        "suppliers/<int:supplier_id>/payments/",
        SupplierPaymentsListView.as_view(),
        name="supplier-payments-list",
    ),
    path(
        "payments/reconciliation/customers/<int:customer_id>/",
        CustomerReconciliationView.as_view(),
        name="customer-reconciliation",
    ),
    path(
        "payments/reconciliation/suppliers/<int:supplier_id>/",
        SupplierReconciliationView.as_view(),
        name="supplier-reconciliation",
    ),
    path("receipts/", ReceiptListView.as_view(), name="receipts-list"),
    path("receipts/<int:pk>/", ReceiptDetailView.as_view(), name="receipts-detail"),
    path(
        "receipts/<int:pk>/print-preview/",
        ReceiptPrintPreviewView.as_view(),
        name="receipts-print-preview",
    ),
]
urlpatterns += router.urls
