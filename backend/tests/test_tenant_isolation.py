import pytest

from apps.subscriptions.models import Plan, PlanCode
from apps.tenants.services import create_first_admin_user, provision_company

pytestmark = pytest.mark.django_db


@pytest.fixture
def other_company_owner(db):
    plan = Plan.objects.get(code=PlanCode.PRO)
    other = provision_company(
        name_ar="منافس", name_en="Competitor Co", subdomain="competitor", plan=plan
    )
    return create_first_admin_user(
        company=other, email="owner@competitor.test", password="OwnerPass123"
    )


def test_tenant_only_sees_own_users(api, owner, cashier, other_company_owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/tenant/users/")
    emails = {u["email"] for u in resp.json()["results"]}
    assert "cashier@primefresh.test" in emails
    assert "owner@competitor.test" not in emails


def test_cannot_access_other_tenant_user(api, owner, other_company_owner):
    api.force_authenticate(user=owner)
    # other_company_owner belongs to a different company -> 404 (out of scope)
    resp = api.get(f"/api/v1/tenant/users/{other_company_owner.id}/")
    assert resp.status_code == 404


def test_cannot_edit_other_tenant_user_permissions(api, owner, other_company_owner):
    api.force_authenticate(user=owner)
    resp = api.patch(
        f"/api/v1/tenant/users/{other_company_owner.id}/permissions/",
        {"overrides": [{"code": "sales.view", "allowed": False}], "reason": "x"},
        format="json",
    )
    assert resp.status_code == 404


def test_audit_logs_isolated_per_tenant(api, owner, other_company_owner):
    # Generate an audit entry in the "other" company by changing its VAT.
    api.force_authenticate(user=other_company_owner)
    api.patch(
        "/api/v1/tenant/settings/vat/",
        {"default_vat_rate": "9.00", "reason": "other co change"},
        format="json",
    )
    # Primefresh owner must not see the competitor's audit entry.
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/tenant/audit-logs/")
    actions = [row["reason"] for row in resp.json()["results"]]
    assert "other co change" not in actions
