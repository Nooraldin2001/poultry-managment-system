"""Seed the permission catalog + role defaults.

Idempotent. Materializes every code from ``apps.permissions.catalog`` into
``PermissionCode`` and seeds ``RolePermissionDefault`` for each tenant role.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.permissions.catalog import all_permission_codes, role_default_map
from apps.permissions.models import PermissionCode, RolePermissionDefault


class Command(BaseCommand):
    help = "Seed/refresh permission codes and role default matrix."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Permission codes
        code_objs = {}
        created = 0
        for code, group, action, is_sensitive in all_permission_codes():
            obj, was_created = PermissionCode.objects.update_or_create(
                code=code,
                defaults={
                    "group": group,
                    "action": action,
                    "label": f"{group}: {action}",
                    "is_sensitive": is_sensitive,
                    "is_active": True,
                },
            )
            code_objs[code] = obj
            created += int(was_created)

        # 2. Role defaults
        defaults_created = 0
        for role, code_map in role_default_map().items():
            for code, allowed in code_map.items():
                _, was_created = RolePermissionDefault.objects.update_or_create(
                    role=role,
                    permission=code_objs[code],
                    defaults={"allowed": allowed},
                )
                defaults_created += int(was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Permissions seeded: {len(code_objs)} codes "
                f"({created} new), {defaults_created} new role defaults."
            )
        )
