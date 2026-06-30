from django.urls import path

from .views import AdminPlanListView, AdminSubscriptionPaymentCreateView

# Mounted under /api/v1/admin/
urlpatterns = [
    path("plans/", AdminPlanListView.as_view(), name="admin-plans"),
    path(
        "subscription-payments/",
        AdminSubscriptionPaymentCreateView.as_view(),
        name="admin-subscription-payments",
    ),
]
