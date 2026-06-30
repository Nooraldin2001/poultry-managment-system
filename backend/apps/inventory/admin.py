from django.contrib import admin

from .models import (
    FIFOStockLayer,
    InventoryBalance,
    InventoryValuationSnapshot,
    StockAdjustment,
    StockMovement,
    StocktakingLine,
    StocktakingSession,
)


class _ReadOnlyAdmin(admin.ModelAdmin):
    """Read-only for everyone except superusers (protects ledgers)."""

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_superuser)

    def has_change_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(InventoryBalance)
class InventoryBalanceAdmin(_ReadOnlyAdmin):
    list_display = (
        "product", "company", "available_cartons", "available_pieces",
        "available_kg", "last_movement_at",
    )
    list_filter = ("company",)
    search_fields = ("product__name_ar", "product__sku")
    autocomplete_fields = ("product",)


@admin.register(FIFOStockLayer)
class FIFOStockLayerAdmin(_ReadOnlyAdmin):
    list_display = (
        "product", "company", "source_type", "received_at",
        "remaining_kg", "unit_cost_per_kg", "is_depleted",
    )
    list_filter = ("company", "source_type", "is_depleted")
    search_fields = ("product__name_ar", "product__sku", "source_reference")


@admin.register(StockMovement)
class StockMovementAdmin(_ReadOnlyAdmin):
    list_display = (
        "product", "company", "movement_type", "direction",
        "kg_delta", "balance_kg_after", "created_at",
    )
    list_filter = ("company", "movement_type", "direction", "created_at")
    search_fields = ("product__name_ar", "product__sku", "reference_number")


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display = (
        "product", "company", "adjustment_type", "status",
        "applied_by", "applied_at",
    )
    list_filter = ("company", "adjustment_type", "status")
    search_fields = ("product__name_ar", "product__sku", "reason")
    readonly_fields = (
        "company", "product", "adjustment_type", "current_cartons",
        "current_pieces", "current_kg", "adjustment_cartons", "adjustment_pieces",
        "adjustment_kg", "new_cartons", "new_pieces", "new_kg",
        "applied_by", "applied_at", "related_movement",
    )

    def has_delete_permission(self, request, obj=None):
        return False


class StocktakingLineInline(admin.TabularInline):
    model = StocktakingLine
    extra = 0
    can_delete = False

    def has_change_permission(self, request, obj=None):
        if obj and obj.status == "applied":
            return bool(request.user and request.user.is_superuser)
        return super().has_change_permission(request, obj)


@admin.register(StocktakingSession)
class StocktakingSessionAdmin(admin.ModelAdmin):
    list_display = ("session_number", "company", "status", "count_date", "applied_at")
    list_filter = ("company", "status")
    search_fields = ("session_number",)
    inlines = [StocktakingLineInline]

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status == "applied" and not request.user.is_superuser:
            return [f.name for f in obj._meta.fields]
        return ("applied_by", "applied_at")


@admin.register(StocktakingLine)
class StocktakingLineAdmin(_ReadOnlyAdmin):
    list_display = ("session", "product", "company", "status", "difference_kg")
    list_filter = ("company", "status")
    search_fields = ("product__name_ar", "product__sku")


@admin.register(InventoryValuationSnapshot)
class InventoryValuationSnapshotAdmin(_ReadOnlyAdmin):
    list_display = (
        "company", "snapshot_date", "total_inventory_value", "total_available_kg",
    )
    list_filter = ("company",)
