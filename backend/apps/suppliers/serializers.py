from decimal import Decimal

from rest_framework import serializers

from .models import (
    OpeningBalanceType,
    Supplier,
    SupplierAgreement,
    SupplierCategory,
    SupplierLedgerEntry,
    SupplierSpecialPrice,
)


class SupplierCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierCategory
        fields = ["id", "name_ar", "name_en", "code", "is_active", "sort_order"]
        read_only_fields = ["id"]


class SupplierListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    category_code = serializers.CharField(source="category.code", read_only=True, default="")
    balance_status = serializers.CharField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "name_ar", "name_en", "phone", "supplier_type",
            "category", "category_name", "category_code", "current_balance", "balance_status",
            "track_balance", "is_active",
        ]


class SupplierDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    balance_status = serializers.CharField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "company", "category", "category_name",
            "name_ar", "name_en", "phone", "whatsapp", "email", "address",
            "emirate", "trn", "supplier_type",
            "opening_balance", "opening_balance_type", "current_balance",
            "balance_status", "payment_terms_days", "default_payment_method",
            "track_balance", "notes", "is_active", "inactive_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "company", "current_balance", "created_at", "updated_at",
        ]


class SupplierCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id", "category", "name_ar", "name_en", "phone", "whatsapp",
            "email", "address", "emirate", "trn", "supplier_type",
            "opening_balance", "opening_balance_type",
            "payment_terms_days", "default_payment_method", "track_balance", "notes",
        ]
        read_only_fields = ["id"]

    def validate_category(self, category):
        request = self.context.get("request")
        if category and request and category.company_id != request.user.company_id:
            raise serializers.ValidationError("Category does not belong to this company.")
        return category

    def validate(self, attrs):
        ob = attrs.get("opening_balance")
        if ob is not None and ob < 0:
            raise serializers.ValidationError({"opening_balance": "Cannot be negative."})
        if self.instance is not None:
            for f in ("opening_balance", "opening_balance_type"):
                if f in attrs and attrs[f] != getattr(self.instance, f):
                    raise serializers.ValidationError(
                        {f: "Use the opening-balance edit action (requires reason)."}
                    )
        return attrs


class SupplierLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierLedgerEntry
        fields = [
            "id", "entry_type", "reference_type", "reference_id", "reference_number",
            "description", "debit", "credit", "balance_after", "entry_date",
            "reason", "notes", "created_at",
        ]


class SupplierStatementSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    supplier_name = serializers.CharField()
    opening_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    current_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance_status = serializers.CharField()
    entries = SupplierLedgerEntrySerializer(many=True)


class SupplierSpecialPriceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)

    class Meta:
        model = SupplierSpecialPrice
        fields = [
            "id", "supplier", "product", "product_name", "price", "price_type",
            "is_active", "reason", "notes", "created_at",
        ]
        read_only_fields = ["id", "supplier", "is_active", "created_at"]


class SupplierAgreementSerializer(serializers.ModelSerializer):
    is_financial = serializers.BooleanField(read_only=True)

    class Meta:
        model = SupplierAgreement
        fields = [
            "id", "supplier", "agreement_type", "title", "description",
            "default_amount", "percentage", "applies_automatically",
            "suggestion_only", "is_active", "notes", "attachment",
            "is_financial", "created_at",
        ]
        read_only_fields = ["id", "supplier", "created_at"]


class OpeningBalanceUpdateSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0")
    )
    opening_balance_type = serializers.ChoiceField(choices=OpeningBalanceType.choices)
    reason = serializers.CharField()


class SupplierDisableSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
