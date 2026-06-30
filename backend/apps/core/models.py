"""Reusable abstract base models shared across all apps.

See docs/backend/DATABASE_SCHEMA.md "Conventions".
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Adds self-managing ``created_at`` / ``updated_at`` timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteModel(TimeStampedModel):
    """Soft-delete base. Rows are flagged, never physically removed.

    Master data that may be referenced by transactions should disable via
    ``is_active`` instead; soft delete is for the rare case a row must be hidden
    while preserving referential history.
    """

    is_active = models.BooleanField(default=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["deleted_at", "is_active", "updated_at"])

    def restore(self):
        self.deleted_at = None
        self.is_active = True
        self.save(update_fields=["deleted_at", "is_active", "updated_at"])


class TenantOwnedModel(TimeStampedModel):
    """Base for every tenant-owned record.

    Carries a ``company`` FK so all tenant data is isolated by ``company_id``
    (shared-DB multi-tenancy). Super-admin/global models do NOT inherit this.

    The ``company`` FK is required at the DB level; services stamp it from the
    resolved tenant context — clients never send it.
    """

    company = models.ForeignKey(
        "tenants.Company",
        on_delete=models.PROTECT,
        db_index=True,
        related_name="%(class)s_set",
    )

    class Meta:
        abstract = True


def get_created_by_field(related_name):
    """Helper for an optional ``created_by`` FK to the user model."""
    return models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=related_name,
    )
