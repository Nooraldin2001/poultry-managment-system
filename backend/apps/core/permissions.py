"""Reusable DRF permission classes for super-admin vs tenant scoping."""

from rest_framework.permissions import BasePermission

from apps.core.tenancy import assert_auth_host_compatible


class IsSuperAdmin(BasePermission):
    """Allow only platform Super Admin users (global scope)."""

    message = "Super admin access required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_superuser):
            return False
        assert_auth_host_compatible(request, user)
        return True


class IsTenantUser(BasePermission):
    """Allow only authenticated users that belong to a company (tenant)."""

    message = "Tenant (company) user access required."

    def has_permission(self, request, view):
        user = request.user
        if not (
            user
            and user.is_authenticated
            and not user.is_superuser
            and user.company_id is not None
        ):
            return False
        assert_auth_host_compatible(request, user)
        return True


class IsOwnerAdmin(BasePermission):
    """Allow only tenant Owner/Admin users."""

    message = "Owner/Admin role required."

    def has_permission(self, request, view):
        user = request.user
        from apps.accounts.models import TenantRole

        if not (
            user
            and user.is_authenticated
            and user.company_id is not None
            and user.role == TenantRole.OWNER_ADMIN
        ):
            return False
        assert_auth_host_compatible(request, user)
        return True


class HasTenantPermission(BasePermission):
    """Checks an effective permission code declared on the view.

    Set ``required_permission = "sales.view"`` on the view. Super Admin bypasses.
    Owner/Admin is granted all tenant permissions by the checker service.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        assert_auth_host_compatible(request, user)
        if user.is_superuser:
            return True
        code = getattr(view, "required_permission", None)
        if not code:
            return user.company_id is not None
        from apps.permissions.services import has_permission

        return has_permission(user, code)
