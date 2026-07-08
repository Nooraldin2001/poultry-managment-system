"""Sales invoice domain models (Phase 5).

Design notes
------------
* **Draft** invoices have NO side effects: no stock deduction, no customer ledger.
* **Approval** consumes FIFO stock, posts customer receivable (unpaid balance only),
  records FIFO cost and gross profit.
* **Cancellation** returns stock (via allocation records) and reverses the customer
  ledger effect without deleting history.
* Customer/product snapshots keep historical invoices stable.

See docs/backend/PHASE_5_SALES_IMPLEMENTATION_NOTES.md.
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


class SalesStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    APPROVED = "approved", "Approved"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"
    CANCELLED = "cancelled", "Cancelled"


class SalesPaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"


class SalesPaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    CREDIT = "credit", "Credit / On Account"
    OTHER = "other", "Other"


class SalesLineType(models.TextChoices):
    PRODUCT = "product", "Product"
    BY_PRODUCT = "by_product", "By-product"
    SERVICE = "service", "Service"
    OTHER = "other", "Other"


class SalesPriceSource(models.TextChoices):
    DEFAULT_PRODUCT_PRICE = "default_product_price", "Default Product Price"
    CUSTOMER_SPECIAL_PRICE = "customer_special_price", "Customer Special Price"
    MANUAL_OVERRIDE = "manual_override", "Manual Override"
    FREE_PRODUCT = "free_product", "Free Product"


class SalesAdjustmentType(models.TextChoices):
    LINE_DISCOUNT = "line_discount", "Line Discount"
    INVOICE_DISCOUNT = "invoice_discount", "Invoice Discount"
    COLLECTION_ADJUSTMENT = "collection_adjustment", "Collection Adjustment"
    DAMAGED_GOODS = "damaged_goods_adjustment", "Damaged Goods Adjustment"
    CUSTOMER_SETTLEMENT = "customer_settlement", "Customer Settlement"
    COMMERCIAL_DISCOUNT = "commercial_discount", "Commercial Discount"
    OTHER = "other", "Other"


class SalesAdjustmentEffect(models.TextChoices):
    REDUCE_INVOICE_TOTAL = "reduce_invoice_total", "Reduce Invoice Total"
    REDUCE_CUSTOMER_BALANCE = "reduce_customer_balance", "Reduce Customer Balance"
    NO_FINANCIAL_EFFECT = "no_financial_effect", "No Financial Effect"


class SalesInvoice(TenantOwnedModel):
    """Customer sales invoice header."""

    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="sales_invoices"
    )
    invoice_number = models.CharField(max_length=64)
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=16, choices=SalesStatus.choices, default=SalesStatus.DRAFT
    )
    payment_status = models.CharField(
        max_length=16, choices=SalesPaymentStatus.choices,
        default=SalesPaymentStatus.UNPAID,
    )
    payment_method = models.CharField(
        max_length=16, choices=SalesPaymentMethod.choices,
        default=SalesPaymentMethod.CREDIT,
    )

    subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    discount_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    taxable_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    total_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    amount_paid = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    balance_due = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)

    fifo_cost_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    gross_profit = models.DecimalField(default=ZERO, **MONEY)

    # Amount debited to customer ledger on approval (unpaid balance at approval).
    posted_receivable = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)

    customer_name_snapshot = models.CharField(max_length=255, blank=True)
    customer_trn_snapshot = models.CharField(max_length=32, blank=True)
    customer_phone_snapshot = models.CharField(max_length=32, blank=True)
    customer_address_snapshot = models.TextField(blank=True)
    credit_limit_snapshot = models.DecimalField(
        default=ZERO, validators=_NON_NEG, **MONEY
    )
    credit_limit_override_used = models.BooleanField(default=False)
    credit_limit_override_reason = models.TextField(blank=True)

    notes = models.TextField(blank=True)
    backdate_reason = models.TextField(blank=True)
    approval_reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sales_invoices_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sales_invoices_cancelled",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)

    created_by = get_created_by_field("sales_invoices_created")
    updated_by = get_created_by_field("sales_invoices_updated")

    class Meta:
        ordering = ["-invoice_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "invoice_number"],
                name="uniq_company_sales_invoice_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "customer"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "invoice_date"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} ({self.status})"

    @property
    def vat_enabled(self) -> bool:
        return (self.vat_rate or ZERO) > 0

    @property
    def is_editable(self) -> bool:
        return self.status == SalesStatus.DRAFT


class SalesInvoiceLine(TenantOwnedModel):
    """Product / service line on a sales invoice."""

    invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.CASCADE, related_name="lines"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="sales_lines",
        null=True, blank=True,
    )
    product_name_snapshot = models.CharField(max_length=255, blank=True)
    product_sku_snapshot = models.CharField(max_length=64, blank=True)
    line_type = models.CharField(
        max_length=16, choices=SalesLineType.choices, default=SalesLineType.PRODUCT
    )

    quantity_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    quantity_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    quantity_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)

    unit_price = models.DecimalField(default=ZERO, validators=_NON_NEG, **UNIT_PRICE)
    price_type = models.CharField(
        max_length=10, choices=PriceType.choices, default=PriceType.KG
    )
    price_source = models.CharField(
        max_length=24, choices=SalesPriceSource.choices,
        default=SalesPriceSource.DEFAULT_PRODUCT_PRICE,
    )
    is_free = models.BooleanField(default=False)
    free_reason = models.TextField(blank=True)

    line_subtotal = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    discount_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    taxable_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    line_total = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    fifo_cost_consumed = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    gross_profit = models.DecimalField(default=ZERO, **MONEY)

    notes = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["invoice", "sort_order", "id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
            models.Index(fields=["company", "product"]),
        ]

    @property
    def is_stock_tracked(self) -> bool:
        return bool(
            self.line_type in (SalesLineType.PRODUCT, SalesLineType.BY_PRODUCT)
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


class SalesInvoiceAdjustment(TenantOwnedModel):
    """Discount or collection adjustment on a sales invoice."""

    invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.CASCADE, related_name="adjustments"
    )
    adjustment_type = models.CharField(
        max_length=24, choices=SalesAdjustmentType.choices
    )
    title = models.CharField(max_length=255)
    amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    effect = models.CharField(max_length=24, choices=SalesAdjustmentEffect.choices)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("sales_adjustments_created")

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["company", "invoice"])]


class SalesStatusHistory(TenantOwnedModel):
    invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    reason = models.TextField(blank=True)
    changed_by = get_created_by_field("sales_status_history_changed")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]


class SalesInventoryAllocation(TenantOwnedModel):
    """FIFO layer consumption trace for a sales line (profit + cancellation)."""

    invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.CASCADE, related_name="inventory_allocations"
    )
    invoice_line = models.ForeignKey(
        SalesInvoiceLine, on_delete=models.CASCADE, related_name="allocations"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="sales_allocations"
    )
    fifo_layer = models.ForeignKey(
        "inventory.FIFOStockLayer", on_delete=models.PROTECT,
        related_name="sales_allocations",
    )
    quantity_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    quantity_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    quantity_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    unit_cost_per_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **COST_PER_KG)
    cost_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["company", "invoice"]),
            models.Index(fields=["company", "invoice_line"]),
        ]
