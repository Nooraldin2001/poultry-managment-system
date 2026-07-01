from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.enums import PriceType
from apps.core.models import TenantOwnedModel, get_created_by_field

# ── Balance convention (documented) ────────────────────────────────────────
# Customer ledger uses debit/credit columns. The customer's running balance is:
#     current_balance = Σ(debit) − Σ(credit)
# A POSITIVE balance means the customer OWES US (a receivable).
# A NEGATIVE balance means WE OWE THE CUSTOMER (credit/advance).
# Opening balance with type "zero" creates NO ledger entry.


class CustomerType(models.TextChoices):
    CASH = "cash", "Cash"
    CREDIT = "credit", "Credit"


class OpeningBalanceType(models.TextChoices):
    CUSTOMER_OWES_US = "customer_owes_us", "Customer owes us"
    WE_OWE_CUSTOMER = "we_owe_customer", "We owe customer"
    ZERO = "zero", "Zero"


class CreditStatus(models.TextChoices):
    CLEAR = "clear", "Clear"
    NEAR_LIMIT = "near_limit", "Near limit"
    EXCEEDED = "exceeded", "Exceeded"


class CustomerCategory(TenantOwnedModel):
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    code = models.CharField(max_length=32)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name_ar"]
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="uniq_company_customercategory_code"),
            models.UniqueConstraint(fields=["company", "name_ar"], name="uniq_company_customercategory_name_ar"),
        ]
        verbose_name_plural = "customer categories"

    def __str__(self):
        return f"{self.name_ar} ({self.code})"


class Customer(TenantOwnedModel):
    category = models.ForeignKey(
        CustomerCategory, on_delete=models.PROTECT, related_name="customers",
        null=True, blank=True,
    )
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32)
    whatsapp = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    emirate = models.CharField(max_length=64, blank=True)
    trn = models.CharField(max_length=32, blank=True)

    customer_type = models.CharField(
        max_length=10, choices=CustomerType.choices, default=CustomerType.CASH
    )

    opening_balance = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    opening_balance_type = models.CharField(
        max_length=20, choices=OpeningBalanceType.choices, default=OpeningBalanceType.ZERO
    )
    current_balance = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )

    credit_limit = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    payment_terms_days = models.PositiveIntegerField(null=True, blank=True)
    block_sales_when_credit_exceeded = models.BooleanField(default=True)
    allow_admin_credit_override = models.BooleanField(default=True)

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    inactive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["name_ar"]
        indexes = [
            models.Index(fields=["company", "name_ar"]),
            models.Index(fields=["company", "phone"]),
            models.Index(fields=["company", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "trn"],
                condition=~models.Q(trn=""),
                name="uniq_company_customer_trn",
            )
        ]

    def __str__(self):
        return self.name_ar

    @property
    def credit_status(self) -> str:
        if self.current_balance <= 0 or self.credit_limit <= 0:
            return CreditStatus.CLEAR
        if self.current_balance >= self.credit_limit:
            return CreditStatus.EXCEEDED
        if self.current_balance >= (self.credit_limit * Decimal("0.9")):
            return CreditStatus.NEAR_LIMIT
        return CreditStatus.CLEAR


class CustomerLedgerEntry(TenantOwnedModel):
    """Append-only ledger backing the customer statement."""

    class EntryType(models.TextChoices):
        OPENING_BALANCE = "opening_balance", "Opening Balance"
        SALES_INVOICE = "sales_invoice", "Sales Invoice"
        COLLECTION = "collection", "Collection"
        COLLECTION_DISCOUNT = "collection_discount", "Collection Discount"
        CUSTOMER_REFUND = "customer_refund", "Customer Refund"
        SALES_RETURN = "sales_return", "Sales Return"
        TAX_CREDIT_NOTE = "tax_credit_note", "Tax Credit Note"
        MANUAL_ADJUSTMENT = "manual_adjustment", "Manual Adjustment"

    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="ledger_entries"
    )
    entry_type = models.CharField(max_length=24, choices=EntryType.choices)
    reference_type = models.CharField(max_length=64, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)
    reference_number = models.CharField(max_length=64, blank=True)
    description = models.CharField(max_length=255, blank=True)
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    balance_after = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    entry_date = models.DateField()
    created_by = get_created_by_field("customer_ledger_entries_created")
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["entry_date", "id"]
        indexes = [
            models.Index(fields=["company", "customer", "entry_date"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.customer_id} {self.entry_type} D{self.debit} C{self.credit}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Customer ledger entries are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Customer ledger entries are append-only.")


class CustomerSpecialPrice(TenantOwnedModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="special_prices")
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="customer_special_prices")
    price = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))]
    )
    price_type = models.CharField(max_length=10, choices=PriceType.choices, default=PriceType.KG)
    is_active = models.BooleanField(default=True)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("customer_special_prices_created")
    updated_by = get_created_by_field("customer_special_prices_updated")

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "customer", "product", "price_type"],
                condition=models.Q(is_active=True),
                name="uniq_active_customer_special_price",
            )
        ]

    def __str__(self):
        return f"{self.customer_id}/{self.product_id} {self.price} ({self.price_type})"


class CustomerFreeProductAgreement(TenantOwnedModel):
    class AgreementType(models.TextChoices):
        ALWAYS_FREE = "always_free", "Always Free"
        FREE_WHEN_SELECTED = "free_when_selected", "Free When Selected"
        MINIMUM_INVOICE_AMOUNT = "minimum_invoice_amount", "Minimum Invoice Amount"
        MINIMUM_QUANTITY = "minimum_quantity", "Minimum Quantity"

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="free_product_agreements")
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="customer_free_agreements")
    agreement_type = models.CharField(max_length=24, choices=AgreementType.choices)
    condition_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    condition_quantity = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("customer_free_agreements_created")
    updated_by = get_created_by_field("customer_free_agreements_updated")

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.customer_id}/{self.product_id} {self.agreement_type}"


class CustomerCreditLimitChange(TenantOwnedModel):
    class ChangeType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        TEMPORARY_FOR_INVOICE = "temporary_for_invoice", "Temporary (for invoice)"

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="credit_limit_changes")
    previous_limit = models.DecimalField(max_digits=14, decimal_places=2)
    new_limit = models.DecimalField(max_digits=14, decimal_places=2)
    change_type = models.CharField(max_length=24, choices=ChangeType.choices, default=ChangeType.PERMANENT)
    related_reference_type = models.CharField(max_length=64, blank=True)
    related_reference_id = models.CharField(max_length=64, blank=True)
    reason = models.TextField()
    changed_by = get_created_by_field("customer_credit_limit_changes")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at", "-id"]

    def __str__(self):
        return f"{self.customer_id} {self.previous_limit}->{self.new_limit}"
