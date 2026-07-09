"""Ensure slaughterhouse/transport supplier categories exist for a tenant."""

from django.core.management.base import BaseCommand, CommandError

from apps.suppliers.constants import CATEGORY_SLAUGHTERHOUSE, CATEGORY_TRANSPORT
from apps.suppliers.models import SupplierCategory
from apps.tenants.models import Company

SERVICE_CATEGORIES = (
    (CATEGORY_SLAUGHTERHOUSE, "مسلخ", "Slaughterhouse"),
    (CATEGORY_TRANSPORT, "نقل / سائق", "Transport / Driver"),
)


class Command(BaseCommand):
    help = "Ensure service supplier categories (slaughterhouse, transport) exist for a company."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview categories that would be created without writing.",
        )

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"].strip().lower()
        dry_run = options["dry_run"]

        company = Company.objects.filter(subdomain=subdomain).first()
        if not company:
            raise CommandError(f"Company not found for subdomain: {subdomain}")

        created = []
        existing = []
        for code, name_ar, name_en in SERVICE_CATEGORIES:
            row = SupplierCategory.objects.filter(company=company, code=code).first()
            if row:
                existing.append(code)
                continue
            if dry_run:
                created.append(code)
                continue
            SupplierCategory.objects.create(
                company=company,
                code=code,
                name_ar=name_ar,
                name_en=name_en,
                is_active=True,
            )
            created.append(code)

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] {company.name_en} ({subdomain}): "
                    f"would create {created or 'none'}; existing {existing or 'none'}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"{company.name_en} ({subdomain}): created {created or 'none'}; "
                    f"existing {existing or 'none'}"
                )
            )
