import pytest

pytestmark = pytest.mark.django_db


def test_login_with_email_password(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body and "refresh" in body
    assert body["user"]["email"] == "owner@primefresh.test"
    assert body["user"]["role"] == "owner_admin"
    assert body["user"]["company"]["subdomain"] == "primefresh"
    # Owner/Admin gets full permission set.
    assert "sales.approve" in body["user"]["permissions"]


def test_login_wrong_password(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "nope"},
        format="json",
    )
    assert resp.status_code == 401


def test_me_requires_auth(api):
    assert api.get("/api/v1/auth/me/").status_code == 401


def test_me_returns_profile(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["email"] == "owner@primefresh.test"


def test_suspended_company_blocks_login(api, owner, company):
    from apps.tenants.models import CompanyStatus

    company.status = CompanyStatus.SUSPENDED
    company.save()
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "inactive" in str(resp.json()).lower()
