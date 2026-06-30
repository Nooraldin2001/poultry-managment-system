from django.db import transaction
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.services import record_action, require_reason_for_sensitive_action
from apps.core.permissions import HasTenantPermission, IsTenantUser

from .models import PermissionCode, UserPermissionOverride
from .serializers import (
    PermissionCodeSerializer,
    UserPermissionsUpdateSerializer,
)
from .services import get_effective_permissions


class PermissionCatalogView(generics.ListAPIView):
    """List the full permission catalog (tenant-visible reference data)."""

    permission_classes = [IsTenantUser]
    serializer_class = PermissionCodeSerializer
    queryset = PermissionCode.objects.filter(is_active=True)
    pagination_class = None


class UserPermissionsView(APIView):
    """GET effective permissions for a tenant user; PATCH per-user overrides."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "users.manage"

    def _get_user(self, request, pk):
        return generics.get_object_or_404(
            User.objects.filter(company_id=request.user.company_id, is_superuser=False),
            pk=pk,
        )

    def get(self, request, pk):
        user = self._get_user(request, pk)
        effective = get_effective_permissions(user)
        overrides = dict(
            UserPermissionOverride.objects.filter(user=user).values_list(
                "permission__code", "allowed"
            )
        )
        return Response({"effective": effective, "overrides": overrides})

    @transaction.atomic
    def patch(self, request, pk):
        user = self._get_user(request, pk)
        serializer = UserPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Changing permissions is a sensitive action -> reason required.
        reason = require_reason_for_sensitive_action(
            "permission_change", serializer.validated_data.get("reason", "")
        )

        before = get_effective_permissions(user)
        for item in serializer.validated_data["overrides"]:
            permission = PermissionCode.objects.get(code=item["code"])
            UserPermissionOverride.objects.update_or_create(
                user=user,
                permission=permission,
                defaults={
                    "allowed": item["allowed"],
                    "company_id": user.company_id,
                    "set_by": request.user,
                },
            )
        after = get_effective_permissions(user)

        record_action(
            request=request,
            action="permission_change",
            module="users",
            reference_type="user",
            reference_id=user.id,
            reason=reason,
            previous_value={k: before[k] for k in before if before[k] != after.get(k)},
            new_value={k: after[k] for k in after if before.get(k) != after[k]},
        )
        return Response({"effective": after})
