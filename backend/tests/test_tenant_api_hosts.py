import pytest

pytestmark = pytest.mark.django_db


def test_health_on_tenant_subdomain_host(api):
    resp = api.get(
        "/api/v1/health/",
        HTTP_HOST="firstview.poultryhero.solutions",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["status"] == "ok"


def test_login_accepts_email_field(api, owner):
    resp = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@primefresh.test", "password": "OwnerPass123"},
        format="json",
        HTTP_HOST="primefresh.poultryhero.solutions",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "owner@primefresh.test"
