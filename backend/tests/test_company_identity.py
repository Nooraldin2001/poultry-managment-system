"""Company identity assets (logo / stamp / signature / TRN) API tests."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

pytestmark = pytest.mark.django_db


def _png_file(name="logo.png", size=(40, 40), color=(15, 44, 89)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


@pytest.fixture(autouse=True)
def _media_tmp(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path / "media")


# ── Super Admin ──────────────────────────────────────────────────────────────

def test_super_admin_uploads_identity_assets(api, super_admin, company):
    api.force_authenticate(super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {
            "trn": "100488358000003",
            "logo": _png_file("logo.png"),
            "stamp": _png_file("stamp.png"),
            "signature": _png_file("signature.png"),
        },
        format="multipart",
    )
    assert res.status_code == 200, res.data
    assert res.data["trn"] == "100488358000003"
    assert res.data["logo_url"] and "/media/company_assets/" in res.data["logo_url"]
    assert res.data["stamp_url"]
    assert res.data["signature_url"]

    company.refresh_from_db()
    assert company.logo and company.stamp and company.signature
    # Tenant-safe path: company_assets/{company_id}/{kind}/...
    assert company.logo.name.startswith(f"company_assets/{company.id}/logo/")
    assert company.stamp.name.startswith(f"company_assets/{company.id}/stamp/")
    assert company.signature.name.startswith(
        f"company_assets/{company.id}/signature/"
    )


def test_super_admin_can_remove_asset(api, super_admin, company):
    api.force_authenticate(super_admin)
    api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": _png_file()},
        format="multipart",
    )
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": ""},
        format="multipart",
    )
    assert res.status_code == 200, res.data
    assert res.data["logo_url"] is None


def test_invalid_file_type_rejected(api, super_admin, company):
    api.force_authenticate(super_admin)
    bad = SimpleUploadedFile(
        "logo.svg", b"<svg></svg>", content_type="image/svg+xml"
    )
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": bad},
        format="multipart",
    )
    assert res.status_code == 400
    assert "logo" in res.data


def test_non_image_content_rejected(api, super_admin, company):
    api.force_authenticate(super_admin)
    fake = SimpleUploadedFile("logo.png", b"not-an-image", content_type="image/png")
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": fake},
        format="multipart",
    )
    assert res.status_code == 400
    assert "logo" in res.data


def test_oversized_file_rejected(api, super_admin, company):
    api.force_authenticate(super_admin)
    # Uncompressible noise > 2 MB.
    import os

    buf = io.BytesIO()
    img = Image.frombytes("RGB", (1200, 1200), os.urandom(1200 * 1200 * 3))
    img.save(buf, format="PNG")
    assert buf.getbuffer().nbytes > 2 * 1024 * 1024
    big = SimpleUploadedFile("big.png", buf.getvalue(), content_type="image/png")
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": big},
        format="multipart",
    )
    assert res.status_code == 400
    assert "logo" in res.data


def test_trn_digits_only(api, super_admin, company):
    api.force_authenticate(super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"trn": "ABC-123"},
        format="json",
    )
    assert res.status_code == 400
    assert "trn" in res.data


# ── Tenant ───────────────────────────────────────────────────────────────────

def test_tenant_owner_views_identity(api, owner, company):
    company.trn = "100488358000003"
    company.logo = _png_file()
    company.save()

    api.force_authenticate(owner)
    res = api.get("/api/v1/tenant/settings/")
    assert res.status_code == 200
    assert res.data["trn"] == "100488358000003"
    assert res.data["logo_url"]
    assert res.data["stamp_url"] is None
    assert res.data["signature_url"] is None


def test_tenant_owner_updates_identity(api, owner):
    api.force_authenticate(owner)
    res = api.patch(
        "/api/v1/tenant/settings/company/",
        {"trn": "100000000000001", "stamp": _png_file("stamp.png")},
        format="multipart",
    )
    assert res.status_code == 200, res.data
    assert res.data["trn"] == "100000000000001"
    assert res.data["stamp_url"]


def test_cashier_cannot_update_identity(api, cashier):
    api.force_authenticate(cashier)
    res = api.patch(
        "/api/v1/tenant/settings/company/",
        {"trn": "100000000000001"},
        format="json",
    )
    assert res.status_code == 403


def test_cross_tenant_isolation(api, owner, other_company):
    other_company.trn = "999999999999999"
    other_company.save()
    api.force_authenticate(owner)
    res = api.get("/api/v1/tenant/settings/")
    assert res.status_code == 200
    assert res.data["trn"] != "999999999999999"
    assert res.data["id"] != other_company.id


# ── Print previews include company identity ─────────────────────────────────

def test_sales_print_preview_includes_identity(api, owner, company, fixed_product):
    from datetime import date
    from decimal import Decimal

    from apps.customers.models import Customer
    from apps.sales.models import SalesInvoice, SalesInvoiceLine

    company.trn = "100488358000003"
    company.logo = _png_file()
    company.stamp = _png_file("stamp.png")
    company.signature = _png_file("sig.png")
    company.save()

    customer = Customer.objects.create(
        company=company, name_ar="عميل نقدي", customer_type="cash"
    )
    invoice = SalesInvoice.objects.create(
        company=company,
        customer=customer,
        invoice_number="SAL-2026-0001",
        invoice_date=date.today(),
        created_by=owner,
        customer_name_snapshot=customer.name_ar,
    )
    SalesInvoiceLine.objects.create(
        company=company,
        invoice=invoice,
        product=fixed_product,
        product_name_snapshot=fixed_product.name_ar,
        quantity_kg=Decimal("10.000"),
        unit_price=Decimal("10.00"),
        line_total=Decimal("100.00"),
    )

    api.force_authenticate(owner)
    res = api.get(f"/api/v1/tenant/sales/{invoice.id}/print-preview/")
    assert res.status_code == 200, res.data
    identity = res.data["company"]
    assert identity["trn"] == "100488358000003"
    assert identity["logo_url"]
    assert identity["stamp_url"]
    assert identity["signature_url"]


def test_purchase_print_preview_includes_identity(api, owner, company, fixed_product):
    from datetime import date

    from apps.purchases.models import PurchaseInvoice
    from apps.suppliers.models import Supplier

    company.trn = "100488358000003"
    company.logo = _png_file()
    company.stamp = _png_file("stamp.png")
    company.signature = _png_file("sig.png")
    company.save()

    supplier = Supplier.objects.create(company=company, name_ar="مورد")
    invoice = PurchaseInvoice.objects.create(
        company=company,
        supplier=supplier,
        invoice_number="PUR-2026-0001",
        invoice_date=date.today(),
        created_by=owner,
        supplier_name_snapshot=supplier.name_ar,
    )

    api.force_authenticate(owner)
    res = api.get(f"/api/v1/tenant/purchases/{invoice.id}/print-preview/")
    assert res.status_code == 200, res.data
    identity = res.data["company"]
    assert identity["trn"] == "100488358000003"
    assert identity["logo_url"]
    assert identity["stamp_url"]
    assert identity["signature_url"]
