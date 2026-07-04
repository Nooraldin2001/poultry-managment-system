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

RESERVED_SUBDOMAINS = {"admin", "www", "api", "app", "mail", "static", "media", "demo"}
