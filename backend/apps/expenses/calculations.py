"""Expense amount calculations (Phase 8)."""

from decimal import Decimal

ZERO = Decimal("0")


def vat_amount(amount: Decimal, vat_rate: Decimal) -> Decimal:
    if not amount or not vat_rate:
        return ZERO
    return (amount * vat_rate / Decimal("100")).quantize(Decimal("0.01"))


def total_amount(amount: Decimal, vat_amount_val: Decimal) -> Decimal:
    return (amount + vat_amount_val).quantize(Decimal("0.01"))
