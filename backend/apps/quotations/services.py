"""Quotation domain services (Phase 7).

NO side effects on inventory, customer ledger, or payments at any lifecycle stage.
Conversion creates a sales invoice draft via sales service with preserved pricing.
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
)
from apps.inventory.models import InventoryBalance
from apps.permissions.services import has_permission
from apps.products.models import Product
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType, SalesPriceSource, SalesStatus
from apps.tenants.print_identity import build_company_print_identity

from . import calculations as calc
from .models import (
    Quotation,
    QuotationLine,
    QuotationLineType,
    QuotationPriceSource,
    QuotationStatus,
    QuotationStatusHistory,
)

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")

_CONVERTIBLE = (QuotationStatus.SENT, QuotationStatus.ACCEPTED)
_TERMINAL = (
    QuotationStatus.REJECTED, QuotationStatus.CANCELLED,
    QuotationStatus.EXPIRED, QuotationStatus.CONVERTED,
)
_EXPIRABLE = (QuotationStatus.DRAFT, QuotationStatus.SENT)


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


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


def resolve_quotation_line_pricing(*, customer, product, price_type, manual_price=None,
                                   is_free=False, price_source=None, user=None):
    """Return (unit_price, price_source, is_free) for a quotation line."""
    if product is None:
        return _d(manual_price or 0), price_source or QuotationPriceSource.MANUAL_OVERRIDE, is_free

    if is_free or price_source == QuotationPriceSource.FREE_PRODUCT:
        if not _has_free_agreement(customer, product):
            if not user or not has_permission(user, "quotations.free_product_override"):
                raise ValidationError(
                    {"is_free": "No free-product agreement; quotations.free_product_override required."}
                )
        return ZERO, QuotationPriceSource.FREE_PRODUCT, True

    if price_source == QuotationPriceSource.MANUAL_OVERRIDE:
        if manual_price is None:
            manual_price = product.sales_price
        if not user or not has_permission(user, "quotations.override_price"):
            raise ValidationError(
                {"unit_price": "Manual override requires quotations.override_price."}
            )
        return _d(manual_price), QuotationPriceSource.MANUAL_OVERRIDE, False

    special = _active_special_price(customer, product, price_type)
    if special:
        return _d(special.price), QuotationPriceSource.CUSTOMER_SPECIAL_PRICE, False

    return _d(product.sales_price or 0), QuotationPriceSource.DEFAULT_PRODUCT_PRICE, False


def price_preview(*, company, customer, product, price_type):
    _check_customer(company, customer)
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    unit_price, source, is_free = resolve_quotation_line_pricing(
        customer=customer, product=product, price_type=price_type,
    )
    return {
        "unit_price": unit_price,
        "price_source": source,
        "is_free": is_free,
        "price_type": price_type,
    }


def _check_customer(company, customer):
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})


def _resolve_product(company, product, line_type):
    if line_type in (QuotationLineType.SERVICE, QuotationLineType.OTHER):
        return product
    if product is None:
        raise ValidationError({"product": "Product is required for this line type."})
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if not product.can_quote:
        raise ValidationError({"product": "This product is not quotable."})
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


def _record_status_history(quotation, from_status, to_status, reason, user):
    QuotationStatusHistory.objects.create(
        company_id=quotation.company_id,
        quotation=quotation,
        from_status=from_status or "",
        to_status=to_status,
        reason=reason or "",
        changed_by=user,
    )


def recalculate_quotation(quotation) -> Quotation:
    # Clear any stale prefetched lines cache (e.g. after deleting a line).
    if getattr(quotation, "_prefetched_objects_cache", None):
        quotation._prefetched_objects_cache = {}
    lines = list(quotation.lines.all())
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
        line.save(update_fields=[
            "line_subtotal", "taxable_amount", "vat_amount", "line_total", "updated_at",
        ])
        subtotal += sub
        line_discount += _d(line.discount_amount)
        vat_sum += vat

    quotation.subtotal = subtotal.quantize(MONEY_Q)
    quotation.discount_total = line_discount.quantize(MONEY_Q)
    taxable = max(subtotal - line_discount, ZERO).quantize(MONEY_Q)
    quotation.taxable_amount = taxable

    if _d(quotation.vat_rate) > 0:
        quotation.vat_amount = calc.vat_amount(taxable, quotation.vat_rate)
    else:
        quotation.vat_amount = vat_sum.quantize(MONEY_Q)

    quotation.total_amount = (taxable + quotation.vat_amount).quantize(MONEY_Q)
    quotation.save(update_fields=[
        "subtotal", "discount_total", "taxable_amount", "vat_amount",
        "total_amount", "updated_at",
    ])
    return quotation


@transaction.atomic
def create_quotation(*, company, customer, created_by, quotation_date, valid_until,
                     lines, vat_rate=None, terms_and_conditions="", notes="",
                     internal_notes=""):
    _check_customer(company, customer)
    if vat_rate is None:
        vat_settings = VATSettings.objects.filter(company=company).first()
        vat_rate = vat_settings.default_vat_rate if vat_settings else ZERO

    quotation_number = generate_document_number(company, DocumentType.QUOTATION)
    quotation = Quotation.objects.create(
        company=company,
        customer=customer,
        quotation_number=quotation_number,
        quotation_date=quotation_date,
        valid_until=valid_until,
        status=QuotationStatus.DRAFT,
        vat_rate=_d(vat_rate),
        terms_and_conditions=terms_and_conditions or "",
        notes=notes or "",
        internal_notes=internal_notes or "",
        customer_name_snapshot=customer.name_ar,
        customer_trn_snapshot=customer.trn or "",
        customer_phone_snapshot=customer.phone or "",
        customer_address_snapshot=customer.address or "",
        created_by=created_by,
        updated_by=created_by,
    )
    for index, line in enumerate(lines):
        _create_line(company, quotation, customer, line, default_sort=index, user=created_by)
    recalculate_quotation(quotation)
    _record_status_history(quotation, "", QuotationStatus.DRAFT, "", created_by)
    return quotation


def _create_line(company, quotation, customer, data, *, default_sort=0, user=None):
    line_type = data.get("line_type", QuotationLineType.PRODUCT)
    product = _resolve_product(company, data.get("product"), line_type)
    price_type = data.get("price_type", product.sales_price_type if product else "kg")
    is_free = bool(data.get("is_free", False))
    price_source = data.get("price_source")
    unit_price, price_source, is_free = resolve_quotation_line_pricing(
        customer=customer, product=product, price_type=price_type,
        manual_price=data.get("unit_price") if price_source == QuotationPriceSource.MANUAL_OVERRIDE else None,
        is_free=is_free, price_source=price_source, user=user,
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
    if price_source == QuotationPriceSource.MANUAL_OVERRIDE and user:
        reason = data.get("override_reason", "")
        if not reason or not reason.strip():
            raise ValidationError({"override_reason": "Reason required for price override."})
        create_audit_log(
            action="override_quotation_price",
            user=user, company=company, module="quotations",
            reference_type="quotation", reference_id=quotation.id,
            reason=reason,
            new_value={"product_id": product.id if product else None, "unit_price": str(unit_price)},
        )
    return QuotationLine.objects.create(
        company=company,
        quotation=quotation,
        product=product,
        product_name_snapshot=product.name_ar if product else "",
        product_sku_snapshot=product.sku if product else "",
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
        vat_rate=_d(data.get("vat_rate", quotation.vat_rate)),
        notes=data.get("notes", ""),
        sort_order=data.get("sort_order", default_sort),
    )


def _require_lines(quotation):
    if not quotation.lines.exists():
        raise ValidationError("Quotation must have at least one line.")


@transaction.atomic
def send_quotation(*, quotation, user, reason=""):
    quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
    if quotation.status != QuotationStatus.DRAFT:
        raise ValidationError("Only draft quotations can be sent.")
    _require_lines(quotation)
    from_status = quotation.status
    quotation.status = QuotationStatus.SENT
    quotation.sent_by = user
    quotation.sent_at = timezone.now()
    quotation.save(update_fields=["status", "sent_by", "sent_at", "updated_at"])
    _record_status_history(quotation, from_status, QuotationStatus.SENT, reason, user)
    create_audit_log(
        action="send_quotation", user=user, company=quotation.company,
        module="quotations", reference_type="quotation", reference_id=quotation.id,
        reason=reason or "",
        new_value={"status": QuotationStatus.SENT},
    )
    return quotation


@transaction.atomic
def accept_quotation(*, quotation, user, reason=""):
    quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
    if quotation.status != QuotationStatus.SENT:
        raise ValidationError("Only sent quotations can be accepted.")
    from_status = quotation.status
    quotation.status = QuotationStatus.ACCEPTED
    quotation.accepted_by = user
    quotation.accepted_at = timezone.now()
    quotation.save(update_fields=[
        "status", "accepted_by", "accepted_at", "updated_at",
    ])
    _record_status_history(quotation, from_status, QuotationStatus.ACCEPTED, reason, user)
    create_audit_log(
        action="accept_quotation", user=user, company=quotation.company,
        module="quotations", reference_type="quotation", reference_id=quotation.id,
        reason=reason or "",
        new_value={"status": QuotationStatus.ACCEPTED},
    )
    return quotation


@transaction.atomic
def reject_quotation(*, quotation, user, reason):
    reason = require_reason_for_sensitive_action("reject_quotation", reason)
    quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise ValidationError("Only draft or sent quotations can be rejected.")
    from_status = quotation.status
    quotation.status = QuotationStatus.REJECTED
    quotation.reject_reason = reason
    quotation.rejected_by = user
    quotation.rejected_at = timezone.now()
    quotation.save(update_fields=[
        "status", "reject_reason", "rejected_by", "rejected_at", "updated_at",
    ])
    _record_status_history(quotation, from_status, QuotationStatus.REJECTED, reason, user)
    create_audit_log(
        action="reject_quotation", user=user, company=quotation.company,
        module="quotations", reference_type="quotation", reference_id=quotation.id,
        reason=reason,
        new_value={"status": QuotationStatus.REJECTED},
    )
    return quotation


@transaction.atomic
def cancel_quotation(*, quotation, user, reason):
    reason = require_reason_for_sensitive_action("cancel_quotation", reason)
    quotation = Quotation.objects.select_for_update().get(pk=quotation.pk)
    if quotation.status in _TERMINAL:
        raise ValidationError("Quotation cannot be cancelled in its current status.")
    from_status = quotation.status
    quotation.status = QuotationStatus.CANCELLED
    quotation.cancel_reason = reason
    quotation.cancelled_by = user
    quotation.cancelled_at = timezone.now()
    quotation.save(update_fields=[
        "status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at",
    ])
    _record_status_history(quotation, from_status, QuotationStatus.CANCELLED, reason, user)
    create_audit_log(
        action="cancel_quotation", user=user, company=quotation.company,
        module="quotations", reference_type="quotation", reference_id=quotation.id,
        reason=reason,
        new_value={"status": QuotationStatus.CANCELLED},
    )
    return quotation


@transaction.atomic
def expire_quotations(*, company=None, user=None) -> int:
    today = timezone.now().date()
    qs = Quotation.objects.filter(
        status__in=_EXPIRABLE, valid_until__lt=today,
    )
    if company is not None:
        qs = qs.filter(company=company)
    count = 0
    for quotation in qs.select_for_update():
        from_status = quotation.status
        quotation.status = QuotationStatus.EXPIRED
        quotation.expired_at = timezone.now()
        quotation.save(update_fields=["status", "expired_at", "updated_at"])
        _record_status_history(
            quotation, from_status, QuotationStatus.EXPIRED, "Auto-expired", user
        )
        count += 1
    return count


@transaction.atomic
def convert_quotation_to_sales_draft(*, quotation, user, reason=""):
    quotation = (
        Quotation.objects.select_for_update()
        .select_related("customer")
        .prefetch_related("lines", "lines__product")
        .get(pk=quotation.pk)
    )
    if quotation.status not in _CONVERTIBLE:
        raise ValidationError(
            "Only sent or accepted quotations can be converted to sales draft."
        )
    if quotation.converted_sales_invoice_id:
        raise ValidationError("Quotation has already been converted.")

    _require_lines(quotation)
    company = quotation.company
    customer = quotation.customer

    sales_lines = []
    for ql in quotation.lines.all().order_by("sort_order", "id"):
        sales_lines.append({
            "product": ql.product,
            "line_type": ql.line_type,
            "quantity_cartons": ql.quantity_cartons,
            "quantity_pieces": ql.quantity_pieces,
            "quantity_kg": ql.quantity_kg,
            "unit_price": ql.unit_price,
            "price_type": ql.price_type,
            "price_source": ql.price_source,
            "is_free": ql.is_free,
            "free_reason": ql.free_reason,
            "discount_amount": ql.discount_amount,
            "vat_rate": ql.vat_rate,
            "notes": ql.notes,
            "sort_order": ql.sort_order,
        })

    invoice = sales_services.create_sales_invoice(
        company=company,
        customer=customer,
        created_by=user,
        invoice_date=timezone.now().date(),
        lines=sales_lines,
        vat_rate=quotation.vat_rate,
        notes=f"Converted from quotation {quotation.quotation_number}",
        preserve_pricing=True,
    )

    from_status = quotation.status
    quotation.status = QuotationStatus.CONVERTED
    quotation.converted_sales_invoice = invoice
    quotation.converted_by = user
    quotation.converted_at = timezone.now()
    quotation.save(update_fields=[
        "status", "converted_sales_invoice", "converted_by", "converted_at", "updated_at",
    ])
    _record_status_history(
        quotation, from_status, QuotationStatus.CONVERTED, reason, user
    )
    create_audit_log(
        action="convert_quotation_to_sales",
        user=user, company=company, module="quotations",
        reference_type="quotation", reference_id=quotation.id,
        reason=reason or "",
        new_value={
            "sales_invoice_id": invoice.id,
            "sales_invoice_number": invoice.invoice_number,
        },
    )
    return quotation, invoice


def build_quotation_print_preview(quotation, request=None) -> dict:
    company = quotation.company
    lines = list(quotation.lines.all().order_by("sort_order", "id"))
    customer_party = {
        "name": quotation.customer_name_snapshot or "",
        "trn": (quotation.customer_trn_snapshot or "").strip(),
        "phone": (quotation.customer_phone_snapshot or "").strip(),
        "address": (quotation.customer_address_snapshot or "").strip(),
    }
    if quotation.customer_id:
        c = quotation.customer
        if not customer_party["name"]:
            customer_party["name"] = c.name_ar or ""
        if not customer_party["trn"]:
            customer_party["trn"] = (c.trn or "").strip()
        if not customer_party["phone"]:
            customer_party["phone"] = (c.phone or "").strip()
        if not customer_party["address"]:
            customer_party["address"] = (c.address or "").strip()
    return {
        "title_en": "QUOTATION",
        "title_ar": "عرض سعر",
        "not_tax_invoice_en": "This quotation is not a tax invoice.",
        "not_tax_invoice_ar": "عرض سعر وليس فاتورة ضريبية",
        "company": build_company_print_identity(company, request),
        "customer": customer_party,
        "party": customer_party,
        "quotation": {
            "number": quotation.quotation_number,
            "date": str(quotation.quotation_date),
            "valid_until": str(quotation.valid_until),
            "status": quotation.status,
            "terms_and_conditions": quotation.terms_and_conditions,
            "notes": quotation.notes,
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
            "subtotal": str(quotation.subtotal),
            "discount_total": str(quotation.discount_total),
            "taxable_amount": str(quotation.taxable_amount),
            "vat_rate": str(quotation.vat_rate),
            "vat_amount": str(quotation.vat_amount),
            "total_amount": str(quotation.total_amount),
            "vat_estimate_note": "VAT shown is an estimate only.",
        },
        "prepared_by": quotation.created_by.full_name if quotation.created_by else "",
    }


def quotation_stock_warning(quotation) -> list:
    warnings = []
    for line in quotation.lines.select_related("product").all():
        if not line.is_stock_tracked or not line.has_quantity:
            continue
        balance = InventoryBalance.objects.filter(
            company_id=quotation.company_id, product=line.product
        ).first()
        avail_c = balance.available_cartons if balance else ZERO
        avail_p = balance.available_pieces if balance else ZERO
        avail_k = balance.available_kg if balance else ZERO
        enough = (
            avail_c >= line.quantity_cartons
            and avail_p >= line.quantity_pieces
            and avail_k >= line.quantity_kg
        )
        warnings.append({
            "line_id": line.id,
            "product_id": line.product_id,
            "product_name": line.product_name_snapshot,
            "enough_stock": enough,
            "available_cartons": avail_c,
            "available_pieces": avail_p,
            "available_kg": avail_k,
            "requested_cartons": line.quantity_cartons,
            "requested_pieces": line.quantity_pieces,
            "requested_kg": line.quantity_kg,
            "warning_message": (
                "" if enough else "Requested quantity may exceed available stock."
            ),
        })
    return warnings


def get_quotation_summary(company) -> dict:
    today = timezone.now().date()
    month_start = today.replace(day=1)
    qs = Quotation.objects.filter(company=company, quotation_date__gte=month_start)
    sent = qs.filter(status=QuotationStatus.SENT).count()
    accepted = qs.filter(status=QuotationStatus.ACCEPTED).count()
    converted = qs.filter(status=QuotationStatus.CONVERTED).count()
    conversion_base = sent + accepted
    rate = (converted / conversion_base * 100) if conversion_base else ZERO
    return {
        "total_quotations_this_month": qs.count(),
        "draft_count": qs.filter(status=QuotationStatus.DRAFT).count(),
        "sent_count": sent,
        "accepted_count": accepted,
        "rejected_count": qs.filter(status=QuotationStatus.REJECTED).count(),
        "expired_count": qs.filter(status=QuotationStatus.EXPIRED).count(),
        "converted_count": converted,
        "total_quoted_amount": qs.exclude(
            status__in=[QuotationStatus.CANCELLED, QuotationStatus.REJECTED]
        ).aggregate(s=Sum("total_amount"))["s"] or ZERO,
        "conversion_rate": rate.quantize(MONEY_Q),
    }


def get_customer_quotation_history(company, customer):
    _check_customer(company, customer)
    return Quotation.objects.filter(
        company=company, customer=customer
    ).order_by("-quotation_date", "-id")
