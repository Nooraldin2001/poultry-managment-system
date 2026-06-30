from rest_framework import serializers

from .models import NumberingSettings, PrintTemplateSettings, VATSettings


class VATSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = VATSettings
        fields = [
            "id", "vat_enabled_default", "default_vat_rate",
            "allow_vat_disable_sales", "allow_vat_disable_purchase",
            "require_reason_for_vat_change",
            "warn_missing_customer_trn", "warn_missing_supplier_trn",
        ]
        read_only_fields = ["id"]

    def validate_default_vat_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("VAT rate cannot be negative.")
        return value


class NumberingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NumberingSettings
        fields = [
            "id", "document_type", "prefix", "next_number",
            "number_length", "reset_rule", "active",
        ]
        read_only_fields = ["id", "document_type"]

    def validate_prefix(self, value):
        if value is None or value.strip() == "":
            raise serializers.ValidationError("Numbering prefix is required.")
        return value

    def validate_next_number(self, value):
        if value < 1:
            raise serializers.ValidationError("Next number must be positive.")
        return value


class PrintTemplateSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintTemplateSettings
        fields = [
            "id", "template_type", "show_logo", "show_stamp", "show_signature",
            "show_trn", "show_arabic_labels", "show_english_labels",
            "show_amount_in_words", "footer_notes",
            "receiver_signature_required", "paper_size",
        ]
        read_only_fields = ["id", "template_type"]
