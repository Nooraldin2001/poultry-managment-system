import pytest

pytestmark = pytest.mark.django_db


def _detail(resp) -> str:
    body = resp.json()
    detail = body.get("detail", body) if isinstance(body, dict) else body
    if isinstance(detail, list):
        return " ".join(str(x) for x in detail)
    if isinstance(detail, dict) and "detail" in detail:
        nested = detail["detail"]
        if isinstance(nested, list):
            return " ".join(str(x) for x in nested)
        return str(nested)
    return str(detail)


def test_tenant_user_blocked_on_admin_host(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="admin.poultryhero.solutions",
    )
    assert resp.status_code == 400
    assert "Super Admin domain" in _detail(resp)


def test_tenant_user_can_login_on_matching_subdomain(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="primefresh.poultryhero.solutions",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["company"]["subdomain"] == "primefresh"


def test_tenant_user_blocked_on_wrong_subdomain(api, owner, other_company):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="competitor.poultryhero.solutions",
    )
    assert resp.status_code == 400
    assert "does not belong" in _detail(resp).lower()


def test_tenant_user_blocked_on_unknown_subdomain(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="unknown-co.poultryhero.solutions",
    )
    assert resp.status_code == 400
    assert "not found" in _detail(resp).lower()


def test_super_admin_blocked_on_tenant_host(api, super_admin):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "admin@poultryhero.solutions", "password": "AdminPass123"},
        format="json",
        HTTP_HOST="primefresh.poultryhero.solutions",
    )
    assert resp.status_code == 400
    assert "Super Admin" in _detail(resp)


def test_super_admin_can_login_on_admin_host(api, super_admin):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "admin@poultryhero.solutions", "password": "AdminPass123"},
        format="json",
        HTTP_HOST="admin.poultryhero.solutions",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["is_superuser"] is True
