"""Super Admin module-level data reset tests."""

from datetime import date
from decimal import Decimal

import pytest
from django.core import signing

from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerType
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType, PurchaseStatus
from apps.sales import services as sales_services
from apps.sales.models import SalesInvoice, SalesLineType, SalesStatus
from apps.payments import services as payment_services
from apps.tenants.module_reset.service import ModuleResetService, required_confirmation_text

pytestmark = pytest.mark.django_db

CATALOG_URL = "/api/v1/admin/companies/{}/module-reset/catalog/"
DRY_RUN_URL = "/api/v1/admin/companies/{}/module-reset/dry-run/"
CONFIRM_URL = "/api/v1/admin/companies/{}/module-reset/confirm/"
HISTORY_URL = "/api/v1/admin/companies/{}/module-reset/history/"


def _customer(company):
    return Customer.objects.create(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )


def _product(company, sku="MR1"):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )


def _seed_stock(company, owner, product):
    from apps.inventory import services as inventory_services
    from apps.inventory.models import MovementType, StockSourceType
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal("100"),
        unit_cost_per_kg=Decimal("8"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _approved_sale(company, owner, customer, product):
    _seed_stock(company, owner, product)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    return inv


def test_super_admin_can_dry_run_sales(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    resp = api.post(
        DRY_RUN_URL.format(company.id),
        {"module": "sales"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["can_reset"] is True
    assert resp.data["affected_counts"]["sales_invoices"] >= 1
    assert "dry_run_token" in resp.data


def test_non_super_admin_cannot_dry_run(api, owner, company):
    api.force_authenticate(owner)
    resp = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    assert resp.status_code == 403


def test_super_admin_can_confirm_sales_reset(api, super_admin, company, owner, other_company):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    other_customer = Customer.objects.create(
        company=other_company, name_ar="other", phone="0500000099",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )
    other_product = _product(other_company, sku="OTH")
    _approved_sale(other_company, owner, other_customer, other_product)

    api.force_authenticate(super_admin)
    dry = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    token = dry.data["dry_run_token"]
    confirm_text = required_confirmation_text(company, "sales")
    resp = api.post(
        CONFIRM_URL.format(company.id),
        {
            "module": "sales",
            "confirmation_text": confirm_text,
            "reason": "Client requested sales data wipe",
            "dry_run_token": token,
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["success"] is True
    assert SalesInvoice.objects.filter(company=company).count() == 0
    assert SalesInvoice.objects.filter(company=other_company).count() == 1
    assert AuditLog.objects.filter(company=company, action="module_reset_confirm").exists()


def test_wrong_confirmation_text_blocks(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    dry = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    resp = api.post(
        CONFIRM_URL.format(company.id),
        {
            "module": "sales",
            "confirmation_text": "WRONG TEXT",
            "reason": "test",
            "dry_run_token": dry.data["dry_run_token"],
        },
        format="json",
    )
    assert resp.status_code == 400
    assert SalesInvoice.objects.filter(company=company).count() == 1


def test_missing_reason_blocks(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    dry = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    resp = api.post(
        CONFIRM_URL.format(company.id),
        {
            "module": "sales",
            "confirmation_text": required_confirmation_text(company, "sales"),
            "reason": "",
            "dry_run_token": dry.data["dry_run_token"],
        },
        format="json",
    )
    assert resp.status_code == 400


def test_purchases_reset_blocked_when_sales_exist(api, super_admin, company, owner):
    from apps.suppliers.models import Supplier, SupplierType
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    supplier = Supplier.objects.create(
        company=company, name_ar="مورد", phone="0500000002",
        supplier_type=SupplierType.CREDIT,
    )
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    api.force_authenticate(super_admin)
    resp = api.post(
        DRY_RUN_URL.format(company.id),
        {"module": "purchases"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["can_reset"] is False
    assert resp.data["blocking_dependencies"]
    assert "sales" in resp.data["required_reset_order"]
    assert resp.data["required_reset_order"][-1] == "purchases"


def test_sales_reset_blocked_when_payment_allocations_exist(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, owner, customer, product)
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=inv.total_amount,
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": inv.total_amount}],
    )
    api.force_authenticate(super_admin)
    resp = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    assert resp.status_code == 200
    assert resp.data["can_reset"] is False
    assert resp.data["required_reset_order"] == ["payments", "sales"]
    assert AuditLog.objects.filter(company=company, action="module_reset_blocked").exists()


def test_force_reset_flag_rejected(api, super_admin, company):
    api.force_authenticate(super_admin)
    resp = api.post(
        DRY_RUN_URL.format(company.id),
        {"module": "sales", "force": True},
        format="json",
    )
    assert resp.status_code == 400
    assert "Force reset is not allowed" in str(resp.data)


def test_confirm_revalidates_dependencies(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    dry = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    token = dry.data["dry_run_token"]
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=inv.total_amount,
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": inv.total_amount}],
    )
    resp = api.post(
        CONFIRM_URL.format(company.id),
        {
            "module": "sales",
            "confirmation_text": required_confirmation_text(company, "sales"),
            "reason": "test",
            "dry_run_token": token,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "blocked" in str(resp.data).lower() or "Reset is blocked" in str(resp.data)
    assert SalesInvoice.objects.filter(company=company).count() == 1
    assert AuditLog.objects.filter(company=company, action="module_reset_blocked").exists()


def test_reports_reset_dry_run_no_snapshots(api, super_admin, company):
    api.force_authenticate(super_admin)
    resp = api.post(
        DRY_RUN_URL.format(company.id),
        {"module": "reports"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["can_reset"] is True
    assert any(
        "no transaction data" in s.lower() or "calculated" in s.lower()
        for s in resp.data["side_effects"]
    )


def test_dry_run_does_not_delete(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    before = SalesInvoice.objects.filter(company=company).count()
    api.force_authenticate(super_admin)
    api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    assert SalesInvoice.objects.filter(company=company).count() == before


def test_catalog_endpoint(api, super_admin, company):
    api.force_authenticate(super_admin)
    resp = api.get(CATALOG_URL.format(company.id))
    assert resp.status_code == 200
    assert len(resp.data["modules"]) >= 10


def test_history_endpoint(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    resp = api.get(HISTORY_URL.format(company.id))
    assert resp.status_code == 200
    assert len(resp.data["history"]) >= 1


def test_expired_dry_run_token_rejected(api, super_admin, company, owner):
    customer = _customer(company)
    product = _product(company)
    _approved_sale(company, owner, customer, product)
    api.force_authenticate(super_admin)
    dry = api.post(DRY_RUN_URL.format(company.id), {"module": "sales"}, format="json")
    signer = signing.TimestampSigner(salt="module-reset-v1")
    bad_token = signer.sign("999:sales:deadbeef")
    resp = api.post(
        CONFIRM_URL.format(company.id),
        {
            "module": "sales",
            "confirmation_text": required_confirmation_text(company, "sales"),
            "reason": "test",
            "dry_run_token": bad_token,
        },
        format="json",
    )
    assert resp.status_code == 400
