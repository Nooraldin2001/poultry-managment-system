import pytest

from apps.accounts.models import TenantRole, User
from apps.accounts.services import create_tenant_user

pytestmark = pytest.mark.django_db


def test_tenant_user_belongs_to_company(owner, company):
    assert owner.company_id == company.id
    assert owner.is_tenant_user
    assert owner.is_owner_admin


def test_user_limit_enforced(api, owner, basic_company):
    # Basic plan = 3 users. Create an owner first (1), then fill to limit.
    from apps.tenants.services import create_first_admin_user

    create_first_admin_user(
        company=basic_company, email="o@basicco.test", password="Pass12345"
    )
    create_tenant_user(
        company=basic_company, email="u2@basicco.test", password="Pass12345",
        role=TenantRole.CASHIER_SALES,
    )
    create_tenant_user(
        company=basic_company, email="u3@basicco.test", password="Pass12345",
        role=TenantRole.CASHIER_SALES,
    )
    # 4th should fail (limit reached).
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        create_tenant_user(
            company=basic_company, email="u4@basicco.test", password="Pass12345",
            role=TenantRole.CASHIER_SALES,
        )


def test_user_limit_enforced_via_api(api, owner):
    api.force_authenticate(user=owner)
    # PRO plan limit = 10; create up to limit then expect 400.
    # owner counts as 1 active user already.
    created = 0
    for i in range(9):
        resp = api.post(
            "/api/v1/tenant/users/",
            {"email": f"u{i}@primefresh.test", "password": "Pass12345",
             "role": "cashier_sales", "full_name": f"U{i}"},
            format="json",
        )
        assert resp.status_code == 201, resp.json()
        created += 1
    # 10 active users now; the next must be blocked.
    resp = api.post(
        "/api/v1/tenant/users/",
        {"email": "overflow@primefresh.test", "password": "Pass12345",
         "role": "cashier_sales"},
        format="json",
    )
    assert resp.status_code == 400
    assert "user limit" in str(resp.json()).lower()


def test_cannot_suspend_last_owner_admin(api, owner):
    api.force_authenticate(user=owner)
    resp = api.post(
        f"/api/v1/tenant/users/{owner.id}/suspend/",
        {"reason": "test"},
        format="json",
    )
    assert resp.status_code == 400
    assert "owner/admin" in str(resp.json()).lower()


def test_suspend_requires_reason(api, owner, cashier):
    api.force_authenticate(user=owner)
    resp = api.post(
        f"/api/v1/tenant/users/{cashier.id}/suspend/", {}, format="json"
    )
    assert resp.status_code == 400
    assert "reason" in str(resp.json()).lower()


def test_suspend_cashier_succeeds_with_reason(api, owner, cashier):
    api.force_authenticate(user=owner)
    resp = api.post(
        f"/api/v1/tenant/users/{cashier.id}/suspend/",
        {"reason": "left company"},
        format="json",
    )
    assert resp.status_code == 200
    cashier.refresh_from_db()
    assert cashier.is_active is False


def test_cashier_cannot_manage_users(api, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get("/api/v1/tenant/users/")
    assert resp.status_code == 403
