from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class TenantRole(models.TextChoices):
    OWNER_ADMIN = "owner_admin", "Owner/Admin"
    ACCOUNTANT = "accountant", "Accountant"
    CASHIER_SALES = "cashier_sales", "Cashier/Sales"


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user: email/password login only.

    A user is either a platform Super Admin (``is_superuser=True``,
    ``company=None``, ``role=None``) or a tenant user attached to exactly one
    company with one of the :class:`TenantRole` values.
    """

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)

    company = models.ForeignKey(
        "tenants.Company",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        help_text="Null for platform Super Admin users.",
    )
    role = models.CharField(
        max_length=20,
        choices=TenantRole.choices,
        null=True,
        blank=True,
        help_text="Null for Super Admin.",
    )

    # active = can log in / operate; deactivated = suspended.
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    force_password_change = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["email"]
        indexes = [
            models.Index(fields=["company"]),
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return self.email

    @property
    def is_super_admin(self) -> bool:
        return self.is_superuser and self.company_id is None

    @property
    def is_tenant_user(self) -> bool:
        return self.company_id is not None

    @property
    def is_owner_admin(self) -> bool:
        return self.role == TenantRole.OWNER_ADMIN
