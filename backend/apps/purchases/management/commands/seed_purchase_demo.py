from django.core.management.base import BaseCommand, CommandError

from apps.core.management.demo_guard import (
    add_confirm_demo_argument,
    require_demo_confirmation,
)
from apps.purchases.seeders import seed_purchase_demo
from apps.tenants.models import Company


class Command(BaseCommand):
    help = (
        "Seed a demo purchase invoice for a company (idempotent). "
        "Local/staging only — requires --confirm-demo-data."
    )

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        add_confirm_demo_argument(parser)

    def handle(self, *args, **options):
        require_demo_confirmation(self, options, what="demo purchases")
        subdomain = options["company_subdomain"]
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")
        count = seed_purchase_demo(company)
        self.stdout.write(self.style.SUCCESS(
            f"Purchase demo seeded: {count} draft invoice(s) created."
        ))
