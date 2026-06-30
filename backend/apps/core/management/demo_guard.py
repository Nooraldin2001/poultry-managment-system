"""Shared safety guard for demo/sample data seed commands.

Demo seed commands create fake business data (customers, suppliers, products,
inventory, purchases). They must NEVER run automatically on production. This
guard prints a loud warning and refuses to proceed unless the operator passes
``--confirm-demo-data`` explicitly (staging/local use only).
"""

from django.core.management.base import CommandError

DEMO_WARNING = (
    "WARNING: This command creates DEMO/sample business data. "
    "Do NOT run it on a real production tenant."
)


def add_confirm_demo_argument(parser):
    parser.add_argument(
        "--confirm-demo-data",
        action="store_true",
        help=(
            "Required to actually create demo data. Without this flag the "
            "command refuses to run (safety guard for production)."
        ),
    )


def require_demo_confirmation(command, options, *, what="demo data"):
    """Print the warning and abort unless ``--confirm-demo-data`` was given."""
    command.stderr.write(command.style.WARNING(DEMO_WARNING))
    if not options.get("confirm_demo_data"):
        raise CommandError(
            f"Refusing to create {what} without --confirm-demo-data. This safety "
            "guard ensures production deployments never auto-seed demo data. "
            "Only pass --confirm-demo-data on local/staging tenants."
        )
