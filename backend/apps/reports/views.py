"""Reports & analytics API (Phase 10) under /api/v1/tenant/reports/."""

from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.constants import risk_for_action
from apps.audit.services import create_audit_log
from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.customers.models import Customer
from apps.suppliers.models import Supplier

from . import services
from .serializers import (
    AgingReportSerializer,
    CustomerStatementSerializer,
    DashboardSummarySerializer,
    ExpensesReportSerializer,
    ExportPayloadQuerySerializer,
    ExportPayloadSerializer,
    InventoryMovementReportSerializer,
    InventoryReportSerializer,
    PaymentsReportSerializer,
    ProfitReportSerializer,
    PurchaseReportSerializer,
    ReportFilterSerializer,
    SalesReportSerializer,
    SupplierStatementSerializer,
    TaxSummaryBridgeSerializer,
)


def _parse_filters(request) -> dict:
    ser = ReportFilterSerializer(data=request.query_params)
    ser.is_valid(raise_exception=True)
    ser.validate_tenant_filters(request.user.company)
    data = ser.validated_data
    filters = {}
    for key in (
        "customer", "supplier", "product", "category", "payment_status",
        "status", "payment_method", "movement_type", "expense_scope",
        "include_cancelled", "include_drafts", "group_by",
    ):
        if key in data:
            filters[key] = data[key]
    return data.get("date_from"), data.get("date_to"), filters


def _require_dates(date_from, date_to):
    if not date_from or not date_to:
        raise ValidationError({"detail": "date_from and date_to are required."})


class DashboardReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_dashboard"

    def get(self, request):
        date_from, date_to, _ = _parse_filters(request)
        data = services.get_dashboard_summary(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        return Response(DashboardSummarySerializer(data).data)


class SalesReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_sales"

    def get(self, request):
        date_from, date_to, filters = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_sales_report(
            request.user.company, date_from=date_from, date_to=date_to, filters=filters,
        )
        return Response(SalesReportSerializer(data).data)


class PurchaseReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_purchases"

    def get(self, request):
        date_from, date_to, filters = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_purchase_report(
            request.user.company, date_from=date_from, date_to=date_to, filters=filters,
        )
        return Response(PurchaseReportSerializer(data).data)


class InventoryReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_inventory"

    def get(self, request):
        _, _, filters = _parse_filters(request)
        data = services.get_inventory_report(request.user.company, filters=filters)
        return Response(InventoryReportSerializer(data).data)


class InventoryValuationReportView(APIView):
    """Same inventory report payload; gated by valuation permission."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_inventory_valuation"

    def get(self, request):
        _, _, filters = _parse_filters(request)
        data = services.get_inventory_report(request.user.company, filters=filters)
        create_audit_log(
            action="inventory_valuation_view", user=request.user,
            company=request.user.company, module="reports",
            reference_type="report", reference_id="inventory_valuation",
            risk_level=risk_for_action("inventory_valuation_view"),
        )
        return Response(InventoryReportSerializer(data).data)


class InventoryMovementReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_inventory"

    def get(self, request):
        date_from, date_to, filters = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_inventory_movement_report(
            request.user.company, date_from=date_from, date_to=date_to, filters=filters,
        )
        return Response(InventoryMovementReportSerializer(data).data)


class CustomerStatementReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_customer_statement"

    def get(self, request, customer_id):
        company = request.user.company
        try:
            customer = Customer.objects.get(pk=customer_id, company=company)
        except Customer.DoesNotExist:
            raise NotFound("Customer not found.")
        date_from, date_to, _ = _parse_filters(request)
        data = services.get_customer_statement(
            company, customer, date_from=date_from, date_to=date_to,
        )
        return Response(CustomerStatementSerializer(data).data)


class CustomersAgingReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_customer_statement"

    def get(self, request):
        data = services.get_customers_aging_report(request.user.company)
        return Response(AgingReportSerializer(data).data)


class SupplierStatementReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_supplier_statement"

    def get(self, request, supplier_id):
        company = request.user.company
        try:
            supplier = Supplier.objects.get(pk=supplier_id, company=company)
        except Supplier.DoesNotExist:
            raise NotFound("Supplier not found.")
        date_from, date_to, _ = _parse_filters(request)
        data = services.get_supplier_statement(
            company, supplier, date_from=date_from, date_to=date_to,
        )
        return Response(SupplierStatementSerializer(data).data)


class SuppliersAgingReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_supplier_statement"

    def get(self, request):
        data = services.get_suppliers_aging_report(request.user.company)
        return Response(AgingReportSerializer(data).data)


class PaymentsReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_payments"

    def get(self, request):
        date_from, date_to, filters = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_payments_report(
            request.user.company, date_from=date_from, date_to=date_to, filters=filters,
        )
        return Response(PaymentsReportSerializer(data).data)


class ExpensesReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_expenses"

    def get(self, request):
        date_from, date_to, filters = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_expenses_report(
            request.user.company, date_from=date_from, date_to=date_to, filters=filters,
        )
        return Response(ExpensesReportSerializer(data).data)


class ProfitReportView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_profit"

    def get(self, request):
        date_from, date_to, _ = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_profit_report(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        create_audit_log(
            action="profit_report_view", user=request.user,
            company=request.user.company, module="reports",
            reference_type="report", reference_id="profit",
            new_value={"date_from": str(date_from), "date_to": str(date_to)},
            risk_level=risk_for_action("profit_report_view"),
        )
        return Response(ProfitReportSerializer(data).data)


class TaxSummaryBridgeView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.view_tax_summary"

    def get(self, request):
        date_from, date_to, _ = _parse_filters(request)
        _require_dates(date_from, date_to)
        data = services.get_tax_summary_bridge(
            request.user.company, date_from=date_from, date_to=date_to,
        )
        if data.get("available"):
            create_audit_log(
                action="tax_report_view", user=request.user,
                company=request.user.company, module="reports",
                reference_type="report", reference_id="tax_summary",
                new_value={"date_from": str(date_from), "date_to": str(date_to)},
                risk_level=risk_for_action("tax_report_view"),
            )
        return Response(TaxSummaryBridgeSerializer(data).data)


class ExportPayloadView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "reports.export"

    def get(self, request):
        ser = ExportPayloadQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        company = request.user.company
        filter_ser = ReportFilterSerializer(data=request.query_params)
        filter_ser.is_valid(raise_exception=True)
        filter_ser.validate_tenant_filters(company)
        filters = {
            k: vd[k] for k in vd if k not in ("report_type", "date_from", "date_to")
        }
        data = services.build_export_payload(
            company,
            report_type=vd["report_type"],
            date_from=vd.get("date_from"),
            date_to=vd.get("date_to"),
            filters=filters,
            user=request.user,
        )
        return Response(ExportPayloadSerializer(data).data)
