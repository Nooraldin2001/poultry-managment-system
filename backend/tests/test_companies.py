import pytest

from apps.accounts.models import TenantRole, User
from apps.tenants.models import Company

pytestmark = pytest.mark.django_db


def test_super_admin_can_create_company(api, super_admin):
    api.force_authenticate(user=super_admin)
    resp = api.post(
        "/api/v1/admin/companies/",
        {
            "name_ar": "شركة جديدة",
            "name_en": "New Co",
            "subdomain": "newco",
            "plan_code": "basic",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    company = Company.objects.get(subdomain="newco")
    # Provisioning creates the subscription + default settings.
    assert hasattr(company, "subscription")
    assert company.subscription.plan.code == "basic"
    assert company.vat_settings.default_vat_rate == pytest.approx(5.00)
    assert company.numbering_settings.count() >= 1
    assert company.print_templates.count() >= 1


def test_duplicate_subdomain_blocked(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    resp = api.post(
        "/api/v1/admin/companies/",
        {"name_ar": "x", "name_en": "x", "subdomain": "primefresh", "plan_code": "pro"},
        format="json",
    )
    assert resp.status_code == 400
    assert "subdomain" in resp.json()


@pytest.mark.parametrize("bad", ["Prime Fresh", "has_underscore", "bad!", "-lead"])
def test_invalid_subdomain_rejected(api, super_admin, bad):
    api.force_authenticate(user=super_admin)
    resp = api.post(
        "/api/v1/admin/companies/",
        {"name_ar": "x", "name_en": "x", "subdomain": bad, "plan_code": "pro"},
        format="json",
    )
    assert resp.status_code == 400


def test_reserved_subdomain_rejected(api, super_admin):
    api.force_authenticate(user=super_admin)
    resp = api.post(
        "/api/v1/admin/companies/",
        {"name_ar": "x", "name_en": "x", "subdomain": "admin", "plan_code": "pro"},
        format="json",
    )
    assert resp.status_code == 400


def test_tenant_user_cannot_create_company(api, owner):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/admin/companies/",
        {"name_ar": "x", "name_en": "x", "subdomain": "zzz", "plan_code": "pro"},
        format="json",
    )
    assert resp.status_code == 403


def test_create_admin_user_for_company(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    resp = api.post(
        f"/api/v1/admin/companies/{company.id}/create-admin-user/",
        {"email": "newowner@primefresh.test", "password": "StrongPass123"},
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    user = User.objects.get(email="newowner@primefresh.test")
    assert user.role == TenantRole.OWNER_ADMIN
    assert user.company_id == company.id


def test_suspend_and_reactivate_company(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    r1 = api.post(f"/api/v1/admin/companies/{company.id}/suspend/", {"reason": "unpaid"}, format="json")
    assert r1.status_code == 200
    company.refresh_from_db()
    assert company.status == "suspended"

    r2 = api.post(f"/api/v1/admin/companies/{company.id}/reactivate/", {}, format="json")
    assert r2.status_code == 200
    company.refresh_from_db()
    assert company.status == "active"
