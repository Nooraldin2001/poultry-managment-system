from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin
from apps.tenants.models import Company
from apps.tenants.module_reset import ModuleResetService
from apps.tenants.module_reset_serializers import (
    ModuleResetConfirmSerializer,
    ModuleResetDryRunSerializer,
)


class AdminModuleResetCatalogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, company_id):
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "company": {
                "id": company.id,
                "name_ar": company.name_ar,
                "name_en": company.name_en,
                "subdomain": company.subdomain,
            },
            "modules": ModuleResetService.get_catalog(),
            "backup_warning_en": (
                "This action is destructive and cannot be undone from the UI. "
                "Make sure you have a database backup before confirming."
            ),
            "backup_warning_ar": (
                "هذا الإجراء خطير ولا يمكن التراجع عنه من الواجهة. "
                "تأكد من وجود نسخة احتياطية قبل التأكيد."
            ),
        })


class AdminModuleResetDryRunView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, company_id):
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModuleResetDryRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = ModuleResetService.dry_run(
            company=company,
            module=serializer.validated_data["module"],
            actor=request.user,
        )
        return Response(data)


class AdminModuleResetConfirmView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, company_id):
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModuleResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        data = ModuleResetService.confirm(
            company=company,
            module=vd["module"],
            actor=request.user,
            reason=vd["reason"],
            confirmation_text=vd["confirmation_text"],
            dry_run_token=vd.get("dry_run_token") or None,
            backup_confirmed=vd.get("backup_confirmed", False),
            request=request,
        )
        return Response(data)


class AdminModuleResetHistoryView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, company_id):
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "company_id": company.id,
            "history": ModuleResetService.history(company=company),
        })
