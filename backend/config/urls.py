from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from apps.core.health import HealthView

api_v1 = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("admin/", include("apps.tenants.admin_urls")),
    path("admin/", include("apps.subscriptions.urls")),
    path("tenant/", include("apps.tenants.tenant_urls")),
    path("tenant/", include("apps.accounts.tenant_urls")),
    path("tenant/", include("apps.permissions.urls")),
    path("tenant/settings/", include("apps.company_settings.urls")),
    path("tenant/", include("apps.audit.urls")),
    path("tenant/", include("apps.products.urls")),
    path("tenant/", include("apps.customers.urls")),
    path("tenant/", include("apps.suppliers.urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api_v1"))),
    # OpenAPI schema + docs
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
