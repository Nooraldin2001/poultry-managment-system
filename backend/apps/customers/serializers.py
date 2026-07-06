from decimal import Decimal

from rest_framework import serializers

from apps.tenants.validators import validate_trn_value

from .models import (
    Customer,
    CustomerCategory,
    CustomerCreditLimitChange,
    CustomerFreeProductAgreement,
    CustomerLedgerEntry,
    CustomerSpecialPrice,
    OpeningBalanceType,
)


class CustomerCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerCategory
        fields = ["id", "name_ar", "name_en", "code", "is_active", "sort_order"]
        read_only_fields = ["id"]


class CustomerListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    credit_status = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "name_ar", "name_en", "phone", "customer_type",
            "category", "category_name", "current_balance", "credit_limit",
            "credit_status", "is_active",
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    credit_status = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id", "company", "category", "category_name",
            "name_ar", "name_en", "phone", "whatsapp", "email", "address",
            "emirate", "trn", "customer_type",
            "opening_balance", "opening_balance_type", "current_balance",
            "credit_limit", "credit_status", "payment_terms_days",
            "block_sales_when_credit_exceeded", "allow_admin_credit_override",
            "notes", "is_active", "inactive_reason", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "company", "current_balance", "created_at", "updated_at",
        ]


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id", "category", "name_ar", "name_en", "phone", "whatsapp",
            "email", "address", "emirate", "trn", "customer_type",
            "opening_balance", "opening_balance_type",
            "credit_limit", "payment_terms_days",
            "block_sales_when_credit_exceeded", "allow_admin_credit_override",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate_trn(self, value):
        return validate_trn_value(value)

    def validate_category(self, category):
        request = self.context.get("request")
        if category and request and category.company_id != request.user.company_id:
            raise serializers.ValidationError("Category does not belong to this company.")
        return category

    def validate(self, attrs):
        ob = attrs.get("opening_balance")
        if ob is not None and ob < 0:
            raise serializers.ValidationError({"opening_balance": "Cannot be negative."})
        cl = attrs.get("credit_limit")
        if cl is not None and cl < 0:
            raise serializers.ValidationError({"credit_limit": "Cannot be negative."})
        # Opening balance edits after creation must use the dedicated endpoint.
        if self.instance is not None:
            for f in ("opening_balance", "opening_balance_type"):
                if f in attrs and attrs[f] != getattr(self.instance, f):
                    raise serializers.ValidationError(
                        {f: "Use the opening-balance edit action (requires reason)."}
                    )
        return attrs


class CustomerLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerLedgerEntry
        fields = [
            "id", "entry_type", "reference_type", "reference_id", "reference_number",
            "description", "debit", "credit", "balance_after", "entry_date",
            "reason", "notes", "created_at",
        ]


class CustomerStatementSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    customer_name = serializers.CharField()
    opening_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    current_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    credit_status = serializers.CharField()
    entries = CustomerLedgerEntrySerializer(many=True)


class CustomerSpecialPriceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)

    class Meta:
        model = CustomerSpecialPrice
        fields = [
            "id", "customer", "product", "product_name", "price", "price_type",
            "is_active", "reason", "notes", "created_at",
        ]
        read_only_fields = ["id", "customer", "is_active", "created_at"]


class CustomerFreeProductAgreementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name_ar", read_only=True)

    class Meta:
        model = CustomerFreeProductAgreement
        fields = [
            "id", "customer", "product", "product_name", "agreement_type",
            "condition_amount", "condition_quantity", "is_active", "notes",
            "created_at",
        ]
        read_only_fields = ["id", "customer", "created_at"]


class CustomerCreditLimitChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerCreditLimitChange
        fields = [
            "id", "customer", "previous_limit", "new_limit", "change_type",
            "related_reference_type", "related_reference_id", "reason", "changed_at",
        ]
        read_only_fields = ["id", "customer", "previous_limit", "changed_at"]


class OpeningBalanceUpdateSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0")
    )
    opening_balance_type = serializers.ChoiceField(choices=OpeningBalanceType.choices)
    reason = serializers.CharField()


class CustomerDisableSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
