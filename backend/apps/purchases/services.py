"""Purchase invoice domain services (Phase 4).

All purchase business logic lives here, not in views. Money mutations and stock
side effects run inside ``transaction.atomic`` so the invoice, supplier ledger
and inventory layers commit together.

Side-effect rules:
* ``create_purchase_invoice`` / ``recalculate_purchase_invoice`` — totals only,
  NO stock, NO supplier ledger.
* ``approve_purchase_invoice`` — adds stock (FIFO) via the inventory service and
  posts a supplier payable ledger entry for the full ``total_amount``.
* ``cancel_purchase_invoice`` — reverses the supplier ledger and reverses
  inventory only if the purchase's FIFO layers are still fully intact.

Supplier-payment ledger limitation: approval always posts the *gross* payable
(``total_amount``). ``amount_paid`` is stored on the invoice but the matching
supplier-payment ledger entry is deferred to the payments phase. So for a cash
purchase the supplier balance shows the gross payable until payments are built.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import (
    create_audit_log,
    require_reason_for_sensitive_action,
)
from apps.company_settings.constants import DocumentType
from apps.company_settings.services import generate_document_number
from apps.inventory import services as inventory_services
from apps.inventory.models import MovementType, StockSourceType
from apps.inventory.services import StockConsumedError
from apps.suppliers.models import Supplier
from apps.suppliers import services as supplier_services

from . import calculations as calc
from .models import (
    PurchaseAdjustment,
    PurchaseAdjustmentEffect,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseLineType,
    PurchasePaymentStatus,
    PurchaseStatus,
    PurchaseStatusHistory,
)

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")

STOCK_CONSUMED_MESSAGE = (
    "Cannot cancel purchase because stock from this purchase has already been "
    "consumed."
)


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


# ── Validation helpers ──────────────────────────────────────────────────────
def _check_supplier(company, supplier):
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})


def _resolve_product(company, product, line_type):
    """Validate/return a product for a line (None allowed for service/other)."""
    if line_type in (PurchaseLineType.SERVICE, PurchaseLineType.OTHER):
        if product is None:
            return None
    if product is None:
        raise ValidationError({"product": "Product is required for this line type."})
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if not product.can_purchase:
        raise ValidationError({"product": "This product is not purchasable."})
    return product


def _line_money(*, price_type, unit_price, cartons, pieces, kg, vat_rate):
    subtotal = calc.line_subtotal(
        price_type=price_type, unit_price=unit_price,
        quantity_cartons=cartons, quantity_pieces=pieces, quantity_kg=kg,
    )
    vat = calc.vat_amount(subtotal, vat_rate)
    return subtotal, vat, (subtotal + vat).quantize(MONEY_Q)


# ── Recalculation ───────────────────────────────────────────────────────────
def _payable_adjustment_total(adjustments) -> Decimal:
    """Net payable impact of adjustments (deductions are negative)."""
    total = ZERO
    for adj in adjustments:
        if adj.effect == PurchaseAdjustmentEffect.REDUCE_SUPPLIER_PAYABLE:
            total -= _d(adj.amount)
    return total


def _inventory_cost_extra(adjustments) -> Decimal:
    """Sum of adjustments that increase the inventory (FIFO) cost basis."""
    return sum(
        (_d(a.amount) for a in adjustments
         if a.effect == PurchaseAdjustmentEffect.INCREASE_INVENTORY_COST),
        ZERO,
    )


def _apply_payment_state(invoice):
    """Derive payment_status (and post-approval status) from amount_paid."""
    total = _d(invoice.total_amount)
    paid = _d(invoice.amount_paid)
    invoice.balance_due = (total - paid).quantize(MONEY_Q)
    if paid <= 0:
        invoice.payment_status = PurchasePaymentStatus.UNPAID
    elif paid < total:
        invoice.payment_status = PurchasePaymentStatus.PARTIALLY_PAID
    else:
        invoice.payment_status = PurchasePaymentStatus.PAID

    # Reflect payment on the workflow status only once approved (never override
    # draft or cancelled).
    if invoice.status in (
        PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID, PurchaseStatus.PAID
    ):
        if invoice.payment_status == PurchasePaymentStatus.PAID:
            invoice.status = PurchaseStatus.PAID
        elif invoice.payment_status == PurchasePaymentStatus.PARTIALLY_PAID:
            invoice.status = PurchaseStatus.PARTIALLY_PAID
        else:
            invoice.status = PurchaseStatus.APPROVED


def recalculate_purchase_invoice(invoice) -> PurchaseInvoice:
    """Recompute line totals, adjustment totals, VAT, totals and balance due."""
    lines = list(invoice.lines.all())
    adjustments = list(invoice.adjustments.all())

    subtotal = ZERO
    for line in lines:
        line.line_subtotal, line.vat_amount, line.line_total = _line_money(
            price_type=line.price_type, unit_price=line.unit_price,
            cartons=line.quantity_cartons, pieces=line.quantity_pieces,
            kg=line.quantity_kg, vat_rate=line.vat_rate,
        )
        line.save(update_fields=["line_subtotal", "vat_amount", "line_total", "updated_at"])
        subtotal += line.line_subtotal

    payable_adjustment = _payable_adjustment_total(adjustments)
    inventory_extra = _inventory_cost_extra(adjustments)

    taxable = (subtotal + payable_adjustment)
    if taxable < 0:
        taxable = ZERO
    taxable = taxable.quantize(MONEY_Q)

    if _d(invoice.vat_rate) > 0:
        vat = calc.vat_amount(taxable, invoice.vat_rate)
    else:
        vat = sum((_d(line.vat_amount) for line in lines), ZERO).quantize(MONEY_Q)

    invoice.subtotal = subtotal.quantize(MONEY_Q)
    invoice.adjustment_total = payable_adjustment.quantize(MONEY_Q)
    invoice.taxable_amount = taxable
    invoice.vat_amount = vat
    invoice.total_amount = (taxable + vat).quantize(MONEY_Q)
    invoice.inventory_cost_total = (subtotal + inventory_extra).quantize(MONEY_Q)

    if _d(invoice.amount_paid) > _d(invoice.total_amount):
        raise ValidationError(
            {"amount_paid": "Amount paid cannot exceed the invoice total."}
        )

    _apply_payment_state(invoice)
    invoice.save(update_fields=[
        "subtotal", "adjustment_total", "taxable_amount", "vat_amount",
        "total_amount", "inventory_cost_total", "amount_paid", "balance_due",
        "payment_status", "status", "updated_at",
    ])
    return invoice


# ── Create ──────────────────────────────────────────────────────────────────
@transaction.atomic
def create_purchase_invoice(*, company, supplier, created_by, invoice_date,
                            lines, adjustments=None, supplier_invoice_number="",
                            due_date=None, payment_method=None, vat_rate=ZERO,
                            amount_paid=ZERO, notes="", invoice_number=None):
    """Create a DRAFT purchase invoice with its lines and adjustments.

    No stock and no supplier ledger effects — those happen only on approval.
    """
    _check_supplier(company, supplier)
    adjustments = adjustments or []

    if not invoice_number:
        invoice_number = generate_document_number(
            company, DocumentType.PURCHASE_INVOICE
        )

    invoice = PurchaseInvoice.objects.create(
        company=company,
        supplier=supplier,
        invoice_number=invoice_number,
        supplier_invoice_number=supplier_invoice_number or "",
        invoice_date=invoice_date,
        due_date=due_date,
        status=PurchaseStatus.DRAFT,
        payment_status=PurchasePaymentStatus.UNPAID,
        payment_method=payment_method or PurchaseInvoice._meta.get_field(
            "payment_method"
        ).default,
        vat_rate=_d(vat_rate),
        amount_paid=_d(amount_paid),
        notes=notes or "",
        supplier_name_snapshot=supplier.name_ar,
        supplier_trn_snapshot=supplier.trn or "",
        created_by=created_by,
        updated_by=created_by,
    )

    for index, line in enumerate(lines):
        _create_line(company, invoice, line, default_sort=index)
    for adj in adjustments:
        _create_adjustment(company, invoice, adj, created_by=created_by)

    recalculate_purchase_invoice(invoice)
    _record_status_history(invoice, "", PurchaseStatus.DRAFT, "", created_by)
    return invoice


def _create_line(company, invoice, data, *, default_sort=0) -> PurchaseInvoiceLine:
    line_type = data.get("line_type", PurchaseLineType.PRODUCT)
    product = _resolve_product(company, data.get("product"), line_type)
    return PurchaseInvoiceLine.objects.create(
        company=company,
        invoice=invoice,
        product=product,
        product_name_snapshot=(product.name_ar if product else data.get("product_name_snapshot", "")),
        product_sku_snapshot=(product.sku if product else data.get("product_sku_snapshot", "")),
        line_type=line_type,
        quantity_cartons=_d(data.get("quantity_cartons")),
        quantity_pieces=_d(data.get("quantity_pieces")),
        quantity_kg=_d(data.get("quantity_kg")),
        unit_price=_d(data.get("unit_price")),
        price_type=data.get("price_type", product.purchase_price_type if product else "kg"),
        vat_rate=_d(data.get("vat_rate")),
        notes=data.get("notes", ""),
        sort_order=data.get("sort_order", default_sort),
    )


def _create_adjustment(company, invoice, data, *, created_by=None) -> PurchaseAdjustment:
    amount = _d(data.get("amount"))
    if amount < 0:
        raise ValidationError({"amount": "Adjustment amount cannot be negative."})
    vat_rate = _d(data.get("vat_rate"))
    return PurchaseAdjustment.objects.create(
        company=company,
        invoice=invoice,
        adjustment_type=data["adjustment_type"],
        effect=data["effect"],
        title=data.get("title", ""),
        amount=amount,
        vat_rate=vat_rate,
        vat_amount=calc.vat_amount(amount, vat_rate),
        notes=data.get("notes", ""),
        created_by=created_by,
    )


# ── Approval ────────────────────────────────────────────────────────────────
@transaction.atomic
def approve_purchase_invoice(*, invoice, user, reason) -> PurchaseInvoice:
    """Approve a draft invoice: add FIFO stock + post supplier payable."""
    reason = require_reason_for_sensitive_action("approve_purchase_invoice", reason)

    invoice = (
        PurchaseInvoice.objects.select_for_update()
        .select_related("supplier")
        .get(pk=invoice.pk)
    )
    if invoice.status != PurchaseStatus.DRAFT:
        raise ValidationError("Only a draft purchase invoice can be approved.")

    company = invoice.company
    _check_supplier(company, invoice.supplier)

    lines = list(invoice.lines.select_related("product").all())
    if not lines:
        raise ValidationError("Cannot approve a purchase invoice without lines.")

    recalculate_purchase_invoice(invoice)
    lines = list(invoice.lines.select_related("product").all())

    # Allocate increase_inventory_cost adjustments across product lines (by
    # subtotal) so unit_cost_per_kg reflects the true landed cost.
    extra = _inventory_cost_extra(list(invoice.adjustments.all()))
    product_lines = [ln for ln in lines if ln.is_stock_tracked and ln.has_quantity]
    allocations = calc.allocate_inventory_cost(
        [ln.line_subtotal for ln in product_lines], extra
    )

    for line, allocated_cost in zip(product_lines, allocations):
        unit_cost = calc.unit_cost_per_kg(allocated_cost, line.quantity_kg)
        line.unit_cost_per_kg = unit_cost
        line.save(update_fields=["unit_cost_per_kg", "updated_at"])
        inventory_services.add_stock(
            company=company,
            product=line.product,
            cartons=line.quantity_cartons,
            pieces=line.quantity_pieces,
            kg=line.quantity_kg,
            unit_cost_per_kg=unit_cost,
            source_type=StockSourceType.PURCHASE_INVOICE,
            source_id=invoice.id,
            source_reference=invoice.invoice_number,
            reason=reason,
            user=user,
            movement_type=MovementType.PURCHASE_APPROVED,
        )

    # Supplier payable: post the gross total. Payment receipt ledger is deferred
    # to the payments phase (documented limitation).
    supplier = Supplier.objects.select_for_update().get(pk=invoice.supplier_id)
    supplier_services.record_purchase_invoice(
        supplier=supplier,
        amount=invoice.total_amount,
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        created_by=user,
        reason=reason,
        entry_date=invoice.invoice_date,
    )

    invoice.status = PurchaseStatus.APPROVED
    invoice.approval_reason = reason
    invoice.approved_by = user
    invoice.approved_at = timezone.now()
    _apply_payment_state(invoice)
    invoice.save(update_fields=[
        "status", "approval_reason", "approved_by", "approved_at",
        "payment_status", "balance_due", "updated_at",
    ])

    create_audit_log(
        action="approve_purchase_invoice", user=user, company=company,
        module="purchases", reference_type="purchase_invoice",
        reference_id=invoice.id,
        previous_value={"status": PurchaseStatus.DRAFT},
        new_value={"status": invoice.status, "total_amount": str(invoice.total_amount)},
        reason=reason,
    )
    _record_status_history(invoice, PurchaseStatus.DRAFT, invoice.status, reason, user)
    return invoice


# ── Cancellation ────────────────────────────────────────────────────────────
@transaction.atomic
def cancel_purchase_invoice(*, invoice, user, reason) -> PurchaseInvoice:
    """Cancel an invoice: reverse supplier ledger + inventory (if intact)."""
    reason = require_reason_for_sensitive_action("cancel_purchase_invoice", reason)

    invoice = (
        PurchaseInvoice.objects.select_for_update()
        .select_related("supplier")
        .get(pk=invoice.pk)
    )
    if invoice.status == PurchaseStatus.CANCELLED:
        raise ValidationError("This purchase invoice is already cancelled.")

    company = invoice.company
    was_posted = invoice.status in (
        PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID, PurchaseStatus.PAID
    )
    previous_status = invoice.status

    if was_posted:
        # Reverse inventory first; block cleanly if stock was already consumed.
        try:
            inventory_services.reverse_source_layers(
                company=company,
                source_type=StockSourceType.PURCHASE_INVOICE,
                source_id=invoice.id,
                reason=reason,
                user=user,
                reference_number=invoice.invoice_number,
                movement_type=MovementType.PURCHASE_CANCELLED,
            )
        except StockConsumedError:
            raise ValidationError(STOCK_CONSUMED_MESSAGE)

        # Reverse the supplier payable (do not delete the original entry).
        supplier = Supplier.objects.select_for_update().get(pk=invoice.supplier_id)
        supplier_services.reverse_purchase_invoice(
            supplier=supplier,
            amount=invoice.total_amount,
            reference_id=invoice.id,
            reference_number=invoice.invoice_number,
            created_by=user,
            reason=reason,
            entry_date=timezone.now().date(),
        )

    invoice.status = PurchaseStatus.CANCELLED
    invoice.cancel_reason = reason
    invoice.cancelled_by = user
    invoice.cancelled_at = timezone.now()
    invoice.save(update_fields=[
        "status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at",
    ])

    create_audit_log(
        action="cancel_purchase_invoice", user=user, company=company,
        module="purchases", reference_type="purchase_invoice",
        reference_id=invoice.id,
        previous_value={"status": previous_status},
        new_value={"status": PurchaseStatus.CANCELLED},
        reason=reason,
    )
    _record_status_history(invoice, previous_status, PurchaseStatus.CANCELLED, reason, user)
    return invoice


# ── Attachments ─────────────────────────────────────────────────────────────
@transaction.atomic
def create_purchase_attachment(*, invoice, file, file_type, original_filename="",
                               notes="", user=None) -> PurchaseAttachment:
    attachment = PurchaseAttachment.objects.create(
        company=invoice.company,
        invoice=invoice,
        file=file,
        file_type=file_type,
        original_filename=original_filename or getattr(file, "name", ""),
        notes=notes or "",
        uploaded_by=user,
    )
    create_audit_log(
        action="supplier_invoice_upload", user=user, company=invoice.company,
        module="purchases", reference_type="purchase_invoice",
        reference_id=invoice.id,
        new_value={"attachment_id": attachment.id, "file_type": file_type},
    )
    return attachment


# ── Status history ──────────────────────────────────────────────────────────
def _record_status_history(invoice, from_status, to_status, reason, user):
    PurchaseStatusHistory.objects.create(
        company=invoice.company, invoice=invoice,
        from_status=from_status or "", to_status=to_status,
        reason=reason or "", changed_by=user,
    )


# ── Reporting ───────────────────────────────────────────────────────────────
def get_purchase_summary(company) -> dict:
    qs = PurchaseInvoice.objects.filter(company=company)
    now = timezone.now()
    active = qs.exclude(status=PurchaseStatus.CANCELLED)

    month_total = active.filter(
        invoice_date__year=now.year, invoice_date__month=now.month
    ).aggregate(s=Sum("total_amount"))["s"] or ZERO

    approved_count = qs.filter(
        status__in=[PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID,
                    PurchaseStatus.PAID]
    ).count()
    draft_count = qs.filter(status=PurchaseStatus.DRAFT).count()

    unpaid_balance = active.aggregate(s=Sum("balance_due"))["s"] or ZERO
    vat_total = active.aggregate(s=Sum("vat_amount"))["s"] or ZERO

    supplier_payable = (
        Supplier.objects.filter(company=company, current_balance__gt=0)
        .aggregate(s=Sum("current_balance"))["s"] or ZERO
    )

    top_suppliers = list(
        active.values("supplier_id", "supplier_name_snapshot")
        .annotate(total=Sum("total_amount"))
        .order_by("-total")[:5]
    )

    return {
        "total_purchases_this_month": month_total,
        "approved_purchases_count": approved_count,
        "draft_purchases_count": draft_count,
        "unpaid_balance": unpaid_balance,
        "supplier_payable_total": supplier_payable,
        "purchase_vat_total": vat_total,
        "top_suppliers": top_suppliers,
    }


def get_supplier_purchase_history(company, supplier):
    _check_supplier(company, supplier)
    return (
        PurchaseInvoice.objects.filter(company=company, supplier=supplier)
        .order_by("-invoice_date", "-id")
    )
