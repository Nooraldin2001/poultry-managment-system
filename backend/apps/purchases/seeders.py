"""Demo purchase seeding (LOCAL / STAGING ONLY).

Idempotent. Never imported by deploy scripts or migrations. Creates a single
draft demo purchase invoice using the company's existing purchasable products
and first supplier, so the purchases UI has something to show in development.
"""

from datetime import date
from decimal import Decimal

from apps.products.models import Product
from apps.suppliers.models import Supplier

from . import services
from .models import PurchaseInvoice, PurchaseLineType

DEMO_SUPPLIER_INVOICE_NO = "DEMO-PUR-0001"


def seed_purchase_demo(company, *, created_by=None) -> int:
    """Create one demo draft purchase invoice (idempotent). Returns count created."""
    if PurchaseInvoice.objects.filter(
        company=company, supplier_invoice_number=DEMO_SUPPLIER_INVOICE_NO
    ).exists():
        return 0

    supplier = Supplier.objects.filter(company=company, is_active=True).first()
    if supplier is None:
        return 0

    products = list(
        Product.objects.filter(
            company=company, is_active=True, can_purchase=True, track_inventory=True
        )[:2]
    )
    if not products:
        return 0

    lines = []
    for product in products:
        lines.append({
            "product": product,
            "line_type": PurchaseLineType.PRODUCT,
            "quantity_cartons": Decimal("10"),
            "quantity_kg": Decimal("100"),
            "unit_price": product.purchase_price or Decimal("12.00"),
            "price_type": product.purchase_price_type,
        })

    services.create_purchase_invoice(
        company=company,
        supplier=supplier,
        created_by=created_by,
        invoice_date=date.today(),
        lines=lines,
        supplier_invoice_number=DEMO_SUPPLIER_INVOICE_NO,
        notes="Demo purchase invoice (staging/local only).",
    )
    return 1
