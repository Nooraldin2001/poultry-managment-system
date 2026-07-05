"""Backfill missing inventory side effects for approved purchase invoices.

Usage:
    python manage.py repair_purchase_inventory_side_effects --company-subdomain firstview --dry-run
    python manage.py repair_purchase_inventory_side_effects --company-subdomain firstview --confirm-repair
"""

import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.purchases import services
from apps.tenants.models import Company

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Detect and repair approved purchase invoices that are missing inventory "
        "stock movements / FIFO layers. Dry-run by default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--company-subdomain",
            required=True,
            help="Tenant subdomain (e.g. firstview)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Report affected invoices without modifying data (default unless --confirm-repair)",
        )
        parser.add_argument(
            "--confirm-repair",
            action="store_true",
            help="Apply repairs transactionally",
        )
        parser.add_argument(
            "--user-email",
            default="",
            help="Optional user email for audit log (defaults to first active owner/admin)",
        )

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"].strip().lower()
        confirm = options["confirm_repair"]
        dry_run = not confirm

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist as exc:
            raise CommandError(f"Company not found for subdomain: {subdomain}") from exc

        user = self._resolve_user(company, options.get("user_email"))
        missing = services.find_purchases_missing_inventory(company)

        self.stdout.write(
            self.style.NOTICE(
                f"Company {company.id} ({company.subdomain}) — "
                f"{len(missing)} approved purchase(s) need inventory repair"
            )
        )

        if not missing:
            self.stdout.write(self.style.SUCCESS("Nothing to repair."))
            return

        for inv in missing:
            self.stdout.write(
                f"  - {inv.invoice_number} (id={inv.id}, status={inv.status}, "
                f"total={inv.total_amount})"
            )
            for line in inv.lines.select_related("product").all():
                if not line.is_stock_tracked:
                    continue
                self.stdout.write(
                    f"      line {line.id}: {line.product_name_snapshot} "
                    f"ct={line.quantity_cartons} pcs={line.quantity_pieces} "
                    f"kg={line.quantity_kg}"
                )

        report = services.repair_purchase_inventory_side_effects(
            company=company,
            user=user,
            dry_run=dry_run,
            invoices=missing,
        )

        self.stdout.write(json.dumps(report, indent=2, default=str))

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Dry-run only — re-run with --confirm-repair to apply fixes."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Repaired {report['repaired_count']} purchase invoice(s)."
                )
            )

    def _resolve_user(self, company, email: str):
        if email:
            try:
                return User.objects.get(email=email, company=company)
            except User.DoesNotExist as exc:
                raise CommandError(f"User not found: {email}") from exc
        user = (
            User.objects.filter(company=company, is_active=True)
            .order_by("-is_company_admin", "-is_staff", "id")
            .first()
        )
        if user is None:
            raise CommandError(
                f"No active user found for company {company.subdomain}. "
                "Pass --user-email."
            )
        return user
