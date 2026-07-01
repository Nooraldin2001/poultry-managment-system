"""DRF serializers for the sales API."""

from decimal import Decimal

from rest_framework import serializers

from apps.customers.models import Customer
from apps.products.models import Product

from .models import (
    SalesAdjustmentEffect,
    SalesAdjustmentType,
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesInvoiceLine,
    SalesLineType,
    SalesStatus,
)

ZERO = Decimal("0")


class SalesInvoiceLineSerializer(serializers.ModelSerializer):
    is_stock_tracked = serializers.BooleanField(read_only=True)

    class Meta:
        model = SalesInvoiceLine
        fields = [
            "id", "product", "product_name_snapshot", "product_sku_snapshot",
            "line_type", "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "price_type", "price_source", "is_free", "free_reason",
            "line_subtotal", "discount_amount", "taxable_amount",
            "vat_rate", "vat_amount", "line_total",
            "fifo_cost_consumed", "gross_profit", "notes", "sort_order",
            "is_stock_tracked",
        ]
        read_only_fields = [
            "line_subtotal", "taxable_amount", "vat_amount", "line_total",
            "fifo_cost_consumed", "gross_profit",
            "product_name_snapshot", "product_sku_snapshot",
        ]


class SalesInvoiceAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesInvoiceAdjustment
        fields = [
            "id", "adjustment_type", "title", "amount", "effect",
            "reason", "notes", "created_at",
        ]
        read_only_fields = ["created_at"]


class SalesInvoiceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesInvoice
        fields = [
            "id", "invoice_number", "customer", "customer_name_snapshot",
            "invoice_date", "due_date", "status", "payment_status",
            "payment_method", "subtotal", "vat_amount", "total_amount",
            "amount_paid", "balance_due", "gross_profit", "created_at",
        ]


class SalesInvoiceDetailSerializer(serializers.ModelSerializer):
    lines = SalesInvoiceLineSerializer(many=True, read_only=True)
    adjustments = SalesInvoiceAdjustmentSerializer(many=True, read_only=True)
    vat_enabled = serializers.BooleanField(read_only=True)

    class Meta:
        model = SalesInvoice
        fields = [
            "id", "invoice_number", "customer", "customer_name_snapshot",
            "customer_trn_snapshot", "customer_phone_snapshot",
            "customer_address_snapshot", "invoice_date", "due_date",
            "status", "payment_status", "payment_method",
            "subtotal", "discount_total", "taxable_amount",
            "vat_rate", "vat_amount", "total_amount", "amount_paid", "balance_due",
            "fifo_cost_total", "gross_profit", "posted_receivable",
            "credit_limit_snapshot", "credit_limit_override_used",
            "credit_limit_override_reason", "vat_enabled", "notes",
            "approval_reason", "approved_by", "approved_at",
            "cancel_reason", "cancelled_by", "cancelled_at",
            "created_by", "updated_by", "created_at", "updated_at",
            "lines", "adjustments",
        ]


class _NonNegativeMixin:
    def _check_non_negative(self, attrs):
        for field in (
            "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "vat_rate", "amount", "amount_paid", "discount_amount",
        ):
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: "Value cannot be negative."})


class SalesInvoiceLineInputSerializer(_NonNegativeMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), required=False, allow_null=True
    )
    line_type = serializers.ChoiceField(
        choices=SalesLineType.choices, default=SalesLineType.PRODUCT
    )
    quantity_cartons = serializers.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    quantity_pieces = serializers.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    quantity_kg = serializers.DecimalField(max_digits=14, decimal_places=3, default=ZERO)
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    price_type = serializers.CharField(required=False)
    price_source = serializers.CharField(required=False, allow_blank=True)
    is_free = serializers.BooleanField(required=False, default=False)
    free_reason = serializers.CharField(required=False, allow_blank=True)
    discount_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    sort_order = serializers.IntegerField(required=False, default=0)
    override_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._check_non_negative(attrs)
        line_type = attrs.get("line_type", SalesLineType.PRODUCT)
        product = attrs.get("product")
        company = self.context["company"]
        if line_type in (SalesLineType.PRODUCT, SalesLineType.BY_PRODUCT):
            if product is None:
                raise serializers.ValidationError({"product": "Product is required."})
        if product is not None:
            if product.company_id != company.id:
                raise serializers.ValidationError(
                    {"product": "Product does not belong to this company."}
                )
            if not product.can_sell:
                raise serializers.ValidationError(
                    {"product": "This product is not sellable."}
                )
            if product.track_inventory and line_type in (
                SalesLineType.PRODUCT, SalesLineType.BY_PRODUCT
            ):
                qty = (
                    attrs.get("quantity_cartons", ZERO)
                    + attrs.get("quantity_pieces", ZERO)
                    + attrs.get("quantity_kg", ZERO)
                )
                if qty <= 0 and not attrs.get("is_free"):
                    raise serializers.ValidationError(
                        {"quantity": "Stock-tracked lines require a quantity."}
                    )
        return attrs


class SalesAdjustmentInputSerializer(_NonNegativeMixin, serializers.Serializer):
    adjustment_type = serializers.ChoiceField(choices=SalesAdjustmentType.choices)
    effect = serializers.ChoiceField(choices=SalesAdjustmentEffect.choices)
    title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, default=ZERO)
    reason = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._check_non_negative(attrs)
        return attrs


class SalesInvoiceCreateUpdateSerializer(_NonNegativeMixin, serializers.Serializer):
    customer = serializers.IntegerField()
    invoice_date = serializers.DateField()
    due_date = serializers.DateField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(
        choices=SalesInvoice._meta.get_field("payment_method").choices, required=False
    )
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=ZERO
    )
    amount_paid = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = SalesInvoiceLineInputSerializer(many=True, required=False)
    adjustments = SalesAdjustmentInputSerializer(many=True, required=False)

    def validate_customer(self, value):
        company = self.context["company"]
        try:
            customer = Customer.objects.get(pk=value, company=company)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found for this company.")
        return customer


class SalesApproveSerializer(serializers.Serializer):
    reason = serializers.CharField()
    credit_override = serializers.BooleanField(required=False, default=False)


class SalesCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class SalesCollectionAdjustmentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    reason = serializers.CharField()
    adjustment_type = serializers.CharField(required=False)


class SalesSummarySerializer(serializers.Serializer):
    total_sales_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    approved_count = serializers.IntegerField()
    draft_count = serializers.IntegerField()
    unpaid_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    customer_receivable_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    sales_vat_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    gross_profit_estimate = serializers.DecimalField(max_digits=16, decimal_places=2)


class SalesPricePreviewSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    price_source = serializers.CharField()
    is_free = serializers.BooleanField()
    price_type = serializers.CharField()


class SalesStockCheckSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    available_cartons = serializers.DecimalField(max_digits=14, decimal_places=2)
    available_pieces = serializers.DecimalField(max_digits=14, decimal_places=2)
    available_kg = serializers.DecimalField(max_digits=14, decimal_places=3)
