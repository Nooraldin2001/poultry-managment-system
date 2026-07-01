"""Payment movement models (Phase 6).

Unified record for customer collections, supplier payments, refunds, and related
movements. Ledger effects are posted via customers/suppliers services; invoice
allocations update sales/purchase payment state.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")
MONEY = dict(max_digits=16, decimal_places=2)
_NON_NEG = [MinValueValidator(ZERO)]


class PaymentMovementType(models.TextChoices):
    CUSTOMER_COLLECTION = "customer_collection", "Customer Collection"
    SUPPLIER_PAYMENT = "supplier_payment", "Supplier Payment"
    CUSTOMER_REFUND = "customer_refund", "Customer Refund"
    SUPPLIER_REFUND = "supplier_refund", "Supplier Refund"
    COLLECTION_ADJUSTMENT = "collection_adjustment", "Collection Adjustment"
    SUPPLIER_ADJUSTMENT = "supplier_adjustment", "Supplier Adjustment"
    OTHER = "other", "Other"


class PartyType(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    SUPPLIER = "supplier", "Supplier"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    OTHER = "other", "Other"


class PaymentMovementStatus(models.TextChoices):
    POSTED = "posted", "Posted"
    CANCELLED = "cancelled", "Cancelled"


class AllocationType(models.TextChoices):
    SALES_INVOICE = "sales_invoice", "Sales Invoice"
    PURCHASE_INVOICE = "purchase_invoice", "Purchase Invoice"
    ACCOUNT_LEVEL = "account_level", "Account Level"


class PaymentMovement(TenantOwnedModel):
    """Posted or cancelled payment/collection/refund movement."""

    movement_number = models.CharField(max_length=64)
    receipt_number = models.CharField(max_length=64, blank=True)
    movement_type = models.CharField(max_length=32, choices=PaymentMovementType.choices)
    party_type = models.CharField(max_length=16, choices=PartyType.choices)
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT,
        null=True, blank=True, related_name="payment_movements",
    )
    supplier = models.ForeignKey(
        "suppliers.Supplier", on_delete=models.PROTECT,
        null=True, blank=True, related_name="payment_movements",
    )
    movement_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    amount = models.DecimalField(**MONEY, validators=_NON_NEG)
    reference_number = models.CharField(max_length=64, blank=True)
    bank_name = models.CharField(max_length=128, blank=True)
    cheque_number = models.CharField(max_length=64, blank=True)
    cheque_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=PaymentMovementStatus.choices,
        default=PaymentMovementStatus.POSTED,
    )
    posted_by = get_created_by_field("payment_movements_posted")
    posted_at = models.DateTimeField(auto_now_add=True)
    cancelled_by = get_created_by_field("payment_movements_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-movement_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "movement_number"],
                name="uniq_company_payment_movement_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "movement_type"]),
            models.Index(fields=["company", "party_type"]),
            models.Index(fields=["company", "customer"]),
            models.Index(fields=["company", "supplier"]),
            models.Index(fields=["company", "movement_date"]),
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"{self.movement_number} ({self.movement_type})"

    def clean(self):
        from django.core.exceptions import ValidationError as DjangoValidationError

        if self.amount is not None and self.amount <= 0:
            raise DjangoValidationError({"amount": "Amount must be positive."})
        if self.party_type == PartyType.CUSTOMER:
            if not self.customer_id:
                raise DjangoValidationError({"customer": "Customer is required."})
            if self.supplier_id:
                raise DjangoValidationError({"supplier": "Must be empty for customer party."})
        elif self.party_type == PartyType.SUPPLIER:
            if not self.supplier_id:
                raise DjangoValidationError({"supplier": "Supplier is required."})
            if self.customer_id:
                raise DjangoValidationError({"customer": "Must be empty for supplier party."})


class PaymentAllocation(TenantOwnedModel):
    """Links a payment movement to a sales/purchase invoice or account level."""

    movement = models.ForeignKey(
        PaymentMovement, on_delete=models.CASCADE, related_name="allocations"
    )
    allocation_type = models.CharField(max_length=24, choices=AllocationType.choices)
    sales_invoice = models.ForeignKey(
        "sales.SalesInvoice", on_delete=models.PROTECT,
        null=True, blank=True, related_name="payment_allocations",
    )
    purchase_invoice = models.ForeignKey(
        "purchases.PurchaseInvoice", on_delete=models.PROTECT,
        null=True, blank=True, related_name="payment_allocations",
    )
    allocated_amount = models.DecimalField(**MONEY, validators=_NON_NEG)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["company", "movement"]),
            models.Index(fields=["company", "sales_invoice"]),
            models.Index(fields=["company", "purchase_invoice"]),
        ]


class PaymentStatusHistory(TenantOwnedModel):
    movement = models.ForeignKey(
        PaymentMovement, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    reason = models.TextField(blank=True)
    changed_by = get_created_by_field("payment_status_history")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]
