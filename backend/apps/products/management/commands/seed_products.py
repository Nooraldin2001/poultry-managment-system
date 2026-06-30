from apps.products.management.commands.seed_product_foundation import (
    Command as FoundationCommand,
)


class Command(FoundationCommand):
    """Alias of ``seed_product_foundation``."""

    help = "Alias for seed_product_foundation: seed product categories + samples."
