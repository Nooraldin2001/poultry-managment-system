from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.services import record_action, require_reason_for_sensitive_action
from apps.core.permissions import HasTenantPermission, IsTenantUser

from . import services
from .models import User
from .serializers import (
    LoginSerializer,
    TenantUserCreateSerializer,
    TenantUserSerializer,
    TenantUserUpdateSerializer,
    UserMeSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user, context={"request": request}).data)


class LogoutView(APIView):
    """Stateless JWT logout placeholder.

    With access/refresh JWTs and no blacklist app enabled yet, logout is handled
    client-side by discarding tokens. Endpoint exists so the frontend has a
    stable contract; returns 205.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(status=status.HTTP_205_RESET_CONTENT)


class _TenantUserMixin:
    permission_classes = [IsTenantUser, HasTenantPermission]

    @property
    def required_permission(self):
        # Read-only access needs users.view; any mutation needs users.manage.
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return "users.view"
        return "users.manage"

    def get_queryset(self):
        return User.objects.filter(
            company_id=self.request.user.company_id, is_superuser=False
        )


class TenantUserListCreateView(_TenantUserMixin, generics.ListCreateAPIView):
    search_fields = ["email", "full_name", "phone"]

    def get_serializer_class(self):
        return (
            TenantUserCreateSerializer
            if self.request.method == "POST"
            else TenantUserSerializer
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = services.create_tenant_user(
            company=request.user.company,
            email=data["email"],
            password=data["password"],
            full_name=data.get("full_name", ""),
            phone=data.get("phone", ""),
            role=data["role"],
        )
        record_action(
            request=request,
            action="user_create",
            module="users",
            reference_type="user",
            reference_id=user.id,
            new_value={"email": user.email, "role": user.role},
        )
        return Response(TenantUserSerializer(user).data, status=status.HTTP_201_CREATED)


class TenantUserDetailView(_TenantUserMixin, generics.RetrieveUpdateAPIView):
    serializer_class = TenantUserUpdateSerializer

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        # Guard against demoting the last active Owner/Admin via role change.
        new_role = serializer.validated_data.get("role", user.role)
        if user.is_active and new_role != user.role:
            from .models import TenantRole

            if user.role == TenantRole.OWNER_ADMIN:
                services.assert_not_last_active_owner_admin(user)
        serializer.save()
        return Response(TenantUserSerializer(user).data)


class TenantUserSuspendView(_TenantUserMixin, APIView):
    def post(self, request, pk):
        user = generics.get_object_or_404(self.get_queryset(), pk=pk)
        # Enforce reason BEFORE mutating; then enforce last-owner rule; then log.
        reason = require_reason_for_sensitive_action(
            "user_suspend", request.data.get("reason", "")
        )
        was_active = user.is_active
        services.suspend_user(user)  # raises if last active Owner/Admin
        record_action(
            request=request,
            action="user_suspend",
            module="users",
            reference_type="user",
            reference_id=user.id,
            reason=reason,
            previous_value={"is_active": was_active},
            new_value={"is_active": False},
        )
        return Response(TenantUserSerializer(user).data)


class TenantUserReactivateView(_TenantUserMixin, APIView):
    def post(self, request, pk):
        user = generics.get_object_or_404(self.get_queryset(), pk=pk)
        services.reactivate_user(user)
        record_action(
            request=request,
            action="user_reactivate",
            module="users",
            reference_type="user",
            reference_id=user.id,
            new_value={"is_active": True},
        )
        return Response(TenantUserSerializer(user).data)
