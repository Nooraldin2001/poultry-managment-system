from decimal import Decimal

from rest_framework import serializers

from apps.products.models import Product

from . import services
from .models import (
    AdjustmentType,
    InventoryBalance,
    StockAdjustment,
    StockMovement,
    StocktakingLine,
    StocktakingSession,
)


class _ProductMixin:
    """Shared validation: product must belong to company + track inventory."""

    def _validate_product(self, product):
        request = self.context.get("request")
        if request and product.company_id != request.user.company_id:
            raise serializers.ValidationError("Product does not belong to this company.")
        if not product.track_inventory:
            raise serializers.ValidationError("This product does not track inventory.")
        return product


class InventoryBalanceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    category = serializers.IntegerField(source="product.category_id", read_only=True)
    stock_status = serializers.CharField(read_only=True)
    minimum_stock_cartons = serializers.DecimalField(
        source="product.minimum_stock_cartons", max_digits=12, decimal_places=2, read_only=True
    )
    minimum_stock_kg = serializers.DecimalField(
        source="product.minimum_stock_kg", max_digits=12, decimal_places=3, read_only=True
    )
    estimated_fifo_value = serializers.SerializerMethodField()

    class Meta:
        model = InventoryBalance
        fields = [
            "id", "product", "product_name", "product_sku", "category",
            "available_cartons", "available_pieces", "available_kg",
            "reserved_cartons", "reserved_pieces", "reserved_kg",
            "minimum_stock_cartons", "minimum_stock_kg",
            "stock_status", "estimated_fifo_value",
            "last_movement_at", "last_stocktaking_at", "notes",
        ]
        read_only_fields = fields

    def get_estimated_fifo_value(self, obj):
        if not self.context.get("include_valuation"):
            return None
        return services.estimate_fifo_value(obj.company, obj.product)


class InventorySummarySerializer(serializers.Serializer):
    total_cartons = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_pieces = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_kg = serializers.DecimalField(max_digits=16, decimal_places=3)
    active_products_count = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()
    out_of_stock_count = serializers.IntegerField()
    estimated_fifo_value = serializers.DecimalField(max_digits=18, decimal_places=2)
    last_movement_at = serializers.DateTimeField(allow_null=True)


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)
    movement_type_label = serializers.CharField(source="get_movement_type_display", read_only=True)
    direction_label = serializers.CharField(source="get_direction_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "movement_type", "movement_type_label",
            "direction", "direction_label", "reference_type", "reference_id",
            "reference_number", "cartons_delta", "pieces_delta", "kg_delta",
            "balance_cartons_after", "balance_pieces_after", "balance_kg_after",
            "fifo_cost_consumed", "unit_cost_per_kg", "reason", "notes",
            "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = fields


class InventoryProductDetailSerializer(serializers.Serializer):
    balance = InventoryBalanceSerializer()
    recent_movements = StockMovementSerializer(many=True)
    estimated_fifo_value = serializers.DecimalField(
        max_digits=18, decimal_places=2, allow_null=True
    )
    carton_weight_kg = serializers.DecimalField(
        max_digits=12, decimal_places=3, allow_null=True
    )


class OpeningStockSerializer(_ProductMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    cartons = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    pieces = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    kg = serializers.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    unit_cost_per_kg = serializers.DecimalField(
        max_digits=12, decimal_places=4, default=Decimal("0"), min_value=Decimal("0")
    )
    reference_number = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_product(self, product):
        return self._validate_product(product)

    def validate_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Reason is required for opening stock.")
        return value

    def validate(self, attrs):
        if attrs["cartons"] <= 0 and attrs["pieces"] <= 0 and attrs["kg"] <= 0:
            raise serializers.ValidationError(
                "At least one quantity (cartons/pieces/kg) must be positive."
            )
        return attrs


class StockAdjustmentCreateSerializer(_ProductMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    adjustment_type = serializers.ChoiceField(choices=AdjustmentType.choices)
    # For increase/decrease:
    cartons = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    pieces = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    kg = serializers.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    # For correction (absolute new values):
    new_cartons = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    new_pieces = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    new_kg = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, allow_null=True)
    unit_cost_per_kg = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, allow_null=True, min_value=Decimal("0")
    )
    reason = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_product(self, product):
        return self._validate_product(product)

    def validate_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Reason is required for a stock adjustment.")
        return value

    def validate(self, attrs):
        atype = attrs["adjustment_type"]
        if atype == AdjustmentType.CORRECTION:
            for f in ("new_cartons", "new_pieces", "new_kg"):
                if attrs.get(f) is None:
                    attrs[f] = Decimal("0")
            if any(attrs[f] < 0 for f in ("new_cartons", "new_pieces", "new_kg")):
                raise serializers.ValidationError("New quantities cannot be negative.")
        else:
            if attrs["cartons"] < 0 or attrs["pieces"] < 0 or attrs["kg"] < 0:
                raise serializers.ValidationError("Quantities cannot be negative.")
            if attrs["cartons"] <= 0 and attrs["pieces"] <= 0 and attrs["kg"] <= 0:
                raise serializers.ValidationError(
                    "At least one quantity (cartons/pieces/kg) must be positive."
                )
        return attrs


class StockAdjustmentDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)
    applied_by_name = serializers.CharField(source="applied_by.full_name", read_only=True)

    class Meta:
        model = StockAdjustment
        fields = [
            "id", "product", "product_name", "adjustment_type",
            "current_cartons", "current_pieces", "current_kg",
            "adjustment_cartons", "adjustment_pieces", "adjustment_kg",
            "new_cartons", "new_pieces", "new_kg", "unit_cost_per_kg",
            "reason", "notes", "attachment", "status",
            "applied_by", "applied_by_name", "applied_at", "related_movement",
        ]
        read_only_fields = fields


class StocktakingLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)

    class Meta:
        model = StocktakingLine
        fields = [
            "id", "product", "product_name",
            "system_cartons", "system_pieces", "system_kg",
            "actual_cartons", "actual_pieces", "actual_kg",
            "difference_cartons", "difference_pieces", "difference_kg",
            "status", "unit_cost_per_kg", "reason", "notes", "related_movement",
        ]
        read_only_fields = [
            "id", "product_name", "system_cartons", "system_pieces", "system_kg",
            "difference_cartons", "difference_pieces", "difference_kg",
            "status", "related_movement",
        ]


class StocktakingLineCreateSerializer(_ProductMixin, serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    actual_cartons = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    actual_pieces = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    actual_kg = serializers.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    unit_cost_per_kg = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, allow_null=True, min_value=Decimal("0")
    )
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_product(self, product):
        return self._validate_product(product)


class StocktakingSessionListSerializer(serializers.ModelSerializer):
    line_count = serializers.IntegerField(source="lines.count", read_only=True)

    class Meta:
        model = StocktakingSession
        fields = [
            "id", "session_number", "status", "count_date",
            "started_by", "applied_by", "applied_at", "reason", "notes",
            "line_count", "created_at",
        ]
        read_only_fields = fields


class StocktakingSessionCreateSerializer(serializers.Serializer):
    count_date = serializers.DateField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    generate_lines = serializers.BooleanField(required=False, default=False)


class StocktakingSessionDetailSerializer(serializers.ModelSerializer):
    lines = StocktakingLineSerializer(many=True, read_only=True)

    class Meta:
        model = StocktakingSession
        fields = [
            "id", "session_number", "status", "count_date",
            "started_by", "applied_by", "applied_at", "reason", "notes",
            "lines", "created_at", "updated_at",
        ]
        read_only_fields = fields


class StocktakingApplySerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Reason is required to apply stocktaking.")
        return value


class InventoryValuationSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    product_name = serializers.CharField()
    product_sku = serializers.CharField()
    available_kg = serializers.DecimalField(max_digits=14, decimal_places=3)
    estimated_fifo_value = serializers.DecimalField(max_digits=18, decimal_places=2)
