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
from apps.core.enums import PriceType
from apps.core.line_pricing import normalize_price_type
from apps.inventory import services as inventory_services
from apps.inventory.models import (
    MovementDirection,
    MovementType,
    StockMovement,
    StockSourceType,
)
from apps.inventory.services import StockConsumedError
from apps.permissions.services import has_permission
from apps.products.models import ProductType
from apps.products.poultry_cuts import is_kg_primary_product, validate_purchase_line_quantities
from apps.suppliers.models import Supplier, SupplierLedgerEntry, SupplierSpecialPrice
from apps.suppliers import services as supplier_services

from apps.tenants.print_identity import build_company_print_identity

from . import calculations as calc
from .models import (
    PurchaseAdjustment,
    PurchaseAdjustmentEffect,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseLineType,
    PurchasePaymentMethod,
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

_POSTED_PURCHASE_STATUSES = (
    PurchaseStatus.APPROVED,
    PurchaseStatus.PARTIALLY_PAID,
    PurchaseStatus.PAID,
)

REPAIR_REASON = "Repair missing purchase inventory side effects"


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


def _validate_service_deductions(invoice, *, gross_total: Decimal) -> None:
    """Validate slaughterhouse/transport deduction fields on a purchase invoice."""
    slaughter = _d(invoice.slaughterhouse_deduction_amount)
    transport = _d(invoice.transport_deduction_amount)
    company = invoice.company

    if slaughter < 0 or transport < 0:
        raise ValidationError("Deduction amounts cannot be negative.")

    if slaughter > 0 and not invoice.slaughterhouse_supplier_id:
        raise ValidationError(
            {"slaughterhouse_supplier": "Slaughterhouse account is required when deduction amount is set."}
        )
    if transport > 0 and not invoice.transport_supplier_id:
        raise ValidationError(
            {"transport_supplier": "Transport account is required when deduction amount is set."}
        )

    total_deductions = slaughter + transport
    if total_deductions > gross_total:
        raise ValidationError(
            {"deductions": "Total deductions cannot exceed the gross invoice total."}
        )

    for field_name, supplier_id in (
        ("slaughterhouse_supplier", invoice.slaughterhouse_supplier_id),
        ("transport_supplier", invoice.transport_supplier_id),
    ):
        if not supplier_id:
            continue
        if not Supplier.objects.filter(pk=supplier_id, company_id=company.id).exists():
            raise ValidationError({field_name: "Supplier does not belong to this company."})


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
    # The API fetches invoices with prefetch_related("lines", "adjustments");
    # line/adjustment mutations happen afterwards, so the prefetched cache is
    # stale here (e.g. it still contains a just-deleted line). Clear it so the
    # recalculation always reads fresh rows.
    if getattr(invoice, "_prefetched_objects_cache", None):
        invoice._prefetched_objects_cache = {}
    lines = list(invoice.lines.all())
    adjustments = list(invoice.adjustments.all())

    header_vat_enabled = _d(invoice.vat_rate) > 0
    subtotal = ZERO
    for line in lines:
        line_vat_rate = line.vat_rate if header_vat_enabled else ZERO
        line.line_subtotal, line.vat_amount, line.line_total = _line_money(
            price_type=line.price_type, unit_price=line.unit_price,
            cartons=line.quantity_cartons, pieces=line.quantity_pieces,
            kg=line.quantity_kg, vat_rate=line_vat_rate,
        )
        line.save(update_fields=["line_subtotal", "vat_amount", "line_total", "updated_at"])
        subtotal += line.line_subtotal

    payable_adjustment = _payable_adjustment_total(adjustments)
    inventory_extra = _inventory_cost_extra(adjustments)

    taxable = (subtotal + payable_adjustment)
    if taxable < 0:
        taxable = ZERO
    taxable = taxable.quantize(MONEY_Q)

    if header_vat_enabled:
        vat = calc.vat_amount(taxable, invoice.vat_rate)
    else:
        vat = ZERO

    gross_total = (taxable + vat).quantize(MONEY_Q)
    _validate_service_deductions(invoice, gross_total=gross_total)

    slaughter = _d(invoice.slaughterhouse_deduction_amount)
    transport = _d(invoice.transport_deduction_amount)
    total_deductions = slaughter + transport

    invoice.subtotal = subtotal.quantize(MONEY_Q)
    invoice.adjustment_total = payable_adjustment.quantize(MONEY_Q)
    invoice.taxable_amount = taxable
    invoice.vat_amount = vat
    invoice.gross_total = gross_total
    invoice.total_amount = (gross_total - total_deductions).quantize(MONEY_Q)
    invoice.inventory_cost_total = (subtotal + inventory_extra).quantize(MONEY_Q)

    if _d(invoice.amount_paid) > _d(invoice.total_amount):
        raise ValidationError(
            {"amount_paid": "Amount paid cannot exceed the invoice total."}
        )

    _apply_payment_state(invoice)
    invoice.save(update_fields=[
        "subtotal", "adjustment_total", "taxable_amount", "vat_amount",
        "gross_total", "total_amount", "inventory_cost_total", "amount_paid", "balance_due",
        "payment_status", "status", "updated_at",
    ])
    return invoice


# ── Create ──────────────────────────────────────────────────────────────────
@transaction.atomic
def create_purchase_invoice(*, company, supplier, created_by, invoice_date,
                            lines, adjustments=None, supplier_invoice_number="",
                            due_date=None, payment_method=None, vat_rate=ZERO,
                            amount_paid=ZERO, notes="", invoice_number=None,
                            money_account=None, backdate_reason="",
                            slaughterhouse_supplier=None, slaughterhouse_deduction_amount=ZERO,
                            transport_supplier=None, transport_deduction_amount=ZERO,
                            deduction_notes=""):
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
        money_account=money_account,
        notes=notes or "",
        backdate_reason=backdate_reason or "",
        supplier_name_snapshot=supplier.name_ar,
        supplier_trn_snapshot=supplier.trn or "",
        slaughterhouse_supplier=slaughterhouse_supplier,
        slaughterhouse_deduction_amount=_d(slaughterhouse_deduction_amount),
        transport_supplier=transport_supplier,
        transport_deduction_amount=_d(transport_deduction_amount),
        deduction_notes=deduction_notes or "",
        created_by=created_by,
        updated_by=created_by,
    )

    for index, line in enumerate(lines):
        _create_line(company, invoice, line, default_sort=index, user=created_by)
    for adj in adjustments:
        _create_adjustment(company, invoice, adj, created_by=created_by)

    recalculate_purchase_invoice(invoice)
    _record_status_history(invoice, "", PurchaseStatus.DRAFT, "", created_by)
    return invoice


