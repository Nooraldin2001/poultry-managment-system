"""Tenant resolution utilities + middleware placeholder.

Phase 0/1: we resolve the active tenant primarily from the authenticated user's
company. Subdomain parsing is implemented as a utility and attached to the
request, but full production subdomain ROUTING/enforcement is intentionally
deferred (see docs/backend/OPEN_QUESTIONS.md). The middleware never blocks
requests yet; it only annotates ``request.tenant`` / ``request.subdomain``.
"""

from django.conf import settings


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
    host = host.split(":")[0].strip().lower()  # drop port
    base = getattr(settings, "BASE_DOMAIN", "").lower()

    if base and host.endswith("." + base):
        label = host[: -(len(base) + 1)]
        return label.split(".")[-1] or None

    # Local dev convenience: <sub>.localhost
    if host.endswith(".localhost"):
        return host[: -len(".localhost")].split(".")[-1] or None

    return None


def is_superadmin_host(host: str) -> bool:
    return parse_subdomain(host) == getattr(settings, "SUPERADMIN_SUBDOMAIN", "admin")


def resolve_company_for_subdomain(subdomain: str):
    """Look up a Company by subdomain. Returns None if not found/super-admin.

    Kept import-local to avoid app-loading issues at import time.
    """
    if not subdomain:
        return None
    if subdomain == getattr(settings, "SUPERADMIN_SUBDOMAIN", "admin"):
        return None
    from apps.tenants.models import Company

    return Company.objects.filter(subdomain=subdomain).first()


class TenantResolutionMiddleware:
    """Annotates the request with tenant context (non-blocking placeholder)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host() if hasattr(request, "get_host") else ""
        subdomain = parse_subdomain(host)
        request.subdomain = subdomain
        request.is_superadmin_host = subdomain == getattr(
            settings, "SUPERADMIN_SUBDOMAIN", "admin"
        )
        # Tenant from subdomain (may be None in local/dev where the auth user's
        # company is the source of truth instead).
        request.tenant = resolve_company_for_subdomain(subdomain)
        return self.get_response(request)
