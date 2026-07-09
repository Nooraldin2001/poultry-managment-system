from django.urls import path

from .views import (
    AdminCompanyCreateAdminUserView,
    AdminCompanyDetailView,
    AdminCompanyListCreateView,
    AdminCompanyReactivateView,
    AdminCompanySuspendView,
)
from .module_reset_views import (
    AdminModuleResetCatalogView,
    AdminModuleResetConfirmView,
    AdminModuleResetDryRunView,
    AdminModuleResetHistoryView,
)

# Mounted under /api/v1/admin/
urlpatterns = [
    path("companies/", AdminCompanyListCreateView.as_view(), name="admin-companies"),
    path("companies/<int:pk>/", AdminCompanyDetailView.as_view(), name="admin-company-detail"),
    path(
        "companies/<int:pk>/suspend/",
        AdminCompanySuspendView.as_view(),
        name="admin-company-suspend",
    ),
    path(
        "companies/<int:pk>/reactivate/",
        AdminCompanyReactivateView.as_view(),
        name="admin-company-reactivate",
    ),
    path(
        "companies/<int:pk>/create-admin-user/",
        AdminCompanyCreateAdminUserView.as_view(),
        name="admin-company-create-admin-user",
    ),
    path(
        "companies/<int:company_id>/module-reset/catalog/",
        AdminModuleResetCatalogView.as_view(),
        name="admin-module-reset-catalog",
    ),
    path(
        "companies/<int:company_id>/module-reset/dry-run/",
        AdminModuleResetDryRunView.as_view(),
        name="admin-module-reset-dry-run",
    ),
    path(
        "companies/<int:company_id>/module-reset/confirm/",
        AdminModuleResetConfirmView.as_view(),
        name="admin-module-reset-confirm",
    ),
    path(
        "companies/<int:company_id>/module-reset/history/",
        AdminModuleResetHistoryView.as_view(),
        name="admin-module-reset-history",
    ),
]