def _resolve_purchase_price(company, supplier, product, price_type):
    """Return (default_price, source) for a purchase line."""
    if product is None:
        return None, "manual"
    special = (
        SupplierSpecialPrice.objects.filter(
            company_id=company.id, supplier=supplier, product=product,
            price_type=price_type, is_active=True,
        )
        .order_by("-id")
        .first()
    )
    if special:
        return _d(special.price), "supplier_special_price"
    return _d(product.purchase_price or 0), "default_purchase_price"


def _create_line(company, invoice, data, *, default_sort=0, user=None) -> PurchaseInvoiceLine:
    line_type = data.get("line_type", PurchaseLineType.PRODUCT)
    product = _resolve_product(company, data.get("product"), line_type)
    try:
        price_type = normalize_price_type(
            data.get("price_type"),
            default=(product.purchase_price_type if product else PriceType.KG),
        )
    except ValueError as exc:
        raise ValidationError({"price_type": str(exc)}) from exc
    provided = data.get("unit_price")
    default_price, _source = _resolve_purchase_price(
        company, invoice.supplier, product, price_type
    )

    if provided is None:
        unit_price = default_price if default_price is not None else ZERO
    else:
        unit_price = _d(provided)
        # A price that differs from the resolved default is a manual override:
        # permission-gated and audit-logged. Internal callers (user=None) are
        # trusted; all API paths pass the requesting user.
        if (
            user is not None
            and product is not None
            and default_price is not None
            and unit_price != default_price
        ):
            if not has_permission(user, "purchases.override_price"):
                raise ValidationError({
                    "unit_price": (
                        "Manual purchase price override requires "
                        "purchases.override_price."
                    )
                })
            if unit_price <= 0:
                raise ValidationError(
                    {"unit_price": "Overridden purchase price must be greater than zero."}
                )
            create_audit_log(
                action="override_purchase_price",
                user=user, company=company, module="purchases",
                reference_type="purchase_invoice", reference_id=invoice.id,
                reason=data.get("override_reason", ""),
                previous_value={"default_price": str(default_price)},
                new_value={
                    "product_id": product.id,
                    "unit_price": str(unit_price),
                },
            )

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
        unit_price=unit_price,
        price_type=price_type,
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


