"""Django admin for payments."""

from django.contrib import admin

from .models import PaymentAllocation, PaymentMovement, PaymentStatusHistory


class PaymentAllocationInline(admin.TabularInline):
    model = PaymentAllocation
    extra = 0
    fields = (
        "allocation_type", "sales_invoice", "purchase_invoice", "allocated_amount",
    )
    readonly_fields = ("allocated_amount",)


@admin.register(PaymentMovement)
class PaymentMovementAdmin(admin.ModelAdmin):
    list_display = (
        "movement_number", "receipt_number", "company", "movement_type",
        "party_type", "amount", "payment_method", "status", "movement_date",
        "posted_by",
    )
    list_filter = ("movement_type", "party_type", "status", "payment_method", "company")
    search_fields = ("movement_number", "receipt_number", "reference_number")
    date_hierarchy = "movement_date"
    inlines = [PaymentAllocationInline]
    readonly_fields = (
        "posted_at", "cancelled_at", "cancelled_by", "posted_by",
    )

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.status in ("posted", "cancelled"):
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentAllocation)
class PaymentAllocationAdmin(admin.ModelAdmin):
    list_display = ("movement", "allocation_type", "allocated_amount")
    list_filter = ("allocation_type", "company")


@admin.register(PaymentStatusHistory)
class PaymentStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("movement", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status", "company")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
