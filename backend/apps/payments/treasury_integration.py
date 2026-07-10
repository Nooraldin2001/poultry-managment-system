"""Shared treasury account validation for purchases, sales, payments, and expenses."""

from decimal import Decimal

from rest_framework.exceptions import ValidationError

from apps.payments.models import MoneyAccount, MoneyAccountType

ZERO = Decimal("0")

CASH_PAYMENT_METHODS = frozenset({"cash"})
BANK_PAYMENT_METHODS = frozenset({"bank_transfer", "cheque"})


def get_money_account(company, account_id):
    if not account_id:
        return None
    try:
        return MoneyAccount.objects.get(pk=account_id, company=company)
    except MoneyAccount.DoesNotExist as exc:
        raise ValidationError({"money_account": "Money account not found for this company."}) from exc


def validate_money_account_for_flow(
    *,
    payment_method: str,
    money_account,
    amount: Decimal,
    require_when_paid: bool = True,
) -> None:
    """Validate account type matches payment method when amount > 0."""
    amount = Decimal(str(amount or 0))
    if amount <= 0:
        if money_account is not None:
            raise ValidationError({
                "money_account": (
                    "No treasury account is required when paid amount is zero. / "
                    "لا حاجة لحساب خزنة أو بنك عندما يكون المبلغ المدفوع صفراً"
                )
            })
        return

    if require_when_paid and money_account is None:
        raise ValidationError({
            "money_account": (
                "Select a cashbox/bank account for paid amounts. / "
                "اختر الخزنة أو الحساب البنكي للمبلغ المدفوع"
            )
        })

    if money_account is None:
        return

    if payment_method in CASH_PAYMENT_METHODS:
        if money_account.account_type != MoneyAccountType.CASHBOX:
            raise ValidationError({
                "money_account": (
                    "Cash payment requires a cashbox account / "
                    "الدفع كاش يتطلب اختيار خزنة"
                )
            })
    elif payment_method in BANK_PAYMENT_METHODS:
        if money_account.account_type != MoneyAccountType.BANK:
            raise ValidationError({
                "money_account": (
                    "Bank/Cheque payment requires a bank account / "
                    "الدفع البنكي يتطلب اختيار حساب بنكي"
                )
            })
