"""Seed the SaaS plan catalog (Basic / Pro / Enterprise).

Idempotent: re-running updates the existing plans to these defaults. Values are
intentionally easy to edit here (see docs/backend/OPEN_QUESTIONS.md #1).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.subscriptions.models import Plan, PlanCode

# Core business modules available to every paid tenant.
CORE_MODULES = [
    "dashboard", "sales", "quotations", "purchases", "inventory",
    "products", "customers", "suppliers", "payments", "expenses",
    "reports", "tax", "settings", "users", "audit",
]
PREMIUM_MODULES = ["premium_communications"]
# Placeholder for future Enterprise-only modules.
ENTERPRISE_FUTURE_MODULES = ["multi_branch_placeholder", "api_access_placeholder"]

PLAN_DEFS = [
    {
        "code": PlanCode.BASIC,
        "name": "Basic",
        "monthly_price": Decimal("199.00"),
        "yearly_price": Decimal("1990.00"),
        "user_limit": 3,
        "enabled_modules": CORE_MODULES,
        "premium_whatsapp_enabled": False,
        "advanced_reports_enabled": False,
    },
    {
        "code": PlanCode.PRO,
        "name": "Pro",
        "monthly_price": Decimal("399.00"),
        "yearly_price": Decimal("3990.00"),
        "user_limit": 10,
        "enabled_modules": CORE_MODULES + PREMIUM_MODULES,
        "premium_whatsapp_enabled": True,
        "advanced_reports_enabled": True,
    },
    {
        "code": PlanCode.ENTERPRISE,
        "name": "Enterprise",
        "monthly_price": Decimal("799.00"),
        "yearly_price": Decimal("7990.00"),
        "user_limit": 50,
        "enabled_modules": CORE_MODULES + PREMIUM_MODULES + ENTERPRISE_FUTURE_MODULES,
        "premium_whatsapp_enabled": True,
        "advanced_reports_enabled": True,
    },
]


class Command(BaseCommand):
    help = "Seed/refresh the SaaS plan catalog."

    def handle(self, *args, **options):
        created, updated = 0, 0
        for defn in PLAN_DEFS:
            obj, was_created = Plan.objects.update_or_create(
                code=defn["code"],
                defaults={**defn, "is_active": True},
            )
            created += int(was_created)
            updated += int(not was_created)
        self.stdout.write(
            self.style.SUCCESS(f"Plans seeded: {created} created, {updated} updated.")
        )
