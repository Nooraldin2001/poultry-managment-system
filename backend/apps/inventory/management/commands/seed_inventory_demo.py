from django.core.management.base import BaseCommand, CommandError

from apps.core.management.demo_guard import (
    add_confirm_demo_argument,
    require_demo_confirmation,
)
from apps.inventory.seeders import seed_inventory_demo
from apps.tenants.models import Company


class Command(BaseCommand):
    help = (
        "Seed demo opening stock for a company's sample products (idempotent). "
        "Local/staging only — requires --confirm-demo-data."
    )

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        add_confirm_demo_argument(parser)

    def handle(self, *args, **options):
        require_demo_confirmation(self, options, what="demo opening stock")
        subdomain = options["company_subdomain"]
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")
        count = seed_inventory_demo(company)
        self.stdout.write(self.style.SUCCESS(
            f"Inventory demo seeded: opening stock for {count} product(s)."
        ))
