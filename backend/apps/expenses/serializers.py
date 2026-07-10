"""Expense API serializers (Phase 8)."""

from decimal import Decimal

from rest_framework import serializers

from apps.permissions.services import has_permission
from apps.purchases.models import PurchaseInvoice

from .models import (
    Expense,
    ExpenseAttachment,
    ExpenseCategory,
    ExpenseScope,
    ExpenseStatus,
    PurchaseLinkBehavior,
    RecurringExpense,
)


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = [
            "id", "name_ar", "name_en", "code", "description", "category_type",
            "is_active", "sort_order", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ExpenseListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id", "expense_number", "category", "category_name", "title",
            "expense_date", "expense_scope", "total_amount", "payment_method",
            "status", "vendor_name", "linked_purchase_invoice",
            "purchase_link_behavior", "created_at",
        ]


class ExpenseStatusHistorySerializer(serializers.Serializer):
    from_status = serializers.CharField()
    to_status = serializers.CharField()
    reason = serializers.CharField()
    changed_at = serializers.DateTimeField()
    changed_by_name = serializers.CharField()


class ExpenseAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseAttachment
        fields = [
            "id", "file", "file_type", "original_filename",
            "uploaded_by", "uploaded_at", "notes",
        ]
        read_only_fields = ["id", "uploaded_by", "uploaded_at"]


class ExpenseDetailSerializer(serializers.ModelSerializer):
    category_detail = ExpenseCategorySerializer(source="category", read_only=True)
    attachments = ExpenseAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id", "expense_number", "category", "category_detail", "title",
            "description", "expense_date", "expense_scope", "amount", "vat_rate",
            "vat_amount", "total_amount", "payment_method", "reference_number",
            "vendor_name", "employee_name", "vehicle_number",
            "linked_purchase_invoice", "purchase_link_behavior",
            "related_purchase_adjustment", "status", "notes",
            "cancellation_reason", "cancelled_at", "attachments",
            "created_by", "updated_by", "created_at", "updated_at",
        ]


class ExpenseCreateUpdateSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(queryset=ExpenseCategory.objects.all())
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    expense_date = serializers.DateField()
    expense_scope = serializers.ChoiceField(
        choices=ExpenseScope.choices, required=False, default=ExpenseScope.GENERAL,
    )
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=Decimal("0"),
    )
    payment_method = serializers.CharField(required=False, default="cash")
    money_account = serializers.IntegerField(required=False, allow_null=True)
    reference_number = serializers.CharField(required=False, allow_blank=True, default="")
    vendor_name = serializers.CharField(required=False, allow_blank=True, default="")
    employee_name = serializers.CharField(required=False, allow_blank=True, default="")
    vehicle_number = serializers.CharField(required=False, allow_blank=True, default="")
    linked_purchase_invoice = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseInvoice.objects.all(), required=False, allow_null=True,
    )
    purchase_link_behavior = serializers.ChoiceField(
        choices=PurchaseLinkBehavior.choices,
        required=False,
        default=PurchaseLinkBehavior.NONE,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        company = self.context["company"]
        category = attrs["category"]
        if category.company_id != company.id:
            raise serializers.ValidationError({"category": "Category must belong to your company."})

        invoice = attrs.get("linked_purchase_invoice")
        if invoice and invoice.company_id != company.id:
            raise serializers.ValidationError(
                {"linked_purchase_invoice": "Purchase invoice must belong to your company."}
            )

        amount = attrs.get("amount")
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be positive."})

        vat_rate = attrs.get("vat_rate", Decimal("0"))
        if vat_rate is not None and vat_rate < 0:
            raise serializers.ValidationError({"vat_rate": "VAT rate cannot be negative."})

        if "money_account" in attrs:
            account_id = attrs.get("money_account")
            if account_id is None:
                attrs["money_account"] = None
            else:
                from apps.payments.treasury_integration import get_money_account
                attrs["money_account"] = get_money_account(company, account_id)

        behavior = attrs.get("purchase_link_behavior", PurchaseLinkBehavior.NONE)
        if behavior in (
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ):
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if not user or not has_permission(user, "expenses.purchase_link"):
                raise serializers.ValidationError(
                    {"purchase_link_behavior": "Missing permission: expenses.purchase_link."}
                )
            if not attrs.get("reason"):
                raise serializers.ValidationError(
                    {"reason": "Reason required for purchase-linked expense."}
                )

        return attrs


class ExpenseCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class RecurringExpenseListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)

    class Meta:
        model = RecurringExpense
        fields = [
            "id", "category", "category_name", "title", "amount", "total_amount",
            "recurrence", "start_date", "end_date", "next_due_date",
            "payment_method", "is_active", "auto_generate",
        ]


class RecurringExpenseDetailSerializer(serializers.ModelSerializer):
    category_detail = ExpenseCategorySerializer(source="category", read_only=True)

    class Meta:
        model = RecurringExpense
        fields = [
            "id", "category", "category_detail", "title", "description",
            "amount", "vat_rate", "vat_amount", "total_amount", "recurrence",
            "start_date", "end_date", "next_due_date", "payment_method",
            "vendor_name", "notes", "is_active", "auto_generate",
            "created_by", "updated_by", "created_at", "updated_at",
        ]


class RecurringExpenseCreateUpdateSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(queryset=ExpenseCategory.objects.all())
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=Decimal("0"),
    )
    recurrence = serializers.ChoiceField(choices=RecurringExpense._meta.get_field("recurrence").choices)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    payment_method = serializers.CharField(required=False, default="cash")
    vendor_name = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False, default=True)
    auto_generate = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        company = self.context["company"]
        category = attrs["category"]
        if category.company_id != company.id:
            raise serializers.ValidationError({"category": "Category must belong to your company."})
        if attrs.get("amount", 0) <= 0:
            raise serializers.ValidationError({"amount": "Amount must be positive."})
        end = attrs.get("end_date")
        start = attrs.get("start_date")
        if end and start and end < start:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        return attrs


class RecurringExpenseGenerateSerializer(serializers.Serializer):
    target_date = serializers.DateField(required=False)
    money_account = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        account_id = attrs.get("money_account")
        if account_id is not None:
            from apps.payments.treasury_integration import get_money_account

            attrs["money_account"] = get_money_account(self.context["company"], account_id)
        return attrs


class ExpenseSummarySerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    total_expenses = serializers.DecimalField(max_digits=16, decimal_places=2)
    daily_expenses = serializers.DecimalField(max_digits=16, decimal_places=2)
    monthly_expenses = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchase_linked_expenses = serializers.DecimalField(max_digits=16, decimal_places=2)
    recurring_due_count = serializers.IntegerField()
    cancelled_expenses_count = serializers.IntegerField()
    category_breakdown = serializers.ListField()
    payment_method_breakdown = serializers.ListField()


class ExpenseProfitImpactSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    sales_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchases_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    expenses_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    gross_profit_if_available = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_profit_foundation = serializers.DecimalField(max_digits=16, decimal_places=2)
    fifo_gross_profit_foundation = serializers.DecimalField(max_digits=16, decimal_places=2)
    notes = serializers.CharField()


class ExpenseVoucherPreviewSerializer(serializers.Serializer):
    title_en = serializers.CharField()
    title_ar = serializers.CharField()
    company = serializers.DictField()
    voucher = serializers.DictField()
    prepared_by = serializers.CharField()
