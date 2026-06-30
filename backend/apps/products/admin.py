from django.contrib import admin

from .models import Product, ProductCategory


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "code", "company", "is_active", "sort_order")
    list_filter = ("company", "is_active")
    search_fields = ("name_ar", "name_en", "code")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name_ar", "sku", "company", "category", "product_type",
        "sales_price", "is_active",
    )
    list_filter = ("company", "product_type", "is_active", "vat_taxable", "track_inventory")
    search_fields = ("name_ar", "name_en", "sku")
    autocomplete_fields = ("category",)
    readonly_fields = ("disabled_at", "disabled_by")
