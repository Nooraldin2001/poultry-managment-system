#!/usr/bin/env python
"""Read-only diagnosis: approved purchases vs inventory side effects for one tenant.

Run on VPS:
    cd /var/www/poultryhero/backend
    source /var/www/poultryhero/.venv/bin/activate
    export DJANGO_SETTINGS_MODULE=config.settings.production
    python scripts/diagnose_tenant_purchase_inventory.py firstview
"""
import os
import sys

import django

if len(sys.argv) < 2:
    print("Usage: python scripts/diagnose_tenant_purchase_inventory.py <subdomain>")
    sys.exit(1)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from apps.inventory.models import FIFOStockLayer, InventoryBalance, StockMovement
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseInvoice, PurchaseStatus
from apps.tenants.models import Company

subdomain = sys.argv[1].strip().lower()
company = Company.objects.get(subdomain=subdomain)
print("Company:", company.id, company.name, company.subdomain)

posted = (
    PurchaseStatus.APPROVED,
    PurchaseStatus.PARTIALLY_PAID,
    PurchaseStatus.PAID,
)
purchases = PurchaseInvoice.objects.filter(company=company, status__in=posted).order_by("-id")[:20]
print("\nRecent approved purchases:", purchases.count())
for p in purchases:
    print(
        f"\nPURCHASE {p.id} {p.invoice_number} status={p.status} "
        f"total={p.total_amount} vat={p.vat_amount}"
    )
    for line in p.lines.select_related("product").all():
        product = line.product
        print(
            f"  LINE {line.id} product={line.product_name_snapshot} "
            f"track_inventory={getattr(product, 'track_inventory', None)} "
            f"cartons={line.quantity_cartons} pieces={line.quantity_pieces} "
            f"kg={line.quantity_kg} unit_price={line.unit_price}"
        )
    needs = purchase_services.purchase_needs_inventory_repair(p)
    print(f"  needs_repair={needs}")

print("\nInventory balances:", InventoryBalance.objects.filter(company=company).count())
for b in InventoryBalance.objects.filter(company=company).select_related("product"):
    print(
        f"  BALANCE {b.id} {b.product.name_ar} "
        f"cartons={b.available_cartons} pieces={b.available_pieces} "
        f"kg={b.available_kg}"
    )

print("\nStock movements:", StockMovement.objects.filter(company=company).count())
for m in StockMovement.objects.filter(company=company).order_by("-id")[:20]:
    print(
        f"  MOVEMENT {m.id} {m.movement_type} {m.product.name_ar} "
        f"kg_delta={m.kg_delta} ct_delta={m.cartons_delta} "
        f"ref={m.reference_type}/{m.reference_id}"
    )

print("\nFIFO layers:", FIFOStockLayer.objects.filter(company=company).count())
for layer in FIFOStockLayer.objects.filter(company=company).order_by("-id")[:20]:
    print(
        f"  LAYER {layer.id} {layer.product.name_ar} "
        f"remaining_kg={layer.remaining_kg} unit_cost={layer.unit_cost_per_kg} "
        f"source={layer.source_type}/{layer.source_id}"
    )

missing = purchase_services.find_purchases_missing_inventory(company)
print(f"\nPurchases missing inventory repair: {len(missing)}")
for inv in missing:
    print(f"  - {inv.invoice_number} (id={inv.id})")
