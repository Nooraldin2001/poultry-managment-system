"""Convenience: seed plans + permissions, and optionally a demo tenant.

Usage:
    python manage.py seed_initial
    python manage.py seed_initial --demo
    python manage.py seed_initial --superadmin admin@poultryhero.solutions --password StrongPass123
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed plans and permissions; optionally create a demo tenant / super admin."

    def add_arguments(self, parser):
        parser.add_argument("--demo", action="store_true", help="Create a demo tenant.")
        parser.add_argument("--superadmin", type=str, default=None)
        parser.add_argument("--password", type=str, default=None)

    def handle(self, *args, **options):
        call_command("seed_plans")
        call_command("seed_permissions")

        if options.get("superadmin") and options.get("password"):
            from apps.accounts.models import User

            email = options["superadmin"].lower()
            if not User.objects.filter(email=email).exists():
                User.objects.create_superuser(
                    email=email, password=options["password"], full_name="Super Admin"
                )
                self.stdout.write(self.style.SUCCESS(f"Super admin created: {email}"))
            else:
                self.stdout.write(f"Super admin already exists: {email}")

        if options.get("demo"):
            from apps.subscriptions.models import Plan, PlanCode
            from apps.tenants.models import Company
            from apps.tenants.services import create_first_admin_user, provision_company

            if not Company.objects.filter(subdomain="primefresh").exists():
                plan = Plan.objects.get(code=PlanCode.PRO)
                company = provision_company(
                    name_ar="برايم فريش",
                    name_en="Prime Fresh Poultry",
                    subdomain="primefresh",
                    plan=plan,
                    emirate="Dubai",
                )
                create_first_admin_user(
                    company=company,
                    email="owner@primefresh.test",
                    password="OwnerPass123",
                    full_name="Prime Fresh Owner",
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        "Demo tenant 'primefresh' created "
                        "(owner@primefresh.test / OwnerPass123)."
                    )
                )
            else:
                self.stdout.write("Demo tenant 'primefresh' already exists.")

        self.stdout.write(self.style.SUCCESS("seed_initial complete."))
