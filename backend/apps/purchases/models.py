"""Purchase invoice domain models (Phase 4).

Design notes
------------
* A :class:`PurchaseInvoice` is a header with product :class:`PurchaseInvoiceLine`
  rows, optional :class:`PurchaseAdjustment` rows, and optional
  :class:`PurchaseAttachment` files (supplier invoice uploads).
* **Draft** invoices have NO side effects: no stock, no supplier ledger.
* **Approval** adds stock through the inventory ``add_stock()`` service (creating
  FIFO layers) and posts a supplier payable ledger entry.
* **Cancellation** reverses the supplier ledger and reverses inventory only when
  the purchase's FIFO layers are still fully intact; otherwise it is blocked.
* Supplier/product name + TRN are snapshotted so historical invoices stay stable.

Two money concepts are tracked separately and must never be silently mixed:
* **Supplier payable** (what we owe) — drives ``total_amount`` / ``balance_due``.
* **Inventory cost basis** (FIFO cost) — drives ``unit_cost_per_kg`` on approval.

See docs/backend/PHASE_4_PURCHASES_IMPLEMENTATION_NOTES.md.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.enums import PriceType
from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")

QTY_CARTON = dict(max_digits=14, decimal_places=2)
QTY_PIECE = dict(max_digits=14, decimal_places=2)
QTY_KG = dict(max_digits=14, decimal_places=3)
UNIT_PRICE = dict(max_digits=12, decimal_places=2)
COST_PER_KG = dict(max_digits=12, decimal_places=4)
VAT_RATE = dict(max_digits=5, decimal_places=2)
MONEY = dict(max_digits=16, decimal_places=2)

_NON_NEG = [MinValueValidator(ZERO)]


class PurchaseStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    APPROVED = "approved", "Approved"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"
    CANCELLED = "cancelled", "Cancelled"


class PurchasePaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"


class PurchasePaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    CREDIT = "credit", "Credit / On Account"
    OTHER = "other", "Other"


class ServiceChargeMode(models.TextChoices):
    ADD = "add", "Add"
    DEDUCT = "deduct", "Deduct"


class PurchaseLineType(models.TextChoices):
    PRODUCT = "product", "Product"
    BY_PRODUCT = "by_product", "By-product"
    SERVICE = "service", "Service"
    OTHER = "other", "Other"


class PurchaseAdjustmentType(models.TextChoices):
    SUPPLIER_DEDUCTION = "supplier_deduction", "Supplier Deduction"
    ADD_TO_INVENTORY_COST = "add_to_inventory_cost", "Add to Inventory Cost"
    NORMAL_EXPENSE_LATER = "normal_expense_later", "Normal Expense (later)"
    COMMERCIAL_DISCOUNT = "commercial_discount", "Commercial Discount"
    TRANSPORT_COST = "transport_cost", "Transport Cost"
    SLAUGHTER_COST = "slaughter_cost", "Slaughter Cost"
    LOADING_UNLOADING = "loading_unloading", "Loading / Unloading"
    OTHER = "other", "Other"


class PurchaseAdjustmentEffect(models.TextChoices):
    REDUCE_SUPPLIER_PAYABLE = "reduce_supplier_payable", "Reduce Supplier Payable"
    INCREASE_INVENTORY_COST = "increase_inventory_cost", "Increase Inventory Cost"
    EXPENSE_ONLY_LATER = "expense_only_later", "Expense Only (later)"
    NO_FINANCIAL_EFFECT = "no_financial_effect", "No Financial Effect"


class PurchaseAttachmentType(models.TextChoices):
    SUPPLIER_INVOICE = "supplier_invoice", "Supplier Invoice"
    DELIVERY_NOTE = "delivery_note", "Delivery Note"
    RECEIPT = "receipt", "Receipt"
    OTHER = "other", "Other"


class PurchaseInvoice(TenantOwnedModel):
    """Supplier purchase invoice header."""

    supplier = models.ForeignKey(
        "suppliers.Supplier", on_delete=models.PROTECT, related_name="purchase_invoices"
    )
    invoice_number = models.CharField(max_length=64)
    supplier_invoice_number = models.CharField(max_length=64, blank=True)
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=16, choices=PurchaseStatus.choices, default=PurchaseStatus.DRAFT
    )
    payment_status = models.CharField(
        max_length=16, choices=PurchasePaymentStatus.choices,
        default=PurchasePaymentStatus.UNPAID,
    )
    payment_method = models.CharField(
        max_length=16, choices=PurchasePaymentMethod.choices,
        default=PurchasePaymentMethod.CREDIT,
    )

    # --- Money (supplier payable side) ---
    subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    adjustment_total = models.DecimalField(default=ZERO, **MONEY)
    taxable_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    total_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    amount_paid = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    balance_due = models.DecimalField(default=ZERO, **MONEY)
    money_account = models.ForeignKey(
        "payments.MoneyAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_invoices",
    )
    supplier_payable_posted = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    # Gross payable before slaughterhouse/transport deductions (subtotal + adjustments + VAT).
    gross_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    slaughterhouse_supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="slaughterhouse_purchase_deductions",
    )
    slaughterhouse_deduction_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    slaughterhouse_deduction_posted = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    transport_supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transport_purchase_deductions",
    )
    transport_deduction_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    transport_deduction_posted = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    deduction_notes = models.TextField(blank=True)
    slaughterhouse_mode = models.CharField(
        max_length=8,
        choices=ServiceChargeMode.choices,
        default=ServiceChargeMode.DEDUCT,
    )
    transport_mode = models.CharField(
        max_length=8,
        choices=ServiceChargeMode.choices,
        default=ServiceChargeMode.DEDUCT,
    )
    final_invoice_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    # Inventory cost basis (subtotal + increase_inventory_cost adjustments).
    inventory_cost_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)

    # --- Snapshots (stable history) ---
    supplier_name_snapshot = models.CharField(max_length=255, blank=True)
    supplier_trn_snapshot = models.CharField(max_length=32, blank=True)

    notes = models.TextField(blank=True)
    backdate_reason = models.TextField(blank=True)

    approval_reason = models.TextField(blank=True)
    approved_by = get_created_by_field("purchase_invoices_approved")
    approved_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    cancelled_by = get_created_by_field("purchase_invoices_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)

    created_by = get_created_by_field("purchase_invoices_created")
    updated_by = get_created_by_field("purchase_invoices_updated")

    class Meta:
        ordering = ["-invoice_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "invoice_number"],
                name="uniq_company_purchase_invoice_number",
            ),
            models.UniqueConstraint(
                fields=["company", "supplier", "supplier_invoice_number"],
                condition=~models.Q(supplier_invoice_number=""),
                name="uniq_company_supplier_invoice_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "supplier"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "invoice_date"]),
            models.Index(fields=["company", "payment_status"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} ({self.status})"

    @property
    def is_draft(self) -> bool:
        return self.status == PurchaseStatus.DRAFT

    @property
    def is_editable(self) -> bool:
        return self.status == PurchaseStatus.DRAFT

    @property
    def vat_enabled(self) -> bool:
        return (self.vat_rate or ZERO) > 0


class PurchaseInvoiceLine(TenantOwnedModel):
    """Product / cost line on a purchase invoice."""

    invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.CASCADE, related_name="lines"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="purchase_lines",
        null=True, blank=True,
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True)
    product_sku_snapshot = models.CharField(max_length=64, blank=True)
    line_type = models.CharField(
        max_length=16, choices=PurchaseLineType.choices, default=PurchaseLineType.PRODUCT
    )

    quantity_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    quantity_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    quantity_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)

    unit_price = models.DecimalField(default=ZERO, validators=_NON_NEG, **UNIT_PRICE)
    price_type = models.CharField(
        max_length=10, choices=PriceType.choices, default=PriceType.KG
    )

    line_subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    line_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    # FIFO cost allocation per KG, computed at approval (includes allocated
    # increase_inventory_cost adjustments).
    unit_cost_per_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **COST_PER_KG)

    notes = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["invoice", "sort_order", "id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
            models.Index(fields=["company", "product"]),
        ]

    def __str__(self):
        return f"Line {self.invoice_id}/{self.product_id} {self.line_subtotal}"

    @property
    def is_stock_tracked(self) -> bool:
        return bool(
            self.line_type in (PurchaseLineType.PRODUCT, PurchaseLineType.BY_PRODUCT)
            and self.product_id
            and getattr(self.product, "track_inventory", False)
        )

    @property
    def has_quantity(self) -> bool:
        return (
            (self.quantity_cartons or ZERO) > 0
            or (self.quantity_pieces or ZERO) > 0
            or (self.quantity_kg or ZERO) > 0
        )


class PurchaseAdjustment(TenantOwnedModel):
    """Adjustment attached to a purchase invoice (deduction / extra cost / etc.)."""

    invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.CASCADE, related_name="adjustments"
    )
    adjustment_type = models.CharField(
        max_length=24, choices=PurchaseAdjustmentType.choices
    )
    effect = models.CharField(max_length=24, choices=PurchaseAdjustmentEffect.choices)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("purchase_adjustments_created")

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
        ]

    def __str__(self):
        return f"{self.adjustment_type} {self.amount} ({self.effect})"


class PurchaseAttachment(TenantOwnedModel):
    """Uploaded supplier invoice / delivery note / receipt for a purchase."""

    invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="purchase_attachments/")
    file_type = models.CharField(
        max_length=16, choices=PurchaseAttachmentType.choices,
        default=PurchaseAttachmentType.SUPPLIER_INVOICE,
    )
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_by = get_created_by_field("purchase_attachments_uploaded")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
        ]

    def __str__(self):
        return f"Attachment {self.invoice_id} {self.file_type}"


class PurchaseStatusHistory(TenantOwnedModel):
    """Status transition trail for a purchase invoice (audit log also covers it)."""

    invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=16, choices=PurchaseStatus.choices, blank=True)
    to_status = models.CharField(max_length=16, choices=PurchaseStatus.choices)
    reason = models.TextField(blank=True)
    changed_by = get_created_by_field("purchase_status_changes")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
        ]

    def __str__(self):
        return f"{self.invoice_id}: {self.from_status} -> {self.to_status}"
