from django.conf import settings
from django.db import models

from .constants import RiskLevel


class AuditLog(models.Model):
    """Append-only audit trail.

    ``company`` is null for global Super Admin actions. Rows are never updated
    or deleted by the application (enforced in :meth:`save`/:meth:`delete` and
    by making the model read-only in the admin).
    """

    company = models.ForeignKey(
        "tenants.Company",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    module = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=64)

    reference_type = models.CharField(max_length=64, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)

    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    reason = models.TextField(blank=True)
    risk_level = models.CharField(
        max_length=10, choices=RiskLevel.choices, default=RiskLevel.LOW
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["company", "created_at"]),
            models.Index(fields=["action"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.user_id} @ {self.created_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Append-only: forbid updates once created.
        if self.pk is not None:
            raise ValueError("AuditLog entries are append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditLog entries are append-only and cannot be deleted.")
