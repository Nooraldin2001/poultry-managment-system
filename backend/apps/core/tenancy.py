"""Host/subdomain helpers for multi-tenant routing."""

from django.conf import settings
from rest_framework.exceptions import APIException


RESERVED_SUBDOMAINS = {
    "www",
    "admin",
    "api",
    "static",
    "media",
    "demo",
}


class AuthHostMismatch(APIException):
    status_code = 403
    default_code = "auth_host_mismatch"
    default_detail = "This session is not valid for the current domain."

    def __init__(self, detail=None):
        super().__init__(
            {
                "detail": detail or self.default_detail,
                "code": self.default_code,
            }
        )


def parse_subdomain(host: str):
    """Return the left-most label of ``host`` relative to ``BASE_DOMAIN``.

    Examples (BASE_DOMAIN=poultryhero.solutions):
        admin.poultryhero.solutions      -> "admin"
        primefresh.poultryhero.solutions -> "primefresh"
        primefresh.localhost             -> "primefresh"
        localhost / 127.0.0.1            -> None
    """
    if not host:
        return None
    host = host.split(":")[0].strip().lower()
    base = getattr(settings, "BASE_DOMAIN", "").lower()

    if base and host.endswith("." + base):
        label = host[: -(len(base) + 1)]
        return label.split(".")[-1] or None

    if host.endswith(".localhost"):
        return host[: -len(".localhost")].split(".")[-1] or None

    return None


def is_superadmin_host(host: str) -> bool:
    return parse_subdomain(host) == getattr(settings, "SUPERADMIN_SUBDOMAIN", "admin")


def is_root_host(host: str) -> bool:
    """True for apex / www hosts (not a tenant workspace)."""
    host = (host or "").split(":")[0].strip().lower()
    base = getattr(settings, "BASE_DOMAIN", "").lower()
    if not base:
        return False
    return host in (base, f"www.{base}")


def is_tenant_host(host: str) -> bool:
    """True when host is a company workspace subdomain."""
    subdomain = parse_subdomain(host)
    if not subdomain:
        return False
    reserved = RESERVED_SUBDOMAINS | {getattr(settings, "SUPERADMIN_SUBDOMAIN", "admin")}
    return subdomain not in reserved


def resolve_company_for_subdomain(subdomain: str):
    """Look up a Company by subdomain. Returns None if not found/reserved."""
    if not subdomain:
        return None
    if subdomain in (RESERVED_SUBDOMAINS | {getattr(settings, "SUPERADMIN_SUBDOMAIN", "admin")}):
        return None
    from apps.tenants.models import Company

    return Company.objects.filter(subdomain=subdomain).first()


def host_context_from_request(request) -> dict:
    """Structured host metadata attached to login / tenant enforcement."""
    host = request.get_host().split(":")[0].lower() if request else ""
    subdomain = parse_subdomain(host)
    return {
        "host": host,
        "subdomain": subdomain,
        "is_superadmin_host": is_superadmin_host(host),
        "is_root_host": is_root_host(host),
        "is_tenant_host": is_tenant_host(host),
        "tenant_company": resolve_company_for_subdomain(subdomain) if is_tenant_host(host) else None,
    }


def _is_local_or_test_host(host: str) -> bool:
    host = (host or "").split(":")[0].strip().lower()
    return host in {"", "localhost", "127.0.0.1", "testserver"} or host.endswith(".localhost")


def is_auth_host_compatible(request, user) -> bool:
    """Return whether an authenticated user may operate on the current host."""
    if not (user and getattr(user, "is_authenticated", False)):
        return False

    ctx = host_context_from_request(request)
    host = ctx["host"]
    if _is_local_or_test_host(host):
        return True

    if user.is_superuser:
        return bool(ctx["is_root_host"] or ctx["is_superadmin_host"])

    if user.company_id is None:
        return False

    if not ctx["is_tenant_host"]:
        return False

    tenant = ctx["tenant_company"]
    return bool(tenant and tenant.id == user.company_id)


def assert_auth_host_compatible(request, user):
    if is_auth_host_compatible(request, user):
        return
    raise AuthHostMismatch()


class TenantResolutionMiddleware:
    """Annotates the request with tenant context from the Host header."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ctx = host_context_from_request(request)
        request.subdomain = ctx["subdomain"]
        request.is_superadmin_host = ctx["is_superadmin_host"]
        request.is_root_host = ctx["is_root_host"]
        request.is_tenant_host = ctx["is_tenant_host"]
        request.tenant = ctx["tenant_company"]
        return self.get_response(request)
