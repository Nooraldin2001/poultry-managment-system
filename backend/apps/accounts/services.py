"""User lifecycle services: limit enforcement + last-owner protection."""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import TenantRole, User


def count_active_tenant_users(company) -> int:
    return User.objects.filter(
        company=company, is_active=True, is_superuser=False
    ).count()


def get_user_limit(company) -> int:
    subscription = getattr(company, "subscription", None)
    if subscription is None:
        return 0
    return subscription.plan.user_limit


def assert_can_add_user(company):
    """Raise 400 if the company has reached its plan user limit."""
    if count_active_tenant_users(company) >= get_user_limit(company):
        raise ValidationError(
            {"detail": "User limit reached for current plan."}
        )


def assert_not_last_active_owner_admin(user):
    """Prevent deactivating/demoting the final active Owner/Admin of a tenant."""
    if user.company_id is None or user.role != TenantRole.OWNER_ADMIN:
        return
    others = (
        User.objects.filter(
            company_id=user.company_id,
            role=TenantRole.OWNER_ADMIN,
            is_active=True,
        )
        .exclude(pk=user.pk)
        .exists()
    )
    if not others:
        raise ValidationError(
            {"detail": "At least one active Owner/Admin must remain for the company."}
        )


@transaction.atomic
def create_tenant_user(*, company, email, password, full_name="", phone="",
                       role=TenantRole.CASHIER_SALES, force_password_change=True):
    """Create a tenant user after enforcing the plan user limit."""
    assert_can_add_user(company)
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        phone=phone,
        company=company,
        role=role,
        force_password_change=force_password_change,
        is_staff=False,
        is_superuser=False,
    )
    return user


def suspend_user(user):
    assert_not_last_active_owner_admin(user)
    user.is_active = False
    user.save(update_fields=["is_active"])
    return user


def reactivate_user(user):
    # Reactivating must still respect the plan limit.
    if not user.is_active:
        assert_can_add_user(user.company)
    user.is_active = True
    user.save(update_fields=["is_active"])
    return user