def _normalize_line_quantities_for_stock(line: PurchaseInvoiceLine) -> bool:
    """Derive missing pieces/kg from cartons for fixed-weight stock lines."""
    product = line.product
    if not product or not line.is_stock_tracked:
        return False

    cartons = _d(line.quantity_cartons)
    pieces = _d(line.quantity_pieces)
    kg = _d(line.quantity_kg)
    if cartons <= 0 and pieces <= 0 and kg <= 0:
        return False

    changed = False
    if product.product_type == ProductType.FIXED_WEIGHT:
        if cartons > 0:
            if pieces <= 0:
                line.quantity_pieces = _d(product.calculate_pieces(int(cartons)))
                changed = True
            if kg <= 0:
                line.quantity_kg = product.calculate_kg(cartons)
                changed = True
    if changed:
        line.save(update_fields=["quantity_pieces", "quantity_kg", "updated_at"])
    return changed


def _validate_lines_for_approval(lines) -> None:
    """Reject approval when stock-tracked lines lack usable quantity."""
    for line in lines:
        if not line.is_stock_tracked:
            continue
        if not line.has_quantity:
            raise ValidationError(
                {
                    "lines": (
                        f"Stock-tracked line '{line.product_name_snapshot}' "
                        "requires cartons, pieces, or kg before approval."
                    )
                }
            )
        qty_errors = validate_purchase_line_quantities(
            product=line.product,
            quantity_cartons=line.quantity_cartons,
            quantity_pieces=line.quantity_pieces,
            quantity_kg=line.quantity_kg,
        )
        if qty_errors:
            raise ValidationError(qty_errors)
        if (
            is_kg_primary_product(line.product)
            and _d(line.quantity_kg) <= 0
        ):
            raise ValidationError(
                {
                    "quantity_kg": (
                        f"Poultry cut '{line.product_name_snapshot}' "
                        "requires KG greater than zero."
                    )
                }
            )


def _posted_stock_deltas(company, invoice, product_id) -> tuple[Decimal, Decimal, Decimal]:
    """Sum inbound stock already posted for a purchase invoice line product."""
    agg = StockMovement.objects.filter(
        company=company,
        reference_type=StockSourceType.PURCHASE_INVOICE,
        reference_id=invoice.id,
        product_id=product_id,
        movement_type=MovementType.PURCHASE_APPROVED,
        direction=MovementDirection.IN,
    ).aggregate(
        cartons=Sum("cartons_delta"),
        pieces=Sum("pieces_delta"),
        kg=Sum("kg_delta"),
    )
    return _d(agg["cartons"]), _d(agg["pieces"]), _d(agg["kg"])


def _apply_purchase_stock_side_effects(*, invoice, user, reason) -> list[dict]:
    """Add FIFO stock for stock-tracked purchase lines (idempotent per quantity)."""
    from apps.core.document_dates import invoice_date_to_received_at

    company = invoice.company
    business_date = invoice.invoice_date
    received_at = invoice_date_to_received_at(business_date)
    lines = list(invoice.lines.select_related("product").all())
    extra = _inventory_cost_extra(list(invoice.adjustments.all()))
    product_lines = [ln for ln in lines if ln.is_stock_tracked and ln.has_quantity]
    allocations = calc.allocate_inventory_cost(
        [ln.line_subtotal for ln in product_lines], extra
    )

    applied: list[dict] = []
    for line, allocated_cost in zip(product_lines, allocations):
        posted_cartons, posted_pieces, posted_kg = _posted_stock_deltas(
            company, invoice, line.product_id
        )
        need_cartons = _d(line.quantity_cartons) - posted_cartons
        need_pieces = _d(line.quantity_pieces) - posted_pieces
        need_kg = _d(line.quantity_kg) - posted_kg
        if need_cartons <= 0 and need_pieces <= 0 and need_kg <= 0:
            continue

        unit_cost = calc.unit_cost_per_kg(allocated_cost, line.quantity_kg)
        line.unit_cost_per_kg = unit_cost
        line.save(update_fields=["unit_cost_per_kg", "updated_at"])
        inventory_services.add_stock(
            company=company,
            product=line.product,
            cartons=need_cartons,
            pieces=need_pieces,
            kg=need_kg,
            unit_cost_per_kg=unit_cost,
            source_type=StockSourceType.PURCHASE_INVOICE,
            source_id=invoice.id,
            source_reference=invoice.invoice_number,
            reason=reason,
            user=user,
            movement_type=MovementType.PURCHASE_APPROVED,
            received_at=received_at,
            movement_date=business_date,
        )
        applied.append({
            "product_id": line.product_id,
            "product": line.product_name_snapshot,
            "cartons": str(need_cartons),
            "pieces": str(need_pieces),
            "kg": str(need_kg),
        })
    return applied


