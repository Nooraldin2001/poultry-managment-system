from django.contrib import admin

from .models import (
    Supplier,
    SupplierAgreement,
    SupplierCategory,
    SupplierLedgerEntry,
    SupplierSpecialPrice,
)


@admin.register(SupplierCategory)
class SupplierCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "code", "company", "is_active", "sort_order")
    list_filter = ("company", "is_active")
    search_fields = ("name_ar", "code")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = (
        "name_ar", "phone", "company", "supplier_type",
        "current_balance", "track_balance", "is_active",
    )
    list_filter = ("company", "supplier_type", "is_active", "track_balance")
    search_fields = ("name_ar", "name_en", "phone", "trn")
    autocomplete_fields = ("category",)
    readonly_fields = ("current_balance",)


class _ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SupplierLedgerEntry)
class SupplierLedgerEntryAdmin(_ReadOnlyAdmin):
    list_display = (
        "supplier", "company", "entry_type", "debit", "credit",
        "balance_after", "entry_date",
    )
    list_filter = ("company", "entry_type")
    search_fields = ("supplier__name_ar", "reference_number")


@admin.register(SupplierSpecialPrice)
class SupplierSpecialPriceAdmin(admin.ModelAdmin):
    list_display = ("supplier", "product", "price", "price_type", "is_active", "company")
    list_filter = ("company", "is_active", "price_type")
    search_fields = ("supplier__name_ar", "product__name_ar")


@admin.register(SupplierAgreement)
class SupplierAgreementAdmin(admin.ModelAdmin):
    list_display = ("supplier", "agreement_type", "title", "is_active", "company")
    list_filter = ("company", "agreement_type", "is_active")
    search_fields = ("supplier__name_ar", "title")
