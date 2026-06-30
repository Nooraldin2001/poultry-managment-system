from django.urls import path

from .views import TenantCompanyUpdateView, TenantSettingsView

# Mounted under /api/v1/tenant/
urlpatterns = [
    path("settings/", TenantSettingsView.as_view(), name="tenant-settings"),
    path(
        "settings/company/",
        TenantCompanyUpdateView.as_view(),
        name="tenant-settings-company",
    ),
]