def _supplier_ledger_posted(invoice) -> bool:
    return SupplierLedgerEntry.objects.filter(
        company_id=invoice.company_id,
        supplier_id=invoice.supplier_id,
        entry_type=SupplierLedgerEntry.EntryType.PURCHASE_INVOICE,
        reference_type="purchase_invoice",
        reference_id=str(invoice.id),
    ).exists()


def purchase_needs_inventory_repair(invoice) -> bool:
    """True when an approved purchase has stock lines but missing stock deltas."""
    if invoice.status not in _POSTED_PURCHASE_STATUSES:
        return False
    company = invoice.company
    for line in invoice.lines.select_related("product").all():
        if not line.is_stock_tracked or not line.has_quantity:
            continue
        posted_cartons, posted_pieces, posted_kg = _posted_stock_deltas(
            company, invoice, line.product_id
        )
        if (
            _d(line.quantity_cartons) > posted_cartons
            or _d(line.quantity_pieces) > posted_pieces
            or _d(line.quantity_kg) > posted_kg
        ):
            return True
    return False


def find_purchases_missing_inventory(company) -> list[PurchaseInvoice]:
    qs = (
        PurchaseInvoice.objects.filter(company=company, status__in=_POSTED_PURCHASE_STATUSES)
        .prefetch_related("lines__product")
        .order_by("id")
    )
    return [inv for inv in qs if purchase_needs_inventory_repair(inv)]


@transaction.atomic
def repair_purchase_inventory_side_effects(
    *,
    company,
    user,
    dry_run: bool = True,
    invoices: list[PurchaseInvoice] | None = None,
) -> dict:
    """Backfill missing stock/FIFO/supplier ledger for approved purchases."""
    targets = invoices if invoices is not None else find_purchases_missing_inventory(company)
    report = {"dry_run": dry_run, "invoices": [], "repaired_count": 0, "skipped_count": 0}

    for invoice in targets:
        if invoice.company_id != company.id:
            raise ValidationError("Purchase invoice does not belong to this company.")
        if invoice.status not in _POSTED_PURCHASE_STATUSES:
            report["skipped_count"] += 1
            continue
        if not purchase_needs_inventory_repair(invoice):
            report["skipped_count"] += 1
            continue

        inv_report = {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
            "lines": [],
            "supplier_ledger": "unchanged",
        }

        lines = list(invoice.lines.select_related("product").all())
        normalized = False
        for line in lines:
            normalized = _normalize_line_quantities_for_stock(line) or normalized
        if normalized:
            recalculate_purchase_invoice(invoice)
            lines = list(invoice.lines.select_related("product").all())

        for line in lines:
            if not line.is_stock_tracked:
                continue
            inv_report["lines"].append({
                "line_id": line.id,
                "product": line.product_name_snapshot,
                "track_inventory": True,
                "cartons": str(line.quantity_cartons),
                "pieces": str(line.quantity_pieces),
                "kg": str(line.quantity_kg),
            })

        if dry_run:
            inv_report["action"] = "would_repair"
            report["invoices"].append(inv_report)
            continue

        _validate_lines_for_approval(lines)
        applied = _apply_purchase_stock_side_effects(
            invoice=invoice, user=user, reason=REPAIR_REASON,
        )
        inv_report["stock_applied"] = applied

        if not _supplier_ledger_posted(invoice):
            supplier = Supplier.objects.select_for_update().get(pk=invoice.supplier_id)
            supplier_services.record_purchase_invoice(
                supplier=supplier,
                amount=invoice.total_amount,
                reference_id=invoice.id,
                reference_number=invoice.invoice_number,
                created_by=user,
                reason=REPAIR_REASON,
                entry_date=invoice.invoice_date,
            )
            inv_report["supplier_ledger"] = "created"
        else:
            inv_report["supplier_ledger"] = "already_posted"

        create_audit_log(
            action="repair_purchase_inventory_side_effects",
            user=user,
            company=company,
            module="purchases",
            reference_type="purchase_invoice",
            reference_id=invoice.id,
            reason=REPAIR_REASON,
            new_value={"stock_applied": applied},
        )
        inv_report["action"] = "repaired"
        report["invoices"].append(inv_report)
        report["repaired_count"] += 1

    return report


