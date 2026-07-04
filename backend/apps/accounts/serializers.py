from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.tenancy import host_context_from_request
from apps.permissions.services import allowed_permission_codes

from .models import TenantRole, User


class CompanyBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_ar = serializers.CharField()
    name_en = serializers.CharField()
    subdomain = serializers.CharField()
    status = serializers.CharField()


class UserMeSerializer(serializers.ModelSerializer):
    """Identity payload for /auth/me/ and login response."""

    company = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role",
            "is_superuser", "is_active", "force_password_change",
            "company", "plan", "permissions",
        ]

    def get_company(self, obj):
        if obj.company_id is None:
            return None
        return CompanyBriefSerializer(obj.company).data

    def get_plan(self, obj):
        if obj.company_id is None:
            return None
        sub = getattr(obj.company, "subscription", None)
        if sub is None:
            return None
        plan = sub.plan
        return {
            "code": plan.code,
            "name": plan.name,
            "status": sub.status,
            "user_limit": plan.user_limit,
            "enabled_modules": plan.enabled_modules,
            "premium_whatsapp_enabled": plan.premium_whatsapp_enabled,
            "advanced_reports_enabled": plan.advanced_reports_enabled,
        }

    def get_permissions(self, obj):
        return allowed_permission_codes(obj)


class LoginSerializer(TokenObtainPairSerializer):
    """JWT login that also blocks suspended tenants and returns user payload."""

    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["company_id"] = user.company_id
        token["is_superuser"] = user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        request = self.context.get("request")

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This user account is inactive."}
            )

        if request is not None:
            ctx = host_context_from_request(request)

            if user.is_superuser:
                if ctx["is_tenant_host"]:
                    raise serializers.ValidationError(
                        {
                            "detail": (
                                "Super Admin users must sign in from the Super Admin "
                                "domain, not a company workspace."
                            )
                        }
                    )
            elif user.company_id is not None:
                if ctx["is_superadmin_host"]:
                    raise serializers.ValidationError(
                        {
                            "detail": (
                                "Tenant users cannot sign in from the Super Admin domain."
                            )
                        }
                    )

                if ctx["is_tenant_host"]:
                    tenant = ctx["tenant_company"]
                    if tenant is None:
                        raise serializers.ValidationError(
                            {"detail": "This company workspace was not found."}
                        )
                    if user.company_id != tenant.id:
                        raise serializers.ValidationError(
                            {
                                "detail": (
                                    "This user does not belong to this company workspace."
                                )
                            }
                        )

        if user.company_id is not None and not user.company.is_operational:
            raise serializers.ValidationError(
                {"detail": "This company is inactive."}
            )
        data["user"] = UserMeSerializer(user, context=self.context).data
        return data


class TenantUserSerializer(serializers.ModelSerializer):
    """Read serializer for tenant users."""

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role",
            "is_active", "force_password_change", "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]


class TenantUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=TenantRole.choices)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role", "password"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class TenantUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "phone", "role"]
