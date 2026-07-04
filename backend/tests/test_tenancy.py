import pytest

from apps.core.tenancy import (
    host_context_from_request,
    is_root_host,
    is_superadmin_host,
    is_tenant_host,
    parse_subdomain,
    resolve_company_for_subdomain,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def host_request(rf, settings):
    settings.BASE_DOMAIN = "poultryhero.solutions"
    settings.ALLOWED_HOSTS = [".poultryhero.solutions", "testserver"]

    def _make(host: str):
        return rf.get("/", HTTP_HOST=host)

    return _make


class TestParseSubdomain:
    @pytest.mark.parametrize(
        "host,expected",
        [
            ("admin.poultryhero.solutions", "admin"),
            ("firstview.poultryhero.solutions", "firstview"),
            ("www.poultryhero.solutions", "www"),
            ("poultryhero.solutions", None),
            ("primefresh.localhost", "primefresh"),
        ],
    )
    def test_parse(self, settings, host, expected):
        settings.BASE_DOMAIN = "poultryhero.solutions"
        assert parse_subdomain(host) == expected

    def test_admin_is_superadmin_host(self, settings):
        settings.BASE_DOMAIN = "poultryhero.solutions"
        assert is_superadmin_host("admin.poultryhero.solutions") is True
        assert is_superadmin_host("firstview.poultryhero.solutions") is False

    def test_root_host(self, settings):
        settings.BASE_DOMAIN = "poultryhero.solutions"
        assert is_root_host("poultryhero.solutions") is True
        assert is_root_host("www.poultryhero.solutions") is True
        assert is_root_host("firstview.poultryhero.solutions") is False

    def test_tenant_host(self, settings):
        settings.BASE_DOMAIN = "poultryhero.solutions"
        assert is_tenant_host("firstview.poultryhero.solutions") is True
        assert is_tenant_host("admin.poultryhero.solutions") is False
        assert is_tenant_host("www.poultryhero.solutions") is False


def test_resolve_company_for_subdomain(company, settings):
    settings.BASE_DOMAIN = "poultryhero.solutions"
    assert resolve_company_for_subdomain("primefresh").id == company.id
    assert resolve_company_for_subdomain("admin") is None
    assert resolve_company_for_subdomain("missing-co") is None


def test_host_context_from_request(host_request, company, settings):
    settings.BASE_DOMAIN = "poultryhero.solutions"
    ctx = host_context_from_request(host_request("firstview.poultryhero.solutions"))
    assert ctx["is_tenant_host"] is True
    assert ctx["is_superadmin_host"] is False

    admin_ctx = host_context_from_request(host_request("admin.poultryhero.solutions"))
    assert admin_ctx["is_superadmin_host"] is True
    assert admin_ctx["is_tenant_host"] is False
    assert admin_ctx["tenant_company"] is None
