"""Django admin for sales invoices."""

from django.contrib import admin

from .models import (
    SalesInventoryAllocation,
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesInvoiceLine,
    SalesStatus,
    SalesStatusHistory,
)


class SalesInvoiceLineInline(admin.TabularInline):
    model = SalesInvoiceLine
    extra = 0
    fields = (
        "product", "line_type", "quantity_cartons", "quantity_pieces",
        "quantity_kg", "unit_price", "price_type", "line_subtotal",
        "vat_amount", "line_total", "fifo_cost_consumed", "gross_profit",
    )
    readonly_fields = (
        "line_subtotal", "vat_amount", "line_total",
        "fifo_cost_consumed", "gross_profit",
    )


class SalesAdjustmentInline(admin.TabularInline):
    model = SalesInvoiceAdjustment
    extra = 0
    fields = ("adjustment_type", "effect", "title", "amount", "reason")


@admin.register(SalesInvoice)
class SalesInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number", "company", "customer", "status", "payment_status",
        "invoice_date", "total_amount", "balance_due",
        "fifo_cost_total", "gross_profit", "approved_at", "cancelled_at",
    )
    list_filter = ("status", "payment_status", "payment_method", "company")
    search_fields = ("invoice_number", "customer_name_snapshot")
    date_hierarchy = "invoice_date"
    inlines = [SalesInvoiceLineInline, SalesAdjustmentInline]
    readonly_fields = (
        "subtotal", "discount_total", "taxable_amount", "vat_amount",
        "total_amount", "balance_due", "fifo_cost_total", "gross_profit",
        "posted_receivable", "approved_by", "approved_at",
        "cancelled_by", "cancelled_at",
    )

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.status in (
            SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID,
            SalesStatus.PAID, SalesStatus.CANCELLED,
        ):
            return False
        return super().has_change_permission(request, obj)


@admin.register(SalesInvoiceLine)
class SalesInvoiceLineAdmin(admin.ModelAdmin):
    list_display = ("invoice", "product", "line_type", "line_subtotal", "line_total")
    list_filter = ("line_type", "company")
    search_fields = ("invoice__invoice_number", "product_name_snapshot")


@admin.register(SalesInvoiceAdjustment)
class SalesInvoiceAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "adjustment_type", "effect", "amount")
    list_filter = ("adjustment_type", "effect", "company")


@admin.register(SalesInventoryAllocation)
class SalesInventoryAllocationAdmin(admin.ModelAdmin):
    list_display = ("invoice", "invoice_line", "product", "quantity_kg", "cost_amount")
    list_filter = ("company",)


@admin.register(SalesStatusHistory)
class SalesStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("invoice", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status", "company")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
