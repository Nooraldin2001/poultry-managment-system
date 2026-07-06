import os

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

# Lowercase English letters/digits/hyphen; must start+end alphanumeric; no spaces
# or special characters. 2..63 chars (DNS label limit).
subdomain_validator = RegexValidator(
    regex=r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
    message=(
        "Subdomain must be lowercase letters, numbers, or hyphens only "
        "(no spaces or special characters), and start/end with a letter or number."
    ),
)

RESERVED_SUBDOMAINS = {
    "admin",
    "www",
    "api",
    "app",
    "mail",
    "static",
    "media",
    "demo",
    "root",
    "poultryhero",
}


def validate_subdomain_available(value: str, *, exclude_company_id=None) -> str:
    """Normalize and ensure subdomain is syntactically valid, not reserved, and unique."""
    value = (value or "").strip().lower()
    subdomain_validator(value)
    if value in RESERVED_SUBDOMAINS:
        raise ValidationError("This subdomain is reserved.")
    from .models import Company

    qs = Company.objects.filter(subdomain=value)
    if exclude_company_id is not None:
        qs = qs.exclude(pk=exclude_company_id)
    if qs.exists():
        raise ValidationError("This subdomain is already taken.")
    return value

# --- Company identity asset (logo / stamp / signature) validation -----------

ALLOWED_COMPANY_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]
MAX_COMPANY_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB


def validate_company_image_size(file):
    if file.size > MAX_COMPANY_IMAGE_BYTES:
        raise ValidationError("Image file must be 2 MB or smaller.")


def validate_company_image_extension(file):
    ext = os.path.splitext(file.name)[1].lstrip(".").lower()
    if ext not in ALLOWED_COMPANY_IMAGE_EXTENSIONS:
        raise ValidationError(
            "Only PNG, JPG, JPEG or WEBP images are allowed."
        )


def validate_trn_value(value: str) -> str:
    """Digits-only TRN. Length is not hard-blocked (existing data varies)."""
    value = (value or "").strip()
    if value and not value.isdigit():
        raise ValidationError("TRN must contain digits only.")
    return value
