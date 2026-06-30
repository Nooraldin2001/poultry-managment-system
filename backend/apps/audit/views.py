from rest_framework import generics

from apps.core.permissions import HasTenantPermission, IsTenantUser

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    """Read-only tenant audit log. Owner/Admin (and audit.view) only."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "audit.view"
    serializer_class = AuditLogSerializer
    search_fields = ["action", "module", "reference_type", "reason"]

    def get_queryset(self):
        qs = AuditLog.objects.filter(company_id=self.request.user.company_id)
        action = self.request.query_params.get("action")
        module = self.request.query_params.get("module")
        if action:
            qs = qs.filter(action=action)
        if module:
            qs = qs.filter(module=module)
        return qs
