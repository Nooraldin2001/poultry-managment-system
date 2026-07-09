"""Shared payment-method normalization across modules."""

from apps.core.enums import PaymentMethod

_SUPPLIER_ALIASES = {
    "bank_transfer": PaymentMethod.BANK,
    "deferred": PaymentMethod.CREDIT,
}


def normalize_supplier_default_payment_method(value: str | None) -> str:
    """Normalize supplier default_payment_method to canonical cash/bank/credit."""
    raw = (value or PaymentMethod.CASH).strip().lower()
    if raw in _SUPPLIER_ALIASES:
        return _SUPPLIER_ALIASES[raw]
    allowed = {
        PaymentMethod.CASH,
        PaymentMethod.BANK,
        PaymentMethod.CREDIT,
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.CHEQUE,
        PaymentMethod.OTHER,
    }
    if raw not in allowed:
        raise ValueError(f"Invalid payment method: {value}")
    if raw in (PaymentMethod.BANK_TRANSFER, PaymentMethod.CHEQUE):
        return PaymentMethod.BANK
    return raw


def supplier_default_to_purchase_payment_method(value: str | None) -> str:
    """Map supplier default payment method to purchase invoice payment_method."""
    normalized = normalize_supplier_default_payment_method(value)
    if normalized == PaymentMethod.BANK:
        return "bank_transfer"
    if normalized == PaymentMethod.CREDIT:
        return "credit"
    return "cash"
