"""Django admin for purchases.

Approved/cancelled invoices are protected from casual edits (financial side
effects already posted). Lines/adjustments are shown inline for inspection.
"""

from django.contrib import admin

from .models import (
    PurchaseAdjustment,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseStatus,
    PurchaseStatusHistory,
)


class PurchaseInvoiceLineInline(admin.TabularInline):
    model = PurchaseInvoiceLine
    extra = 0
    fields = (
        "product", "line_type", "quantity_cartons", "quantity_pieces",
        "quantity_kg", "unit_price", "price_type", "line_subtotal",
        "vat_amount", "line_total", "unit_cost_per_kg",
    )
    readonly_fields = ("line_subtotal", "vat_amount", "line_total", "unit_cost_per_kg")


class PurchaseAdjustmentInline(admin.TabularInline):
    model = PurchaseAdjustment
    extra = 0
    fields = ("adjustment_type", "effect", "title", "amount", "vat_amount")
    readonly_fields = ("vat_amount",)


class PurchaseAttachmentInline(admin.TabularInline):
    model = PurchaseAttachment
    extra = 0
    fields = ("file", "file_type", "original_filename", "uploaded_at")
    readonly_fields = ("uploaded_at",)


@admin.register(PurchaseInvoice)
class PurchaseInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number", "company", "supplier", "status", "payment_status",
        "invoice_date", "total_amount", "balance_due", "approved_at", "cancelled_at",
    )
    list_filter = ("status", "payment_status", "payment_method", "company")
    search_fields = ("invoice_number", "supplier_invoice_number", "supplier_name_snapshot")
    date_hierarchy = "invoice_date"
    inlines = [PurchaseInvoiceLineInline, PurchaseAdjustmentInline, PurchaseAttachmentInline]
    readonly_fields = (
        "subtotal", "adjustment_total", "taxable_amount", "vat_amount",
        "total_amount", "balance_due", "inventory_cost_total",
        "approved_by", "approved_at", "cancelled_by", "cancelled_at",
    )

    def has_change_permission(self, request, obj=None):
        # Protect posted invoices from casual editing in admin.
        if obj is not None and obj.status in (
            PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID,
            PurchaseStatus.PAID, PurchaseStatus.CANCELLED,
        ):
            return False
        return super().has_change_permission(request, obj)


@admin.register(PurchaseInvoiceLine)
class PurchaseInvoiceLineAdmin(admin.ModelAdmin):
    list_display = ("invoice", "product", "line_type", "line_subtotal", "line_total")
    list_filter = ("line_type", "company")
    search_fields = ("invoice__invoice_number", "product_name_snapshot")


@admin.register(PurchaseAdjustment)
class PurchaseAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "adjustment_type", "effect", "amount")
    list_filter = ("adjustment_type", "effect", "company")


@admin.register(PurchaseAttachment)
class PurchaseAttachmentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "file_type", "original_filename", "uploaded_at")
    list_filter = ("file_type", "company")


@admin.register(PurchaseStatusHistory)
class PurchaseStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("invoice", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status", "company")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
