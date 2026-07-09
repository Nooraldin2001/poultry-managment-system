"""Post-reset balance and inventory recalculation helpers."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from apps.customers.models import Customer
from apps.customers.services import get_customer_balance
from apps.inventory.models import FIFOStockLayer, InventoryBalance
from apps.payments.models import MoneyAccount, MoneyDirection, MoneyMovement
from apps.suppliers.models import Supplier
from apps.suppliers.services import get_supplier_balance

ZERO = Decimal("0")


def rebuild_customer_balances(company) -> int:
    """Sync Customer.current_balance from remaining ledger entries."""
    updated = 0
    for customer in Customer.objects.filter(company=company):
        balance = get_customer_balance(customer)
        if customer.current_balance != balance:
            customer.current_balance = balance
            customer.save(update_fields=["current_balance", "updated_at"])
            updated += 1
    return updated


def rebuild_supplier_balances(company) -> int:
    """Sync Supplier.current_balance from remaining ledger entries."""
    updated = 0
    for supplier in Supplier.objects.filter(company=company):
        balance = get_supplier_balance(supplier)
        if supplier.current_balance != balance:
            supplier.current_balance = balance
            supplier.save(update_fields=["current_balance", "updated_at"])
            updated += 1
    return updated


def rebuild_money_account_balances(company) -> int:
    """Recompute MoneyAccount.current_balance from movements."""
    updated = 0
    for account in MoneyAccount.objects.filter(company=company):
        balance = ZERO
        for movement in MoneyMovement.objects.filter(
            company=company, money_account=account
        ).order_by("movement_date", "id"):
            delta = movement.amount if movement.direction == MoneyDirection.IN else -movement.amount
            balance += delta
        if account.current_balance != balance:
            account.current_balance = balance
            account.save(update_fields=["current_balance", "updated_at"])
            updated += 1
    return updated


def rebuild_inventory_balances_from_layers(company) -> int:
    """Best-effort sync of InventoryBalance from non-depleted FIFO layer sums."""
    updated = 0
    for balance in InventoryBalance.objects.filter(company=company).select_related("product"):
        agg = FIFOStockLayer.objects.filter(
            company=company, product=balance.product, is_depleted=False,
        ).aggregate(
            cartons=Sum("remaining_cartons"),
            pieces=Sum("remaining_pieces"),
            kg=Sum("remaining_kg"),
        )
        cartons = agg["cartons"] or ZERO
        pieces = agg["pieces"] or ZERO
        kg = agg["kg"] or ZERO
        if (
            balance.available_cartons != cartons
            or balance.available_pieces != pieces
            or balance.available_kg != kg
        ):
            balance.available_cartons = cartons
            balance.available_pieces = pieces
            balance.available_kg = kg
            balance.save(update_fields=[
                "available_cartons", "available_pieces", "available_kg", "updated_at",
            ])
            updated += 1
    return updated
