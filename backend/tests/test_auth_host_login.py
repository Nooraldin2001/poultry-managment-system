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


def _code(resp) -> str:
    body = resp.json()
    if isinstance(body, dict):
        if body.get("code"):
            return body["code"]
        detail = body.get("detail")
        if isinstance(detail, dict):
            return detail.get("code", "")
    return ""


def test_tenant_user_blocked_on_admin_host(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="admin.poultryhero.solutions",
    )
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_tenant_user_blocked_on_root_host(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="poultryhero.solutions",
    )
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


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
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_tenant_user_blocked_on_unknown_subdomain(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="unknown-co.poultryhero.solutions",
    )
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_super_admin_blocked_on_tenant_host(api, super_admin):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "admin@poultryhero.solutions", "password": "AdminPass123"},
        format="json",
        HTTP_HOST="primefresh.poultryhero.solutions",
    )
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_super_admin_can_login_on_admin_host(api, super_admin):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "admin@poultryhero.solutions", "password": "AdminPass123"},
        format="json",
        HTTP_HOST="admin.poultryhero.solutions",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["is_superuser"] is True


def test_super_admin_can_login_on_root_host(api, super_admin):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "admin@poultryhero.solutions", "password": "AdminPass123"},
        format="json",
        HTTP_HOST="poultryhero.solutions",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["is_superuser"] is True


def test_me_rejects_tenant_user_on_root_host(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/auth/me/", HTTP_HOST="poultryhero.solutions")
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_me_accepts_tenant_user_on_matching_host(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/auth/me/", HTTP_HOST="primefresh.poultryhero.solutions")
    assert resp.status_code == 200
    assert resp.json()["company"]["subdomain"] == "primefresh"


def test_me_rejects_tenant_user_on_wrong_host(api, owner, other_company):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/auth/me/", HTTP_HOST="competitor.poultryhero.solutions")
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"


def test_me_accepts_super_admin_on_root_host(api, super_admin):
    api.force_authenticate(user=super_admin)
    resp = api.get("/api/v1/auth/me/", HTTP_HOST="poultryhero.solutions")
    assert resp.status_code == 200
    assert resp.json()["is_superuser"] is True


def test_me_rejects_super_admin_on_tenant_host(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    resp = api.get("/api/v1/auth/me/", HTTP_HOST="primefresh.poultryhero.solutions")
    assert resp.status_code == 403
    assert _code(resp) == "auth_host_mismatch"
