from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.enums import PaymentMethod, PriceType
from apps.core.models import TenantOwnedModel, get_created_by_field

# ── Balance convention (documented) ────────────────────────────────────────
# Supplier ledger uses debit/credit columns. The supplier's running balance is:
#     current_balance = Σ(credit) − Σ(debit)
# A POSITIVE balance means WE OWE THE SUPPLIER (a payable).
# A NEGATIVE balance means the SUPPLIER OWES US (credit/advance in our favour).
# Opening balance with type "zero" creates NO ledger entry.


class SupplierType(models.TextChoices):
    CASH = "cash", "Cash"
    BANK = "bank", "Bank"
    CREDIT = "credit", "Credit"


class OpeningBalanceType(models.TextChoices):
    WE_OWE_SUPPLIER = "we_owe_supplier", "We owe supplier"
    SUPPLIER_OWES_US = "supplier_owes_us", "Supplier owes us"
    ZERO = "zero", "Zero"


class BalanceStatus(models.TextChoices):
    CLEAR = "clear", "Clear"
    PAYABLE = "payable", "Payable"
    CREDIT = "credit", "Credit"


class SupplierCategory(TenantOwnedModel):
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    code = models.CharField(max_length=32)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name_ar"]
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="uniq_company_suppliercategory_code"),
            models.UniqueConstraint(fields=["company", "name_ar"], name="uniq_company_suppliercategory_name_ar"),
        ]
        verbose_name_plural = "supplier categories"

    def __str__(self):
        return f"{self.name_ar} ({self.code})"


class Supplier(TenantOwnedModel):
    category = models.ForeignKey(
        SupplierCategory, on_delete=models.PROTECT, related_name="suppliers",
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

    supplier_type = models.CharField(
        max_length=10, choices=SupplierType.choices, default=SupplierType.CASH
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

    payment_terms_days = models.PositiveIntegerField(null=True, blank=True)
    default_payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    track_balance = models.BooleanField(default=True)

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
                name="uniq_company_supplier_trn",
            )
        ]

    def __str__(self):
        return self.name_ar

    @property
    def balance_status(self) -> str:
        if self.current_balance > 0:
            return BalanceStatus.PAYABLE
        if self.current_balance < 0:
            return BalanceStatus.CREDIT
        return BalanceStatus.CLEAR


class SupplierLedgerEntry(TenantOwnedModel):
    """Append-only ledger backing the supplier statement."""

    class EntryType(models.TextChoices):
        OPENING_BALANCE = "opening_balance", "Opening Balance"
        PURCHASE_INVOICE = "purchase_invoice", "Purchase Invoice"
        SUPPLIER_PAYMENT = "supplier_payment", "Supplier Payment"
        SUPPLIER_REFUND = "supplier_refund", "Supplier Refund"
        PURCHASE_DEDUCTION = "purchase_deduction", "Purchase Deduction"
        PURCHASE_CANCELLATION = "purchase_cancellation", "Purchase Cancellation"
        PURCHASE_RETURN = "purchase_return", "Purchase Return"
        MANUAL_ADJUSTMENT = "manual_adjustment", "Manual Adjustment"

    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="ledger_entries"
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
    created_by = get_created_by_field("supplier_ledger_entries_created")
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["entry_date", "id"]
        indexes = [
            models.Index(fields=["company", "supplier", "entry_date"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.supplier_id} {self.entry_type} D{self.debit} C{self.credit}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Supplier ledger entries are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Supplier ledger entries are append-only.")


class SupplierSpecialPrice(TenantOwnedModel):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="special_prices")
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="supplier_special_prices")
    price = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))]
    )
    price_type = models.CharField(max_length=10, choices=PriceType.choices, default=PriceType.KG)
    is_active = models.BooleanField(default=True)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("supplier_special_prices_created")
    updated_by = get_created_by_field("supplier_special_prices_updated")

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "supplier", "product", "price_type"],
                condition=models.Q(is_active=True),
                name="uniq_active_supplier_special_price",
            )
        ]

    def __str__(self):
        return f"{self.supplier_id}/{self.product_id} {self.price} ({self.price_type})"


class SupplierAgreement(TenantOwnedModel):
    class AgreementType(models.TextChoices):
        PAYMENT_TERMS = "payment_terms", "Payment Terms"
        SLAUGHTER_DEDUCTION = "slaughter_deduction", "Slaughter Deduction"
        TRANSPORT_DEDUCTION = "transport_deduction", "Transport Deduction"
        LOADING_UNLOADING_COST = "loading_unloading_cost", "Loading/Unloading Cost"
        VAT_BEHAVIOR = "vat_behavior", "VAT Behavior"
        DEFAULT_PIECES_PER_CARTON = "default_pieces_per_carton", "Default Pieces Per Carton"
        DEFAULT_PURCHASE_METHOD = "default_purchase_method", "Default Purchase Method"
        GENERAL_NOTE = "general_note", "General Note"
        SPECIAL_AGREEMENT = "special_agreement", "Special Agreement"

    # Agreement types that carry a financial default (changes are sensitive).
    FINANCIAL_TYPES = {
        AgreementType.SLAUGHTER_DEDUCTION,
        AgreementType.TRANSPORT_DEDUCTION,
        AgreementType.LOADING_UNLOADING_COST,
        AgreementType.PAYMENT_TERMS,
        AgreementType.VAT_BEHAVIOR,
    }

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="agreements")
    agreement_type = models.CharField(max_length=32, choices=AgreementType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    default_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    applies_automatically = models.BooleanField(default=False)
    suggestion_only = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    attachment = models.FileField(upload_to="supplier_agreements/", null=True, blank=True)
    created_by = get_created_by_field("supplier_agreements_created")
    updated_by = get_created_by_field("supplier_agreements_updated")

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.supplier_id} {self.agreement_type}: {self.title}"

    @property
    def is_financial(self) -> bool:
        return self.agreement_type in self.FINANCIAL_TYPES
