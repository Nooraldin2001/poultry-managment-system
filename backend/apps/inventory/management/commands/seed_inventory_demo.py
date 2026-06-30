from django.core.management.base import BaseCommand, CommandError

from apps.inventory.seeders import seed_inventory_demo
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Seed demo opening stock for a company's sample products (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"]
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")
        count = seed_inventory_demo(company)
        self.stdout.write(self.style.SUCCESS(
            f"Inventory demo seeded: opening stock for {count} product(s)."
        ))
