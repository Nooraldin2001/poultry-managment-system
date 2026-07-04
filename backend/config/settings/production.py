"""Production settings (VPS / Hostinger)."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# DJANGO_ALLOWED_HOSTS must be set, e.g. ".poultryhero.solutions"
ALLOWED_HOSTS = list(env("DJANGO_ALLOWED_HOSTS"))

# Always allow all tenant workspace subdomains ({sub}.BASE_DOMAIN).
# Without ".poultryhero.solutions", requests like firstview.poultryhero.solutions
# hit Django DisallowedHost and return HTML 400 (browser shows failed /api/ calls).
_base_domain = env("BASE_DOMAIN", default="poultryhero.solutions").strip().lower()
if _base_domain:
    _wildcard_host = f".{_base_domain}"
    if _wildcard_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_wildcard_host)

# Security hardening
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_TRUSTED_ORIGINS = env(
    "CSRF_TRUSTED_ORIGINS",
    default=["https://*.poultryhero.solutions"],
)

# WhiteNoise for static files behind Gunicorn/Nginx.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
