"""Tax / VAT API serializers (Phase 9)."""

from decimal import Decimal

from rest_framework import serializers

from .models import TaxAdjustment, TaxPeriod, TaxWarning


class DateRangeSerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()

    def validate(self, attrs):
        if attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "Must be on or after date_from."})
        return attrs


class TaxSummarySerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    sales_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchase_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    expense_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_vat_status = serializers.CharField()
    open_warnings_count = serializers.IntegerField()
    note = serializers.CharField()


class SalesVATReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()


class PurchaseVATReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()


class ExpenseVATReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()


class NetVATEstimateSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    output_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchase_input_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    expense_input_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_input_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    manual_adjustments = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_vat = serializers.DecimalField(max_digits=16, decimal_places=2)
    status = serializers.CharField()
    note = serializers.CharField()


class TaxWarningSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxWarning
        fields = [
            "id", "warning_type", "severity", "source_type", "source_id",
            "source_reference", "party_name", "message", "status",
            "dismissed_at", "dismiss_reason", "resolved_at", "created_at",
        ]
        read_only_fields = fields


class TaxWarningDismissSerializer(serializers.Serializer):
    reason = serializers.CharField()


class TaxWarningResolveSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class TaxAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxAdjustment
        fields = [
            "id", "adjustment_number", "adjustment_date", "adjustment_type",
            "amount", "reason", "notes", "related_source_type", "related_source_id",
            "status", "posted_by", "posted_at", "cancelled_at", "cancel_reason",
            "created_at",
        ]
        read_only_fields = fields


class TaxAdjustmentCreateSerializer(serializers.Serializer):
    adjustment_date = serializers.DateField()
    adjustment_type = serializers.ChoiceField(choices=TaxAdjustment._meta.get_field("adjustment_type").choices)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    reason = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    related_source_type = serializers.CharField(required=False, allow_blank=True, default="")
    related_source_id = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value


class TaxAdjustmentCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class TaxPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxPeriod
        fields = [
            "id", "name", "start_date", "end_date", "status", "notes",
            "reviewed_by", "reviewed_at", "closed_by", "closed_at",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "status", "reviewed_by", "reviewed_at", "closed_by", "closed_at",
            "created_by", "created_at", "updated_at",
        ]


class TaxPeriodCreateUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError({"end_date": "Must be on or after start_date."})
        return attrs


class TaxExportPayloadSerializer(serializers.Serializer):
    metadata = serializers.DictField()
    company = serializers.DictField()
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    report = serializers.DictField()
    warnings_summary = serializers.ListField()


class DisabledVATDocumentSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()


class TaxAuditEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    action = serializers.CharField()
    reference_type = serializers.CharField()
    reference_id = serializers.CharField()
    reason = serializers.CharField()
    risk_level = serializers.CharField()
    created_at = serializers.CharField()
    user = serializers.CharField()