def _validate_purchase_payment_for_approval(invoice) -> Decimal:
    """Validate payment fields before stock/accounting side effects. Returns paid amount."""
    from apps.payments.models import MoneyAccountType

    paid_amount = _d(invoice.amount_paid)
    if paid_amount > _d(invoice.total_amount):
        raise ValidationError({"amount_paid": "Amount paid cannot exceed total."})

    if invoice.payment_method == PurchasePaymentMethod.CREDIT:
        if paid_amount > 0:
            raise ValidationError({"amount_paid": "Credit purchase must have zero paid amount."})
        if invoice.money_account_id:
            raise ValidationError({
                "money_account": (
                    "Credit purchase cannot use a cashbox/bank account / "
                    "الشراء الآجل لا يستخدم خزنة أو حساب بنكي"
                )
            })
        return ZERO

    if paid_amount <= 0:
        return paid_amount

    if not invoice.money_account_id:
        raise ValidationError({
            "money_account": (
                "Select a cashbox/bank account for paid purchases. / "
                "اختر الخزنة أو الحساب البنكي للمبلغ المدفوع"
            )
        })
    account = invoice.money_account
    if invoice.payment_method == PurchasePaymentMethod.CASH and account.account_type != MoneyAccountType.CASHBOX:
        raise ValidationError({
            "money_account": (
                "Cash payment requires a cashbox account / "
                "الدفع كاش يتطلب اختيار خزنة"
            )
        })
    if invoice.payment_method in (PurchasePaymentMethod.BANK_TRANSFER, PurchasePaymentMethod.CHEQUE) and account.account_type != MoneyAccountType.BANK:
        raise ValidationError({
            "money_account": (
                "Bank/Cheque payment requires a bank account / "
                "الدفع البنكي يتطلب اختيار حساب بنكي"
            )
        })
    return paid_amount


