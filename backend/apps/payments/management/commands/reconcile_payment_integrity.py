"""Dry-run payment integrity reconciliation for a tenant."""

from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Sum

from apps.customers.models import Customer, CustomerLedgerEntry
from apps.payments.models import (
    AllocationType,
    MoneyAccount,
    MoneyDirection,
    MoneyMovement,
    MoneyMovementType,
    PaymentAllocation,
    PaymentMovementStatus,
)
from apps.purchases.models import PurchaseInvoice
from apps.sales.models import SalesInvoice
from apps.suppliers.models import Supplier, SupplierLedgerEntry
from apps.tenants.models import Company

ZERO = Decimal("0")


def _d(value) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value or 0))


class Command(BaseCommand):
    help = "Report payment, ledger, invoice, and treasury integrity issues for a tenant."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument("--dry-run", action="store_true", default=True)
        parser.add_argument("--apply", action="store_true", help="Reserved for future repair mode.")

    def handle(self, *args, **options):
        if options["apply"]:
            raise CommandError("Repair mode is not implemented. Run with --dry-run only.")

        subdomain = (options["company_subdomain"] or "").strip().lower()
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist as exc:
            raise CommandError(f"No company with subdomain '{subdomain}'.") from exc

        issues: list[str] = []
        self.stdout.write(
            f"Payment integrity dry-run for {company.name_en} ({company.subdomain})"
        )

        self._check_sales_allocations(company, issues)
        self._check_purchase_allocations(company, issues)
        self._check_customer_ledgers(company, issues)
        self._check_supplier_ledgers(company, issues)
        self._check_money_accounts(company, issues)
        self._check_orphan_and_duplicate_allocations(company, issues)

        if not issues:
            self.stdout.write(self.style.SUCCESS("No payment integrity issues found."))
            return

        self.stdout.write(self.style.WARNING(f"{len(issues)} issue(s) found:"))
        for issue in issues:
            self.stdout.write(f"- {issue}")

    def _check_sales_allocations(self, company, issues):
        for invoice in SalesInvoice.objects.filter(company=company):
            allocated = (
                PaymentAllocation.objects.filter(
                    company=company,
                    sales_invoice=invoice,
                    movement__status=PaymentMovementStatus.POSTED,
                ).aggregate(total=Sum("allocated_amount"))["total"]
                or ZERO
            )
            if _d(invoice.amount_paid) != allocated:
                issues.append(
                    f"Sales invoice {invoice.id}: amount_paid={invoice.amount_paid} "
                    f"posted_allocations={allocated}"
                )
            expected_balance = _d(invoice.total_amount) - _d(invoice.amount_paid)
            if _d(invoice.balance_due) != expected_balance:
                issues.append(
                    f"Sales invoice {invoice.id}: balance_due={invoice.balance_due} "
                    f"expected={expected_balance}"
                )

    def _check_purchase_allocations(self, company, issues):
        for invoice in PurchaseInvoice.objects.filter(company=company):
            allocated = (
                PaymentAllocation.objects.filter(
                    company=company,
                    purchase_invoice=invoice,
                    movement__status=PaymentMovementStatus.POSTED,
                ).aggregate(total=Sum("allocated_amount"))["total"]
                or ZERO
            )
            if _d(invoice.amount_paid) != allocated:
                issues.append(
                    f"Purchase invoice {invoice.id}: amount_paid={invoice.amount_paid} "
                    f"posted_allocations={allocated}"
                )
            expected_balance = _d(invoice.total_amount) - _d(invoice.amount_paid)
            if _d(invoice.balance_due) != expected_balance:
                issues.append(
                    f"Purchase invoice {invoice.id}: balance_due={invoice.balance_due} "
                    f"expected={expected_balance}"
                )

    def _check_customer_ledgers(self, company, issues):
        for customer in Customer.objects.filter(company=company):
            totals = CustomerLedgerEntry.objects.filter(
                company=company, customer=customer,
            ).aggregate(debit=Sum("debit"), credit=Sum("credit"))
            expected = (totals["debit"] or ZERO) - (totals["credit"] or ZERO)
            if _d(customer.current_balance) != expected:
                issues.append(
                    f"Customer {customer.id}: current_balance={customer.current_balance} "
                    f"ledger_expected={expected}"
                )

    def _check_supplier_ledgers(self, company, issues):
        for supplier in Supplier.objects.filter(company=company):
            totals = SupplierLedgerEntry.objects.filter(
                company=company, supplier=supplier,
            ).aggregate(debit=Sum("debit"), credit=Sum("credit"))
            expected = (totals["credit"] or ZERO) - (totals["debit"] or ZERO)
            if _d(supplier.current_balance) != expected:
                issues.append(
                    f"Supplier {supplier.id}: current_balance={supplier.current_balance} "
                    f"ledger_expected={expected}"
                )

    def _check_money_accounts(self, company, issues):
        for account in MoneyAccount.objects.filter(company=company):
            movements = MoneyMovement.objects.filter(company=company, money_account=account)
            has_opening_movement = movements.filter(
                movement_type=MoneyMovementType.OPENING_BALANCE,
            ).exists()
            expected = ZERO if has_opening_movement else _d(account.opening_balance)
            for movement in movements:
                delta = _d(movement.amount)
                expected += delta if movement.direction == MoneyDirection.IN else -delta
            if _d(account.current_balance) != expected:
                issues.append(
                    f"Money account {account.id}: current_balance={account.current_balance} "
                    f"treasury_expected={expected}"
                )

    def _check_orphan_and_duplicate_allocations(self, company, issues):
        orphan_count = PaymentAllocation.objects.filter(
            company=company,
            allocation_type__in=[
                AllocationType.SALES_INVOICE,
                AllocationType.PURCHASE_INVOICE,
            ],
            sales_invoice__isnull=True,
            purchase_invoice__isnull=True,
        ).count()
        if orphan_count:
            issues.append(f"Orphan invoice allocations: {orphan_count}")

        duplicate_rows = (
            PaymentAllocation.objects.filter(company=company)
            .values("movement_id", "sales_invoice_id", "purchase_invoice_id")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
        )
        for row in duplicate_rows:
            issues.append(
                f"Duplicate allocations: movement={row['movement_id']} "
                f"sales_invoice={row['sales_invoice_id']} "
                f"purchase_invoice={row['purchase_invoice_id']} count={row['count']}"
            )
