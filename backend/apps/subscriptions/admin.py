from django.contrib import admin

from .models import CompanySubscription, Plan, SubscriptionPayment


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "monthly_price", "yearly_price", "user_limit", "is_active"]
    list_filter = ["is_active", "premium_whatsapp_enabled", "advanced_reports_enabled"]


@admin.register(CompanySubscription)
class CompanySubscriptionAdmin(admin.ModelAdmin):
    list_display = ["company", "plan", "status", "billing_cycle", "renewal_date", "outstanding_amount"]
    list_filter = ["status", "billing_cycle", "plan"]
    search_fields = ["company__subdomain", "company__name_en"]


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ["company", "amount", "payment_date", "payment_method", "recorded_by"]
    list_filter = ["payment_method", "payment_date"]
    search_fields = ["company__subdomain", "reference_number"]
