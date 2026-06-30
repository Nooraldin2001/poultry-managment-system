from decimal import Decimal

from django.db import models

from apps.core.models import TimeStampedModel, get_created_by_field


class PlanCode(models.TextChoices):
    BASIC = "basic", "Basic"
    PRO = "pro", "Pro"
    ENTERPRISE = "enterprise", "Enterprise"


class BillingCycle(models.TextChoices):
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class SubscriptionStatus(models.TextChoices):
    TRIAL = "trial", "Trial"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    EXPIRED = "expired", "Expired"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    OTHER = "other", "Other"


class Plan(TimeStampedModel):
    """SaaS plan catalog (global). Seeded via ``seed_plans`` command."""

    code = models.CharField(
        max_length=20, choices=PlanCode.choices, unique=True
    )
    name = models.CharField(max_length=64)
    monthly_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    yearly_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    user_limit = models.PositiveIntegerField(default=3)
    enabled_modules = models.JSONField(default=list, blank=True)
    premium_whatsapp_enabled = models.BooleanField(default=False)
    advanced_reports_enabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["monthly_price"]

    def __str__(self):
        return self.name


class CompanySubscription(TimeStampedModel):
    """Current subscription state for a company (manual billing). 1—1 company."""

    company = models.OneToOneField(
        "tenants.Company", on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(
        Plan, on_delete=models.PROTECT, related_name="subscriptions"
    )
    status = models.CharField(
        max_length=16,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL,
    )
    billing_cycle = models.CharField(
        max_length=16, choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    start_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    trial_end_date = models.DateField(null=True, blank=True)
    monthly_price_snapshot = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    yearly_price_snapshot = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    outstanding_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    total_paid = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    last_payment_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["renewal_date"]),
        ]

    def __str__(self):
        return f"{self.company.subdomain} · {self.plan.code}"

    @property
    def user_limit(self) -> int:
        return self.plan.user_limit


class SubscriptionPayment(TimeStampedModel):
    """A manual SaaS payment recorded by the Super Admin."""

    company = models.ForeignKey(
        "tenants.Company", on_delete=models.CASCADE, related_name="subscription_payments"
    )
    subscription = models.ForeignKey(
        CompanySubscription,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    reference_number = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to="subscription_payments/", null=True, blank=True
    )
    recorded_by = get_created_by_field("subscription_payments_recorded")

    class Meta:
        ordering = ["-payment_date", "-id"]
        indexes = [models.Index(fields=["company", "payment_date"])]

    def __str__(self):
        return f"{self.company.subdomain} · {self.amount} on {self.payment_date}"
