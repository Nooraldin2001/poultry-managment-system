"""Shared invoice line pricing helpers (no DB access)."""

from apps.core.enums import PriceType


def normalize_price_type(value, *, default=PriceType.KG) -> str:
    """Return a valid PriceType value or raise ValueError.

    Empty/None values fall back to ``default`` so callers can supply a
    product-specific default (purchase_price_type / sales_price_type).
    """
    if value is None or (isinstance(value, str) and not str(value).strip()):
        return default
    normalized = str(value).strip().lower()
    if normalized in PriceType.values:
        return normalized
    allowed = ", ".join(PriceType.values)
    raise ValueError(
        f"Invalid price_type '{value}'. Allowed values: {allowed}."
    )
