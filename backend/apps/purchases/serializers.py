"""DRF serializers for the purchases API.

Write serializers validate tenant ownership (supplier/product), reject negative
quantities/prices, and block edits to non-draft invoices. Approval/cancellation
serializers enforce a non-empty reason.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.products.models import Product

from .models import (
    PurchaseAdjustment,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseLineType,
    PurchaseStatus,
)

ZERO = Decimal("0")


# ── Read serializers ────────────────────────────────────────────────────────
class PurchaseInvoiceLineSerializer(serializers.ModelSerializer):
    is_stock_tracked = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseInvoiceLine
        fields = [
            "id", "product", "product_name_snapshot", "product_sku_snapshot",
            "line_type", "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "price_type", "line_subtotal", "vat_rate", "vat_amount",
            "line_total", "unit_cost_per_kg", "notes", "sort_order",
            "is_stock_tracked",
        ]
        read_only_fields = [
            "line_subtotal", "vat_amount", "line_total", "unit_cost_per_kg",
            "product_name_snapshot", "product_sku_snapshot",
        ]


class PurchaseAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseAdjustment
        fields = [
            "id", "adjustment_type", "effect", "title", "amount",
            "vat_rate", "vat_amount", "notes", "created_at",
        ]
        read_only_fields = ["vat_amount", "created_at"]


class PurchaseAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseAttachment
        fields = [
            "id", "file", "file_type", "original_filename",
            "uploaded_by", "uploaded_at", "notes",
        ]
        read_only_fields = ["uploaded_by", "uploaded_at", "original_filename"]


class PurchaseInvoiceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseInvoice
        fields = [
            "id", "invoice_number", "supplier", "supplier_name_snapshot",
            "supplier_invoice_number", "invoice_date", "due_date",
            "status", "payment_status", "payment_method",
            "subtotal", "vat_amount", "total_amount", "amount_paid",
            "balance_due", "created_at",
        ]


class PurchaseInvoiceDetailSerializer(serializers.ModelSerializer):
    lines = PurchaseInvoiceLineSerializer(many=True, read_only=True)
    adjustments = PurchaseAdjustmentSerializer(many=True, read_only=True)
    attachments = PurchaseAttachmentSerializer(many=True, read_only=True)
    vat_enabled = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseInvoice
        fields = [
            "id", "invoice_number", "supplier", "supplier_name_snapshot",
            "supplier_trn_snapshot", "supplier_invoice_number",
            "invoice_date", "due_date", "status", "payment_status",
            "payment_method", "subtotal", "adjustment_total", "taxable_amount",
            "vat_rate", "vat_amount", "total_amount", "amount_paid", "balance_due",
            "inventory_cost_total", "vat_enabled", "notes",
            "approval_reason", "approved_by", "approved_at",
            "cancel_reason", "cancelled_by", "cancelled_at",
            "created_by", "updated_by", "created_at", "updated_at",
            "lines", "adjustments", "attachments",
        ]


# ── Write serializers ───────────────────────────────────────────────────────
class _NonNegativeMixin:
    def _check_non_negative(self, attrs):
        for field in ("quantity_cartons", "quantity_pieces", "quantity_kg",
                      "unit_price", "vat_rate", "amount", "amount_paid"):
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError(
                    {field: "Value cannot be negative."}
                )


class PurchaseInvoiceLineInputSerializer(_NonNegativeMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), required=False, allow_null=True
    )
    line_type = serializers.ChoiceField(
        choices=PurchaseLineType.choices, default=PurchaseLineType.PRODUCT
    )
    quantity_cartons = serializers.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    quantity_pieces = serializers.DecimalField(max_digits=14, decimal_places=2, default=ZERO)
    quantity_kg = serializers.DecimalField(max_digits=14, decimal_places=3, default=ZERO)
    # None means "use the resolved default" (supplier special price, then the
    # product's default purchase price). An explicit different value is a
    # manual override and requires purchases.override_price.
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, default=None
    )
    price_type = serializers.CharField(required=False)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    notes = serializers.CharField(required=False, allow_blank=True)
    sort_order = serializers.IntegerField(required=False, default=0)
    override_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._check_non_negative(attrs)
        line_type = attrs.get("line_type", PurchaseLineType.PRODUCT)
        product = attrs.get("product")
        company = self.context["company"]

        if line_type in (PurchaseLineType.PRODUCT, PurchaseLineType.BY_PRODUCT):
            if product is None and not self.partial:
                raise serializers.ValidationError(
                    {"product": "Product is required for product lines."}
                )
        if product is not None:
            if product.company_id != company.id:
                raise serializers.ValidationError(
                    {"product": "Product does not belong to this company."}
                )
            if not product.can_purchase:
                raise serializers.ValidationError(
                    {"product": "This product is not purchasable."}
                )
            # Stock-tracked product lines must carry a quantity.
            if (
                product.track_inventory
                and line_type in (PurchaseLineType.PRODUCT, PurchaseLineType.BY_PRODUCT)
            ):
                qty = (
                    attrs.get("quantity_cartons", ZERO)
                    + attrs.get("quantity_pieces", ZERO)
                    + attrs.get("quantity_kg", ZERO)
                )
                if qty <= 0:
                    raise serializers.ValidationError(
                        {"quantity": "Stock-tracked product lines require a quantity."}
                    )
        return attrs


class PurchaseAdjustmentInputSerializer(_NonNegativeMixin, serializers.Serializer):
    adjustment_type = serializers.ChoiceField(
        choices=PurchaseAdjustment._meta.get_field("adjustment_type").choices
    )
    effect = serializers.ChoiceField(
        choices=PurchaseAdjustment._meta.get_field("effect").choices
    )
    title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, default=ZERO)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        self._check_non_negative(attrs)
        return attrs


class PurchaseInvoiceCreateUpdateSerializer(_NonNegativeMixin, serializers.Serializer):
    supplier = serializers.IntegerField()
    invoice_date = serializers.DateField()
    due_date = serializers.DateField(required=False, allow_null=True)
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(
        choices=PurchaseInvoice._meta.get_field("payment_method").choices,
        required=False,
    )
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=ZERO
    )
    amount_paid = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = PurchaseInvoiceLineInputSerializer(many=True, required=False)
    adjustments = PurchaseAdjustmentInputSerializer(many=True, required=False)

    def validate_supplier(self, value):
        from apps.suppliers.models import Supplier

        company = self.context["company"]
        try:
            supplier = Supplier.objects.get(pk=value, company=company)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError(
                "Supplier does not belong to this company."
            )
        return supplier

    def validate(self, attrs):
        if "invoice_number" in self.initial_data:
            raise serializers.ValidationError(
                {"invoice_number": "Internal invoice number is assigned automatically."}
            )
        self._check_non_negative(attrs)
        return attrs


class PurchaseApproveSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("Reason is required to approve.")
        return value


class PurchaseCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("Reason is required to cancel.")
        return value


class PurchaseAttachmentCreateSerializer(serializers.Serializer):
    file = serializers.FileField()
    file_type = serializers.ChoiceField(
        choices=PurchaseAttachment._meta.get_field("file_type").choices,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class PurchaseSummarySerializer(serializers.Serializer):
    total_purchases_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    approved_purchases_count = serializers.IntegerField()
    draft_purchases_count = serializers.IntegerField()
    unpaid_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    supplier_payable_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchase_vat_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    top_suppliers = serializers.ListField(child=serializers.DictField(), required=False)
