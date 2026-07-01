"""Quotation domain models (Phase 7).

Quotations have NO side effects: no stock, no customer ledger, no payments.
Conversion creates a sales invoice **draft** only.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")

QTY_CARTON = dict(max_digits=14, decimal_places=2)
QTY_PIECE = dict(max_digits=14, decimal_places=2)
QTY_KG = dict(max_digits=14, decimal_places=3)
UNIT_PRICE = dict(max_digits=12, decimal_places=2)
VAT_RATE = dict(max_digits=5, decimal_places=2)
MONEY = dict(max_digits=16, decimal_places=2)

_NON_NEG = [MinValueValidator(ZERO)]


class QuotationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SENT = "sent", "Sent"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    EXPIRED = "expired", "Expired"
    CONVERTED = "converted", "Converted"
    CANCELLED = "cancelled", "Cancelled"


class QuotationLineType(models.TextChoices):
    PRODUCT = "product", "Product"
    BY_PRODUCT = "by_product", "By-product"
    SERVICE = "service", "Service"
    OTHER = "other", "Other"


class QuotationPriceSource(models.TextChoices):
    DEFAULT_PRODUCT_PRICE = "default_product_price", "Default Product Price"
    CUSTOMER_SPECIAL_PRICE = "customer_special_price", "Customer Special Price"
    MANUAL_OVERRIDE = "manual_override", "Manual Override"
    FREE_PRODUCT = "free_product", "Free Product"


class Quotation(TenantOwnedModel):
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="quotations"
    )
    quotation_number = models.CharField(max_length=64)
    quotation_date = models.DateField()
    valid_until = models.DateField()

    status = models.CharField(
        max_length=16, choices=QuotationStatus.choices, default=QuotationStatus.DRAFT
    )

    subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    discount_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    taxable_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    total_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)

    customer_name_snapshot = models.CharField(max_length=255, blank=True)
    customer_trn_snapshot = models.CharField(max_length=32, blank=True)
    customer_phone_snapshot = models.CharField(max_length=32, blank=True)
    customer_address_snapshot = models.TextField(blank=True)

    terms_and_conditions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    converted_sales_invoice = models.ForeignKey(
        "sales.SalesInvoice", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="source_quotation",
    )

    created_by = get_created_by_field("quotations_created")
    updated_by = get_created_by_field("quotations_updated")
    sent_by = get_created_by_field("quotations_sent")
    accepted_by = get_created_by_field("quotations_accepted")
    rejected_by = get_created_by_field("quotations_rejected")
    converted_by = get_created_by_field("quotations_converted")
    cancelled_by = get_created_by_field("quotations_cancelled")

    cancel_reason = models.TextField(blank=True)
    reject_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-quotation_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "quotation_number"],
                name="uniq_company_quotation_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "customer"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "quotation_date"]),
            models.Index(fields=["company", "valid_until"]),
        ]

    def __str__(self):
        return f"{self.quotation_number} ({self.status})"

    @property
    def is_editable(self) -> bool:
        return self.status == QuotationStatus.DRAFT


class QuotationLine(TenantOwnedModel):
    quotation = models.ForeignKey(
        Quotation, on_delete=models.CASCADE, related_name="lines"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT,
        null=True, blank=True, related_name="quotation_lines",
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True)
    product_sku_snapshot = models.CharField(max_length=64, blank=True)
    line_type = models.CharField(
        max_length=16, choices=QuotationLineType.choices, default=QuotationLineType.PRODUCT
    )
    quantity_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    quantity_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    quantity_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    unit_price = models.DecimalField(default=ZERO, validators=_NON_NEG, **UNIT_PRICE)
    price_type = models.CharField(max_length=16, default="kg")
    price_source = models.CharField(
        max_length=32, choices=QuotationPriceSource.choices,
        default=QuotationPriceSource.DEFAULT_PRODUCT_PRICE,
    )
    is_free = models.BooleanField(default=False)
    free_reason = models.TextField(blank=True)
    line_subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    discount_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    taxable_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    line_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    notes = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["company", "quotation"]),
            models.Index(fields=["company", "product"]),
        ]

    @property
    def is_stock_tracked(self) -> bool:
        if self.line_type in (QuotationLineType.SERVICE, QuotationLineType.OTHER):
            return False
        return bool(self.product and self.product.track_inventory)

    @property
    def has_quantity(self) -> bool:
        return (
            self.quantity_cartons > 0
            or self.quantity_pieces > 0
            or self.quantity_kg > 0
        )


class QuotationStatusHistory(TenantOwnedModel):
    quotation = models.ForeignKey(
        Quotation, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    reason = models.TextField(blank=True)
    changed_by = get_created_by_field("quotation_status_history")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]
