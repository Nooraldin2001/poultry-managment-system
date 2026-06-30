from django.contrib import admin

from .models import (
    Customer,
    CustomerCategory,
    CustomerCreditLimitChange,
    CustomerFreeProductAgreement,
    CustomerLedgerEntry,
    CustomerSpecialPrice,
)


@admin.register(CustomerCategory)
class CustomerCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "code", "company", "is_active", "sort_order")
    list_filter = ("company", "is_active")
    search_fields = ("name_ar", "code")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "name_ar", "phone", "company", "customer_type",
        "current_balance", "credit_limit", "is_active",
    )
    list_filter = ("company", "customer_type", "is_active")
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


@admin.register(CustomerLedgerEntry)
class CustomerLedgerEntryAdmin(_ReadOnlyAdmin):
    list_display = (
        "customer", "company", "entry_type", "debit", "credit",
        "balance_after", "entry_date",
    )
    list_filter = ("company", "entry_type")
    search_fields = ("customer__name_ar", "reference_number")


@admin.register(CustomerSpecialPrice)
class CustomerSpecialPriceAdmin(admin.ModelAdmin):
    list_display = ("customer", "product", "price", "price_type", "is_active", "company")
    list_filter = ("company", "is_active", "price_type")
    search_fields = ("customer__name_ar", "product__name_ar")


@admin.register(CustomerFreeProductAgreement)
class CustomerFreeProductAgreementAdmin(admin.ModelAdmin):
    list_display = ("customer", "product", "agreement_type", "is_active", "company")
    list_filter = ("company", "agreement_type", "is_active")
    search_fields = ("customer__name_ar", "product__name_ar")


@admin.register(CustomerCreditLimitChange)
class CustomerCreditLimitChangeAdmin(_ReadOnlyAdmin):
    list_display = ("customer", "previous_limit", "new_limit", "change_type", "changed_at", "company")
    list_filter = ("company", "change_type")
    search_fields = ("customer__name_ar",)
