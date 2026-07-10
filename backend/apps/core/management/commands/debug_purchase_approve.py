"""Attempt purchase invoice approval for one tenant (production diagnostics)."""

from __future__ import annotations

import traceback

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseInvoice, PurchaseStatus
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Inspect and optionally approve a draft purchase invoice by invoice number."

    def add_arguments(self, parser):
        parser.add_argument("subdomain", help="Tenant subdomain, e.g. firstview")
        parser.add_argument("invoice_number", help="Internal invoice number, e.g. PINV-00019")
        parser.add_argument(
            "--attempt",
            action="store_true",
            help="Call approve_purchase_invoice (dry-run inspection only by default).",
        )
        parser.add_argument(
            "--reason",
            default="Diagnostic approve attempt",
            help="Approval reason when --attempt is used.",
        )

    def handle(self, *args, **options):
        subdomain = options["subdomain"].strip().lower()
        invoice_number = options["invoice_number"].strip()
        attempt = options["attempt"]
        reason = options["reason"]

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist as exc:
            raise CommandError(f"Company not found for subdomain '{subdomain}'") from exc

        invoice = (
            PurchaseInvoice.objects.filter(company=company, invoice_number=invoice_number)
            .select_related("supplier", "money_account")
            .prefetch_related("lines__product")
            .first()
        )
        if invoice is None:
            raise CommandError(f"Invoice {invoice_number} not found for {subdomain}")

        self.stdout.write(f"Company: {company.id} {company.name}")
        self.stdout.write(
            f"Invoice: {invoice.id} {invoice.invoice_number} status={invoice.status} "
            f"date={invoice.invoice_date} vat_rate={invoice.vat_rate} "
            f"payment_method={invoice.payment_method} paid={invoice.amount_paid} "
            f"total={invoice.total_amount} backdate_reason={invoice.backdate_reason!r}"
        )
        for line in invoice.lines.all():
            product = line.product
            self.stdout.write(
                f"  LINE {line.id} product={line.product_name_snapshot} "
                f"type={getattr(product, 'product_type', None)} "
                f"track_inventory={getattr(product, 'track_inventory', None)} "
                f"cartons={line.quantity_cartons} pieces={line.quantity_pieces} "
                f"kg={line.quantity_kg} price_type={line.price_type} unit_price={line.unit_price}"
            )

        if not attempt:
            self.stdout.write(self.style.WARNING("Dry run only. Re-run with --attempt to approve."))
            return

        if invoice.status != PurchaseStatus.DRAFT:
            raise CommandError(f"Invoice is not draft (status={invoice.status}).")

        User = get_user_model()
        user = (
            User.objects.filter(company=company, is_active=True, role__in=("owner", "admin"))
            .order_by("id")
            .first()
        )
        if user is None:
            raise CommandError("No active owner/admin user found for tenant.")

        self.stdout.write(f"Approving as user {user.id} {user.email} ...")
        try:
            approved = purchase_services.approve_purchase_invoice(
                invoice=invoice,
                user=user,
                reason=reason,
                backdate_reason=invoice.backdate_reason or "",
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"FAILED: {type(exc).__name__}: {exc}"))
            self.stdout.write(traceback.format_exc())
            raise CommandError("Approve failed — see traceback above.") from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Approved invoice {approved.invoice_number} status={approved.status} "
                f"total={approved.total_amount}"
            )
        )
