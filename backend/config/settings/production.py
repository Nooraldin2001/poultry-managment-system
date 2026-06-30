"""Production settings (VPS / Hostinger)."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# DJANGO_ALLOWED_HOSTS must be set, e.g. ".poultryhero.solutions"
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

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