# ── Approval ────────────────────────────────────────────────────────────────
@transaction.atomic
def approve_purchase_invoice(*, invoice, user, reason, backdate_reason="") -> PurchaseInvoice:
    """Approve a draft invoice: add FIFO stock + post supplier payable."""
    from apps.core.agent_debug import agent_dbg
    from apps.core.document_dates import ensure_backdate_reason_for_approval

    agent_dbg(
        "purchases.services.approve:entry",
        "approve service started",
        {"invoice_id": invoice.id, "invoice_number": invoice.invoice_number},
        "C",
    )
    reason = require_reason_for_sensitive_action("approve_purchase_invoice", reason)

    invoice = (
        PurchaseInvoice.objects.select_for_update(of=("self",))
        .select_related("supplier", "money_account", "slaughterhouse_supplier", "transport_supplier")
        .get(pk=invoice.pk)
    )
    if invoice.status != PurchaseStatus.DRAFT:
        raise ValidationError("Only a draft purchase invoice can be approved.")

    backdate_reason_set = ensure_backdate_reason_for_approval(invoice, backdate_reason)
    agent_dbg("purchases.services.approve:backdate_ok", "backdate validated", {"invoice_id": invoice.id}, "C")

    company = invoice.company
    _check_supplier(company, invoice.supplier)

    lines = list(invoice.lines.select_related("product").all())
    if not lines:
        raise ValidationError("Cannot approve a purchase invoice without lines.")

    recalculate_purchase_invoice(invoice)
    lines = list(invoice.lines.select_related("product").all())
    agent_dbg(
        "purchases.services.approve:recalculated",
        "totals recalculated",
        {"invoice_id": invoice.id, "line_count": len(lines), "total": str(invoice.total_amount)},
        "C",
    )

    normalized = False
    for line in lines:
        normalized = _normalize_line_quantities_for_stock(line) or normalized
    if normalized:
        recalculate_purchase_invoice(invoice)
        lines = list(invoice.lines.select_related("product").all())

    _validate_lines_for_approval(lines)
    agent_dbg("purchases.services.approve:lines_ok", "lines validated", {"invoice_id": invoice.id}, "C")

    paid_amount = _validate_purchase_payment_for_approval(invoice)
    agent_dbg(
        "purchases.services.approve:payment_ok",
        "payment validated",
        {"invoice_id": invoice.id, "paid_amount": str(paid_amount)},
        "C",
    )

    # Allocate increase_inventory_cost adjustments across product lines (by
    # subtotal) so unit_cost_per_kg reflects the true landed cost.
    _apply_purchase_stock_side_effects(invoice=invoice, user=user, reason=reason)
    agent_dbg("purchases.services.approve:stock_ok", "stock side effects applied", {"invoice_id": invoice.id}, "C")

    # Post money movement for paid part (cash/bank), then supplier payable only
    # for outstanding part so credit/partial works correctly.
    from apps.payments import services as payment_services
    from apps.payments.models import MoneyDirection, MoneyMovementType

    if paid_amount > 0:
        account = invoice.money_account
        payment_services.post_money_movement(
            company=company,
            money_account=account,
            movement_type=MoneyMovementType.PURCHASE_PAYMENT,
            direction=MoneyDirection.OUT,
            amount=paid_amount,
            reference_type="purchase_invoice",
            reference_id=invoice.id,
            description=f"Purchase payment {invoice.invoice_number}",
            reason=reason,
            user=user,
            movement_date=invoice.invoice_date,
        )

    payable_amount = max(_d(invoice.total_amount) - paid_amount, ZERO)
    supplier = Supplier.objects.select_for_update().get(pk=invoice.supplier_id)
    if payable_amount > 0:
        supplier_services.record_purchase_invoice(
            supplier=supplier,
            amount=payable_amount,
            reference_id=invoice.id,
            reference_number=invoice.invoice_number,
            created_by=user,
            reason=reason,
            entry_date=invoice.invoice_date,
        )
    invoice.supplier_payable_posted = payable_amount

    slaughter_posted = ZERO
    transport_posted = ZERO
    if _d(invoice.slaughterhouse_deduction_amount) > 0 and invoice.slaughterhouse_supplier_id:
        sh = Supplier.objects.select_for_update().get(pk=invoice.slaughterhouse_supplier_id)
        slaughter_posted = _d(invoice.slaughterhouse_deduction_amount)
        supplier_services.record_purchase_deduction(
            supplier=sh,
            amount=slaughter_posted,
            reference_id=invoice.id,
            reference_number=invoice.invoice_number,
            created_by=user,
            reason=reason,
            entry_date=invoice.invoice_date,
            description=f"Slaughterhouse deduction {invoice.invoice_number}",
        )
    if _d(invoice.transport_deduction_amount) > 0 and invoice.transport_supplier_id:
        tr = Supplier.objects.select_for_update().get(pk=invoice.transport_supplier_id)
        transport_posted = _d(invoice.transport_deduction_amount)
        supplier_services.record_purchase_deduction(
            supplier=tr,
            amount=transport_posted,
            reference_id=invoice.id,
            reference_number=invoice.invoice_number,
            created_by=user,
            reason=reason,
            entry_date=invoice.invoice_date,
            description=f"Transport deduction {invoice.invoice_number}",
        )
    invoice.slaughterhouse_deduction_posted = slaughter_posted
    invoice.transport_deduction_posted = transport_posted

    invoice.status = PurchaseStatus.APPROVED
    invoice.approval_reason = reason
    invoice.approved_by = user
    invoice.approved_at = timezone.now()
    _apply_payment_state(invoice)
    update_fields = [
        "status", "approval_reason", "approved_by", "approved_at",
        "payment_status", "balance_due", "supplier_payable_posted",
        "slaughterhouse_deduction_posted", "transport_deduction_posted",
        "updated_at",
    ]
    if backdate_reason_set:
        update_fields.append("backdate_reason")
    invoice.save(update_fields=update_fields)

    create_audit_log(
        action="approve_purchase_invoice", user=user, company=company,
        module="purchases", reference_type="purchase_invoice",
        reference_id=invoice.id,
        previous_value={"status": PurchaseStatus.DRAFT},
        new_value={
            "status": invoice.status,
            "gross_total": str(invoice.gross_total),
            "total_amount": str(invoice.total_amount),
            "slaughterhouse_deduction": str(invoice.slaughterhouse_deduction_amount),
            "transport_deduction": str(invoice.transport_deduction_amount),
            "slaughterhouse_supplier_id": invoice.slaughterhouse_supplier_id,
            "transport_supplier_id": invoice.transport_supplier_id,
        },
        reason=reason,
    )
    _record_status_history(invoice, PurchaseStatus.DRAFT, invoice.status, reason, user)
    agent_dbg(
        "purchases.services.approve:done",
        "approve service completed",
        {"invoice_id": invoice.id, "status": invoice.status},
        "C",
    )
    return invoice


