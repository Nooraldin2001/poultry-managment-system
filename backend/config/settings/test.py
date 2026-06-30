"""Test settings — fast, isolated, in-memory SQLite."""

from .base import *  # noqa: F401,F403

DEBUG = False

# Deterministic, sufficiently long key so JWT tests don't warn.
SECRET_KEY = "test-secret-key-test-secret-key-test-secret-key-0123456789"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Faster password hashing for tests.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CORS_ALLOW_ALL_ORIGINS = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
