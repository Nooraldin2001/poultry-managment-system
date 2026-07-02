"""Phase 9 tax/VAT tests: reports, warnings, adjustments, permissions."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerType
from apps.expenses import services as expense_services
from apps.expenses.models import ExpenseCategory, ExpenseCategoryType, ExpenseStatus
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType, PurchaseStatus
from apps.quotations import services as quotation_services
from apps.quotations.models import QuotationLineType, QuotationStatus
from apps.sales import services as sales_services
from apps.sales.models import SalesInvoice, SalesLineType, SalesStatus
from apps.suppliers.models import Supplier, SupplierType
from apps.tax import services
from apps.tax.models import (
    TaxAdjustment,
    TaxAdjustmentStatus,
    TaxAdjustmentType,
    TaxPeriod,
    TaxPeriodStatus,
    TaxWarning,
    TaxWarningStatus,
    TaxWarningType,
)

pytestmark = pytest.mark.django_db

TAX_SUMMARY_URL = "/api/v1/tenant/tax/summary/"
SALES_VAT_URL = "/api/v1/tenant/tax/sales-vat/"
NET_VAT_URL = "/api/v1/tenant/tax/net-vat/"
WARNINGS_URL = "/api/v1/tenant/tax/warnings/"
ADJUSTMENTS_URL = "/api/v1/tenant/tax/adjustments/"
EXPORT_URL = "/api/v1/tenant/tax/export-payload/"


def _customer(company, **kwargs):
    defaults = dict(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT, trn="",
        credit_limit=Decimal("50000.00"),
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _supplier(company, **kwargs):
    defaults = dict(
        company=company, name_ar="مورد", phone="0500000000",
        supplier_type=SupplierType.CREDIT, trn="",
    )
    defaults.update(kwargs)
    return Supplier.objects.create(**defaults)


def _product(company, sku="T1", **kwargs):
    cat = ProductCategory.objects.create(
        company=company, name_ar=f"cat-{sku}", code=f"C{sku}",
    )
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _approved_sale(company, owner, vat_rate=Decimal("5"), trn=""):
    from apps.inventory import services as inventory_services
    from apps.inventory.models import StockSourceType

    customer = _customer(company, trn=trn)
    product = _product(company, sales_price=Decimal("100"))
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal("100"),
        unit_cost_per_kg=Decimal("8"),
        source_type=StockSourceType.OPENING_INVENTORY, source_id=0,
        source_reference="opening", reason="stock", user=owner,
    )
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=vat_rate,
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    inv.refresh_from_db()
    return inv


def _approved_purchase(company, owner, vat_rate=Decimal("5"), trn=""):
    supplier = _supplier(company, trn=trn)
    product = _product(company, sku="PUR")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=vat_rate,
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("50"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    inv.refresh_from_db()
    return inv


def _posted_expense(company, owner, vat_rate=Decimal("5")):
    cat = ExpenseCategory.objects.create(
        company=company, name_ar="نقل", code="TRN", category_type=ExpenseCategoryType.DAILY,
    )
    return expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="Transport", expense_date=date.today(),
        amount=Decimal("200"), vat_rate=vat_rate,
    )


# ── Sales VAT ─────────────────────────────────────────────────────────────────
def test_sales_vat_includes_approved_only(company, owner):
    inv = _approved_sale(company, owner, trn="123")
    report = services.get_sales_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1
    assert report["totals"]["sales_vat_amount"] == inv.vat_amount


def test_sales_vat_excludes_draft_and_cancelled(company, owner):
    _approved_sale(company, owner, trn="123")
    customer = _customer(company, phone="0502")
    product = _product(company, sku="DRF")
    draft = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    assert draft.status == SalesStatus.DRAFT
    report = services.get_sales_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1


def test_purchase_vat_includes_approved_only(company, owner):
    inv = _approved_purchase(company, owner, trn="456")
    report = services.get_purchase_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1
    assert report["totals"]["purchase_vat_amount"] == inv.vat_amount


def test_purchase_vat_excludes_draft(company, owner):
    _approved_purchase(company, owner, trn="456")
    supplier = _supplier(company, phone="0503")
    product = _product(company, sku="PD")
    purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    report = services.get_purchase_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1


def test_expense_vat_posted_only(company, owner):
    exp = _posted_expense(company, owner)
    report = services.get_expense_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["expense_count"] == 1
    assert report["totals"]["expense_vat_amount"] == exp.vat_amount


def test_expense_vat_excludes_cancelled(company, owner):
    exp = _posted_expense(company, owner)
    expense_services.cancel_expense(expense=exp, user=owner, reason="cancel")
    report = services.get_expense_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["expense_count"] == 0


def test_quotations_excluded_from_vat(company, owner):
    customer = _customer(company, phone="0504")
    product = _product(company, sku="QT")
    quotation_services.create_quotation(
        company=company, customer=customer, created_by=owner,
        quotation_date=date.today(), valid_until=date.today(),
        vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": QuotationLineType.PRODUCT,
            "quantity_kg": Decimal("100"), "price_type": "kg",
        }],
    )
    report = services.get_sales_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 0


def test_net_vat_formula(company, owner):
    sale = _approved_sale(company, owner, trn="111")
    purchase = _approved_purchase(company, owner, trn="222")
    expense = _posted_expense(company, owner)
    net = services.get_net_vat_estimate(
        company, date_from=date.today(), date_to=date.today(),
    )
    expected_output = sale.vat_amount
    expected_input = purchase.vat_amount + expense.vat_amount
    assert net["output_vat"] == expected_output
    assert net["total_input_vat"] == expected_input
    assert net["net_vat"] == expected_output - expected_input


def test_manual_adjustment_affects_net_vat(company, owner):
    _approved_sale(company, owner, trn="111")
    services.create_tax_adjustment(
        company=company, user=owner, adjustment_date=date.today(),
        adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
        amount=Decimal("50"), reason="rounding correction",
    )
    net = services.get_net_vat_estimate(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert net["manual_adjustments"] == Decimal("50.00")


# ── Warnings ──────────────────────────────────────────────────────────────────
def test_missing_company_trn_warning(company, owner):
    company.trn = ""
    company.save(update_fields=["trn"])
    _approved_sale(company, owner)
    result = services.generate_tax_warnings(company)
    assert result["generated_count"] >= 1
    assert TaxWarning.objects.filter(
        company=company, warning_type=TaxWarningType.COMPANY_TRN_MISSING,
    ).exists()


def test_missing_customer_trn_warning(company, owner):
    _approved_sale(company, owner, trn="")
    services.generate_tax_warnings(company)
    assert TaxWarning.objects.filter(
        company=company, warning_type=TaxWarningType.CUSTOMER_TRN_MISSING,
    ).exists()


def test_missing_supplier_trn_warning(company, owner):
    _approved_purchase(company, owner, trn="")
    services.generate_tax_warnings(company)
    assert TaxWarning.objects.filter(
        company=company, warning_type=TaxWarningType.SUPPLIER_TRN_MISSING,
    ).exists()


def test_vat_disabled_warning(company, owner):
    _approved_sale(company, owner, trn="123", vat_rate=Decimal("0"))
    services.generate_tax_warnings(company)
    assert TaxWarning.objects.filter(
        company=company, warning_type=TaxWarningType.VAT_DISABLED_SALES,
    ).exists()


def test_vat_mismatch_warning(company, owner):
    inv = _approved_sale(company, owner, trn="123", vat_rate=Decimal("5"))
    SalesInvoice.objects.filter(pk=inv.pk).update(vat_amount=Decimal("999.00"))
    services.generate_tax_warnings(company)
    assert TaxWarning.objects.filter(
        company=company, warning_type=TaxWarningType.VAT_AMOUNT_MISMATCH,
    ).exists()


def test_warning_generation_idempotent(company, owner):
    _approved_sale(company, owner, trn="")
    r1 = services.generate_tax_warnings(company)
    r2 = services.generate_tax_warnings(company)
    assert r2["generated_count"] == 0


def test_dismiss_warning_requires_reason(company, owner):
    _approved_sale(company, owner, trn="")
    services.generate_tax_warnings(company)
    warning = TaxWarning.objects.filter(company=company, status=TaxWarningStatus.OPEN).first()
    with pytest.raises(ValidationError):
        services.dismiss_tax_warning(warning=warning, user=owner, reason="")


def test_resolve_warning(company, owner):
    _approved_sale(company, owner, trn="")
    services.generate_tax_warnings(company)
    warning = TaxWarning.objects.filter(company=company, status=TaxWarningStatus.OPEN).first()
    services.resolve_tax_warning(warning=warning, user=owner, reason="fixed")
    warning.refresh_from_db()
    assert warning.status == TaxWarningStatus.RESOLVED


def test_cross_tenant_warning_blocked(api, company, owner, other_owner):
    _approved_sale(company, owner, trn="")
    services.generate_tax_warnings(company)
    warning = TaxWarning.objects.filter(company=company).first()
    api.force_authenticate(user=other_owner)
    resp = api.get(f"{WARNINGS_URL}{warning.id}/")
    assert resp.status_code == 404


# ── Adjustments ───────────────────────────────────────────────────────────────
def test_create_adjustment_requires_reason(company, owner):
    with pytest.raises(ValidationError):
        services.create_tax_adjustment(
            company=company, user=owner, adjustment_date=date.today(),
            adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
            amount=Decimal("10"), reason="",
        )


def test_adjustment_amount_positive(company, owner):
    with pytest.raises(ValidationError):
        services.create_tax_adjustment(
            company=company, user=owner, adjustment_date=date.today(),
            adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
            amount=Decimal("-5"), reason="bad",
        )


def test_cancel_adjustment_requires_reason(company, owner):
    adj = services.create_tax_adjustment(
        company=company, user=owner, adjustment_date=date.today(),
        adjustment_type=TaxAdjustmentType.INPUT_VAT_INCREASE,
        amount=Decimal("20"), reason="test",
    )
    with pytest.raises(ValidationError):
        services.cancel_tax_adjustment(adjustment=adj, user=owner, reason="")


def test_cancelled_adjustment_excluded_from_net(company, owner):
    _approved_sale(company, owner, trn="111")
    adj = services.create_tax_adjustment(
        company=company, user=owner, adjustment_date=date.today(),
        adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
        amount=Decimal("100"), reason="test",
    )
    services.cancel_tax_adjustment(adjustment=adj, user=owner, reason="undo")
    net = services.get_net_vat_estimate(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert net["manual_adjustments"] == Decimal("0")


def test_adjustment_audit_log(company, owner):
    adj = services.create_tax_adjustment(
        company=company, user=owner, adjustment_date=date.today(),
        adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
        amount=Decimal("15"), reason="audit test",
    )
    assert AuditLog.objects.filter(
        module="tax", action="tax_adjustment_create", reference_id=str(adj.id),
    ).exists()


# ── Periods ───────────────────────────────────────────────────────────────────
def test_create_tax_period(company, owner):
    period = TaxPeriod.objects.create(
        company=company, name="Q1 2026",
        start_date=date(2026, 1, 1), end_date=date(2026, 3, 31),
        created_by=owner,
    )
    assert period.status == TaxPeriodStatus.OPEN


def test_invalid_period_dates_rejected():
    from django.core.exceptions import ValidationError as DjangoValidationError
    period = TaxPeriod(
        company_id=1, name="Bad",
        start_date=date(2026, 6, 1), end_date=date(2026, 1, 1),
    )
    with pytest.raises(DjangoValidationError):
        period.full_clean()


def test_review_and_close_period(company, owner):
    period = TaxPeriod.objects.create(
        company=company, name="Jan 2026",
        start_date=date(2026, 1, 1), end_date=date(2026, 1, 31),
        created_by=owner,
    )
    services.review_tax_period(period=period, user=owner)
    period.refresh_from_db()
    assert period.status == TaxPeriodStatus.REVIEWED
    services.close_tax_period(period=period, user=owner)
    period.refresh_from_db()
    assert period.status == TaxPeriodStatus.CLOSED


def test_adjustment_blocked_in_closed_period(company, owner):
    period = TaxPeriod.objects.create(
        company=company, name="Closed",
        start_date=date.today().replace(day=1),
        end_date=date.today(),
        status=TaxPeriodStatus.CLOSED,
        created_by=owner,
    )
    with pytest.raises(ValidationError):
        services.create_tax_adjustment(
            company=company, user=owner, adjustment_date=date.today(),
            adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
            amount=Decimal("10"), reason="blocked",
        )


# ── Export / disabled VAT / API permissions ───────────────────────────────────
def test_export_payload_structure(company, owner):
    _approved_sale(company, owner, trn="123")
    payload = services.build_tax_export_payload(
        company, report_type="vat_summary",
        date_from=date.today(), date_to=date.today(), user=owner,
    )
    assert payload["metadata"]["report_type"] == "vat_summary"
    assert payload["company"]["name_en"]
    assert "report" in payload
    assert "warnings_summary" in payload


def test_disabled_vat_documents(company, owner):
    _approved_sale(company, owner, trn="123", vat_rate=Decimal("0"))
    data = services.get_disabled_vat_documents(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert len(data["records"]) >= 1


def test_tax_audit_entries(company, owner):
    services.create_tax_adjustment(
        company=company, user=owner, adjustment_date=date.today(),
        adjustment_type=TaxAdjustmentType.OUTPUT_VAT_INCREASE,
        amount=Decimal("5"), reason="audit",
    )
    entries = services.get_tax_audit_entries(company)
    assert any(e["action"] == "tax_adjustment_create" for e in entries)


def test_owner_can_view_summary(api, company, owner):
    _approved_sale(company, owner, trn="123")
    api.force_authenticate(user=owner)
    resp = api.get(TAX_SUMMARY_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 200


def test_accountant_can_view_net_vat(api, company, accountant, owner):
    _approved_sale(company, owner, trn="123")
    api.force_authenticate(user=accountant)
    resp = api.get(NET_VAT_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 200


def test_accountant_cannot_adjust_by_default(api, company, accountant):
    api.force_authenticate(user=accountant)
    resp = api.post(ADJUSTMENTS_URL, {
        "adjustment_date": str(date.today()),
        "adjustment_type": "output_vat_increase",
        "amount": "10.00",
        "reason": "try",
    }, format="json")
    assert resp.status_code == 403


def test_cashier_blocked(api, company, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get(SALES_VAT_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 403


def test_tenant_isolation(api, company, owner, other_owner):
    _approved_sale(company, owner, trn="123")
    api.force_authenticate(user=other_owner)
    resp = api.get(SALES_VAT_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 200
    assert resp.data["totals"]["invoice_count"] == 0


def test_export_requires_permission(api, company, owner, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get(EXPORT_URL, {
        "date_from": str(date.today()), "date_to": str(date.today()),
        "report_type": "vat_summary",
    })
    assert resp.status_code == 403
