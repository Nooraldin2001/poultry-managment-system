"""Aggregate carton/kg totals for invoice print-preview payloads."""

from decimal import Decimal, ROUND_HALF_UP

ZERO = Decimal("0")


def _format_quantity(value: Decimal) -> str:
    """Human-readable quantity string (strip trailing zeros)."""
    normalized = value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    text = format(normalized, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def compute_print_line_totals(lines) -> dict:
    """Sum cartons and kg across invoice lines (backend source of truth)."""
    total_cartons = ZERO
    total_kg = ZERO
    for line in lines:
        total_cartons += Decimal(str(getattr(line, "quantity_cartons", 0) or 0))
        total_kg += Decimal(str(getattr(line, "quantity_kg", 0) or 0))
    return {
        "total_cartons": _format_quantity(total_cartons),
        "total_kg": _format_quantity(total_kg),
    }
