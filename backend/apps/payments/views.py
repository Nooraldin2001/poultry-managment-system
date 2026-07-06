"""Payments API (Phase 6) under /api/v1/tenant/payments/."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.customers.models import Customer
from apps.purchases.models import PurchaseInvoice
from apps.sales.models import SalesInvoice
from apps.suppliers.models import Supplier

from . import services
from .models import PaymentMovement, PaymentMovementStatus
from .serializers import (
    CustomerBalanceReconciliationSerializer,
    CustomerCollectionCreateSerializer,
    CustomerRefundCreateSerializer,
    PaymentCancelSerializer,
    PaymentMovementDetailSerializer,
    PaymentMovementListSerializer,
    PaymentSummarySerializer,
    SupplierBalanceReconciliationSerializer,
    SupplierPaymentCreateSerializer,
    SupplierRefundCreateSerializer,
)


class PaymentMovementViewSet(TenantScopedViewSet):
    queryset = (
        PaymentMovement.objects.select_related("customer", "supplier", "posted_by")
        .prefetch_related("allocations", "allocations__sales_invoice",
                          "allocations__purchase_invoice")
        .all()
    )
    serializer_class = PaymentMovementDetailSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_map = {
        "list": "payments.view",
        "retrieve": "payments.view",
        "cancel": "payments.cancel",
        "print_preview": "payments.print",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_serializer_class(self):
        if self.action == "list":
            return PaymentMovementListSerializer
        return PaymentMovementDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("movement_type"):
            qs = qs.filter(movement_type=p["movement_type"])
        if p.get("party_type"):
            qs = qs.filter(party_type=p["party_type"])
        if p.get("customer"):
            qs = qs.filter(customer_id=p["customer"])
        if p.get("supplier"):
            qs = qs.filter(supplier_id=p["supplier"])
        if p.get("payment_method"):
            qs = qs.filter(payment_method=p["payment_method"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("date_from"):
            qs = qs.filter(movement_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(movement_date__lte=p["date_to"])
        if p.get("min_amount"):
            qs = qs.filter(amount__gte=p["min_amount"])
        if p.get("max_amount"):
            qs = qs.filter(amount__lte=p["max_amount"])
        if p.get("search"):
            qs = qs.filter(
                Q(movement_number__icontains=p["search"])
                | Q(receipt_number__icontains=p["search"])
                | Q(reference_number__icontains=p["search"])
            )
        return qs

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        movement = self.get_object()
        serializer = PaymentCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = services.cancel_payment_movement(
            movement=movement, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(PaymentMovementDetailSerializer(movement).data)

    @action(detail=True, methods=["get"], url_path="print-preview")
    def print_preview(self, request, pk=None):
        movement = self.get_object()
        return Response(services.build_receipt_preview(movement, request=request))


class PaymentSummaryView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.view"

    def get(self, request):
        data = services.get_payment_summary(request.user.company)
        return Response(PaymentSummarySerializer(data).data)


class CustomerCollectionCreateView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.create_customer_collection"

    def post(self, request):
        serializer = CustomerCollectionCreateSerializer(
            data=request.data, context={"company": request.user.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        movement = services.record_customer_collection(
            company=request.user.company,
            customer=vd["customer"],
            amount=vd["amount"],
            payment_method=vd["payment_method"],
            allocations=vd.get("_resolved_allocations", []),
            reference_number=vd.get("reference_number", ""),
            bank_name=vd.get("bank_name", ""),
            cheque_number=vd.get("cheque_number", ""),
            cheque_date=vd.get("cheque_date"),
            movement_date=vd.get("movement_date"),
            notes=vd.get("notes", ""),
            user=request.user,
            reason=vd.get("reason", ""),
        )
        return Response(
            PaymentMovementDetailSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class SupplierPaymentCreateView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.create_supplier_payment"

    def post(self, request):
        serializer = SupplierPaymentCreateSerializer(
            data=request.data, context={"company": request.user.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        movement = services.record_supplier_payment(
            company=request.user.company,
            supplier=vd["supplier"],
            amount=vd["amount"],
            payment_method=vd["payment_method"],
            allocations=vd.get("_resolved_allocations", []),
            reference_number=vd.get("reference_number", ""),
            bank_name=vd.get("bank_name", ""),
            cheque_number=vd.get("cheque_number", ""),
            cheque_date=vd.get("cheque_date"),
            movement_date=vd.get("movement_date"),
            notes=vd.get("notes", ""),
            user=request.user,
            reason=vd.get("reason", ""),
        )
        return Response(
            PaymentMovementDetailSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerRefundCreateView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.create_customer_refund"

    def post(self, request):
        serializer = CustomerRefundCreateSerializer(
            data=request.data, context={"company": request.user.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        movement = services.record_customer_refund(
            company=request.user.company,
            customer=vd["customer"],
            amount=vd["amount"],
            payment_method=vd["payment_method"],
            reference_number=vd.get("reference_number", ""),
            bank_name=vd.get("bank_name", ""),
            cheque_number=vd.get("cheque_number", ""),
            cheque_date=vd.get("cheque_date"),
            movement_date=vd.get("movement_date"),
            notes=vd.get("notes", ""),
            user=request.user,
            reason=vd["reason"],
            allow_override=vd.get("allow_override", False),
        )
        return Response(
            PaymentMovementDetailSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class SupplierRefundCreateView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.create_supplier_refund"

    def post(self, request):
        serializer = SupplierRefundCreateSerializer(
            data=request.data, context={"company": request.user.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        movement = services.record_supplier_refund(
            company=request.user.company,
            supplier=vd["supplier"],
            amount=vd["amount"],
            payment_method=vd["payment_method"],
            reference_number=vd.get("reference_number", ""),
            bank_name=vd.get("bank_name", ""),
            cheque_number=vd.get("cheque_number", ""),
            cheque_date=vd.get("cheque_date"),
            movement_date=vd.get("movement_date"),
            notes=vd.get("notes", ""),
            user=request.user,
            reason=vd["reason"],
            allow_override=vd.get("allow_override", False),
        )
        return Response(
            PaymentMovementDetailSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerCollectionsListView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.view"

    def get(self, request, customer_id):
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=request.user.company_id
        )
        qs = services.get_customer_collections(request.user.company, customer)
        return Response(PaymentMovementListSerializer(qs, many=True).data)


class SupplierPaymentsListView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.view"

    def get(self, request, supplier_id):
        supplier = get_object_or_404(
            Supplier, pk=supplier_id, company_id=request.user.company_id
        )
        qs = services.get_supplier_payments(request.user.company, supplier)
        return Response(PaymentMovementListSerializer(qs, many=True).data)


class CustomerReconciliationView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.reconcile"

    def get(self, request, customer_id):
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=request.user.company_id
        )
        data = services.reconcile_customer_balance(request.user.company, customer)
        return Response(CustomerBalanceReconciliationSerializer(data).data)


class SupplierReconciliationView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "payments.reconcile"

    def get(self, request, supplier_id):
        supplier = get_object_or_404(
            Supplier, pk=supplier_id, company_id=request.user.company_id
        )
        data = services.reconcile_supplier_balance(request.user.company, supplier)
        return Response(SupplierBalanceReconciliationSerializer(data).data)


class ReceiptListView(APIView):
    """GET /api/v1/tenant/receipts/ — posted payment movements with receipt numbers."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "receipts.view"

    def get(self, request):
        qs = PaymentMovement.objects.filter(
            company_id=request.user.company_id,
            status=PaymentMovementStatus.POSTED,
        ).exclude(receipt_number="").order_by("-movement_date", "-id")
        return Response(PaymentMovementListSerializer(qs, many=True).data)


class ReceiptDetailView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "receipts.view"

    def get(self, request, pk):
        movement = get_object_or_404(
            PaymentMovement, pk=pk, company_id=request.user.company_id
        )
        return Response(PaymentMovementDetailSerializer(movement).data)


class ReceiptPrintPreviewView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "receipts.print"

    def get(self, request, pk):
        movement = get_object_or_404(
            PaymentMovement, pk=pk, company_id=request.user.company_id
        )
        return Response(services.build_receipt_preview(movement, request=request))
