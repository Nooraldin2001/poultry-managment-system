from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CustomerSalesView, SalesInvoiceViewSet

router = DefaultRouter()
router.register("sales", SalesInvoiceViewSet, basename="sales")

urlpatterns = [
    path(
        "customers/<int:customer_id>/sales/",
        CustomerSalesView.as_view(),
        name="customer-sales",
    ),
]
urlpatterns += router.urls
