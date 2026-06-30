"""Local development settings."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Permissive CORS for local frontend (Vite dev server, subdomain.localhost, etc.)
CORS_ALLOW_ALL_ORIGINS = True

# Console email for password-reset flows added in later phases.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
