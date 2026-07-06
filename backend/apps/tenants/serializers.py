from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers

from apps.subscriptions.models import BillingCycle, Plan

from .models import Company, CompanyStatus
from .validators import (
    validate_company_image_extension,
    validate_company_image_size,
    validate_subdomain_available,
    validate_trn_value,
)


class CompanyAssetURLMixin(serializers.Serializer):
    """Absolute (when request available) URLs for company identity assets."""

    logo_url = serializers.SerializerMethodField()
    stamp_url = serializers.SerializerMethodField()
    signature_url = serializers.SerializerMethodField()

    def _file_url(self, file_field):
        if not file_field:
            return None
        url = file_field.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request is not None else url

    def get_logo_url(self, obj):
        return self._file_url(obj.logo)

    def get_stamp_url(self, obj):
        return self._file_url(obj.stamp)

    def get_signature_url(self, obj):
        return self._file_url(obj.signature)


class SubscriptionBriefSerializer(serializers.Serializer):
    plan_code = serializers.CharField(source="plan.code")
    plan_name = serializers.CharField(source="plan.name")
    status = serializers.CharField()
    billing_cycle = serializers.CharField()
    user_limit = serializers.IntegerField()
    renewal_date = serializers.DateField()
    outstanding_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=14, decimal_places=2)


class CompanySerializer(CompanyAssetURLMixin, serializers.ModelSerializer):
    subscription = SubscriptionBriefSerializer(read_only=True)
    active_user_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name_ar", "name_en", "subdomain",
            "trade_license", "license_expiry_date", "trn", "country", "emirate", "address",
            "phone", "email", "manager_name", "manager_phone", "manager_email", "notes",
            "status", "is_active",
            "logo_url", "stamp_url", "signature_url",
            "subscription", "active_user_count", "created_at",
        ]
        read_only_fields = ["id", "created_at", "subscription", "active_user_count"]

    def get_active_user_count(self, obj):
        return obj.users.filter(is_active=True, is_superuser=False).count()


class AdminCompanyDetailSerializer(CompanySerializer):
    """Super Admin company detail — same shape as list/detail read serializer."""

    class Meta(CompanySerializer.Meta):
        pass


class CompanyCreateSerializer(serializers.Serializer):
    name_ar = serializers.CharField(max_length=255)
    name_en = serializers.CharField(max_length=255)
    subdomain = serializers.CharField(max_length=63)
    plan_code = serializers.ChoiceField(choices=[p[0] for p in Plan._meta.get_field("code").choices])
    billing_cycle = serializers.ChoiceField(
        choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    status = serializers.ChoiceField(
        choices=CompanyStatus.choices, default=CompanyStatus.TRIAL
    )
    trade_license = serializers.CharField(max_length=64, required=False, allow_blank=True)
    trn = serializers.CharField(max_length=32, required=False, allow_blank=True)
    emirate = serializers.CharField(max_length=64, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate_subdomain(self, value):
        try:
            return validate_subdomain_available(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc

    def validate_plan_code(self, value):
        if not Plan.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown or inactive plan.")
        return value

    def validate_trn(self, value):
        return validate_trn_value(value)


class _CompanyAssetUpdateMixin:
    """Shared image clear/upload handling for company profile PATCH."""

    logo = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[validate_company_image_extension, validate_company_image_size],
    )
    stamp = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[validate_company_image_extension, validate_company_image_size],
    )
    signature = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[validate_company_image_extension, validate_company_image_size],
    )

    def to_internal_value(self, data):
        if hasattr(data, "dict"):
            data = data.dict()
        cleared = {
            key for key in ("logo", "stamp", "signature")
            if key in data and data[key] in ("", None)
        }
        for key in cleared:
            data.pop(key)
        attrs = super().to_internal_value(data)
        for key in cleared:
            attrs[key] = None
        return attrs


class CompanyUpdateSerializer(_CompanyAssetUpdateMixin, serializers.ModelSerializer):
    """Tenant-side company profile update (no subdomain/status)."""

    class Meta:
        model = Company
        fields = [
            "name_ar", "name_en", "trade_license", "license_expiry_date", "trn",
            "emirate", "address", "phone", "email",
            "manager_name", "manager_phone", "manager_email", "notes",
            "logo", "stamp", "signature",
        ]

    def validate_name_ar(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Arabic company name is required.")
        return value

    def validate_name_en(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("English company name is required.")
        return value

    def validate_trn(self, value):
        value = validate_trn_value(value)
        self._warn_trn_length(value)
        return value

    def _warn_trn_length(self, value: str) -> None:
        company = getattr(self, "instance", None)
        if not company or not value:
            return
        vat_settings = getattr(company, "vat_settings", None)
        if vat_settings is None:
            try:
                vat_settings = company.vat_settings
            except Exception:
                return
        if getattr(vat_settings, "vat_enabled_default", False) and len(value) != 15:
            # Soft warning only — digits-only rule still enforced above.
            pass

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance is None:
            return attrs
        name_ar = attrs.get("name_ar", instance.name_ar)
        name_en = attrs.get("name_en", instance.name_en)
        if not (name_ar or "").strip() and not (name_en or "").strip():
            raise serializers.ValidationError(
                "At least one of Arabic or English company name is required."
            )
        return attrs


class AdminCompanyUpdateSerializer(_CompanyAssetUpdateMixin, serializers.ModelSerializer):
    """Super Admin company profile update — excludes subscription/billing fields."""

    subdomain = serializers.CharField(max_length=63, required=False)
    status = serializers.ChoiceField(choices=CompanyStatus.choices, required=False)

    class Meta:
        model = Company
        fields = [
            "name_ar", "name_en", "subdomain", "status",
            "trade_license", "license_expiry_date", "trn",
            "emirate", "address", "phone", "email",
            "manager_name", "manager_phone", "manager_email", "notes",
            "logo", "stamp", "signature",
        ]

    def validate_subdomain(self, value):
        instance = getattr(self, "instance", None)
        exclude_id = instance.pk if instance is not None else None
        try:
            return validate_subdomain_available(value, exclude_company_id=exclude_id)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc

    def validate_name_ar(self, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Arabic company name is required.")
        return value

    def validate_name_en(self, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise serializers.ValidationError("English company name is required.")
        return value

    def validate_trn(self, value):
        return validate_trn_value(value)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance is None:
            return attrs
        name_ar = attrs.get("name_ar", instance.name_ar)
        name_en = attrs.get("name_en", instance.name_en)
        if not (name_ar or "").strip() and not (name_en or "").strip():
            raise serializers.ValidationError(
                "At least one of Arabic or English company name is required."
            )
        return attrs


class CompanyAdminUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        from apps.accounts.models import User

        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
