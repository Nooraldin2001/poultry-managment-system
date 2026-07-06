"""Shared company / party identity blocks for print-preview JSON payloads."""


def file_absolute_url(file_field, request=None) -> str | None:
    if not file_field:
        return None
    url = file_field.url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


def build_company_print_identity(company, request=None) -> dict:
    """Company header block for invoices, quotations, receipts, vouchers."""
    return {
        "name_ar": company.name_ar or "",
        "name_en": company.name_en or "",
        "trn": (company.trn or "").strip(),
        "phone": (company.phone or "").strip(),
        "address": (company.address or "").strip(),
        "email": (company.email or "").strip(),
        "logo_url": file_absolute_url(company.logo, request),
        "stamp_url": file_absolute_url(company.stamp, request),
        "signature_url": file_absolute_url(company.signature, request),
    }


def build_sales_customer_party(invoice) -> dict:
    """Customer block for sales invoice print preview (snapshot-first)."""
    name = (invoice.customer_name_snapshot or "").strip()
    trn = (invoice.customer_trn_snapshot or "").strip()
    phone = (invoice.customer_phone_snapshot or "").strip()
    address = (invoice.customer_address_snapshot or "").strip()

    customer = getattr(invoice, "customer", None)
    if customer is not None:
        if not name:
            name = customer.name_ar or ""
        if not trn:
            trn = (customer.trn or "").strip()
        if not phone:
            phone = (customer.phone or "").strip()
        if not address:
            address = (customer.address or "").strip()

    return {
        "name": name,
        "name_ar": name,
        "name_en": name,
        "trn": trn,
        "phone": phone,
        "address": address,
    }
