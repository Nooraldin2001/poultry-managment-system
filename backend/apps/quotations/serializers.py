"""DRF serializers for quotations API."""

from decimal import Decimal

from rest_framework import serializers

from apps.customers.models import Customer
from apps.products.models import Product

from .models import (
    Quotation,
    QuotationLine,
    QuotationLineType,
    QuotationPriceSource,
    QuotationStatus,
    QuotationStatusHistory,
)

ZERO = Decimal("0")


class QuotationLineSerializer(serializers.ModelSerializer):
    is_stock_tracked = serializers.BooleanField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = [
            "id", "product", "product_name_snapshot", "product_sku_snapshot",
            "line_type", "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "price_type", "price_source", "is_free", "free_reason",
            "line_subtotal", "discount_amount", "taxable_amount",
            "vat_rate", "vat_amount", "line_total", "notes", "sort_order",
            "is_stock_tracked",
        ]
        read_only_fields = [
            "line_subtotal", "taxable_amount", "vat_amount", "line_total",
            "product_name_snapshot", "product_sku_snapshot",
        ]


class QuotationStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationStatusHistory
        fields = ["id", "from_status", "to_status", "reason", "changed_by", "changed_at"]
        read_only_fields = fields


class QuotationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = [
            "id", "quotation_number", "customer", "customer_name_snapshot",
            "quotation_date", "valid_until", "status", "total_amount",
            "converted_sales_invoice", "created_at",
        ]


class QuotationDetailSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    status_history = QuotationStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            "id", "quotation_number", "customer", "customer_name_snapshot",
            "customer_trn_snapshot", "customer_phone_snapshot",
            "customer_address_snapshot", "quotation_date", "valid_until", "status",
            "subtotal", "discount_total", "taxable_amount", "vat_rate", "vat_amount",
            "total_amount", "terms_and_conditions", "notes", "internal_notes",
            "sent_at", "accepted_at", "rejected_at", "expired_at", "converted_at",
            "cancelled_at", "converted_sales_invoice", "cancel_reason", "reject_reason",
            "created_by", "updated_by", "sent_by", "accepted_by", "rejected_by",
            "converted_by", "cancelled_by", "created_at", "updated_at",
            "lines", "status_history",
        ]


class _NonNegativeMixin:
    def _check_non_negative(self, attrs):
        for field in (
            "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "vat_rate", "discount_amount",
        ):
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: "Value cannot be negative."})


class QuotationLineInputSerializer(_NonNegativeMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), required=False, allow_null=True
    )
    line_type = serializers.ChoiceField(
        choices=QuotationLineType.choices, default=QuotationLineType.PRODUCT
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
        line_type = attrs.get("line_type", QuotationLineType.PRODUCT)
        product = attrs.get("product")
        company = self.context["company"]
        if line_type in (QuotationLineType.PRODUCT, QuotationLineType.BY_PRODUCT):
            if product is None:
                raise serializers.ValidationError({"product": "Product is required."})
        if product is not None:
            if product.company_id != company.id:
                raise serializers.ValidationError(
                    {"product": "Product does not belong to this company."}
                )
            if not product.can_quote:
                raise serializers.ValidationError({"product": "Product is not quotable."})
            if product.track_inventory and line_type in (
                QuotationLineType.PRODUCT, QuotationLineType.BY_PRODUCT
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


class QuotationCreateUpdateSerializer(_NonNegativeMixin, serializers.Serializer):
    customer = serializers.IntegerField()
    quotation_date = serializers.DateField()
    valid_until = serializers.DateField()
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=ZERO
    )
    terms_and_conditions = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True)
    lines = QuotationLineInputSerializer(many=True, required=False)

    def validate_customer(self, value):
        company = self.context["company"]
        try:
            return Customer.objects.get(pk=value, company=company)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found for this company.")

    def validate(self, attrs):
        self._check_non_negative(attrs)
        if attrs.get("quotation_date") and attrs.get("valid_until"):
            if attrs["valid_until"] < attrs["quotation_date"]:
                raise serializers.ValidationError(
                    {"valid_until": "Valid until must be on or after quotation date."}
                )
        return attrs


class QuotationStatusActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class QuotationRejectSerializer(serializers.Serializer):
    reason = serializers.CharField()


class QuotationCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class QuotationConvertToSalesSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class QuotationSummarySerializer(serializers.Serializer):
    total_quotations_this_month = serializers.IntegerField()
    draft_count = serializers.IntegerField()
    sent_count = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()
    expired_count = serializers.IntegerField()
    converted_count = serializers.IntegerField()
    total_quoted_amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    conversion_rate = serializers.DecimalField(max_digits=8, decimal_places=2)


class QuotationPricePreviewSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    price_source = serializers.CharField()
    is_free = serializers.BooleanField()
    price_type = serializers.CharField()


class QuotationStockWarningSerializer(serializers.Serializer):
    line_id = serializers.IntegerField()
    product_id = serializers.IntegerField(allow_null=True)
    product_name = serializers.CharField()
    enough_stock = serializers.BooleanField()
    available_cartons = serializers.DecimalField(max_digits=14, decimal_places=2)
    available_pieces = serializers.DecimalField(max_digits=14, decimal_places=2)
    available_kg = serializers.DecimalField(max_digits=14, decimal_places=3)
    requested_cartons = serializers.DecimalField(max_digits=14, decimal_places=2)
    requested_pieces = serializers.DecimalField(max_digits=14, decimal_places=2)
    requested_kg = serializers.DecimalField(max_digits=14, decimal_places=3)
    warning_message = serializers.CharField()
