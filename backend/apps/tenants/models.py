from django.db import models

from apps.core.models import TimeStampedModel, get_created_by_field

from .validators import subdomain_validator


class CompanyStatus(models.TextChoices):
    TRIAL = "trial", "Trial"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"


class Company(TimeStampedModel):
    """A tenant company managed by the Super Admin (global / super-admin owned).

    This row *defines* a tenant; it is NOT itself tenant-scoped. Tenant-owned
    data references it via ``company_id``.
    """

    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255)
    subdomain = models.SlugField(
        max_length=63,
        unique=True,
        validators=[subdomain_validator],
        help_text="e.g. 'primefresh' -> primefresh.poultryhero.solutions",
    )

    trade_license = models.CharField(max_length=64, blank=True)
    trn = models.CharField("Tax Registration Number", max_length=32, blank=True)
    country = models.CharField(max_length=64, default="UAE")
    emirate = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)

    logo = models.ImageField(upload_to="company/logo/", null=True, blank=True)
    stamp = models.ImageField(upload_to="company/stamp/", null=True, blank=True)
    signature = models.ImageField(
        upload_to="company/signature/", null=True, blank=True
    )

    status = models.CharField(
        max_length=16, choices=CompanyStatus.choices, default=CompanyStatus.TRIAL
    )
    is_active = models.BooleanField(default=True)

    created_by = get_created_by_field("companies_created")

    class Meta:
        ordering = ["name_en"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["subdomain"]),
        ]
        verbose_name_plural = "companies"

    def __str__(self):
        return f"{self.name_en} ({self.subdomain})"

    @property
    def is_operational(self) -> bool:
        """Whether tenant users may operate (not suspended / inactive)."""
        return self.is_active and self.status != CompanyStatus.SUSPENDED

    def save(self, *args, **kwargs):
        if self.subdomain:
            self.subdomain = self.subdomain.lower()
        super().save(*args, **kwargs)
