"""Backfill missing internal invoice numbers for sales/purchase drafts.

Dry-run by default. Requires --company-subdomain and --confirm to write.

Usage:
    python manage.py backfill_invoice_numbers --company-subdomain firstview --dry-run
    python manage.py backfill_invoice_numbers --company-subdomain firstview --confirm
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from apps.company_settings.constants import DocumentType
from apps.company_settings.services import generate_document_number
from apps.purchases.models import PurchaseInvoice
from apps.sales.models import SalesInvoice
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Backfill missing sales/purchase invoice_number values for one tenant."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--confirm", action="store_true")

    def handle(self, *args, **options):
        subdomain = (options["company_subdomain"] or "").strip().lower()
        dry_run = options["dry_run"] or not options["confirm"]

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")

        missing_sales = SalesInvoice.objects.filter(
            company=company,
        ).filter(Q(invoice_number="") | Q(invoice_number__isnull=True))
        missing_purchases = PurchaseInvoice.objects.filter(
            company=company,
        ).filter(Q(invoice_number="") | Q(invoice_number__isnull=True))

        self.stdout.write(
            f"Tenant: {company.name_en} ({company.subdomain}) [id={company.pk}]"
        )
        self.stdout.write(f"  Missing sales invoice numbers: {missing_sales.count()}")
        self.stdout.write(f"  Missing purchase invoice numbers: {missing_purchases.count()}")

        for inv in missing_sales[:20]:
            self.stdout.write(f"  SALES id={inv.pk} status={inv.status}")
        for inv in missing_purchases[:20]:
            self.stdout.write(f"  PURCHASE id={inv.pk} status={inv.status}")

        total = missing_sales.count() + missing_purchases.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to backfill."))
            return

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f"Dry run: {total} record(s) would be updated.")
            )
            return

        updated = 0
        with transaction.atomic():
            for inv in missing_sales:
                inv.invoice_number = generate_document_number(
                    company, DocumentType.SALES_INVOICE
                )
                inv.save(update_fields=["invoice_number", "updated_at"])
                updated += 1
                self.stdout.write(f"Updated sales id={inv.pk} -> {inv.invoice_number}")
            for inv in missing_purchases:
                inv.invoice_number = generate_document_number(
                    company, DocumentType.PURCHASE_INVOICE
                )
                inv.save(update_fields=["invoice_number", "updated_at"])
                updated += 1
                self.stdout.write(f"Updated purchase id={inv.pk} -> {inv.invoice_number}")

        self.stdout.write(self.style.SUCCESS(f"Backfilled {updated} invoice number(s)."))
