from django.contrib import admin

from .models import (
    Expense,
    ExpenseAttachment,
    ExpenseCategory,
    ExpenseStatusHistory,
    RecurringExpense,
)


class ExpenseAttachmentInline(admin.TabularInline):
    model = ExpenseAttachment
    extra = 0
    readonly_fields = ("uploaded_by", "uploaded_at")


class ExpenseStatusHistoryInline(admin.TabularInline):
    model = ExpenseStatusHistory
    extra = 0
    readonly_fields = ("from_status", "to_status", "reason", "changed_by", "changed_at")


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "code", "company", "category_type", "is_active", "sort_order")
    list_filter = ("category_type", "is_active", "company")
    search_fields = ("name_ar", "name_en", "code")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "expense_number", "company", "category", "title", "expense_date",
        "total_amount", "payment_method", "status", "created_by",
    )
    list_filter = ("status", "expense_scope", "payment_method", "company")
    search_fields = ("expense_number", "title", "vendor_name")
    readonly_fields = (
        "expense_number", "amount", "vat_amount", "total_amount",
        "cancelled_by", "cancelled_at", "created_by", "updated_by",
        "created_at", "updated_at",
    )
    inlines = [ExpenseAttachmentInline, ExpenseStatusHistoryInline]

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        if obj and obj.status == "cancelled":
            ro += [f.name for f in obj._meta.fields if f.name not in ro]
        return ro


@admin.register(RecurringExpense)
class RecurringExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "title", "company", "category", "total_amount", "recurrence",
        "next_due_date", "is_active",
    )
    list_filter = ("recurrence", "is_active", "company")


@admin.register(ExpenseAttachment)
class ExpenseAttachmentAdmin(admin.ModelAdmin):
    list_display = ("expense", "file_type", "original_filename", "uploaded_at", "company")


@admin.register(ExpenseStatusHistory)
class ExpenseStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("expense", "from_status", "to_status", "changed_at", "company")
    readonly_fields = ("expense", "from_status", "to_status", "reason", "changed_by", "changed_at")
