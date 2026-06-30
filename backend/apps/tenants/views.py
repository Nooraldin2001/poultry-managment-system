from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import TenantUserSerializer
from apps.audit.services import record_action
from apps.core.permissions import IsSuperAdmin, IsTenantUser
from apps.subscriptions.models import Plan

from . import services
from .models import Company, CompanyStatus
from .serializers import (
    CompanyAdminUserCreateSerializer,
    CompanyCreateSerializer,
    CompanySerializer,
    CompanyUpdateSerializer,
)


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
            CompanySerializer(company).data, status=status.HTTP_201_CREATED
        )


class AdminCompanyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperAdmin]
    queryset = Company.objects.select_related("subscription", "subscription__plan").all()

    def get_serializer_class(self):
        return CompanyUpdateSerializer if self.request.method in ("PATCH", "PUT") else CompanySerializer

    def update(self, request, *args, **kwargs):
        company = self.get_object()
        serializer = CompanyUpdateSerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CompanySerializer(company).data)


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

    permission_classes = [IsTenantUser]

    def get(self, request):
        company = request.user.company
        return Response(CompanySerializer(company).data)


class TenantCompanyUpdateView(APIView):
    permission_classes = [IsTenantUser]

    def patch(self, request):
        company = request.user.company
        serializer = CompanyUpdateSerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_action(
            request=request,
            action="company_profile_update",
            module="settings",
            reference_type="company",
            reference_id=company.id,
            new_value=serializer.validated_data,
        )
        return Response(CompanySerializer(company).data)
