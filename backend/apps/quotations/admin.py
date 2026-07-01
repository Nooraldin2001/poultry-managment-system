"""Django admin for quotations."""

from django.contrib import admin

from .models import Quotation, QuotationLine, QuotationStatus, QuotationStatusHistory


class QuotationLineInline(admin.TabularInline):
    model = QuotationLine
    extra = 0
    fields = (
        "product", "line_type", "quantity_cartons", "quantity_pieces",
        "quantity_kg", "unit_price", "price_type", "line_subtotal", "line_total",
    )
    readonly_fields = ("line_subtotal", "line_total")


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = (
        "quotation_number", "company", "customer", "status",
        "quotation_date", "valid_until", "total_amount",
        "converted_sales_invoice",
    )
    list_filter = ("status", "company")
    search_fields = ("quotation_number", "customer_name_snapshot")
    date_hierarchy = "quotation_date"
    inlines = [QuotationLineInline]
    readonly_fields = (
        "subtotal", "discount_total", "taxable_amount", "vat_amount", "total_amount",
        "sent_at", "accepted_at", "rejected_at", "expired_at", "converted_at", "cancelled_at",
    )

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.status != QuotationStatus.DRAFT:
            return False
        return super().has_change_permission(request, obj)


@admin.register(QuotationLine)
class QuotationLineAdmin(admin.ModelAdmin):
    list_display = ("quotation", "product", "line_type", "line_subtotal", "line_total")
    list_filter = ("line_type", "company")


@admin.register(QuotationStatusHistory)
class QuotationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("quotation", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status", "company")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