# ── Cancellation ────────────────────────────────────────────────────────────
@transaction.atomic
def cancel_purchase_invoice(*, invoice, user, reason) -> PurchaseInvoice:
    """Cancel an invoice: reverse supplier ledger + inventory (if intact)."""
    reason = require_reason_for_sensitive_action("cancel_purchase_invoice", reason)

    invoice = (
        PurchaseInvoice.objects.select_for_update(of=("self",))
        .select_related("supplier", "slaughterhouse_supplier", "transport_supplier")
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
        if _d(invoice.supplier_payable_posted) > 0:
            supplier_services.reverse_purchase_invoice(
                supplier=supplier,
                amount=invoice.supplier_payable_posted,
                reference_id=invoice.id,
                reference_number=invoice.invoice_number,
                created_by=user,
                reason=reason,
                entry_date=timezone.now().date(),
            )

        if _d(invoice.slaughterhouse_deduction_posted) > 0 and invoice.slaughterhouse_supplier_id:
            sh = Supplier.objects.select_for_update().get(pk=invoice.slaughterhouse_supplier_id)
            supplier_services.reverse_purchase_deduction(
                supplier=sh,
                amount=invoice.slaughterhouse_deduction_posted,
                reference_id=invoice.id,
                reference_number=invoice.invoice_number,
                created_by=user,
                reason=reason,
                entry_date=timezone.now().date(),
                description=f"Reverse slaughterhouse deduction {invoice.invoice_number}",
            )

        if _d(invoice.transport_deduction_posted) > 0 and invoice.transport_supplier_id:
            tr = Supplier.objects.select_for_update().get(pk=invoice.transport_supplier_id)
            supplier_services.reverse_purchase_deduction(
                supplier=tr,
                amount=invoice.transport_deduction_posted,
                reference_id=invoice.id,
                reference_number=invoice.invoice_number,
                created_by=user,
                reason=reason,
                entry_date=timezone.now().date(),
                description=f"Reverse transport deduction {invoice.invoice_number}",
            )

        # Reverse paid money movement by booking an IN refund.
        from apps.payments import services as payment_services
        from apps.payments.models import MoneyDirection, MoneyMovement, MoneyMovementType

        paid_out = (
            MoneyMovement.objects.filter(
                company=company,
                movement_type=MoneyMovementType.PURCHASE_PAYMENT,
                direction=MoneyDirection.OUT,
                reference_type="purchase_invoice",
                reference_id=str(invoice.id),
            ).aggregate(s=Sum("amount"))["s"] or ZERO
        )
        if paid_out > 0 and invoice.money_account_id:
            payment_services.post_money_movement(
                company=company,
                money_account=invoice.money_account,
                movement_type=MoneyMovementType.REFUND,
                direction=MoneyDirection.IN,
                amount=paid_out,
                reference_type="purchase_invoice_cancel",
                reference_id=invoice.id,
                description=f"Cancel purchase {invoice.invoice_number}",
                reason=reason,
                user=user,
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

    month_qs = active.filter(
        invoice_date__year=now.year, invoice_date__month=now.month
    )
    month_total = month_qs.aggregate(s=Sum("total_amount"))["s"] or ZERO
    month_gross = month_qs.aggregate(s=Sum("gross_total"))["s"] or ZERO
    month_deductions = (
        month_qs.aggregate(
            sh=Sum("slaughterhouse_deduction_amount"),
            tr=Sum("transport_deduction_amount"),
        )
    )
    month_service_deductions = (
        _d(month_deductions.get("sh")) + _d(month_deductions.get("tr"))
    )

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
        "gross_purchases_this_month": month_gross or month_total,
        "service_deductions_this_month": month_service_deductions,
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
        .exclude(status=PurchaseStatus.CANCELLED)
        .order_by("-invoice_date", "-id")
    )


def get_purchase_price_history(*, company, supplier, product, limit=10):
    """Real previous purchase prices for a supplier+product (no fake data).

    Sources, most recent first:
    * previous non-cancelled purchase invoice lines (deduped by price+type),
    * active supplier special prices,
    * current default product purchase price.
    """
    _check_supplier(company, supplier)
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})

    items = []
    seen = set()

    lines = (
        PurchaseInvoiceLine.objects.filter(
            company=company, invoice__supplier=supplier, product=product,
        )
        .exclude(invoice__status=PurchaseStatus.CANCELLED)
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

    specials = SupplierSpecialPrice.objects.filter(
        company_id=company.id, supplier=supplier, product=product, is_active=True,
    ).order_by("-id")
    for sp in specials:
        items.append({
            "price": str(_d(sp.price)),
            "price_type": sp.price_type,
            "source": "supplier_special_price",
            "invoice_number": None,
            "date": str(sp.created_at.date()) if getattr(sp, "created_at", None) else None,
        })

    if _d(product.purchase_price or 0) > 0:
        items.append({
            "price": str(_d(product.purchase_price)),
            "price_type": product.purchase_price_type or "kg",
            "source": "default_purchase_price",
            "invoice_number": None,
            "date": None,
        })
    return items


def build_purchase_print_preview(invoice, request=None) -> dict:
    """JSON payload for tenant purchase print preview (browser print / save as PDF)."""
    from apps.company_settings.services import build_invoice_branding

    company = invoice.company
    lines = list(invoice.lines.all().order_by("sort_order", "id"))
    supplier = getattr(invoice, "supplier", None)
    supplier_trn = (invoice.supplier_trn_snapshot or "").strip()
    if not supplier_trn and supplier is not None:
        supplier_trn = (supplier.trn or "").strip()
    supplier_party = {
        "name": invoice.supplier_name_snapshot,
        "name_ar": invoice.supplier_name_snapshot,
        "name_en": invoice.supplier_name_snapshot,
        "trn": supplier_trn,
        "phone": (supplier.phone or "").strip() if supplier is not None else "",
        "address": (supplier.address or "").strip() if supplier is not None else "",
        "supplier_invoice_number": invoice.supplier_invoice_number,
    }
    return {
        "title_en": "PURCHASE INVOICE",
        "title_ar": "فاتورة شراء",
        "branding": build_invoice_branding(company),
        "company": build_company_print_identity(company, request),
        "supplier": supplier_party,
        "party": supplier_party,
        "invoice": {
            "number": invoice.invoice_number,
            "invoice_number": invoice.invoice_number,
            "supplier_invoice_number": invoice.supplier_invoice_number,
            "date": str(invoice.invoice_date),
            "due_date": str(invoice.due_date) if invoice.due_date else None,
            "status": invoice.status,
            "notes": invoice.notes,
            "title_ar": "فاتورة شراء",
            "title_en": "Purchase Invoice",
        },
        "lines": [
            {
                "product_name": ln.product_name_snapshot,
                "sku": ln.product_sku_snapshot,
                "quantity_cartons": str(ln.quantity_cartons),
                "quantity_pieces": str(ln.quantity_pieces),
                "quantity_kg": str(ln.quantity_kg),
                "cartons": str(ln.quantity_cartons),
                "pieces": str(ln.quantity_pieces),
                "kg": str(ln.quantity_kg),
                "unit_price": str(ln.unit_price),
                "price_type": ln.price_type,
                "line_subtotal": str(ln.line_subtotal),
                "line_total": str(ln.line_total),
            }
            for ln in lines
        ],
        "totals": {
            "subtotal": str(invoice.subtotal),
            "deduction_total": str(invoice.adjustment_total),
            "gross_total": str(invoice.gross_total or invoice.total_amount),
            "slaughterhouse_deduction": str(invoice.slaughterhouse_deduction_amount),
            "transport_deduction": str(invoice.transport_deduction_amount),
            "slaughterhouse_name": (
                invoice.slaughterhouse_supplier.name_ar
                if invoice.slaughterhouse_supplier_id else ""
            ),
            "transport_name": (
                invoice.transport_supplier.name_ar
                if invoice.transport_supplier_id else ""
            ),
            "vat_rate": str(invoice.vat_rate),
            "vat_amount": str(invoice.vat_amount),
            "total_amount": str(invoice.total_amount),
            "net_supplier_payable": str(invoice.total_amount),
            "amount_paid": str(invoice.amount_paid),
            "balance_due": str(invoice.balance_due),
        },
        "prepared_by": invoice.created_by.full_name if invoice.created_by else "",
        "approved_by": invoice.approved_by.full_name if invoice.approved_by else "",
    }
