from django.conf import settings
from django.db import models

from apps.accounts.models import TenantRole
from apps.core.models import TimeStampedModel, get_created_by_field


class PermissionCode(TimeStampedModel):
    """Canonical permission entry (global reference data). ``group.action``."""

    code = models.CharField(max_length=64, unique=True)
    group = models.CharField(max_length=32)
    action = models.CharField(max_length=32)
    label = models.CharField(max_length=128, blank=True)
    is_sensitive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["group", "action"]
        indexes = [models.Index(fields=["group"])]

    def __str__(self):
        return self.code


class RolePermissionDefault(TimeStampedModel):
    """Baseline allow/deny per tenant role per permission (global defaults)."""

    role = models.CharField(max_length=20, choices=TenantRole.choices)
    permission = models.ForeignKey(
        PermissionCode, on_delete=models.CASCADE, related_name="role_defaults"
    )
    allowed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="uniq_role_permission_default"
            )
        ]

    def __str__(self):
        return f"{self.role}:{self.permission.code}={self.allowed}"


class UserPermissionOverride(TimeStampedModel):
    """Per-user grant/revoke vs the role default (Owner/Admin customization)."""

    company = models.ForeignKey(
        "tenants.Company", on_delete=models.CASCADE, related_name="permission_overrides"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission = models.ForeignKey(
        PermissionCode, on_delete=models.CASCADE, related_name="user_overrides"
    )
    allowed = models.BooleanField()
    set_by = get_created_by_field("permission_overrides_set")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "permission"], name="uniq_user_permission_override"
            )
        ]

    def __str__(self):
        return f"{self.user_id}:{self.permission.code}={self.allowed}"
