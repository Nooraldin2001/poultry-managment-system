"""Sales invoice domain services (Phase 5).

Side-effect rules:
* create / recalculate — totals only, NO stock, NO customer ledger.
* approve — FIFO consumption + customer receivable (balance_due) + profit.
* cancel — return stock + reverse receivable posted on approval.
* collection adjustment — reduces customer balance only (no line edits).

Payment limitation: full collection receipts are deferred to the payments phase.
``amount_paid`` is stored on the invoice; ledger debit on approval is the unpaid
``balance_due`` only.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import (
    create_audit_log,
    require_reason_for_sensitive_action,
)
from apps.company_settings.constants import DocumentType
from apps.company_settings.models import VATSettings
from apps.company_settings.services import generate_document_number
from apps.customers.models import (
    Customer,
    CustomerFreeProductAgreement,
    CustomerSpecialPrice,
    CustomerType,
)
from apps.customers import services as customer_services
from apps.customers.models import CustomerCreditLimitChange
from apps.inventory import services as inventory_services
from apps.inventory.models import InventoryBalance, MovementType, StockSourceType
from apps.permissions.services import has_permission
from apps.products.models import Product
from apps.tenants.print_identity import (
    build_company_print_identity,
    build_sales_customer_party,
)

from . import calculations as calc
from .models import (
    SalesAdjustmentEffect,
    SalesAdjustmentType,
    SalesInventoryAllocation,
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesInvoiceLine,
    SalesLineType,
    SalesPaymentMethod,
    SalesPaymentStatus,
    SalesPriceSource,
    SalesStatus,
    SalesStatusHistory,
)

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


# ── Price resolution ────────────────────────────────────────────────────────
def _active_special_price(customer, product, price_type):
    return (
        CustomerSpecialPrice.objects.filter(
            company_id=customer.company_id,
            customer=customer, product=product, price_type=price_type,
            is_active=True,
        )
        .order_by("-id")
        .first()
    )


def _has_free_agreement(customer, product):
    return CustomerFreeProductAgreement.objects.filter(
        company_id=customer.company_id,
        customer=customer, product=product, is_active=True,
        agreement_type__in=[
            CustomerFreeProductAgreement.AgreementType.ALWAYS_FREE,
            CustomerFreeProductAgreement.AgreementType.FREE_WHEN_SELECTED,
        ],
    ).exists()


def resolve_line_pricing(*, customer, product, price_type, manual_price=None,
                         is_free=False, price_source=None, user=None):
    """Return (unit_price, price_source, is_free) for a sales line."""
    if product is None:
        return _d(manual_price or 0), price_source or SalesPriceSource.MANUAL_OVERRIDE, is_free

    if is_free or price_source == SalesPriceSource.FREE_PRODUCT:
        if not _has_free_agreement(customer, product):
            if not user or not has_permission(user, "sales.sensitive"):
                raise ValidationError(
                    {"is_free": "No active free-product agreement; override required."}
                )
        return ZERO, SalesPriceSource.FREE_PRODUCT, True

    if price_source == SalesPriceSource.MANUAL_OVERRIDE:
        if manual_price is None:
            manual_price = product.sales_price
        if not user or not has_permission(user, "sales.override_price"):
            raise ValidationError(
                {"unit_price": "Manual price override requires sales.override_price."}
            )
        if _d(manual_price) <= 0:
            raise ValidationError(
                {"unit_price": "Overridden price must be greater than zero."}
            )
        return _d(manual_price), SalesPriceSource.MANUAL_OVERRIDE, False

    special = _active_special_price(customer, product, price_type)
    if special:
        return _d(special.price), SalesPriceSource.CUSTOMER_SPECIAL_PRICE, False

    return _d(product.sales_price or 0), SalesPriceSource.DEFAULT_PRODUCT_PRICE, False


def get_sales_price_history(*, company, customer, product, limit=10):
    """Real previous prices for a customer+product (no fabricated data).

    Sources, most recent first:
    * previous non-cancelled sales invoice lines (deduped by price+price_type),
    * active customer special prices,
    * current default product sales price.
    """
    _check_customer(company, customer)
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})

    items = []
    seen = set()

    lines = (
        SalesInvoiceLine.objects.filter(
            company=company, invoice__customer=customer, product=product,
        )
        .exclude(invoice__status=SalesStatus.CANCELLED)
        .exclude(is_free=True)
        .select_related("invoice")
        .order_by("-invoice__invoice_date", "-id")
    )
    for line in lines:
        key = (str(_d(line.unit_price)), line.price_type)
        if key in seen:
            continue
        seen.add(key)
        items.append({
            "price": str(_d(line.unit_price)),
            "price_type": line.price_type,
            "source": "previous_invoice",
            "invoice_number": line.invoice.invoice_number,
            "date": str(line.invoice.invoice_date),
        })
        if len(items) >= limit:
            break

    specials = CustomerSpecialPrice.objects.filter(
        company_id=company.id, customer=customer, product=product, is_active=True,
    ).order_by("-id")
    for sp in specials:
        items.append({
            "price": str(_d(sp.price)),
            "price_type": sp.price_type,
            "source": "customer_special_price",
            "invoice_number": None,
            "date": str(sp.created_at.date()) if getattr(sp, "created_at", None) else None,
        })

    if _d(product.sales_price or 0) > 0:
        items.append({
            "price": str(_d(product.sales_price)),
            "price_type": product.sales_price_type or "kg",
            "source": "default_product_price",
            "invoice_number": None,
            "date": None,
        })
    return items


def price_preview(*, company, customer, product, price_type):
    _check_customer(company, customer)
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    unit_price, source, is_free = resolve_line_pricing(
        customer=customer, product=product, price_type=price_type,
    )
    return {
        "unit_price": unit_price,
        "price_source": source,
        "is_free": is_free,
        "price_type": price_type,
    }


# ── Validation ──────────────────────────────────────────────────────────────
def _check_customer(company, customer):
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})


def _resolve_product(company, product, line_type):
    if line_type in (SalesLineType.SERVICE, SalesLineType.OTHER):
        return product
    if product is None:
        raise ValidationError({"product": "Product is required for this line type."})
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if not product.can_sell:
        raise ValidationError({"product": "This product is not sellable."})
    return product


def _line_money(*, price_type, unit_price, cartons, pieces, kg, vat_rate, is_free=False,
                discount=ZERO):
    subtotal = calc.line_subtotal(
        price_type=price_type, unit_price=unit_price,
        quantity_cartons=cartons, quantity_pieces=pieces, quantity_kg=kg,
        is_free=is_free,
    )
    taxable = max(subtotal - _d(discount), ZERO).quantize(MONEY_Q)
    vat = calc.vat_amount(taxable, vat_rate)
    return subtotal, taxable, vat, (taxable + vat).quantize(MONEY_Q)


def _invoice_discount_total(adjustments) -> Decimal:
    total = ZERO
    for adj in adjustments:
        if adj.effect == SalesAdjustmentEffect.REDUCE_INVOICE_TOTAL:
            total += _d(adj.amount)
    return total


def _apply_payment_state(invoice):
    total = _d(invoice.total_amount)
    paid = _d(invoice.amount_paid)
    invoice.balance_due = max(total - paid, ZERO).quantize(MONEY_Q)
    if paid <= 0:
        invoice.payment_status = SalesPaymentStatus.UNPAID
    elif paid < total:
        invoice.payment_status = SalesPaymentStatus.PARTIALLY_PAID
    else:
        invoice.payment_status = SalesPaymentStatus.PAID

    if invoice.status in (
        SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID
    ):
        if invoice.payment_status == SalesPaymentStatus.PAID:
            invoice.status = SalesStatus.PAID
        elif invoice.payment_status == SalesPaymentStatus.PARTIALLY_PAID:
            invoice.status = SalesStatus.PARTIALLY_PAID
        else:
            invoice.status = SalesStatus.APPROVED


def _record_status_history(invoice, from_status, to_status, reason, user):
    SalesStatusHistory.objects.create(
        company_id=invoice.company_id,
        invoice=invoice,
        from_status=from_status or "",
        to_status=to_status,
        reason=reason or "",
        changed_by=user,
    )


# ── Recalculate ─────────────────────────────────────────────────────────────
def recalculate_sales_invoice(invoice) -> SalesInvoice:
    lines = list(invoice.lines.all())
    adjustments = list(invoice.adjustments.all())

    subtotal = ZERO
    line_discount = ZERO
    vat_sum = ZERO
    for line in lines:
        sub, taxable, vat, total = _line_money(
            price_type=line.price_type, unit_price=line.unit_price,
            cartons=line.quantity_cartons, pieces=line.quantity_pieces,
            kg=line.quantity_kg, vat_rate=line.vat_rate,
            is_free=line.is_free, discount=line.discount_amount,
        )
        line.line_subtotal = sub
        line.taxable_amount = taxable
        line.vat_amount = vat
        line.line_total = total
        if not line.is_free and invoice.status == SalesStatus.DRAFT:
            line.gross_profit = ZERO
            line.fifo_cost_consumed = ZERO
        line.save(update_fields=[
            "line_subtotal", "taxable_amount", "vat_amount", "line_total",
            "gross_profit", "fifo_cost_consumed", "updated_at",
        ])
        subtotal += sub
        line_discount += _d(line.discount_amount)
        vat_sum += vat

    inv_discount = _invoice_discount_total(adjustments)
    invoice.subtotal = subtotal.quantize(MONEY_Q)
    invoice.discount_total = (line_discount + inv_discount).quantize(MONEY_Q)
    taxable = max(subtotal - inv_discount - line_discount, ZERO).quantize(MONEY_Q)
    invoice.taxable_amount = taxable

    if _d(invoice.vat_rate) > 0:
        invoice.vat_amount = calc.vat_amount(taxable, invoice.vat_rate)
    else:
        invoice.vat_amount = vat_sum.quantize(MONEY_Q)

    invoice.total_amount = (taxable + invoice.vat_amount).quantize(MONEY_Q)

    if _d(invoice.amount_paid) > _d(invoice.total_amount):
        raise ValidationError({"amount_paid": "Amount paid cannot exceed total."})

    _apply_payment_state(invoice)

    if invoice.status == SalesStatus.DRAFT:
        invoice.fifo_cost_total = ZERO
        invoice.gross_profit = ZERO
    else:
        fifo_total = sum((_d(l.fifo_cost_consumed) for l in lines), ZERO)
        invoice.fifo_cost_total = fifo_total.quantize(MONEY_Q)
        invoice.gross_profit = calc.gross_profit(
            revenue=invoice.total_amount, fifo_cost=invoice.fifo_cost_total
        )

    invoice.save(update_fields=[
        "subtotal", "discount_total", "taxable_amount", "vat_amount",
        "total_amount", "amount_paid", "balance_due", "payment_status", "status",
        "fifo_cost_total", "gross_profit", "updated_at",
    ])
    return invoice


# ── Create ──────────────────────────────────────────────────────────────────
@transaction.atomic
def create_sales_invoice(*, company, customer, created_by, invoice_date, lines,
                           adjustments=None, due_date=None, payment_method=None,
                           vat_rate=None, amount_paid=ZERO, notes="",
                           invoice_number=None, preserve_pricing=False):
    _check_customer(company, customer)
    adjustments = adjustments or []

    if vat_rate is None:
        vat_settings = VATSettings.objects.filter(company=company).first()
        vat_rate = vat_settings.default_vat_rate if vat_settings else ZERO

    if not invoice_number:
        invoice_number = generate_document_number(company, DocumentType.SALES_INVOICE)

    invoice = SalesInvoice.objects.create(
        company=company,
        customer=customer,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        due_date=due_date,
        status=SalesStatus.DRAFT,
        payment_status=SalesPaymentStatus.UNPAID,
        payment_method=payment_method or SalesPaymentMethod.CREDIT,
        vat_rate=_d(vat_rate),
        amount_paid=_d(amount_paid),
        notes=notes or "",
        customer_name_snapshot=customer.name_ar,
        customer_trn_snapshot=customer.trn or "",
        customer_phone_snapshot=customer.phone or "",
        customer_address_snapshot=customer.address or "",
        created_by=created_by,
        updated_by=created_by,
    )

    for index, line in enumerate(lines):
        _create_line(
            company, invoice, customer, line, default_sort=index,
            user=created_by, preserve_pricing=preserve_pricing,
        )
    for adj in adjustments:
        _create_adjustment(company, invoice, adj, created_by=created_by)

    recalculate_sales_invoice(invoice)
    _record_status_history(invoice, "", SalesStatus.DRAFT, "", created_by)
    return invoice


def _create_line(company, invoice, customer, data, *, default_sort=0, user=None,
                 preserve_pricing=False):
    line_type = data.get("line_type", SalesLineType.PRODUCT)
    product = _resolve_product(company, data.get("product"), line_type)
    price_type = data.get("price_type", product.sales_price_type if product else "kg")
    is_free = bool(data.get("is_free", False))
    price_source = data.get("price_source")
    if preserve_pricing:
        unit_price = _d(data.get("unit_price", 0))
        price_source = price_source or SalesPriceSource.DEFAULT_PRODUCT_PRICE
        is_free = bool(data.get("is_free", False))
    else:
        unit_price, price_source, is_free = resolve_line_pricing(
            customer=customer, product=product, price_type=price_type,
            manual_price=data.get("unit_price") if price_source == SalesPriceSource.MANUAL_OVERRIDE else None,
            is_free=is_free,
            price_source=price_source, user=user,
        )
    for label, val in (
        ("quantity_cartons", data.get("quantity_cartons")),
        ("quantity_pieces", data.get("quantity_pieces")),
        ("quantity_kg", data.get("quantity_kg")),
    ):
        if _d(val) < 0:
            raise ValidationError({label: "Quantity cannot be negative."})
    if unit_price < 0:
        raise ValidationError({"unit_price": "Unit price cannot be negative."})
    if price_source == SalesPriceSource.MANUAL_OVERRIDE and user:
        create_audit_log(
            action="override_sales_price",
            user=user, company=company, module="sales",
            reference_type="sales_invoice", reference_id=invoice.id,
            reason=data.get("override_reason", ""),
            new_value={"product_id": product.id if product else None, "unit_price": str(unit_price)},
        )
    return SalesInvoiceLine.objects.create(
        company=company,
        invoice=invoice,
        product=product,
        product_name_snapshot=(product.name_ar if product else data.get("product_name_snapshot", "")),
        product_sku_snapshot=(product.sku if product else data.get("product_sku_snapshot", "")),
        line_type=line_type,
        quantity_cartons=_d(data.get("quantity_cartons")),
        quantity_pieces=_d(data.get("quantity_pieces")),
        quantity_kg=_d(data.get("quantity_kg")),
        unit_price=unit_price,
        price_type=price_type,
        price_source=price_source,
        is_free=is_free,
        free_reason=data.get("free_reason", ""),
        discount_amount=_d(data.get("discount_amount")),
        vat_rate=_d(data.get("vat_rate", invoice.vat_rate)),
        notes=data.get("notes", ""),
        sort_order=data.get("sort_order", default_sort),
    )


def _create_adjustment(company, invoice, data, *, created_by=None):
    amount = _d(data.get("amount"))
    if amount < 0:
        raise ValidationError({"amount": "Adjustment amount cannot be negative."})
    return SalesInvoiceAdjustment.objects.create(
        company=company,
        invoice=invoice,
        adjustment_type=data["adjustment_type"],
        title=data.get("title", ""),
        amount=amount,
        effect=data["effect"],
        reason=data.get("reason", ""),
        notes=data.get("notes", ""),
        created_by=created_by,
    )


# ── Credit limit ────────────────────────────────────────────────────────────
def _validate_credit_limit(*, customer, balance_due, user, credit_override=None):
    if balance_due <= 0:
        return
    if customer.customer_type == CustomerType.CASH:
        return
    if not customer.block_sales_when_credit_exceeded:
        return

    projected = _d(customer.current_balance) + _d(balance_due)
    if projected <= _d(customer.credit_limit):
        return

    if credit_override and credit_override.get("allowed"):
        reason = (credit_override.get("reason") or "").strip()
        if not reason:
            raise ValidationError({"reason": "Credit override requires a reason."})
        if not has_permission(user, "sales.credit_override"):
            raise ValidationError("Missing permission: sales.credit_override")
        return reason

    raise ValidationError(
        "Customer credit limit would be exceeded. Provide an authorized override."
    )


def _validate_cash_customer_payment(customer, total_amount, amount_paid):
    if customer.customer_type != CustomerType.CASH:
        return
    if _d(amount_paid) < _d(total_amount):
        raise ValidationError(
            {"amount_paid": "Cash customers must pay the full invoice amount at approval."}
        )


# ── Stock check ─────────────────────────────────────────────────────────────
def check_stock_availability(*, company, product, cartons=ZERO, pieces=ZERO, kg=ZERO):
    balance = InventoryBalance.objects.filter(company=company, product=product).first()
    if balance is None:
        return {
            "available": False,
            "available_cartons": ZERO,
            "available_pieces": ZERO,
            "available_kg": ZERO,
        }
    ok = (
        balance.available_cartons >= _d(cartons)
        and balance.available_pieces >= _d(pieces)
        and balance.available_kg >= _d(kg)
    )
    return {
        "available": ok,
        "available_cartons": balance.available_cartons,
        "available_pieces": balance.available_pieces,
        "available_kg": balance.available_kg,
    }


# ── Approval ────────────────────────────────────────────────────────────────
@transaction.atomic
def approve_sales_invoice(*, invoice, user, reason, credit_override=None) -> SalesInvoice:
    reason = require_reason_for_sensitive_action("approve_sales_invoice", reason)

    invoice = (
        SalesInvoice.objects.select_for_update()
        .select_related("customer")
        .get(pk=invoice.pk)
    )
    if invoice.status != SalesStatus.DRAFT:
        raise ValidationError("Only a draft sales invoice can be approved.")

    company = invoice.company
    customer = Customer.objects.select_for_update().get(pk=invoice.customer_id)
    _check_customer(company, customer)

    lines = list(invoice.lines.select_related("product").all())
    if not lines:
        raise ValidationError("Cannot approve a sales invoice without lines.")

    recalculate_sales_invoice(invoice)
    lines = list(invoice.lines.select_related("product").all())

    _validate_cash_customer_payment(customer, invoice.total_amount, invoice.amount_paid)
    override_reason = _validate_credit_limit(
        customer=customer, balance_due=invoice.balance_due,
        user=user, credit_override=credit_override,
    )

    fifo_total = ZERO
    for line in lines:
        if not line.is_stock_tracked or not line.has_quantity:
            continue
        movement, allocations = inventory_services.consume_stock_fifo_detailed(
            company=company,
            product=line.product,
            cartons=line.quantity_cartons,
            pieces=line.quantity_pieces,
            kg=line.quantity_kg,
            reference_type="sales_invoice",
            reference_id=invoice.id,
            reference_number=invoice.invoice_number,
            reason=reason,
            user=user,
            movement_type=MovementType.SALES_APPROVED,
        )
        line_cost = _d(movement.fifo_cost_consumed)
        fifo_total += line_cost
        line.fifo_cost_consumed = line_cost
        line.gross_profit = calc.gross_profit(
            revenue=line.line_total, fifo_cost=line_cost
        )
        line.save(update_fields=[
            "fifo_cost_consumed", "gross_profit", "updated_at",
        ])
        for alloc in allocations:
            SalesInventoryAllocation.objects.create(
                company=company,
                invoice=invoice,
                invoice_line=line,
                product=line.product,
                fifo_layer=alloc["fifo_layer"],
                quantity_kg=alloc["quantity_kg"],
                quantity_cartons=alloc["quantity_cartons"],
                quantity_pieces=alloc["quantity_pieces"],
                unit_cost_per_kg=alloc["unit_cost_per_kg"],
                cost_amount=alloc["cost_amount"],
            )

    invoice.fifo_cost_total = fifo_total.quantize(MONEY_Q)
    invoice.gross_profit = calc.gross_profit(
        revenue=invoice.total_amount, fifo_cost=invoice.fifo_cost_total
    )

    invoice.customer_name_snapshot = customer.name_ar
    invoice.customer_trn_snapshot = customer.trn or ""
    invoice.customer_phone_snapshot = customer.phone or ""
    invoice.customer_address_snapshot = customer.address or ""

    receivable = _d(invoice.balance_due)
    invoice.posted_receivable = receivable
    invoice.credit_limit_snapshot = customer.credit_limit
    if override_reason:
        invoice.credit_limit_override_used = True
        invoice.credit_limit_override_reason = override_reason
        customer_services.change_customer_credit_limit(
            customer=customer,
            new_limit=customer.credit_limit,
            change_type=CustomerCreditLimitChange.ChangeType.TEMPORARY_FOR_INVOICE,
            reason=override_reason,
            changed_by=user,
            related_reference_type="sales_invoice",
            related_reference_id=invoice.id,
        )

    customer_services.record_sales_invoice(
        customer=customer,
        amount=receivable,
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        created_by=user,
        reason=reason,
        entry_date=invoice.invoice_date,
    )

    from_status = invoice.status
    invoice.status = SalesStatus.APPROVED
    invoice.approval_reason = reason
    invoice.approved_by = user
    invoice.approved_at = timezone.now()
    _apply_payment_state(invoice)
    invoice.save(update_fields=[
        "status", "approval_reason", "approved_by", "approved_at",
        "customer_name_snapshot", "customer_trn_snapshot",
        "customer_phone_snapshot", "customer_address_snapshot",
        "fifo_cost_total", "gross_profit", "posted_receivable",
        "credit_limit_snapshot", "credit_limit_override_used",
        "credit_limit_override_reason", "payment_status", "balance_due",
        "updated_at",
    ])
    _record_status_history(invoice, from_status, invoice.status, reason, user)

    create_audit_log(
        action="approve_sales_invoice",
        user=user, company=company, module="sales",
        reference_type="sales_invoice", reference_id=invoice.id,
        reason=reason,
        new_value={"invoice_number": invoice.invoice_number, "total": str(invoice.total_amount)},
    )
    return invoice


# ── Cancellation ────────────────────────────────────────────────────────────
@transaction.atomic
def cancel_sales_invoice(*, invoice, user, reason) -> SalesInvoice:
    reason = require_reason_for_sensitive_action("cancel_sales_invoice", reason)

    invoice = (
        SalesInvoice.objects.select_for_update()
        .select_related("customer")
        .get(pk=invoice.pk)
    )
    if invoice.status == SalesStatus.CANCELLED:
        raise ValidationError("Invoice is already cancelled.")

    company = invoice.company
    from_status = invoice.status

    if invoice.status == SalesStatus.DRAFT:
        invoice.status = SalesStatus.CANCELLED
        invoice.cancel_reason = reason
        invoice.cancelled_by = user
        invoice.cancelled_at = timezone.now()
        invoice.save(update_fields=[
            "status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at",
        ])
        _record_status_history(invoice, from_status, SalesStatus.CANCELLED, reason, user)
        create_audit_log(
            action="cancel_sales_invoice", user=user, company=company,
            module="sales", reference_type="sales_invoice", reference_id=invoice.id,
            reason=reason, previous_value={"status": from_status},
            new_value={"status": SalesStatus.CANCELLED},
        )
        return invoice

    customer = Customer.objects.select_for_update().get(pk=invoice.customer_id)

    allocations = list(
        invoice.inventory_allocations.select_related("product", "fifo_layer").all()
    )
    for alloc in allocations:
        inventory_services.add_stock(
            company=company,
            product=alloc.product,
            cartons=alloc.quantity_cartons,
            pieces=alloc.quantity_pieces,
            kg=alloc.quantity_kg,
            unit_cost_per_kg=alloc.unit_cost_per_kg,
            source_type=StockSourceType.SALES_INVOICE,
            source_id=invoice.id,
            source_reference=f"{invoice.invoice_number}-cancel",
            reason=reason,
            user=user,
            movement_type=MovementType.SALES_CANCELLED,
        )

    posted = _d(invoice.posted_receivable)
    customer_services.reverse_sales_invoice(
        customer=customer,
        amount=posted,
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        created_by=user,
        reason=reason,
        entry_date=timezone.now().date(),
    )

    invoice.status = SalesStatus.CANCELLED
    invoice.cancel_reason = reason
    invoice.cancelled_by = user
    invoice.cancelled_at = timezone.now()
    invoice.save(update_fields=[
        "status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at",
    ])
    _record_status_history(invoice, from_status, SalesStatus.CANCELLED, reason, user)
    create_audit_log(
        action="cancel_sales_invoice", user=user, company=company,
        module="sales", reference_type="sales_invoice", reference_id=invoice.id,
        reason=reason, previous_value={"status": from_status},
        new_value={"status": SalesStatus.CANCELLED},
    )
    return invoice


# ── Collection adjustment foundation ────────────────────────────────────────
@transaction.atomic
def create_collection_adjustment(*, invoice, user, amount, reason,
                               adjustment_type=SalesAdjustmentType.COLLECTION_ADJUSTMENT):
    reason = require_reason_for_sensitive_action("collection_adjustment", reason)
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})

    invoice = SalesInvoice.objects.select_for_update().select_related("customer").get(
        pk=invoice.pk
    )
    if invoice.status not in (
        SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID
    ):
        raise ValidationError("Collection adjustments apply to approved invoices only.")

    customer = Customer.objects.select_for_update().get(pk=invoice.customer_id)
    adj = SalesInvoiceAdjustment.objects.create(
        company_id=invoice.company_id,
        invoice=invoice,
        adjustment_type=adjustment_type,
        title="Collection adjustment",
        amount=amount,
        effect=SalesAdjustmentEffect.REDUCE_CUSTOMER_BALANCE,
        reason=reason,
        created_by=user,
    )
    customer_services.record_collection_adjustment(
        customer=customer,
        amount=amount,
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        created_by=user,
        reason=reason,
    )
    create_audit_log(
        action="collection_adjustment", user=user, company=invoice.company,
        module="sales", reference_type="sales_invoice", reference_id=invoice.id,
        reason=reason, new_value={"amount": str(amount), "adjustment_id": adj.id},
    )
    return adj


# ── Reporting ───────────────────────────────────────────────────────────────
def get_sales_summary(company) -> dict:
    today = timezone.now().date()
    month_start = today.replace(day=1)
    qs = SalesInvoice.objects.filter(company=company).exclude(
        status=SalesStatus.CANCELLED
    )
    approved = qs.filter(
        status__in=[SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID]
    )
    month_sales = approved.filter(invoice_date__gte=month_start).aggregate(
        total=Sum("total_amount")
    )["total"] or ZERO
    return {
        "total_sales_this_month": month_sales,
        "approved_count": approved.count(),
        "draft_count": qs.filter(status=SalesStatus.DRAFT).count(),
        "unpaid_balance": qs.filter(balance_due__gt=0).aggregate(
            s=Sum("balance_due")
        )["s"] or ZERO,
        "customer_receivable_total": Customer.objects.filter(
            company=company, current_balance__gt=0
        ).aggregate(s=Sum("current_balance"))["s"] or ZERO,
        "sales_vat_total": approved.filter(invoice_date__gte=month_start).aggregate(
            s=Sum("vat_amount")
        )["s"] or ZERO,
        "gross_profit_estimate": approved.filter(invoice_date__gte=month_start).aggregate(
            s=Sum("gross_profit")
        )["s"] or ZERO,
    }


def get_customer_sales_history(company, customer):
    _check_customer(company, customer)
    return SalesInvoice.objects.filter(
        company=company, customer=customer
    ).exclude(status=SalesStatus.CANCELLED).order_by("-invoice_date", "-id")


# ── Print preview ───────────────────────────────────────────────────────────
def build_print_preview(invoice, request=None) -> dict:
    from apps.company_settings.services import build_invoice_branding

    company = invoice.company
    lines = list(invoice.lines.all().order_by("sort_order", "id"))
    customer_party = build_sales_customer_party(invoice)
    return {
        "title_en": "TAX INVOICE",
        "title_ar": "فاتورة ضريبية",
        "branding": build_invoice_branding(company),
        "company": build_company_print_identity(company, request),
        "customer": customer_party,
        "party": customer_party,
        "invoice": {
            "number": invoice.invoice_number,
            "invoice_number": invoice.invoice_number,
            "date": str(invoice.invoice_date),
            "due_date": str(invoice.due_date) if invoice.due_date else None,
            "status": invoice.status,
            "notes": invoice.notes,
            "title_ar": "فاتورة ضريبية",
            "title_en": "Tax Invoice",
        },
        "lines": [
            {
                "product_name": ln.product_name_snapshot,
                "sku": ln.product_sku_snapshot,
                "quantity_cartons": str(ln.quantity_cartons),
                "quantity_pieces": str(ln.quantity_pieces),
                "quantity_kg": str(ln.quantity_kg),
                "unit_price": str(ln.unit_price),
                "line_total": str(ln.line_total),
                "is_free": ln.is_free,
            }
            for ln in lines
        ],
        "totals": {
            "subtotal": str(invoice.subtotal),
            "discount_total": str(invoice.discount_total),
            "taxable_amount": str(invoice.taxable_amount),
            "vat_rate": str(invoice.vat_rate),
            "vat_amount": str(invoice.vat_amount),
            "total_amount": str(invoice.total_amount),
            "amount_paid": str(invoice.amount_paid),
            "balance_due": str(invoice.balance_due),
        },
        "prepared_by": invoice.created_by.full_name if invoice.created_by else "",
        "approved_by": invoice.approved_by.full_name if invoice.approved_by else "",
    }
