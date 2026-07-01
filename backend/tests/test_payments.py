"""Phase 6 payment tests: collections, payments, refunds, cancellation, APIs."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.customers.models import (
    Customer,
    CustomerLedgerEntry,
    CustomerType,
    OpeningBalanceType,
)
from apps.customers import services as customer_services
from apps.inventory import services as inventory_services
from apps.inventory.models import MovementType, StockSourceType
from apps.payments import services as payment_services
from apps.payments.models import (
    PaymentAllocation,
    PaymentMovement,
    PaymentMovementStatus,
    PaymentMovementType,
)
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseInvoiceLine, PurchaseLineType, PurchaseStatus
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType, SalesPaymentStatus, SalesStatus
from apps.suppliers.models import (
    OpeningBalanceType as SupplierOBType,
    Supplier,
    SupplierLedgerEntry,
    SupplierType,
)
from apps.suppliers import services as supplier_services

pytestmark = pytest.mark.django_db

COLLECTIONS_URL = "/api/v1/tenant/payments/customer-collections/"
PAYMENTS_URL = "/api/v1/tenant/payments/supplier-payments/"
MOVEMENTS_URL = "/api/v1/tenant/payments/movements/"


def _customer(company, **kwargs):
    defaults = dict(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _supplier(company, **kwargs):
    defaults = dict(
        company=company, name_ar="مورد", phone="0500000002",
        supplier_type=SupplierType.CREDIT,
    )
    defaults.update(kwargs)
    return Supplier.objects.create(**defaults)


def _product(company, sku="PAY1"):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )


def _seed_stock(company, owner, product, kg="100"):
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal(kg),
        unit_cost_per_kg=Decimal("10"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _approved_sale(company, customer, owner, product, qty="10", price=None):
    _seed_stock(company, owner, product)
    lines = [{
        "product": product, "line_type": SalesLineType.PRODUCT,
        "quantity_kg": Decimal(qty), "price_type": "kg",
    }]
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), lines=lines, vat_rate=Decimal("0"),
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="sold")
    inv.refresh_from_db()
    return inv


def _approved_purchase(company, supplier, owner, product, qty="10"):
    lines = [{
        "product": product, "line_type": PurchaseLineType.PRODUCT,
        "quantity_kg": Decimal(qty), "unit_price": Decimal("10"), "price_type": "kg",
    }]
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), lines=lines, vat_rate=Decimal("0"),
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")
    inv.refresh_from_db()
    return inv


# ── Customer collections ────────────────────────────────────────────────────
def test_collection_creates_movement_and_ledger(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, customer, owner, product)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("500"),
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("500")}],
    )
    assert movement.movement_type == PaymentMovementType.CUSTOMER_COLLECTION
    assert movement.receipt_number.startswith("REC-")
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("500.00")
    entry = CustomerLedgerEntry.objects.get(
        customer=customer, entry_type=CustomerLedgerEntry.EntryType.COLLECTION
    )
    assert entry.credit == Decimal("500.00")


def test_collection_updates_sales_invoice_payment_status(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, customer, owner, product)  # total 1000
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("400"),
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("400")}],
    )
    inv.refresh_from_db()
    assert inv.amount_paid == Decimal("400.00")
    assert inv.balance_due == Decimal("600.00")
    assert inv.payment_status == SalesPaymentStatus.PARTIALLY_PAID
    assert inv.status == SalesStatus.PARTIALLY_PAID

    payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("600"),
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("600")}],
    )
    inv.refresh_from_db()
    assert inv.payment_status == SalesPaymentStatus.PAID
    assert inv.status == SalesStatus.PAID


def test_over_allocation_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, customer, owner, product)
    with pytest.raises(ValidationError):
        payment_services.record_customer_collection(
            company=company, customer=customer, amount=Decimal("100"),
            payment_method="cash", user=owner,
            allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("200")}],
        )


def test_collection_to_cancelled_invoice_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _approved_sale(company, customer, owner, product)
    sales_services.cancel_sales_invoice(invoice=inv, user=owner, reason="cancel")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        payment_services.record_customer_collection(
            company=company, customer=customer, amount=Decimal("100"),
            payment_method="cash", user=owner,
            allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("100")}],
        )


def test_customer_cross_tenant_rejected(company, owner, other_company):
    other_customer = _customer(other_company, phone="099")
    with pytest.raises(ValidationError):
        payment_services.record_customer_collection(
            company=company, customer=other_customer, amount=Decimal("100"),
            payment_method="cash", user=owner,
        )


# ── Supplier payments ───────────────────────────────────────────────────────
def test_supplier_payment_creates_movement_and_ledger(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PURP")
    inv = _approved_purchase(company, supplier, owner, product)
    movement = payment_services.record_supplier_payment(
        company=company, supplier=supplier, amount=Decimal("50"),
        payment_method="bank_transfer", user=owner,
        allocations=[{"purchase_invoice": inv, "allocated_amount": Decimal("50")}],
    )
    assert movement.receipt_number.startswith("PAY-")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("50.00")
    entry = SupplierLedgerEntry.objects.get(
        supplier=supplier, entry_type=SupplierLedgerEntry.EntryType.SUPPLIER_PAYMENT
    )
    assert entry.debit == Decimal("50.00")


def test_supplier_payment_updates_purchase_status(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PUR2")
    inv = _approved_purchase(company, supplier, owner, product)  # 100 total
    payment_services.record_supplier_payment(
        company=company, supplier=supplier, amount=Decimal("100"),
        payment_method="cash", user=owner,
        allocations=[{"purchase_invoice": inv, "allocated_amount": Decimal("100")}],
    )
    inv.refresh_from_db()
    assert inv.payment_status == "paid"
    assert inv.status == PurchaseStatus.PAID


def test_payment_to_cancelled_purchase_rejected(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PUR3")
    inv = _approved_purchase(company, supplier, owner, product)
    purchase_services.cancel_purchase_invoice(invoice=inv, user=owner, reason="x")
    with pytest.raises(ValidationError):
        payment_services.record_supplier_payment(
            company=company, supplier=supplier, amount=Decimal("50"),
            payment_method="cash", user=owner,
            allocations=[{"purchase_invoice": inv, "allocated_amount": Decimal("50")}],
        )


# ── Refunds ─────────────────────────────────────────────────────────────────
def test_customer_refund_requires_reason(company, owner):
    customer = customer_services.create_customer_with_opening_balance(
        company=company,
        name_ar="credit", phone="051", customer_type=CustomerType.CREDIT,
        opening_balance=Decimal("100"), opening_balance_type=OpeningBalanceType.WE_OWE_CUSTOMER,
    )
    with pytest.raises(ValidationError):
        payment_services.record_customer_refund(
            company=company, customer=customer, amount=Decimal("50"),
            payment_method="cash", user=owner, reason="",
        )


def test_customer_refund_with_credit_balance(company, owner):
    customer = customer_services.create_customer_with_opening_balance(
        company=company,
        name_ar="credit", phone="051", customer_type=CustomerType.CREDIT,
        opening_balance=Decimal("100"), opening_balance_type=OpeningBalanceType.WE_OWE_CUSTOMER,
    )
    movement = payment_services.record_customer_refund(
        company=company, customer=customer, amount=Decimal("100"),
        payment_method="cash", user=owner, reason="return overpayment",
    )
    assert movement.movement_type == PaymentMovementType.CUSTOMER_REFUND
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("0.00")


def test_supplier_refund_requires_reason(company, owner):
    supplier = _supplier(company)
    with pytest.raises(ValidationError):
        payment_services.record_supplier_refund(
            company=company, supplier=supplier, amount=Decimal("10"),
            payment_method="cash", user=owner, reason="",
        )


# ── Cancellation ────────────────────────────────────────────────────────────
def test_cancel_collection_requires_reason(company, owner):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("100"),
        payment_method="cash", user=owner,
    )
    with pytest.raises(ValidationError):
        payment_services.cancel_payment_movement(movement=movement, user=owner, reason="")


def test_cancel_collection_reverses_ledger_and_invoice(company, owner):
    customer = _customer(company)
    product = _product(company, sku="CAN1")
    inv = _approved_sale(company, customer, owner, product)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("300"),
        payment_method="cash", user=owner,
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("300")}],
    )
    payment_services.cancel_payment_movement(
        movement=movement, user=owner, reason="wrong amount"
    )
    customer.refresh_from_db()
    inv.refresh_from_db()
    movement.refresh_from_db()
    assert movement.status == PaymentMovementStatus.CANCELLED
    assert customer.current_balance == Decimal("1000.00")
    assert inv.amount_paid == Decimal("0.00")
    assert inv.payment_status == SalesPaymentStatus.UNPAID
    assert AuditLog.objects.filter(
        company=company, action="payment_cancel", reference_id=str(movement.id)
    ).exists()


def test_cancel_cannot_run_twice(company, owner):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("50"),
        payment_method="cash", user=owner,
    )
    payment_services.cancel_payment_movement(movement=movement, user=owner, reason="x")
    movement.refresh_from_db()
    with pytest.raises(ValidationError):
        payment_services.cancel_payment_movement(movement=movement, user=owner, reason="again")


# ── Print preview ───────────────────────────────────────────────────────────
def test_receipt_print_preview(company, owner):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("100"),
        payment_method="cash", user=owner,
    )
    preview = payment_services.build_receipt_preview(movement)
    assert preview["title_en"] == "RECEIPT VOUCHER"
    assert preview["title_ar"] == "سند قبض"
    assert preview["amount"] == "100.00"
    assert "company" in preview


# ── Reconciliation ────────────────────────────────────────────────────────────
def test_customer_reconciliation_matched(company, owner):
    customer = _customer(company)
    product = _product(company, sku="REC1")
    _approved_sale(company, customer, owner, product)
    result = payment_services.reconcile_customer_balance(company, customer)
    assert result["status"] == "matched"


# ── API / permissions ───────────────────────────────────────────────────────
def test_owner_can_create_collection(api, company, owner):
    customer = _customer(company)
    api.force_authenticate(owner)
    resp = api.post(COLLECTIONS_URL, {
        "customer": customer.id, "amount": "100", "payment_method": "cash",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["receipt_number"].startswith("REC-")


def test_accountant_can_create_but_not_cancel(api, company, owner, accountant):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("50"),
        payment_method="cash", user=owner,
    )
    api.force_authenticate(accountant)
    resp = api.post(f"{MOVEMENTS_URL}{movement.id}/cancel/", {"reason": "no"}, format="json")
    assert resp.status_code == 403


def test_cashier_can_create_collection(api, company, cashier):
    customer = _customer(company)
    api.force_authenticate(cashier)
    resp = api.post(COLLECTIONS_URL, {
        "customer": customer.id, "amount": "50", "payment_method": "cash",
    }, format="json")
    assert resp.status_code == 201


def test_cashier_cannot_create_supplier_payment(api, company, cashier):
    supplier = _supplier(company)
    api.force_authenticate(cashier)
    resp = api.post(PAYMENTS_URL, {
        "supplier": supplier.id, "amount": "50", "payment_method": "cash",
    }, format="json")
    assert resp.status_code == 403


def test_tenant_isolation(api, company, owner, other_owner):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("50"),
        payment_method="cash", user=owner,
    )
    api.force_authenticate(other_owner)
    resp = api.get(f"{MOVEMENTS_URL}{movement.id}/")
    assert resp.status_code == 404


def test_receipt_preview_cross_tenant(api, company, owner, other_owner):
    customer = _customer(company)
    movement = payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("50"),
        payment_method="cash", user=owner,
    )
    api.force_authenticate(other_owner)
    resp = api.get(f"/api/v1/tenant/receipts/{movement.id}/print-preview/")
    assert resp.status_code == 404
