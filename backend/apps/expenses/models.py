"""Expense domain models (Phase 8).

Expenses record operational costs. They do NOT create double-entry accounting or
payment ledger entries in this phase.

Purchase-linked expenses may optionally create draft PurchaseAdjustment rows
(reduce payable / increase inventory cost) — those do NOT count as operational
expenses in summaries unless ``purchase_link_behavior = expense_only``.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")
VAT_RATE = dict(max_digits=5, decimal_places=2)
MONEY = dict(max_digits=16, decimal_places=2)
_NON_NEG = [MinValueValidator(ZERO)]


class ExpenseCategoryType(models.TextChoices):
    DAILY = "daily", "Daily"
    MONTHLY = "monthly", "Monthly"
    RECURRING = "recurring", "Recurring"
    PURCHASE_LINKED = "purchase_linked", "Purchase Linked"
    GENERAL = "general", "General"


class ExpenseScope(models.TextChoices):
    DAILY = "daily", "Daily"
    MONTHLY = "monthly", "Monthly"
    PURCHASE_LINKED = "purchase_linked", "Purchase Linked"
    RECURRING_GENERATED = "recurring_generated", "Recurring Generated"
    GENERAL = "general", "General"


class ExpensePaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    OTHER = "other", "Other"


class PurchaseLinkBehavior(models.TextChoices):
    NONE = "none", "None"
    EXPENSE_ONLY = "expense_only", "Expense Only"
    REDUCE_SUPPLIER_PAYABLE = "reduce_supplier_payable", "Reduce Supplier Payable"
    INCREASE_INVENTORY_COST = "increase_inventory_cost", "Increase Inventory Cost"


class ExpenseStatus(models.TextChoices):
    POSTED = "posted", "Posted"
    CANCELLED = "cancelled", "Cancelled"


class RecurrencePeriod(models.TextChoices):
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class ExpenseAttachmentType(models.TextChoices):
    RECEIPT = "receipt", "Receipt"
    INVOICE = "invoice", "Invoice"
    PROOF = "proof", "Proof"
    OTHER = "other", "Other"


class ExpenseCategory(TenantOwnedModel):
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    code = models.CharField(max_length=32)
    description = models.TextField(blank=True)
    category_type = models.CharField(
        max_length=24, choices=ExpenseCategoryType.choices,
        default=ExpenseCategoryType.GENERAL,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name_ar"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"], name="uniq_company_expense_category_code",
            ),
            models.UniqueConstraint(
                fields=["company", "name_ar"], name="uniq_company_expense_category_name_ar",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "category_type"]),
            models.Index(fields=["company", "is_active"]),
        ]

    def __str__(self):
        return self.name_ar


class Expense(TenantOwnedModel):
    expense_number = models.CharField(max_length=64)
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, related_name="expenses",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    expense_date = models.DateField()
    expense_scope = models.CharField(
        max_length=24, choices=ExpenseScope.choices, default=ExpenseScope.GENERAL,
    )
    amount = models.DecimalField(**MONEY, validators=[MinValueValidator(Decimal("0.01"))])
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    total_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    payment_method = models.CharField(
        max_length=16, choices=ExpensePaymentMethod.choices,
        default=ExpensePaymentMethod.CASH,
    )
    reference_number = models.CharField(max_length=64, blank=True)
    vendor_name = models.CharField(max_length=255, blank=True)
    employee_name = models.CharField(max_length=255, blank=True)
    vehicle_number = models.CharField(max_length=32, blank=True)
    linked_purchase_invoice = models.ForeignKey(
        "purchases.PurchaseInvoice", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="linked_expenses",
    )
    purchase_link_behavior = models.CharField(
        max_length=32, choices=PurchaseLinkBehavior.choices,
        default=PurchaseLinkBehavior.NONE,
    )
    related_purchase_adjustment = models.ForeignKey(
        "purchases.PurchaseAdjustment", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="source_expense",
    )
    status = models.CharField(
        max_length=16, choices=ExpenseStatus.choices, default=ExpenseStatus.POSTED,
    )
    notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = get_created_by_field("expenses_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_by = get_created_by_field("expenses_created")
    updated_by = get_created_by_field("expenses_updated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "expense_number"], name="uniq_company_expense_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "expense_date"]),
            models.Index(fields=["company", "category"]),
            models.Index(fields=["company", "expense_scope"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "linked_purchase_invoice"]),
        ]

    def __str__(self):
        return f"{self.expense_number} ({self.status})"

    @property
    def is_editable(self) -> bool:
        return self.status == ExpenseStatus.POSTED

    @property
    def counts_in_operational_totals(self) -> bool:
        """Whether this expense should appear in operational expense summaries."""
        if self.status != ExpenseStatus.POSTED:
            return False
        if self.purchase_link_behavior in (
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ):
            return False
        return True


class RecurringExpense(TenantOwnedModel):
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, related_name="recurring_expenses",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    amount = models.DecimalField(**MONEY, validators=[MinValueValidator(Decimal("0.01"))])
    vat_rate = models.DecimalField(default=ZERO, validators=_NON_NEG, **VAT_RATE)
    vat_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    total_amount = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    recurrence = models.CharField(max_length=16, choices=RecurrencePeriod.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_due_date = models.DateField()
    payment_method = models.CharField(
        max_length=16, choices=ExpensePaymentMethod.choices,
        default=ExpensePaymentMethod.CASH,
    )
    vendor_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    auto_generate = models.BooleanField(default=False)
    created_by = get_created_by_field("recurring_expenses_created")
    updated_by = get_created_by_field("recurring_expenses_updated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["next_due_date", "id"]
        indexes = [
            models.Index(fields=["company", "is_active"]),
            models.Index(fields=["company", "next_due_date"]),
        ]

    def __str__(self):
        return self.title


class ExpenseAttachment(TenantOwnedModel):
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="attachments",
    )
    file = models.FileField(upload_to="expense_attachments/")
    file_type = models.CharField(
        max_length=16, choices=ExpenseAttachmentType.choices,
        default=ExpenseAttachmentType.RECEIPT,
    )
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_by = get_created_by_field("expense_attachments_uploaded")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]
        indexes = [
            models.Index(fields=["company", "expense"]),
        ]

    def __str__(self):
        return f"Attachment {self.expense_id} {self.file_type}"


class ExpenseStatusHistory(TenantOwnedModel):
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="status_history",
    )
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    reason = models.TextField(blank=True)
    changed_by = get_created_by_field("expense_status_history")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]
