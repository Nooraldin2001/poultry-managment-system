"""Reusable tenant-scoped DRF viewset base.

Filters every queryset by the authenticated user's company, stamps ``company``
on create, and resolves a per-action permission from ``permission_map``.
"""

from rest_framework import viewsets

from .permissions import HasTenantPermission, IsTenantUser


class TenantScopedViewSet(viewsets.ModelViewSet):
    """Base viewset for tenant-owned resources.

    Subclasses set ``queryset``, ``permission_map`` (``{action: "perm.code"}``)
    and serializer(s). All rows are isolated by ``company_id``.
    """

    permission_classes = [IsTenantUser, HasTenantPermission]
    permission_map: dict = {}

    @property
    def required_permission(self):
        return self.permission_map.get(self.action)

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(company_id=self.request.user.company_id)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)
