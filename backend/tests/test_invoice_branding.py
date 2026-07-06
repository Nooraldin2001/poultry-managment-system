"""Invoice branding and tax identity integration tests."""

import io
from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.customers.models import Customer
from apps.sales.models import SalesInvoice, SalesInvoiceLine, SalesStatus
from apps.sales.services import build_print_preview
from apps.purchases.services import build_purchase_print_preview

pytestmark = pytest.mark.django_db


def _png(name="logo.png"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (15, 44, 89)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


@pytest.fixture(autouse=True)
def _media_tmp(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path / "media")


def test_customer_create_accepts_trn(api, owner, company):
    api.force_authenticate(owner)
    res = api.post(
        "/api/v1/tenant/customers/",
        {
            "name_ar": "عميل ضريبي",
            "name_en": "Tax Customer",
            "customer_type": "credit",
            "phone": "0501234567",
            "trn": "100488358000003",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["trn"] == "100488358000003"


def test_customer_update_accepts_trn(api, owner, company):
    customer = Customer.objects.create(
        company=company, name_ar="عميل", customer_type="cash"
    )
    api.force_authenticate(owner)
    res = api.patch(
        f"/api/v1/tenant/customers/{customer.id}/",
        {"trn": "100000000000001"},
        format="json",
    )
    assert res.status_code == 200, res.data
    customer.refresh_from_db()
    assert customer.trn == "100000000000001"


def test_customer_trn_digits_only_rejected(api, owner):
    api.force_authenticate(owner)
    res = api.post(
        "/api/v1/tenant/customers/",
        {"name_ar": "x", "customer_type": "cash", "trn": "ABC-123"},
        format="json",
    )
    assert res.status_code == 400
    assert "trn" in res.data


def test_sales_invoice_stores_customer_trn_snapshot(api, owner, company, fixed_product):
    from apps.inventory.models import InventoryBalance

    customer = Customer.objects.create(
        company=company,
        name_ar="عميل TRN",
        customer_type="credit",
        trn="100488358000003",
        phone="0501234567",
        address="Dubai",
    )
    InventoryBalance.objects.create(
        company=company, product=fixed_product, available_kg=Decimal("100")
    )
    api.force_authenticate(owner)
    res = api.post(
        "/api/v1/tenant/sales/",
        {
            "customer": customer.id,
            "invoice_date": str(date.today()),
            "lines": [
                {
                    "product": fixed_product.id,
                    "quantity_kg": "5.000",
                    "unit_price": "10.00",
                }
            ],
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    inv = SalesInvoice.objects.get(pk=res.data["id"])
    assert inv.customer_trn_snapshot == "100488358000003"
    assert inv.customer_phone_snapshot == "0501234567"
    assert inv.customer_address_snapshot == "Dubai"


def test_sales_print_preview_includes_company_and_customer_trn(
    api, owner, company, fixed_product
):
    company.trn = "10498835800003"
    company.logo = _png()
    company.stamp = _png("stamp.png")
    company.signature = _png("sig.png")
    company.save()

    customer = Customer.objects.create(
        company=company, name_ar="عميل", customer_type="cash", trn="100488358000003"
    )
    invoice = SalesInvoice.objects.create(
        company=company,
        customer=customer,
        invoice_number="SAL-TEST-0001",
        invoice_date=date.today(),
        created_by=owner,
        customer_name_snapshot=customer.name_ar,
        customer_trn_snapshot=customer.trn,
        customer_phone_snapshot=customer.phone,
    )
    SalesInvoiceLine.objects.create(
        company=company,
        invoice=invoice,
        product=fixed_product,
        product_name_snapshot=fixed_product.name_ar,
        quantity_kg=Decimal("5.000"),
        unit_price=Decimal("10.00"),
        line_total=Decimal("50.00"),
    )

    api.force_authenticate(owner)
    res = api.get(f"/api/v1/tenant/sales/{invoice.id}/print-preview/")
    assert res.status_code == 200, res.data
    assert res.data["company"]["trn"] == "10498835800003"
    assert res.data["company"]["logo_url"]
    assert "/media/company_assets/" in res.data["company"]["logo_url"]
    assert res.data["customer"]["trn"] == "100488358000003"
    assert res.data["party"]["trn"] == "100488358000003"


def test_old_invoice_without_snapshot_falls_back_to_customer_trn(
    company, owner, fixed_product
):
    customer = Customer.objects.create(
        company=company, name_ar="قديم", customer_type="cash", trn="999999999999999"
    )
    invoice = SalesInvoice.objects.create(
        company=company,
        customer=customer,
        invoice_number="SAL-OLD-0001",
        invoice_date=date.today(),
        created_by=owner,
        status=SalesStatus.APPROVED,
        customer_name_snapshot="",
        customer_trn_snapshot="",
    )
    preview = build_print_preview(invoice)
    assert preview["customer"]["trn"] == "999999999999999"
    assert preview["customer"]["name"] == "قديم"


def test_missing_assets_do_not_crash_print_preview(company, owner, fixed_product):
    customer = Customer.objects.create(
        company=company, name_ar="عميل", customer_type="cash"
    )
    invoice = SalesInvoice.objects.create(
        company=company,
        customer=customer,
        invoice_number="SAL-NOIMG-0001",
        invoice_date=date.today(),
        created_by=owner,
        customer_name_snapshot=customer.name_ar,
    )
    preview = build_print_preview(invoice)
    assert preview["company"]["logo_url"] is None
    assert preview["company"]["stamp_url"] is None
    assert preview["company"]["signature_url"] is None


def test_purchase_print_preview_includes_company_identity(api, owner, company, fixed_product):
    from apps.purchases.models import PurchaseInvoice
    from apps.suppliers.models import Supplier

    company.trn = "10498835800003"
    company.logo = _png()
    company.save()

    supplier = Supplier.objects.create(company=company, name_ar="مورد")
    invoice = PurchaseInvoice.objects.create(
        company=company,
        supplier=supplier,
        invoice_number="PUR-TEST-0001",
        invoice_date=date.today(),
        created_by=owner,
        supplier_name_snapshot=supplier.name_ar,
    )

    api.force_authenticate(owner)
    res = api.get(f"/api/v1/tenant/purchases/{invoice.id}/print-preview/")
    assert res.status_code == 200, res.data
    assert res.data["company"]["trn"] == "10498835800003"
    assert res.data["company"]["logo_url"]


def test_approve_refreshes_customer_snapshot(api, owner, company, fixed_product):
    from apps.inventory import services as inventory_services
    from apps.inventory.models import MovementType, StockSourceType

    customer = Customer.objects.create(
        company=company,
        name_ar="قبل",
        customer_type="credit",
        trn="",
        credit_limit=Decimal("50000"),
    )
    inventory_services.add_stock(
        company=company,
        product=fixed_product,
        kg=Decimal("100"),
        unit_cost_per_kg=Decimal("10"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening stock",
        user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )
    api.force_authenticate(owner)
    create = api.post(
        "/api/v1/tenant/sales/",
        {
            "customer": customer.id,
            "invoice_date": str(date.today()),
            "lines": [{"product": fixed_product.id, "quantity_kg": "2.000", "unit_price": "10.00"}],
        },
        format="json",
    )
    inv_id = create.data["id"]
    customer.trn = "100488358000003"
    customer.name_ar = "بعد"
    customer.save()
    approve = api.post(f"/api/v1/tenant/sales/{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert approve.status_code == 200, approve.data
    inv = SalesInvoice.objects.get(pk=inv_id)
    assert inv.customer_trn_snapshot == "100488358000003"
    assert inv.customer_name_snapshot == "بعد"
