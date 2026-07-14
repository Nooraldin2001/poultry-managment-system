from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core.health import HealthView

try:
    from drf_spectacular.views import (
        SpectacularAPIView,
        SpectacularSwaggerView,
    )
except ImportError:
    SpectacularAPIView = None
    SpectacularSwaggerView = None

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
    path("tenant/", include("apps.inventory.urls")),
    path("tenant/", include("apps.purchases.urls")),
    path("tenant/", include("apps.sales.urls")),
    path("tenant/", include("apps.payments.urls")),
    path("tenant/", include("apps.quotations.urls")),
    path("tenant/", include("apps.expenses.urls")),
    path("tenant/", include("apps.tax.urls")),
    path("tenant/", include("apps.reports.urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api_v1"))),
]

if SpectacularAPIView and SpectacularSwaggerView:
    urlpatterns += [
        # OpenAPI schema + docs
        path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/v1/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
    ]

if settings.DEBUG:
    # Local development only — Nginx serves /media/ in production.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
