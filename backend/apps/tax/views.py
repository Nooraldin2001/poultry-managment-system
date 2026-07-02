"""Tax / VAT API (Phase 9) under /api/v1/tenant/tax/."""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet

from . import services
from .models import TaxAdjustment, TaxPeriod, TaxWarning, TaxWarningStatus
from .serializers import (
    DisabledVATDocumentSerializer,
    ExpenseVATReportSerializer,
    NetVATEstimateSerializer,
    PurchaseVATReportSerializer,
    SalesVATReportSerializer,
    TaxAdjustmentCancelSerializer,
    TaxAdjustmentCreateSerializer,
    TaxAdjustmentSerializer,
    TaxAuditEntrySerializer,
    TaxExportPayloadSerializer,
    TaxPeriodCreateUpdateSerializer,
    TaxPeriodSerializer,
    TaxSummarySerializer,
    TaxWarningDismissSerializer,
    TaxWarningResolveSerializer,
    TaxWarningSerializer,
)


def _date_params(request):
    p = request.query_params
    date_from = p.get("date_from")
    date_to = p.get("date_to")
    if not date_from or not date_to:
        raise ValidationError({"detail": "date_from and date_to are required."})
    return date_from, date_to


def _report_filters(request):
    p = request.query_params
    filters = {}
    if p.get("customer"):
        filters["customer"] = p["customer"]
    if p.get("supplier"):
        filters["supplier"] = p["supplier"]
    if p.get("category"):
        filters["category"] = p["category"]
    if p.get("missing_trn") is not None:
        filters["missing_trn"] = str(p["missing_trn"]).lower() in ("1", "true", "yes")
    if p.get("vat_disabled") is not None:
        filters["vat_disabled"] = str(p["vat_disabled"]).lower() in ("1", "true", "yes")
    return filters


class TaxSummaryView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_tax_summary(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        return Response(TaxSummarySerializer(data).data)


class SalesVATReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view_sales_vat"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_sales_vat_report(
            request.user.company, date_from=date_from, date_to=date_to,
            filters=_report_filters(request),
        )
        return Response(SalesVATReportSerializer(data).data)


class PurchaseVATReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view_purchase_vat"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_purchase_vat_report(
            request.user.company, date_from=date_from, date_to=date_to,
            filters=_report_filters(request),
        )
        return Response(PurchaseVATReportSerializer(data).data)


class ExpenseVATReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view_expense_vat"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_expense_vat_report(
            request.user.company, date_from=date_from, date_to=date_to,
            filters=_report_filters(request),
        )
        return Response(ExpenseVATReportSerializer(data).data)


class NetVATReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view_net_vat"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_net_vat_estimate(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        return Response(NetVATEstimateSerializer(data).data)


class TaxExportPayloadView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.export"

    def get(self, request):
        date_from, date_to = _date_params(request)
        report_type = request.query_params.get("report_type", "vat_summary")
        data = services.build_tax_export_payload(
            request.user.company,
            report_type=report_type,
            date_from=date_from,
            date_to=date_to,
            user=request.user,
        )
        return Response(TaxExportPayloadSerializer(data).data)


class DisabledVATDocumentsView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view"

    def get(self, request):
        date_from, date_to = _date_params(request)
        data = services.get_disabled_vat_documents(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        return Response(DisabledVATDocumentSerializer(data).data)


class TaxAuditView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "tax.view_audit"

    def get(self, request):
        p = request.query_params
        entries = services.get_tax_audit_entries(
            request.user.company,
            date_from=p.get("date_from"),
            date_to=p.get("date_to"),
        )
        return Response(TaxAuditEntrySerializer(entries, many=True).data)


class TaxWarningViewSet(TenantScopedViewSet):
    queryset = TaxWarning.objects.all()
    serializer_class = TaxWarningSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_map = {
        "list": "tax.view",
        "retrieve": "tax.view",
        "generate": "tax.generate_warnings",
        "dismiss": "tax.dismiss_warnings",
        "resolve": "tax.dismiss_warnings",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("warning_type"):
            qs = qs.filter(warning_type=p["warning_type"])
        if p.get("severity"):
            qs = qs.filter(severity=p["severity"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("source_type"):
            qs = qs.filter(source_type=p["source_type"])
        return qs

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        p = request.data or request.query_params
        result = services.generate_tax_warnings(
            request.user.company,
            date_from=p.get("date_from"),
            date_to=p.get("date_to"),
        )
        return Response(result)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        warning = self.get_object()
        serializer = TaxWarningDismissSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warning = services.dismiss_tax_warning(
            warning=warning, user=request.user, reason=serializer.validated_data["reason"],
        )
        return Response(TaxWarningSerializer(warning).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        warning = self.get_object()
        serializer = TaxWarningResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warning = services.resolve_tax_warning(
            warning=warning, user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(TaxWarningSerializer(warning).data)


class TaxAdjustmentViewSet(TenantScopedViewSet):
    queryset = TaxAdjustment.objects.select_related("posted_by").all()
    serializer_class = TaxAdjustmentSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_map = {
        "list": "tax.view",
        "retrieve": "tax.view",
        "create": "tax.adjust",
        "cancel": "tax.cancel_adjustment",
    }

    def create(self, request, *args, **kwargs):
        serializer = TaxAdjustmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        adjustment = services.create_tax_adjustment(
            company=request.user.company,
            user=request.user,
            adjustment_date=vd["adjustment_date"],
            adjustment_type=vd["adjustment_type"],
            amount=vd["amount"],
            reason=vd["reason"],
            notes=vd.get("notes", ""),
            related_source_type=vd.get("related_source_type", ""),
            related_source_id=vd.get("related_source_id", ""),
        )
        return Response(
            TaxAdjustmentSerializer(adjustment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        adjustment = self.get_object()
        serializer = TaxAdjustmentCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adjustment = services.cancel_tax_adjustment(
            adjustment=adjustment, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(TaxAdjustmentSerializer(adjustment).data)


class TaxPeriodViewSet(TenantScopedViewSet):
    queryset = TaxPeriod.objects.all()
    serializer_class = TaxPeriodSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "tax.view",
        "retrieve": "tax.view",
        "create": "tax.view",
        "partial_update": "tax.view",
        "review": "tax.view",
        "close": "tax.view",
    }

    def create(self, request, *args, **kwargs):
        serializer = TaxPeriodCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        period = TaxPeriod.objects.create(
            company=request.user.company,
            name=vd["name"],
            start_date=vd["start_date"],
            end_date=vd["end_date"],
            notes=vd.get("notes", ""),
            created_by=request.user,
        )
        return Response(TaxPeriodSerializer(period).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        period = self.get_object()
        if period.status == "closed":
            raise ValidationError("Closed period cannot be edited.")
        serializer = TaxPeriodCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(period, field, value)
        period.save()
        return Response(TaxPeriodSerializer(period).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        period = self.get_object()
        period = services.review_tax_period(period=period, user=request.user)
        return Response(TaxPeriodSerializer(period).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = self.get_object()
        period = services.close_tax_period(period=period, user=request.user)
        return Response(TaxPeriodSerializer(period).data)
