from django.core.files import File

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import TenantUserSerializer
from apps.audit.services import create_audit_log, record_action
from apps.core.permissions import HasTenantPermission, IsSuperAdmin, IsTenantUser
from apps.subscriptions.models import Plan

from . import services
from .models import Company, CompanyStatus
from .serializers import (
    AdminCompanyDetailSerializer,
    AdminCompanyUpdateSerializer,
    CompanyAdminUserCreateSerializer,
    CompanyCreateSerializer,
    CompanySerializer,
    CompanyUpdateSerializer,
)

_ADMIN_AUDIT_FIELDS = (
    "name_ar", "name_en", "subdomain", "status",
    "trade_license", "license_expiry_date", "trn",
    "emirate", "address", "phone", "email",
    "manager_name", "manager_phone", "manager_email", "notes",
    "logo", "stamp", "signature",
)


def _audit_safe(data: dict) -> dict:
    """Replace uploaded file objects with their names so audit JSON stays valid."""
    safe = {}
    for key, value in data.items():
        if isinstance(value, File):
            safe[key] = getattr(value, "name", "uploaded-file")
        elif value is None or isinstance(value, (str, int, float, bool)):
            safe[key] = value
        else:
            safe[key] = str(value)
    return safe


def _company_field_snapshot(company: Company, fields=_ADMIN_AUDIT_FIELDS) -> dict:
    snap = {}
    for field in fields:
        value = getattr(company, field, None)
        if hasattr(value, "name"):
            snap[field] = value.name or None
        elif hasattr(value, "isoformat"):
            snap[field] = value.isoformat() if value else None
        else:
            snap[field] = value
    return snap


def _audit_diff(before: dict, after: dict) -> tuple[dict, dict]:
    prev, new = {}, {}
    for key in after:
        if before.get(key) != after.get(key):
            prev[key] = before.get(key)
            new[key] = after.get(key)
    return prev, new


# --- Super Admin -----------------------------------------------------------

class AdminCompanyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdmin]
    queryset = Company.objects.select_related("subscription", "subscription__plan").all()
    serializer_class = CompanySerializer
    search_fields = ["name_ar", "name_en", "subdomain", "trn"]

    def create(self, request, *args, **kwargs):
        serializer = CompanyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        plan = Plan.objects.get(code=data.pop("plan_code"))
        company = services.provision_company(
            plan=plan, created_by=request.user, **data
        )
        record_action(
            request=request,
            action="company_create",
            module="tenants",
            reference_type="company",
            reference_id=company.id,
            new_value={"subdomain": company.subdomain, "plan": plan.code},
        )
        return Response(
            CompanySerializer(company, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminCompanyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperAdmin]
    queryset = Company.objects.select_related("subscription", "subscription__plan").all()

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return AdminCompanyUpdateSerializer
        return AdminCompanyDetailSerializer

    def update(self, request, *args, **kwargs):
        company = self.get_object()
        before = _company_field_snapshot(company)
        serializer = AdminCompanyUpdateSerializer(
            company, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        company.refresh_from_db()
        after = _company_field_snapshot(company)
        previous_value, new_value = _audit_diff(before, after)
        create_audit_log(
            action="company_update",
            user=request.user if request.user.is_authenticated else None,
            company=company,
            module="tenants",
            reference_type="company",
            reference_id=company.id,
            previous_value=previous_value or None,
            new_value=new_value or None,
            request=request,
        )
        return Response(
            AdminCompanyDetailSerializer(company, context={"request": request}).data
        )


class AdminCompanySuspendView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        company = generics.get_object_or_404(Company, pk=pk)
        company.status = CompanyStatus.SUSPENDED
        company.save(update_fields=["status", "updated_at"])
        record_action(
            request=request,
            action="company_suspend",
            module="tenants",
            reference_type="company",
            reference_id=company.id,
            reason=request.data.get("reason", ""),
            new_value={"status": company.status},
        )
        return Response(CompanySerializer(company).data)


class AdminCompanyReactivateView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        company = generics.get_object_or_404(Company, pk=pk)
        company.status = CompanyStatus.ACTIVE
        company.is_active = True
        company.save(update_fields=["status", "is_active", "updated_at"])
        record_action(
            request=request,
            action="company_reactivate",
            module="tenants",
            reference_type="company",
            reference_id=company.id,
            new_value={"status": company.status},
        )
        return Response(CompanySerializer(company).data)


class AdminCompanyCreateAdminUserView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        company = generics.get_object_or_404(Company, pk=pk)
        serializer = CompanyAdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = services.create_first_admin_user(
            company=company,
            email=data["email"],
            password=data["password"],
            full_name=data.get("full_name", ""),
            phone=data.get("phone", ""),
        )
        record_action(
            request=request,
            action="company_create_admin_user",
            module="tenants",
            reference_type="user",
            reference_id=user.id,
            new_value={"email": user.email, "company": company.subdomain},
        )
        return Response(TenantUserSerializer(user).data, status=status.HTTP_201_CREATED)


# --- Tenant ----------------------------------------------------------------

class TenantSettingsView(APIView):
    """Company profile + settings summary for the current tenant."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "settings.view"

    def get(self, request):
        company = request.user.company
        return Response(
            CompanySerializer(company, context={"request": request}).data
        )


class TenantCompanyUpdateView(APIView):
    """Tenant-side company profile update (incl. logo/stamp/signature/TRN).

    Restricted to users holding ``settings.manage`` (Owner/Admin by default).
    Subdomain and status are not editable from the tenant profile.
    """

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "settings.manage"

    def patch(self, request):
        company = request.user.company
        before = _company_field_snapshot(company)
        serializer = CompanyUpdateSerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        company.refresh_from_db()
        after = _company_field_snapshot(company)
        previous_value, new_value = _audit_diff(before, after)
        create_audit_log(
            action="company_profile_update",
            user=request.user,
            company=company,
            module="settings",
            reference_type="company",
            reference_id=company.id,
            previous_value=previous_value or None,
            new_value=new_value or None,
            request=request,
        )
        return Response(
            CompanySerializer(company, context={"request": request}).data
        )
