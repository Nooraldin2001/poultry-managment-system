"""DRF serializers for payments API."""

from decimal import Decimal

from rest_framework import serializers

from apps.customers.models import Customer
from apps.purchases.models import PurchaseInvoice
from apps.sales.models import SalesInvoice
from apps.suppliers.models import Supplier

from .models import (
    MoneyAccount,
    MoneyMovement,
    PaymentAllocation,
    PaymentMethod,
    PaymentMovement,
)

ZERO = Decimal("0")


class PaymentAllocationSerializer(serializers.ModelSerializer):
    sales_invoice_number = serializers.CharField(
        source="sales_invoice.invoice_number", read_only=True, default=None
    )
    purchase_invoice_number = serializers.CharField(
        source="purchase_invoice.invoice_number", read_only=True, default=None
    )

    class Meta:
        model = PaymentAllocation
        fields = [
            "id", "allocation_type", "sales_invoice", "sales_invoice_number",
            "purchase_invoice", "purchase_invoice_number", "allocated_amount",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PaymentMovementListSerializer(serializers.ModelSerializer):
    party_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMovement
        fields = [
            "id", "movement_number", "receipt_number", "movement_type",
            "party_type", "customer", "supplier", "party_name",
            "movement_date", "payment_method", "amount", "status",
            "reference_number", "posted_at",
        ]

    def get_party_name(self, obj):
        if obj.customer_id:
            return obj.customer.name_ar
        if obj.supplier_id:
            return obj.supplier.name_ar
        return ""


class PaymentMovementDetailSerializer(serializers.ModelSerializer):
    allocations = PaymentAllocationSerializer(many=True, read_only=True)
    party_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMovement
        fields = [
            "id", "movement_number", "receipt_number", "movement_type",
            "party_type", "customer", "supplier", "party_name",
            "movement_date", "payment_method", "amount", "reference_number",
            "bank_name", "cheque_number", "cheque_date", "notes", "status",
            "posted_by", "posted_at", "cancelled_by", "cancelled_at",
            "cancel_reason", "created_at", "updated_at", "allocations",
        ]

    def get_party_name(self, obj):
        if obj.customer_id:
            return obj.customer.name_ar
        if obj.supplier_id:
            return obj.supplier.name_ar
        return ""


class _AllocationInputSerializer(serializers.Serializer):
    sales_invoice = serializers.IntegerField(required=False, allow_null=True)
    purchase_invoice = serializers.IntegerField(required=False, allow_null=True)
    allocated_amount = serializers.DecimalField(max_digits=16, decimal_places=2)

    def validate_allocated_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be positive.")
        return value


class _PaymentBaseSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    movement_date = serializers.DateField(required=False)
    reference_number = serializers.CharField(required=False, allow_blank=True)
    bank_name = serializers.CharField(required=False, allow_blank=True)
    cheque_number = serializers.CharField(required=False, allow_blank=True)
    cheque_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    reason = serializers.CharField(required=False, allow_blank=True)
    allocations = _AllocationInputSerializer(many=True, required=False)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def _resolve_allocations(self, items, company):
        resolved = []
        total = ZERO
        for item in items or []:
            data = dict(item)
            sid = data.pop("sales_invoice", None)
            pid = data.pop("purchase_invoice", None)
            if sid:
                try:
                    inv = SalesInvoice.objects.get(pk=sid, company=company)
                except SalesInvoice.DoesNotExist:
                    raise serializers.ValidationError(
                        {"allocations": f"Sales invoice {sid} not found."}
                    )
                data["sales_invoice"] = inv
            if pid:
                try:
                    inv = PurchaseInvoice.objects.get(pk=pid, company=company)
                except PurchaseInvoice.DoesNotExist:
                    raise serializers.ValidationError(
                        {"allocations": f"Purchase invoice {pid} not found."}
                    )
                data["purchase_invoice"] = inv
            total += data["allocated_amount"]
            resolved.append(data)
        return resolved, total

    def validate(self, attrs):
        allocations = attrs.get("allocations", [])
        if allocations:
            company = self.context["company"]
            resolved, total = self._resolve_allocations(allocations, company)
            if total > attrs["amount"]:
                raise serializers.ValidationError(
                    {"allocations": "Total allocations exceed payment amount."}
                )
            attrs["_resolved_allocations"] = resolved
        else:
            attrs["_resolved_allocations"] = []
        return attrs


class CustomerCollectionCreateSerializer(_PaymentBaseSerializer):
    customer = serializers.IntegerField()

    def validate_customer(self, value):
        company = self.context["company"]
        try:
            return Customer.objects.get(pk=value, company=company)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found for this company.")


class SupplierPaymentCreateSerializer(_PaymentBaseSerializer):
    supplier = serializers.IntegerField()

    def validate_supplier(self, value):
        company = self.context["company"]
        try:
            return Supplier.objects.get(pk=value, company=company)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError("Supplier not found for this company.")


class CustomerRefundCreateSerializer(_PaymentBaseSerializer):
    customer = serializers.IntegerField()
    reason = serializers.CharField()
    allow_override = serializers.BooleanField(required=False, default=False)

    def validate_customer(self, value):
        company = self.context["company"]
        try:
            return Customer.objects.get(pk=value, company=company)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found for this company.")


class SupplierRefundCreateSerializer(_PaymentBaseSerializer):
    supplier = serializers.IntegerField()
    reason = serializers.CharField()
    allow_override = serializers.BooleanField(required=False, default=False)

    def validate_supplier(self, value):
        company = self.context["company"]
        try:
            return Supplier.objects.get(pk=value, company=company)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError("Supplier not found for this company.")


class PaymentCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class PaymentSummarySerializer(serializers.Serializer):
    total_customer_collections_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_supplier_payments_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_customer_refunds_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_supplier_refunds_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_cash_movement = serializers.DecimalField(max_digits=16, decimal_places=2)
    unpaid_sales_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    unpaid_purchase_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    cancelled_movements_count = serializers.IntegerField()
    payment_method_breakdown = serializers.DictField(child=serializers.CharField())


class CustomerBalanceReconciliationSerializer(serializers.Serializer):
    current_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    ledger_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    open_sales_invoice_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    difference = serializers.DecimalField(max_digits=16, decimal_places=2)
    status = serializers.CharField()


class SupplierBalanceReconciliationSerializer(serializers.Serializer):
    current_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    ledger_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    open_purchase_invoice_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    difference = serializers.DecimalField(max_digits=16, decimal_places=2)
    status = serializers.CharField()


class MoneyAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoneyAccount
        fields = [
            "id",
            "name",
            "account_type",
            "bank_name",
            "account_number",
            "iban",
            "currency",
            "opening_balance",
            "current_balance",
            "is_active",
            "allow_negative",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "current_balance", "created_at", "updated_at"]


class MoneyMovementSerializer(serializers.ModelSerializer):
    money_account_name = serializers.CharField(source="money_account.name", read_only=True)

    class Meta:
        model = MoneyMovement
        fields = [
            "id",
            "money_account",
            "money_account_name",
            "movement_type",
            "direction",
            "amount",
            "reference_type",
            "reference_id",
            "description",
            "reason",
            "movement_date",
            "created_by",
            "created_at",
        ]


class MoneyAdjustmentSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["in", "out"])
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    reason = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class TreasurySummarySerializer(serializers.Serializer):
    cashbox_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    bank_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    available_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    accounts_count = serializers.IntegerField()
    active_cashboxes = serializers.IntegerField()
    active_banks = serializers.IntegerField()
    today_inflows = serializers.DecimalField(max_digits=16, decimal_places=2)
    today_outflows = serializers.DecimalField(max_digits=16, decimal_places=2)


class AccountStatementSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    closing_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    movements = MoneyMovementSerializer(many=True)


class AccountTransferSerializer(serializers.Serializer):
    from_account = serializers.IntegerField()
    to_account = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    reason = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        company = self.context["company"]
        try:
            attrs["from_account"] = MoneyAccount.objects.get(
                pk=attrs["from_account"], company=company
            )
        except MoneyAccount.DoesNotExist as exc:
            raise serializers.ValidationError({"from_account": "Source account not found."}) from exc
        try:
            attrs["to_account"] = MoneyAccount.objects.get(
                pk=attrs["to_account"], company=company
            )
        except MoneyAccount.DoesNotExist as exc:
            raise serializers.ValidationError({"to_account": "Destination account not found."}) from exc
        if attrs["amount"] <= 0:
            raise serializers.ValidationError({"amount": "Amount must be positive."})
        return attrs
