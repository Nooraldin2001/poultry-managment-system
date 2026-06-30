from django.urls import path

from .views import AuditLogListView

# Mounted under /api/v1/tenant/
urlpatterns = [
    path("audit-logs/", AuditLogListView.as_view(), name="tenant-audit-logs"),
]
