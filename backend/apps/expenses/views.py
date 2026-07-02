"""Expenses API (Phase 8) under /api/v1/tenant/."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.permissions.services import has_permission

from . import services
from .models import Expense, ExpenseAttachment, ExpenseCategory, ExpenseStatus, RecurringExpense
from .serializers import (
    ExpenseAttachmentSerializer,
    ExpenseCancelSerializer,
    ExpenseCategorySerializer,
    ExpenseCreateUpdateSerializer,
    ExpenseDetailSerializer,
    ExpenseListSerializer,
    ExpenseProfitImpactSerializer,
    ExpenseSummarySerializer,
    ExpenseVoucherPreviewSerializer,
    RecurringExpenseCreateUpdateSerializer,
    RecurringExpenseDetailSerializer,
    RecurringExpenseGenerateSerializer,
    RecurringExpenseListSerializer,
)


def _require(user, code):
    if not has_permission(user, code):
        raise PermissionDenied(f"Missing permission: {code}")


def _require_posted(expense):
    if expense.status != ExpenseStatus.POSTED:
        raise ValidationError("Only posted expenses can be modified.")


class ExpenseCategoryViewSet(TenantScopedViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "expenses.view",
        "retrieve": "expenses.view",
        "create": "expenses.manage_categories",
        "partial_update": "expenses.manage_categories",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("category_type"):
            qs = qs.filter(category_type=p["category_type"])
        if p.get("is_active") is not None:
            qs = qs.filter(is_active=str(p["is_active"]).lower() in ("1", "true", "yes"))
        return qs.order_by("sort_order", "name_ar")


class ExpenseViewSet(TenantScopedViewSet):
    queryset = (
        Expense.objects.select_related("category", "linked_purchase_invoice", "created_by")
        .prefetch_related("attachments")
        .all()
    )
    serializer_class = ExpenseDetailSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "expenses.view",
        "retrieve": "expenses.view",
        "create": "expenses.create",
        "partial_update": "expenses.edit",
        "cancel": "expenses.cancel",
        "voucher_preview": "expenses.print",
        "attachments": "expenses.view",
        "upload_attachment": "expenses.upload_attachment",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_serializer_class(self):
        if self.action == "list":
            return ExpenseListSerializer
        return ExpenseDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("category"):
            qs = qs.filter(category_id=p["category"])
        if p.get("expense_scope"):
            qs = qs.filter(expense_scope=p["expense_scope"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("payment_method"):
            qs = qs.filter(payment_method=p["payment_method"])
        if p.get("date_from"):
            qs = qs.filter(expense_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(expense_date__lte=p["date_to"])
        if p.get("min_amount"):
            qs = qs.filter(total_amount__gte=p["min_amount"])
        if p.get("max_amount"):
            qs = qs.filter(total_amount__lte=p["max_amount"])
        if p.get("linked_purchase_invoice"):
            qs = qs.filter(linked_purchase_invoice_id=p["linked_purchase_invoice"])
        if p.get("search"):
            qs = qs.filter(
                Q(expense_number__icontains=p["search"])
                | Q(title__icontains=p["search"])
                | Q(vendor_name__icontains=p["search"])
            )
        if p.get("recurring_generated") is not None:
            from .models import ExpenseScope
            if str(p["recurring_generated"]).lower() in ("1", "true", "yes"):
                qs = qs.filter(expense_scope=ExpenseScope.RECURRING_GENERATED)
            else:
                qs = qs.exclude(expense_scope=ExpenseScope.RECURRING_GENERATED)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ExpenseCreateUpdateSerializer(
            data=request.data, context={"company": self.company, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        expense = services.create_expense(
            company=self.company,
            category=vd["category"],
            created_by=request.user,
            title=vd["title"],
            expense_date=vd["expense_date"],
            amount=vd["amount"],
            expense_scope=vd.get("expense_scope", "general"),
            vat_rate=vd.get("vat_rate", 0),
            payment_method=vd.get("payment_method", "cash"),
            description=vd.get("description", ""),
            reference_number=vd.get("reference_number", ""),
            vendor_name=vd.get("vendor_name", ""),
            employee_name=vd.get("employee_name", ""),
            vehicle_number=vd.get("vehicle_number", ""),
            linked_purchase_invoice=vd.get("linked_purchase_invoice"),
            purchase_link_behavior=vd.get("purchase_link_behavior", "none"),
            notes=vd.get("notes", ""),
            reason=vd.get("reason", ""),
        )
        return Response(ExpenseDetailSerializer(expense).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        expense = self.get_object()
        _require_posted(expense)
        allowed = {"notes", "description", "reference_number", "vendor_name", "employee_name", "vehicle_number"}
        extra = set(request.data.keys()) - allowed
        if extra:
            raise ValidationError(
                "Only notes, description, reference_number, vendor_name, employee_name, "
                "and vehicle_number can be edited after posting."
            )
        for field in allowed:
            if field in request.data:
                setattr(expense, field, request.data[field])
        expense.updated_by = request.user
        expense.save(update_fields=list(request.data.keys()) + ["updated_by", "updated_at"])
        return Response(ExpenseDetailSerializer(expense).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        expense = self.get_object()
        serializer = ExpenseCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.cancel_expense(
            expense=expense, user=request.user, reason=serializer.validated_data["reason"],
        )
        return Response(ExpenseDetailSerializer(expense).data)

    @action(detail=True, methods=["get"], url_path="voucher-preview")
    def voucher_preview(self, request, pk=None):
        expense = self.get_object()
        data = services.build_expense_voucher_preview(expense)
        return Response(ExpenseVoucherPreviewSerializer(data).data)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        expense = self.get_object()
        if request.method == "GET":
            qs = expense.attachments.all()
            return Response(ExpenseAttachmentSerializer(qs, many=True).data)
        _require(request.user, "expenses.upload_attachment")
        file = request.FILES.get("file")
        if not file:
            raise ValidationError({"file": "File is required."})
        attachment = ExpenseAttachment.objects.create(
            company=self.company,
            expense=expense,
            file=file,
            file_type=request.data.get("file_type", "receipt"),
            original_filename=getattr(file, "name", ""),
            uploaded_by=request.user,
            notes=request.data.get("notes", ""),
        )
        return Response(
            ExpenseAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class RecurringExpenseViewSet(TenantScopedViewSet):
    queryset = RecurringExpense.objects.select_related("category").all()
    serializer_class = RecurringExpenseDetailSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "expenses.view",
        "retrieve": "expenses.view",
        "create": "expenses.manage_recurring",
        "partial_update": "expenses.manage_recurring",
        "generate": "expenses.manage_recurring",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_serializer_class(self):
        if self.action == "list":
            return RecurringExpenseListSerializer
        return RecurringExpenseDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = RecurringExpenseCreateUpdateSerializer(
            data=request.data, context={"company": self.company},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        recurring = services.create_recurring_expense(
            company=self.company,
            category=vd["category"],
            created_by=request.user,
            title=vd["title"],
            amount=vd["amount"],
            recurrence=vd["recurrence"],
            start_date=vd["start_date"],
            vat_rate=vd.get("vat_rate", 0),
            payment_method=vd.get("payment_method", "cash"),
            description=vd.get("description", ""),
            end_date=vd.get("end_date"),
            vendor_name=vd.get("vendor_name", ""),
            notes=vd.get("notes", ""),
            auto_generate=vd.get("auto_generate", False),
        )
        return Response(
            RecurringExpenseDetailSerializer(recurring).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        recurring = self.get_object()
        serializer = RecurringExpenseCreateUpdateSerializer(
            data=request.data, partial=True, context={"company": self.company},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        update_fields = []
        for field, value in vd.items():
            setattr(recurring, field, value)
            update_fields.append(field)
        if "amount" in vd or "vat_rate" in vd:
            amount, vat_rate, vat_amount, total = services._compute_money(
                recurring.amount, recurring.vat_rate,
            )
            recurring.amount = amount
            recurring.vat_rate = vat_rate
            recurring.vat_amount = vat_amount
            recurring.total_amount = total
            update_fields += ["amount", "vat_rate", "vat_amount", "total_amount"]
        recurring.updated_by = request.user
        update_fields += ["updated_by", "updated_at"]
        recurring.save(update_fields=list(set(update_fields)))
        return Response(RecurringExpenseDetailSerializer(recurring).data)

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        recurring = self.get_object()
        serializer = RecurringExpenseGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.generate_expense_from_recurring(
            recurring_expense=recurring,
            user=request.user,
            target_date=serializer.validated_data.get("target_date"),
        )
        return Response(ExpenseDetailSerializer(expense).data, status=status.HTTP_201_CREATED)


class ExpenseSummaryView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "expenses.view"

    def get(self, request):
        company = request.user.company
        p = request.query_params
        data = services.get_expense_summary(
            company,
            date_from=p.get("date_from"),
            date_to=p.get("date_to"),
        )
        return Response(ExpenseSummarySerializer(data).data)


class ExpenseProfitImpactView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "expenses.view_profit_impact"

    def get(self, request):
        company = request.user.company
        p = request.query_params
        date_from = p.get("date_from")
        date_to = p.get("date_to")
        if not date_from or not date_to:
            raise ValidationError({"detail": "date_from and date_to are required."})
        data = services.get_profit_impact_foundation(
            company, date_from=date_from, date_to=date_to,
        )
        return Response(ExpenseProfitImpactSerializer(data).data)
