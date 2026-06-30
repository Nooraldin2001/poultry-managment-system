from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PurchaseInvoiceViewSet, SupplierPurchasesView

router = DefaultRouter()
router.register("purchases", PurchaseInvoiceViewSet, basename="purchases")

urlpatterns = [
    path(
        "suppliers/<int:supplier_id>/purchases/",
        SupplierPurchasesView.as_view(),
        name="supplier-purchases",
    ),
]
urlpatterns += router.urls
