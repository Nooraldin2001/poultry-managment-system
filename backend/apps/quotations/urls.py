from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CustomerQuotationsView, QuotationSummaryView, QuotationViewSet

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotations")

urlpatterns = [
    path("quotations/summary/", QuotationSummaryView.as_view(), name="quotations-summary"),
    path(
        "customers/<int:customer_id>/quotations/",
        CustomerQuotationsView.as_view(),
        name="customer-quotations",
    ),
]
urlpatterns += router.urls
