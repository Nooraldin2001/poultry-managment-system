"""Tax / VAT domain models (Phase 9).

Internal VAT management foundation — not an official tax filing engine.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")
MONEY = dict(max_digits=16, decimal_places=2)
_NON_NEG = [MinValueValidator(ZERO)]


class TaxPeriodStatus(models.TextChoices):
    OPEN = "open", "Open"
    REVIEWED = "reviewed", "Reviewed"
    CLOSED = "closed", "Closed"


class TaxWarningType(models.TextChoices):
    COMPANY_TRN_MISSING = "company_trn_missing", "Company TRN Missing"
    CUSTOMER_TRN_MISSING = "customer_trn_missing", "Customer TRN Missing"
    SUPPLIER_TRN_MISSING = "supplier_trn_missing", "Supplier TRN Missing"
    VAT_DISABLED_SALES = "vat_disabled_sales", "VAT Disabled on Sales"
    VAT_DISABLED_PURCHASE = "vat_disabled_purchase", "VAT Disabled on Purchase"
    VAT_DISABLED_EXPENSE = "vat_disabled_expense", "VAT Disabled on Expense"
    VAT_RATE_CHANGED = "vat_rate_changed", "VAT Rate Changed"
    VAT_AMOUNT_MISMATCH = "vat_amount_mismatch", "VAT Amount Mismatch"
    SALES_INVOICE_CANCELLED = "sales_invoice_cancelled", "Sales Invoice Cancelled"
    PURCHASE_INVOICE_CANCELLED = "purchase_invoice_cancelled", "Purchase Invoice Cancelled"
    EXPENSE_CANCELLED = "expense_cancelled", "Expense Cancelled"
    QUOTATION_NOT_TAX_INVOICE = "quotation_not_tax_invoice", "Quotation Not Tax Invoice"
    MISSING_PRINT_TEMPLATE_TAX_FIELDS = "missing_print_template_tax_fields", "Missing Print Template Tax Fields"
    OTHER = "other", "Other"


class TaxWarningSeverity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class TaxWarningStatus(models.TextChoices):
    OPEN = "open", "Open"
    DISMISSED = "dismissed", "Dismissed"
    RESOLVED = "resolved", "Resolved"


class TaxSourceType(models.TextChoices):
    SALES_INVOICE = "sales_invoice", "Sales Invoice"
    PURCHASE_INVOICE = "purchase_invoice", "Purchase Invoice"
    EXPENSE = "expense", "Expense"
    QUOTATION = "quotation", "Quotation"
    COMPANY_SETTINGS = "company_settings", "Company Settings"
    CUSTOMER = "customer", "Customer"
    SUPPLIER = "supplier", "Supplier"
    OTHER = "other", "Other"


class TaxAdjustmentType(models.TextChoices):
    OUTPUT_VAT_INCREASE = "output_vat_increase", "Output VAT Increase"
    OUTPUT_VAT_DECREASE = "output_vat_decrease", "Output VAT Decrease"
    INPUT_VAT_INCREASE = "input_vat_increase", "Input VAT Increase"
    INPUT_VAT_DECREASE = "input_vat_decrease", "Input VAT Decrease"
    ROUNDING_ADJUSTMENT = "rounding_adjustment", "Rounding Adjustment"
    OTHER = "other", "Other"


class TaxAdjustmentStatus(models.TextChoices):
    POSTED = "posted", "Posted"
    CANCELLED = "cancelled", "Cancelled"


class TaxPeriod(TenantOwnedModel):
    name = models.CharField(max_length=128)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=16, choices=TaxPeriodStatus.choices, default=TaxPeriodStatus.OPEN,
    )
    notes = models.TextField(blank=True)
    reviewed_by = get_created_by_field("tax_periods_reviewed")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    closed_by = get_created_by_field("tax_periods_closed")
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = get_created_by_field("tax_periods_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"], name="uniq_company_tax_period_name",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "start_date", "end_date"]),
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"


class TaxWarning(TenantOwnedModel):
    warning_type = models.CharField(max_length=48, choices=TaxWarningType.choices)
    severity = models.CharField(
        max_length=16, choices=TaxWarningSeverity.choices,
        default=TaxWarningSeverity.MEDIUM,
    )
    source_type = models.CharField(max_length=32, choices=TaxSourceType.choices)
    source_id = models.CharField(max_length=64, blank=True)
    source_reference = models.CharField(max_length=128, blank=True)
    party_name = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    status = models.CharField(
        max_length=16, choices=TaxWarningStatus.choices, default=TaxWarningStatus.OPEN,
    )
    dismissed_by = get_created_by_field("tax_warnings_dismissed")
    dismissed_at = models.DateTimeField(null=True, blank=True)
    dismiss_reason = models.TextField(blank=True)
    resolved_by = get_created_by_field("tax_warnings_resolved")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["company", "warning_type"]),
            models.Index(fields=["company", "severity"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "source_type", "source_id"]),
        ]

    def __str__(self):
        return f"{self.warning_type} ({self.status})"


class TaxAdjustment(TenantOwnedModel):
    adjustment_number = models.CharField(max_length=64)
    adjustment_date = models.DateField()
    adjustment_type = models.CharField(max_length=32, choices=TaxAdjustmentType.choices)
    amount = models.DecimalField(
        **MONEY, validators=[MinValueValidator(Decimal("0.01"))],
    )
    reason = models.TextField()
    notes = models.TextField(blank=True)
    related_source_type = models.CharField(max_length=32, blank=True)
    related_source_id = models.CharField(max_length=64, blank=True)
    status = models.CharField(
        max_length=16, choices=TaxAdjustmentStatus.choices,
        default=TaxAdjustmentStatus.POSTED,
    )
    posted_by = get_created_by_field("tax_adjustments_posted")
    posted_at = models.DateTimeField(auto_now_add=True)
    cancelled_by = get_created_by_field("tax_adjustments_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-adjustment_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "adjustment_number"],
                name="uniq_company_tax_adjustment_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "adjustment_date"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "adjustment_type"]),
        ]

    def __str__(self):
        return f"{self.adjustment_number} ({self.status})"
