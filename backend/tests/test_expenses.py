"""Phase 8 expense tests: creation, purchase-link, cancellation, recurring, APIs."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.expenses import services
from apps.expenses.models import (
    Expense,
    ExpenseCategory,
    ExpenseCategoryType,
    ExpenseScope,
    ExpenseStatus,
    PurchaseLinkBehavior,
    RecurrencePeriod,
    RecurringExpense,
)
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import (
    PurchaseAdjustment,
    PurchaseAdjustmentEffect,
    PurchaseLineType,
    PurchaseStatus,
)
from apps.suppliers.models import Supplier, SupplierType

pytestmark = pytest.mark.django_db

EXPENSES_URL = "/api/v1/tenant/expenses/"
CATEGORIES_URL = "/api/v1/tenant/expense-categories/"
RECURRING_URL = "/api/v1/tenant/recurring-expenses/"


def _category(company, code="VEH", **kwargs):
    defaults = dict(
        company=company, name_ar="مصروفات السيارات", name_en="Vehicle Expenses",
        code=code, category_type=ExpenseCategoryType.DAILY, is_active=True,
    )
    defaults.update(kwargs)
    return ExpenseCategory.objects.create(**defaults)


def _supplier(company, **kwargs):
    defaults = dict(
        company=company, name_ar="مورد", phone="0500000000",
        supplier_type=SupplierType.CREDIT,
    )
    defaults.update(kwargs)
    return Supplier.objects.create(**defaults)


def _product(company, sku="EXP1"):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, purchase_price=Decimal("10.00"),
    )


def _purchase_line(product, **kwargs):
    data = dict(
        product=product, line_type=PurchaseLineType.PRODUCT,
        quantity_kg=Decimal("100"), unit_price=Decimal("10"), price_type="kg",
    )
    data.update(kwargs)
    return data


def _draft_purchase(company, owner, **kwargs):
    supplier = _supplier(company)
    product = _product(company)
    return purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), lines=[_purchase_line(product)], **kwargs,
    )


def _create_expense(company, owner, category=None, **kwargs):
    if category is None:
        category, _ = ExpenseCategory.objects.get_or_create(
            company=company,
            code="VEH",
            defaults=dict(
                name_ar="مصروفات السيارات", name_en="Vehicle Expenses",
                category_type=ExpenseCategoryType.DAILY, is_active=True,
            ),
        )
    defaults = dict(
        company=company, category=category, created_by=owner,
        title="Fuel", expense_date=date.today(), amount=Decimal("100"),
        expense_scope=ExpenseScope.DAILY,
    )
    defaults.update(kwargs)
    return services.create_expense(**defaults)


# ── Categories ────────────────────────────────────────────────────────────────
def test_create_expense_category(company):
    cat = _category(company)
    assert cat.code == "VEH"
    assert cat.is_active


def test_duplicate_category_code_blocked(company):
    _category(company, code="DUP")
    with pytest.raises(Exception):
        ExpenseCategory.objects.create(
            company=company, name_ar="other", code="DUP",
            category_type=ExpenseCategoryType.GENERAL,
        )


def test_cross_tenant_category_access_blocked(api, company, owner, other_company):
    other_cat = _category(other_company, code="OT")
    api.force_authenticate(user=owner)
    resp = api.get(f"{CATEGORIES_URL}{other_cat.id}/")
    assert resp.status_code == 404


# ── Expense creation ─────────────────────────────────────────────────────────
def test_create_daily_expense(company, owner):
    cat = _category(company)
    exp = _create_expense(company, owner, category=cat)
    assert exp.status == ExpenseStatus.POSTED
    assert exp.expense_number.startswith("EXP-")
    assert exp.expense_scope == ExpenseScope.DAILY


def test_create_monthly_expense(company, owner):
    exp = _create_expense(
        company, owner, expense_scope=ExpenseScope.MONTHLY,
        amount=Decimal("5000"),
    )
    assert exp.expense_scope == ExpenseScope.MONTHLY


def test_vat_and_total_calculated(company, owner):
    exp = _create_expense(company, owner, amount=Decimal("100"), vat_rate=Decimal("5"))
    assert exp.vat_amount == Decimal("5.00")
    assert exp.total_amount == Decimal("105.00")


def test_negative_amount_rejected(company, owner):
    cat = _category(company, code="N1")
    with pytest.raises(ValidationError):
        _create_expense(company, owner, category=cat, amount=Decimal("-10"))


def test_cancelled_excluded_from_summary(company, owner):
    exp = _create_expense(company, owner, amount=Decimal("200"))
    services.cancel_expense(expense=exp, user=owner, reason="duplicate entry")
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("0")


def test_expense_number_generated(company, owner):
    exp = _create_expense(company, owner)
    assert exp.expense_number.startswith("EXP-")


def test_cross_tenant_purchase_rejected(company, owner, other_company, other_owner):
    cat = _category(company, code="X1")
    inv = _draft_purchase(other_company, other_owner)
    with pytest.raises(ValidationError):
        services.create_expense(
            company=company, category=cat, created_by=owner,
            title="Bad link", expense_date=date.today(), amount=Decimal("50"),
            linked_purchase_invoice=inv,
            purchase_link_behavior=PurchaseLinkBehavior.EXPENSE_ONLY,
        )


def test_cross_tenant_category_rejected(company, owner, other_company):
    other_cat = _category(other_company, code="OC")
    with pytest.raises(ValidationError):
        _create_expense(company, owner, category=other_cat)


def test_cashier_blocked_by_default(api, company, cashier):
    cat = _category(company, code="CSH")
    api.force_authenticate(user=cashier)
    resp = api.get(EXPENSES_URL)
    assert resp.status_code == 403


# ── Purchase-linked ───────────────────────────────────────────────────────────
def test_expense_only_counts_in_totals(company, owner):
    inv = _draft_purchase(company, owner)
    services.create_expense(
        company=company, category=_category(company, code="PL1"), created_by=owner,
        title="Transport", expense_date=date.today(), amount=Decimal("150"),
        linked_purchase_invoice=inv,
        purchase_link_behavior=PurchaseLinkBehavior.EXPENSE_ONLY,
    )
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("150.00")


def test_reduce_payable_draft_creates_adjustment(company, owner):
    inv = _draft_purchase(company, owner)
    exp = services.create_expense(
        company=company, category=_category(company, code="PL2"), created_by=owner,
        title="Deduction", expense_date=date.today(), amount=Decimal("50"),
        linked_purchase_invoice=inv,
        purchase_link_behavior=PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        reason="Supplier credit note",
    )
    assert exp.related_purchase_adjustment_id
    adj = PurchaseAdjustment.objects.get(pk=exp.related_purchase_adjustment_id)
    assert adj.effect == PurchaseAdjustmentEffect.REDUCE_SUPPLIER_PAYABLE
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("0")


def test_reduce_payable_approved_blocked(company, owner):
    inv = _draft_purchase(company, owner)
    purchase_services.approve_purchase_invoice(
        invoice=inv, user=owner, reason="approve for test",
    )
    with pytest.raises(ValidationError):
        services.create_expense(
            company=company, category=_category(company, code="PL3"), created_by=owner,
            title="Late deduction", expense_date=date.today(), amount=Decimal("50"),
            linked_purchase_invoice=inv,
            purchase_link_behavior=PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            reason="too late",
        )


def test_increase_inventory_cost_draft_creates_adjustment(company, owner):
    inv = _draft_purchase(company, owner)
    exp = services.create_expense(
        company=company, category=_category(company, code="PL4"), created_by=owner,
        title="Transport cost", expense_date=date.today(), amount=Decimal("75"),
        linked_purchase_invoice=inv,
        purchase_link_behavior=PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        reason="landed cost",
    )
    assert exp.related_purchase_adjustment_id
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("0")


def test_increase_inventory_cost_approved_blocked(company, owner):
    inv = _draft_purchase(company, owner)
    purchase_services.approve_purchase_invoice(
        invoice=inv, user=owner, reason="approve for test",
    )
    with pytest.raises(ValidationError):
        services.create_expense(
            company=company, category=_category(company, code="PL5"), created_by=owner,
            title="Late cost", expense_date=date.today(), amount=Decimal("75"),
            linked_purchase_invoice=inv,
            purchase_link_behavior=PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
            reason="too late",
        )


def test_purchase_linked_expense_audited(company, owner):
    inv = _draft_purchase(company, owner)
    exp = services.create_expense(
        company=company, category=_category(company, code="PL6"), created_by=owner,
        title="Deduction", expense_date=date.today(), amount=Decimal("30"),
        linked_purchase_invoice=inv,
        purchase_link_behavior=PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        reason="audit test",
    )
    assert AuditLog.objects.filter(
        module="expenses", reference_id=exp.id, action="create_purchase_linked_expense",
    ).exists()


# ── Cancellation ──────────────────────────────────────────────────────────────
def test_cancel_requires_reason(company, owner):
    exp = _create_expense(company, owner)
    with pytest.raises(ValidationError):
        services.cancel_expense(expense=exp, user=owner, reason="")


def test_cancel_marks_cancelled(company, owner):
    exp = _create_expense(company, owner)
    services.cancel_expense(expense=exp, user=owner, reason="wrong entry")
    exp.refresh_from_db()
    assert exp.status == ExpenseStatus.CANCELLED


def test_cancel_creates_status_history(company, owner):
    exp = _create_expense(company, owner)
    services.cancel_expense(expense=exp, user=owner, reason="wrong entry")
    assert exp.status_history.filter(to_status=ExpenseStatus.CANCELLED).exists()


def test_cancel_creates_audit_log(company, owner):
    exp = _create_expense(company, owner)
    services.cancel_expense(expense=exp, user=owner, reason="wrong entry")
    assert AuditLog.objects.filter(action="expense_cancel", reference_id=exp.id).exists()


def test_cancel_excludes_from_summaries(company, owner):
    exp = _create_expense(company, owner, amount=Decimal("300"))
    services.cancel_expense(expense=exp, user=owner, reason="duplicate")
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("0")


def test_cancel_twice_blocked(company, owner):
    exp = _create_expense(company, owner)
    services.cancel_expense(expense=exp, user=owner, reason="first")
    with pytest.raises(ValidationError):
        services.cancel_expense(expense=exp, user=owner, reason="second")


def test_cancel_removes_draft_purchase_adjustment(company, owner):
    inv = _draft_purchase(company, owner)
    exp = services.create_expense(
        company=company, category=_category(company, code="CN1"), created_by=owner,
        title="Deduction", expense_date=date.today(), amount=Decimal("40"),
        linked_purchase_invoice=inv,
        purchase_link_behavior=PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        reason="test cancel",
    )
    adj_id = exp.related_purchase_adjustment_id
    services.cancel_expense(expense=exp, user=owner, reason="undo")
    assert not PurchaseAdjustment.objects.filter(pk=adj_id).exists()


# ── Recurring ─────────────────────────────────────────────────────────────────
def test_create_recurring_expense(company, owner):
    cat = _category(company, code="RC1", category_type=ExpenseCategoryType.RECURRING)
    rec = services.create_recurring_expense(
        company=company, category=cat, created_by=owner,
        title="Office Rent", amount=Decimal("3000"), recurrence=RecurrencePeriod.MONTHLY,
        start_date=date.today(),
    )
    assert rec.is_active
    assert rec.next_due_date == date.today()


def test_generate_expense_from_recurring(company, owner):
    cat = _category(company, code="RC2", category_type=ExpenseCategoryType.RECURRING)
    rec = services.create_recurring_expense(
        company=company, category=cat, created_by=owner,
        title="Rent", amount=Decimal("2000"), recurrence=RecurrencePeriod.MONTHLY,
        start_date=date.today(),
    )
    exp = services.generate_expense_from_recurring(recurring_expense=rec, user=owner)
    assert exp.expense_scope == ExpenseScope.RECURRING_GENERATED
    assert exp.total_amount == Decimal("2000.00")


def test_next_due_date_advances(company, owner):
    cat = _category(company, code="RC3", category_type=ExpenseCategoryType.RECURRING)
    start = date(2026, 1, 15)
    rec = services.create_recurring_expense(
        company=company, category=cat, created_by=owner,
        title="Rent", amount=Decimal("1000"), recurrence=RecurrencePeriod.MONTHLY,
        start_date=start,
    )
    services.generate_expense_from_recurring(recurring_expense=rec, user=owner)
    rec.refresh_from_db()
    assert rec.next_due_date == date(2026, 2, 15)


def test_duplicate_generation_blocked(company, owner):
    cat = _category(company, code="RC4", category_type=ExpenseCategoryType.RECURRING)
    target = date.today()
    rec = services.create_recurring_expense(
        company=company, category=cat, created_by=owner,
        title="Rent", amount=Decimal("1000"), recurrence=RecurrencePeriod.MONTHLY,
        start_date=target,
    )
    services.generate_expense_from_recurring(
        recurring_expense=rec, user=owner, target_date=target,
    )
    with pytest.raises(ValidationError):
        services.generate_expense_from_recurring(
            recurring_expense=rec, user=owner, target_date=target,
        )


def test_inactive_recurring_cannot_generate(company, owner):
    cat = _category(company, code="RC5", category_type=ExpenseCategoryType.RECURRING)
    rec = services.create_recurring_expense(
        company=company, category=cat, created_by=owner,
        title="Rent", amount=Decimal("1000"), recurrence=RecurrencePeriod.MONTHLY,
        start_date=date.today(),
    )
    rec.is_active = False
    rec.save(update_fields=["is_active"])
    with pytest.raises(ValidationError):
        services.generate_expense_from_recurring(recurring_expense=rec, user=owner)


# ── Voucher preview ───────────────────────────────────────────────────────────
def test_voucher_preview_structure(company, owner):
    exp = _create_expense(company, owner, title="Office supplies", amount=Decimal("250"))
    preview = services.build_expense_voucher_preview(exp)
    assert preview["title_en"] == "EXPENSE VOUCHER"
    assert preview["title_ar"] == "سند مصروف"
    assert preview["voucher"]["amount"] == "250.00"
    assert preview["voucher"]["status"] == ExpenseStatus.POSTED
    assert preview["company"]["name_ar"]


def test_cross_tenant_voucher_preview_denied(api, company, owner, other_owner):
    exp = _create_expense(company, owner)
    api.force_authenticate(user=other_owner)
    resp = api.get(f"{EXPENSES_URL}{exp.id}/voucher-preview/")
    assert resp.status_code == 404


# ── Summary / profit impact ───────────────────────────────────────────────────
def test_expense_summary_posted_only(company, owner):
    _create_expense(company, owner, amount=Decimal("100"))
    exp2 = _create_expense(company, owner, amount=Decimal("200"))
    services.cancel_expense(expense=exp2, user=owner, reason="cancel")
    summary = services.get_expense_summary(company)
    assert summary["total_expenses"] == Decimal("100.00")


def test_category_breakdown(company, owner):
    cat1 = _category(company, code="CB1", name_ar="نقل")
    cat2 = _category(company, code="CB2", name_ar="صيانة")
    _create_expense(company, owner, category=cat1, amount=Decimal("100"))
    _create_expense(company, owner, category=cat2, amount=Decimal("50"))
    summary = services.get_expense_summary(company)
    assert len(summary["category_breakdown"]) == 2


def test_payment_method_breakdown(company, owner):
    _create_expense(company, owner, payment_method="cash", amount=Decimal("80"))
    _create_expense(company, owner, payment_method="bank_transfer", amount=Decimal("120"))
    summary = services.get_expense_summary(company)
    methods = {row["payment_method"] for row in summary["payment_method_breakdown"]}
    assert "cash" in methods
    assert "bank_transfer" in methods


def test_profit_impact_foundation(company, owner):
    _create_expense(company, owner, amount=Decimal("500"))
    inv = _draft_purchase(company, owner)
    purchase_services.approve_purchase_invoice(
        invoice=inv, user=owner, reason="approve for profit test",
    )

    impact = services.get_profit_impact_foundation(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert impact["purchases_total"] > 0
    assert impact["expenses_total"] == Decimal("500.00")
    assert "net_profit_foundation" in impact
    assert "notes" in impact


def test_cancelled_excluded_from_profit_impact(company, owner):
    exp = _create_expense(company, owner, amount=Decimal("999"))
    services.cancel_expense(expense=exp, user=owner, reason="cancel")
    impact = services.get_profit_impact_foundation(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert impact["expenses_total"] == Decimal("0")


# ── Permissions / API ─────────────────────────────────────────────────────────
def test_owner_can_create(api, company, owner):
    cat = _category(company, code="AP1")
    api.force_authenticate(user=owner)
    resp = api.post(EXPENSES_URL, {
        "category": cat.id, "title": "Fuel", "expense_date": str(date.today()),
        "amount": "100.00", "expense_scope": "daily", "payment_method": "cash",
    }, format="json")
    assert resp.status_code == 201


def test_accountant_can_create(api, company, accountant):
    cat = _category(company, code="AP2")
    api.force_authenticate(user=accountant)
    resp = api.post(EXPENSES_URL, {
        "category": cat.id, "title": "Rent", "expense_date": str(date.today()),
        "amount": "2000.00", "expense_scope": "monthly",
    }, format="json")
    assert resp.status_code == 201


def test_accountant_cannot_cancel_by_default(api, company, owner, accountant):
    exp = _create_expense(company, owner)
    api.force_authenticate(user=accountant)
    resp = api.post(f"{EXPENSES_URL}{exp.id}/cancel/", {"reason": "try cancel"}, format="json")
    assert resp.status_code == 403


def test_tenant_isolation(api, company, owner, other_owner):
    exp = _create_expense(company, owner)
    api.force_authenticate(user=other_owner)
    resp = api.get(f"{EXPENSES_URL}{exp.id}/")
    assert resp.status_code == 404


def test_profit_impact_permission(api, company, owner, accountant):
    api.force_authenticate(user=accountant)
    resp = api.get(
        "/api/v1/tenant/expenses/profit-impact/",
        {"date_from": str(date.today()), "date_to": str(date.today())},
    )
    assert resp.status_code == 200

    api.force_authenticate(user=owner)
    resp = api.get(
        "/api/v1/tenant/expenses/profit-impact/",
        {"date_from": str(date.today()), "date_to": str(date.today())},
    )
    assert resp.status_code == 200
