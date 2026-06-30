from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import TenantRole
from apps.audit.services import create_audit_log, record_action
from apps.core.viewsets import TenantScopedViewSet

from . import services
from .models import (
    Customer,
    CustomerCategory,
    CustomerCreditLimitChange,
    CustomerFreeProductAgreement,
    CustomerSpecialPrice,
)
from .serializers import (
    CustomerCategorySerializer,
    CustomerCreateUpdateSerializer,
    CustomerCreditLimitChangeSerializer,
    CustomerDetailSerializer,
    CustomerDisableSerializer,
    CustomerFreeProductAgreementSerializer,
    CustomerLedgerEntrySerializer,
    CustomerListSerializer,
    CustomerSpecialPriceSerializer,
    CustomerStatementSerializer,
    OpeningBalanceUpdateSerializer,
)


def _is_owner_admin(user):
    return user.role == TenantRole.OWNER_ADMIN


class CustomerCategoryViewSet(TenantScopedViewSet):
    queryset = CustomerCategory.objects.all()
    serializer_class = CustomerCategorySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "customers.view",
        "retrieve": "customers.view",
        "create": "customers.create",
        "partial_update": "customers.create",
    }


class CustomerViewSet(TenantScopedViewSet):
    queryset = Customer.objects.select_related("category").all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "customers.view",
        "retrieve": "customers.view",
        "create": "customers.create",
        "partial_update": "customers.edit",
        "disable": "customers.disable",
        "reactivate": "customers.disable",
        "ledger": "customers.view_balance",
        "statement": "customers.view_balance",
        "opening_balance": "customers.edit_opening_balance",
        "credit_limit": "customers.set_credit_limit",
        "special_prices": "customers.special_prices.manage",
        "special_price_detail": "customers.special_prices.manage",
        "free_products": "customers.free_products.manage",
        "free_product_detail": "customers.free_products.manage",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return CustomerListSerializer
        if self.action in ("create", "partial_update"):
            return CustomerCreateUpdateSerializer
        return CustomerDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("is_active") is not None:
            qs = qs.filter(is_active=p["is_active"].lower() in ("1", "true", "yes"))
        if p.get("category"):
            qs = qs.filter(category_id=p["category"])
        if p.get("customer_type") or p.get("type"):
            qs = qs.filter(customer_type=p.get("customer_type") or p.get("type"))
        search = p.get("search") or p.get("q")
        if search:
            qs = qs.filter(Q(name_ar__icontains=search) | Q(name_en__icontains=search) | Q(phone__icontains=search))
        if p.get("has_balance") in ("1", "true", "yes"):
            qs = qs.exclude(current_balance=0)
        if p.get("credit_exceeded") in ("1", "true", "yes"):
            qs = qs.filter(credit_limit__gt=0, current_balance__gte=F("credit_limit"))
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = services.create_customer_with_opening_balance(
            company=request.user.company, created_by=request.user,
            **serializer.validated_data,
        )
        return Response(
            CustomerDetailSerializer(customer, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def _detail_response(self, customer):
        return Response(
            CustomerDetailSerializer(customer, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        customer = self.get_object()
        reason = (request.data.get("reason") or "").strip()
        if customer.current_balance != 0:
            record_action(
                request=request, action="customer_disable_with_balance",
                module="customers", reference_type="customer", reference_id=customer.id,
                previous_value={"current_balance": str(customer.current_balance)},
                reason=reason,
            )
        else:
            create_audit_log(
                action="customer_disable", user=request.user, company=request.user.company,
                module="customers", reference_type="customer", reference_id=customer.id,
                reason=reason, request=request,
            )
        customer.is_active = False
        customer.inactive_reason = reason
        customer.save(update_fields=["is_active", "inactive_reason"])
        return self._detail_response(customer)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        customer = self.get_object()
        customer.is_active = True
        customer.inactive_reason = ""
        customer.save(update_fields=["is_active", "inactive_reason"])
        return self._detail_response(customer)

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        customer = self.get_object()
        entries = customer.ledger_entries.all()
        return Response(CustomerLedgerEntrySerializer(entries, many=True).data)

    @action(detail=True, methods=["get"])
    def statement(self, request, pk=None):
        customer = self.get_object()
        data = {
            "customer_id": customer.id,
            "customer_name": customer.name_ar,
            "opening_balance": customer.opening_balance,
            "current_balance": services.get_customer_balance(customer),
            "credit_status": customer.credit_status,
            "entries": customer.ledger_entries.all(),
        }
        return Response(CustomerStatementSerializer(data).data)

    @action(detail=True, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request, pk=None):
        customer = self.get_object()
        serializer = OpeningBalanceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        previous = {
            "opening_balance": str(customer.opening_balance),
            "opening_balance_type": customer.opening_balance_type,
        }
        services.update_customer_opening_balance_with_reason(
            customer=customer, new_amount=vd["opening_balance"],
            new_type=vd["opening_balance_type"], reason=vd["reason"], user=request.user,
        )
        record_action(
            request=request, action="edit_customer_opening_balance", module="customers",
            reference_type="customer", reference_id=customer.id,
            previous_value=previous,
            new_value={"opening_balance": str(vd["opening_balance"]), "opening_balance_type": vd["opening_balance_type"]},
            reason=vd["reason"],
        )
        return self._detail_response(customer)

    @action(detail=True, methods=["post"], url_path="credit-limit")
    def credit_limit(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerCreditLimitChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        change = services.change_customer_credit_limit(
            customer=customer, new_limit=vd["new_limit"],
            change_type=vd.get("change_type", CustomerCreditLimitChange.ChangeType.PERMANENT),
            reason=vd["reason"], changed_by=request.user,
            related_reference_type=vd.get("related_reference_type", ""),
            related_reference_id=vd.get("related_reference_id", ""),
        )
        record_action(
            request=request, action="customer_credit_limit_change", module="customers",
            reference_type="customer", reference_id=customer.id,
            previous_value={"credit_limit": str(change.previous_limit)},
            new_value={"credit_limit": str(change.new_limit)}, reason=vd["reason"],
        )
        return Response(CustomerCreditLimitChangeSerializer(change).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="special-prices")
    def special_prices(self, request, pk=None):
        customer = self.get_object()
        if request.method == "GET":
            qs = customer.special_prices.select_related("product").all()
            return Response(CustomerSpecialPriceSerializer(qs, many=True).data)
        serializer = CustomerSpecialPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        reason = (request.data.get("reason") or "").strip()
        sp = services.create_customer_special_price(
            company=request.user.company, customer=customer, product=vd["product"],
            price=vd["price"], price_type=vd["price_type"], reason=reason,
            notes=vd.get("notes", ""), created_by=request.user,
            allow_override=_is_owner_admin(request.user),
        )
        record_action(
            request=request, action="customer_special_price_change", module="customers",
            reference_type="customer_special_price", reference_id=sp.id,
            new_value={"product": sp.product_id, "price": str(sp.price), "price_type": sp.price_type},
            reason=reason,
        )
        return Response(CustomerSpecialPriceSerializer(sp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="special-prices/(?P<price_id>[^/.]+)")
    def special_price_detail(self, request, pk=None, price_id=None):
        customer = self.get_object()
        sp = get_object_or_404(CustomerSpecialPrice, pk=price_id, customer=customer,
                               company_id=request.user.company_id)
        reason = (request.data.get("reason") or "").strip()
        previous = {"price": str(sp.price), "is_active": sp.is_active}
        for field in ("price", "price_type", "is_active", "notes"):
            if field in request.data:
                setattr(sp, field, request.data[field])
        sp.updated_by = request.user
        sp.reason = reason or sp.reason
        sp.save()
        record_action(
            request=request, action="customer_special_price_change", module="customers",
            reference_type="customer_special_price", reference_id=sp.id,
            previous_value=previous, new_value={"price": str(sp.price), "is_active": sp.is_active},
            reason=reason,
        )
        return Response(CustomerSpecialPriceSerializer(sp).data)

    @action(detail=True, methods=["get", "post"], url_path="free-products")
    def free_products(self, request, pk=None):
        customer = self.get_object()
        if request.method == "GET":
            qs = customer.free_product_agreements.select_related("product").all()
            return Response(CustomerFreeProductAgreementSerializer(qs, many=True).data)
        serializer = CustomerFreeProductAgreementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        agreement = services.create_customer_free_product_agreement(
            company=request.user.company, customer=customer, product=vd["product"],
            agreement_type=vd["agreement_type"], condition_amount=vd.get("condition_amount"),
            condition_quantity=vd.get("condition_quantity"), notes=vd.get("notes", ""),
            created_by=request.user, allow_override=_is_owner_admin(request.user),
        )
        return Response(CustomerFreeProductAgreementSerializer(agreement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="free-products/(?P<agreement_id>[^/.]+)")
    def free_product_detail(self, request, pk=None, agreement_id=None):
        customer = self.get_object()
        agreement = get_object_or_404(
            CustomerFreeProductAgreement, pk=agreement_id, customer=customer,
            company_id=request.user.company_id,
        )
        for field in ("agreement_type", "condition_amount", "condition_quantity", "is_active", "notes"):
            if field in request.data:
                setattr(agreement, field, request.data[field])
        agreement.updated_by = request.user
        agreement.save()
        return Response(CustomerFreeProductAgreementSerializer(agreement).data)
