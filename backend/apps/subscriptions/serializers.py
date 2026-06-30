from rest_framework import serializers

from apps.tenants.models import Company

from .models import CompanySubscription, Plan, SubscriptionPayment


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id", "code", "name", "monthly_price", "yearly_price",
            "user_limit", "enabled_modules",
            "premium_whatsapp_enabled", "advanced_reports_enabled", "is_active",
        ]


class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(
        source="company", queryset=Company.objects.all(), write_only=True
    )

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id", "company_id", "amount", "payment_date", "payment_method",
            "reference_number", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class CompanySubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = CompanySubscription
        fields = [
            "id", "plan", "status", "billing_cycle",
            "start_date", "renewal_date", "trial_end_date",
            "monthly_price_snapshot", "yearly_price_snapshot",
            "outstanding_amount", "total_paid", "last_payment_date", "notes",
        ]
