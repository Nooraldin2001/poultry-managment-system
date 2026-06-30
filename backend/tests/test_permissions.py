import pytest

from apps.permissions.models import PermissionCode, RolePermissionDefault
from apps.permissions.services import get_effective_permissions, has_permission

pytestmark = pytest.mark.django_db


def test_role_defaults_seeded():
    assert PermissionCode.objects.filter(is_active=True).count() > 0
    # Each role has a default row for every code.
    for role in ("owner_admin", "accountant", "cashier_sales"):
        assert RolePermissionDefault.objects.filter(role=role).exists()


def test_owner_admin_has_all(owner):
    assert has_permission(owner, "sales.cancel")
    assert has_permission(owner, "users.manage")
    assert has_permission(owner, "tax.sensitive")


def test_cashier_defaults(cashier):
    assert has_permission(cashier, "sales.create")
    assert not has_permission(cashier, "purchases.view")
    assert not has_permission(cashier, "users.manage")
    assert not has_permission(cashier, "sales.cancel")


def test_accountant_defaults(accountant):
    assert has_permission(accountant, "reports.export")
    assert has_permission(accountant, "customers.create")
    assert not has_permission(accountant, "users.manage")


def test_super_admin_bypasses(super_admin):
    assert has_permission(super_admin, "anything.at.all")


def test_user_override_changes_effective_permission(api, owner, cashier):
    # Grant the cashier a normally-denied permission via override.
    assert not has_permission(cashier, "purchases.view")
    api.force_authenticate(user=owner)
    resp = api.patch(
        f"/api/v1/tenant/users/{cashier.id}/permissions/",
        {"overrides": [{"code": "purchases.view", "allowed": True}],
         "reason": "needs purchase visibility"},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    cashier.refresh_from_db()
    assert has_permission(cashier, "purchases.view")


def test_permission_change_requires_reason(api, owner, cashier):
    api.force_authenticate(user=owner)
    resp = api.patch(
        f"/api/v1/tenant/users/{cashier.id}/permissions/",
        {"overrides": [{"code": "purchases.view", "allowed": True}]},
        format="json",
    )
    assert resp.status_code == 400
    assert "reason" in str(resp.json()).lower()


def test_permission_catalog_listable(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/tenant/permissions/")
    assert resp.status_code == 200
    assert len(resp.json()) > 0
