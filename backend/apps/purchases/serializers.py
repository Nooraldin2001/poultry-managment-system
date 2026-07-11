"""DRF serializers for the purchases API.

Write serializers validate tenant ownership (supplier/product), reject negative
quantities/prices, and block edits to non-draft invoices. Approval/cancellation
serializers enforce a non-empty reason.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.products.models import Product

from apps.core.serializer_mixins import PurchaseInvoiceDateValidationMixin
from apps.core.line_pricing import normalize_price_type
from apps.products.poultry_cuts import validate_purchase_line_quantities

from .models import (
    PurchaseAdjustment,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseLineType,
    PurchaseStatus,
    ServiceChargeMode,
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
            "money_account",
            "subtotal", "vat_amount", "total_amount", "amount_paid",
            "balance_due", "created_at",
        ]


class PurchaseInvoiceDetailSerializer(serializers.ModelSerializer):
    lines = PurchaseInvoiceLineSerializer(many=True, read_only=True)
    adjustments = PurchaseAdjustmentSerializer(many=True, read_only=True)
    attachments = PurchaseAttachmentSerializer(many=True, read_only=True)
    vat_enabled = serializers.BooleanField(read_only=True)
    slaughterhouse_amount = serializers.DecimalField(
        source="slaughterhouse_deduction_amount", max_digits=16, decimal_places=2, read_only=True,
    )
    transport_amount = serializers.DecimalField(
        source="transport_deduction_amount", max_digits=16, decimal_places=2, read_only=True,
    )
    service_notes = serializers.CharField(source="deduction_notes", read_only=True)

    class Meta:
        model = PurchaseInvoice
        fields = [
            "id", "invoice_number", "supplier", "supplier_name_snapshot",
            "supplier_trn_snapshot", "supplier_invoice_number",
            "invoice_date", "due_date", "status", "payment_status",
            "payment_method", "subtotal", "adjustment_total", "taxable_amount",
            "vat_rate", "vat_amount", "gross_total", "final_invoice_total",
            "total_amount", "amount_paid", "balance_due",
            "inventory_cost_total", "money_account", "supplier_payable_posted",
            "slaughterhouse_supplier", "slaughterhouse_amount",
            "slaughterhouse_deduction_amount", "slaughterhouse_mode",
            "transport_supplier", "transport_amount",
            "transport_deduction_amount", "transport_mode",
            "service_notes", "deduction_notes",
            "vat_enabled", "notes", "backdate_reason",
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

    def validate_price_type(self, value):
        if value is None or value == "":
            return value
        try:
            return normalize_price_type(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

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
            # Stock-tracked product lines must carry a valid quantity for product type.
            if (
                product.track_inventory
                and line_type in (PurchaseLineType.PRODUCT, PurchaseLineType.BY_PRODUCT)
            ):
                from apps.products.poultry_cuts import is_kg_primary_product

                # KG-primary cuts may be saved on draft with KG=0; approval enforces KG>0.
                if not is_kg_primary_product(product):
                    qty_errors = validate_purchase_line_quantities(
                        product=product,
                        quantity_cartons=attrs.get("quantity_cartons", ZERO),
                        quantity_pieces=attrs.get("quantity_pieces", ZERO),
                        quantity_kg=attrs.get("quantity_kg", ZERO),
                    )
                    if qty_errors:
                        raise serializers.ValidationError(qty_errors)
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


class PurchaseInvoiceCreateUpdateSerializer(
    PurchaseInvoiceDateValidationMixin, _NonNegativeMixin, serializers.Serializer,
):
    supplier = serializers.IntegerField()
    invoice_date = serializers.DateField()
    backdate_reason = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    supplier_invoice_number = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(
        choices=PurchaseInvoice._meta.get_field("payment_method").choices,
        required=False,
    )
    money_account = serializers.IntegerField(required=False, allow_null=True)
    vat_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=ZERO
    )
    amount_paid = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = PurchaseInvoiceLineInputSerializer(many=True, required=False)
    adjustments = PurchaseAdjustmentInputSerializer(many=True, required=False)
    slaughterhouse_supplier = serializers.IntegerField(required=False, allow_null=True)
    slaughterhouse_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    slaughterhouse_deduction_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False
    )
    slaughterhouse_mode = serializers.ChoiceField(
        choices=ServiceChargeMode.choices, required=False, default=ServiceChargeMode.DEDUCT
    )
    transport_supplier = serializers.IntegerField(required=False, allow_null=True)
    transport_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, default=ZERO
    )
    transport_deduction_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False
    )
    transport_mode = serializers.ChoiceField(
        choices=ServiceChargeMode.choices, required=False, default=ServiceChargeMode.DEDUCT
    )
    service_notes = serializers.CharField(required=False, allow_blank=True)
    deduction_notes = serializers.CharField(required=False, allow_blank=True)

    def _resolve_supplier(self, value, field_name):
        if value is None:
            return None
        from apps.suppliers.models import Supplier

        company = self.context["company"]
        try:
            return Supplier.objects.get(pk=value, company=company)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError(
                {field_name: "Supplier does not belong to this company."}
            )

    def validate_slaughterhouse_supplier(self, value):
        if value is None:
            return None
        return self._resolve_supplier(value, "slaughterhouse_supplier")

    def validate_transport_supplier(self, value):
        if value is None:
            return None
        return self._resolve_supplier(value, "transport_supplier")

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
        initial = self.initial_data
        if "slaughterhouse_amount" not in attrs and "slaughterhouse_deduction_amount" in initial:
            attrs["slaughterhouse_amount"] = initial.get("slaughterhouse_deduction_amount", ZERO)
        if "transport_amount" not in attrs and "transport_deduction_amount" in initial:
            attrs["transport_amount"] = initial.get("transport_deduction_amount", ZERO)
        if "service_notes" not in attrs and "deduction_notes" in initial:
            attrs["service_notes"] = initial.get("deduction_notes", "")
        if "slaughterhouse_amount" in attrs:
            attrs["slaughterhouse_deduction_amount"] = attrs["slaughterhouse_amount"]
        if "transport_amount" in attrs:
            attrs["transport_deduction_amount"] = attrs["transport_amount"]
        if "service_notes" in attrs:
            attrs["deduction_notes"] = attrs["service_notes"]
        self._check_non_negative(attrs)
        company = self.context["company"]
        account_id = attrs.get("money_account")
        if account_id is not None:
            from apps.payments.models import MoneyAccount

            try:
                attrs["money_account"] = MoneyAccount.objects.get(pk=account_id, company=company)
            except MoneyAccount.DoesNotExist:
                raise serializers.ValidationError({"money_account": "Money account not found for this company."})
        return super().validate(attrs)


class PurchaseApproveSerializer(serializers.Serializer):
    reason = serializers.CharField()
    # Optional fallback so approving a backdated invoice that is missing its
    # stored backdate reason can supply one in the approve payload.
    backdate_reason = serializers.CharField(required=False, allow_blank=True)

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
    gross_purchases_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    service_deductions_this_month = serializers.DecimalField(max_digits=16, decimal_places=2)
    approved_purchases_count = serializers.IntegerField()
    draft_purchases_count = serializers.IntegerField()
    unpaid_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    supplier_payable_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchase_vat_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    top_suppliers = serializers.ListField(child=serializers.DictField(), required=False)
