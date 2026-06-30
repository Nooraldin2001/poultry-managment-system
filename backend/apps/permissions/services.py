"""Permission checker service.

Effective permission resolution order:
1. Super Admin            -> always allowed (bypasses tenant permissions).
2. Non-tenant / no company -> denied for tenant permission codes.
3. Owner/Admin            -> always allowed (cannot be locked out).
4. Per-user override      -> wins if present.
5. Role default           -> otherwise.
6. Fallback               -> denied.
"""

from apps.accounts.models import TenantRole


def has_permission(user, permission_code: str, company=None) -> bool:
    if user is None or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False):
        return True

    if user.company_id is None:
        return False

    if company is not None and user.company_id != getattr(company, "id", company):
        return False

    if user.role == TenantRole.OWNER_ADMIN:
        return True

    from .models import RolePermissionDefault, UserPermissionOverride

    override = (
        UserPermissionOverride.objects.filter(
            user=user, permission__code=permission_code
        )
        .values_list("allowed", flat=True)
        .first()
    )
    if override is not None:
        return override

    default = (
        RolePermissionDefault.objects.filter(
            role=user.role, permission__code=permission_code
        )
        .values_list("allowed", flat=True)
        .first()
    )
    return bool(default)


def get_effective_permissions(user) -> dict:
    """Return ``{code: allowed_bool}`` for every catalog permission for a user.

    Used to build the permissions summary returned by ``/auth/me/``.
    """
    from .models import PermissionCode

    codes = list(
        PermissionCode.objects.filter(is_active=True).values_list("code", flat=True)
    )

    if getattr(user, "is_superuser", False):
        return {code: True for code in codes}

    if not getattr(user, "is_authenticated", False) or user.company_id is None:
        return {code: False for code in codes}

    if user.role == TenantRole.OWNER_ADMIN:
        return {code: True for code in codes}

    from .models import RolePermissionDefault, UserPermissionOverride

    defaults = dict(
        RolePermissionDefault.objects.filter(role=user.role).values_list(
            "permission__code", "allowed"
        )
    )
    overrides = dict(
        UserPermissionOverride.objects.filter(user=user).values_list(
            "permission__code", "allowed"
        )
    )

    result = {}
    for code in codes:
        if code in overrides:
            result[code] = overrides[code]
        else:
            result[code] = bool(defaults.get(code, False))
    return result


def allowed_permission_codes(user) -> list:
    return [code for code, allowed in get_effective_permissions(user).items() if allowed]
