from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response

from apps.audit.services import record_action
from apps.core.permissions import IsSuperAdmin

from .models import Plan, SubscriptionPayment
from .serializers import PlanSerializer, SubscriptionPaymentSerializer


class AdminPlanListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    queryset = Plan.objects.filter(is_active=True)
    serializer_class = PlanSerializer
    pagination_class = None


class AdminSubscriptionPaymentCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = SubscriptionPaymentSerializer
    queryset = SubscriptionPayment.objects.select_related("company", "subscription").all()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = serializer.validated_data["company"]
        subscription = getattr(company, "subscription", None)
        if subscription is None:
            return Response(
                {"detail": "Company has no subscription."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payment = serializer.save(
            subscription=subscription, recorded_by=request.user
        )
        # Update subscription running totals.
        subscription.total_paid = (subscription.total_paid or 0) + payment.amount
        subscription.outstanding_amount = max(
            (subscription.outstanding_amount or 0) - payment.amount, 0
        )
        subscription.last_payment_date = payment.payment_date
        subscription.save(
            update_fields=[
                "total_paid", "outstanding_amount", "last_payment_date", "updated_at"
            ]
        )
        record_action(
            request=request,
            action="subscription_payment_record",
            module="subscriptions",
            reference_type="subscription_payment",
            reference_id=payment.id,
            new_value={"amount": str(payment.amount), "company": company.subdomain},
        )
        return Response(
            SubscriptionPaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )
