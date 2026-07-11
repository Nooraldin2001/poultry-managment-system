"""Permission catalog: groups, actions, and the canonical code list.

A permission ``code`` is ``"<group>.<action>"`` (e.g. ``"sales.approve"``).
The seed command (``seed_permissions``) materializes these into the
``PermissionCode`` table and seeds the role defaults below.

Edit this file to add/adjust permissions; re-run ``seed_permissions`` to apply.
"""

# Permission groups (modules). Mirrors BUSINESS_RULES / API_DESIGN modules.
GROUPS = [
    "dashboard",
    "sales",
    "quotations",
    "purchases",
    "inventory",
    "products",
    "customers",
    "suppliers",
    "payments",
    "treasury",
    "receipts",
    "expenses",
    "reports",
    "tax",
    "settings",
    "users",
    "audit",
    "premium_communications",
]

# Available actions per group. Only meaningful combinations are listed so the
# catalog stays clean. "sensitive" = may perform sensitive/audited operations
# (price edit, KG override, opening-balance edit, etc.) for that module.
GROUP_ACTIONS = {
    "dashboard": ["view"],
    "sales": [
        "view", "create", "edit", "approve", "cancel", "print", "export",
        "sensitive", "view_cost", "view_profit", "override_price", "override_kg",
        "apply_discount", "collection_adjustment", "credit_override", "backdate",
    ],
    "quotations": [
        "view", "create", "edit", "send", "accept", "reject", "cancel",
        "convert_to_sales", "print", "export", "override_price", "free_product_override",
    ],
    "purchases": [
        "view", "create", "edit", "approve", "cancel", "print", "export",
        "sensitive", "upload_attachment", "view_cost", "manage_adjustments",
        "manage_service_charges",
        "override_price", "backdate",
    ],
    "inventory": [
        "view", "view_movements", "view_valuation", "adjust", "export",
        "manage", "sensitive",
    ],
    "products": [
        "view", "create", "edit", "delete", "disable", "export",
        "manage_settings", "view_purchase_cost",
    ],
    "customers": [
        "view", "create", "edit", "delete", "export", "sensitive",
        "disable", "view_balance", "edit_opening_balance",
        "set_credit_limit", "override_credit_limit",
    ],
    "suppliers": [
        "view", "create", "edit", "delete", "export", "sensitive",
        "disable", "view_balance", "edit_opening_balance",
    ],
    "payments": [
        "view", "create_customer_collection", "create_supplier_payment",
        "create_customer_refund", "create_supplier_refund", "cancel", "allocate",
        "print", "export", "reconcile", "sensitive", "backdate",
    ],
    "treasury": [
        "view",
        "create",
        "update",
        "delete",
        "adjust",
        "transfer",
        "movements.view",
        "statement.view",
    ],
    "receipts": ["view", "print"],
    "expenses": [
        "view", "create", "edit", "cancel", "print", "export",
        "manage_categories", "manage_recurring", "purchase_link",
        "view_profit_impact", "upload_attachment", "backdate",
    ],
    "reports": ["view", "export"],
    "tax": ["view", "edit", "export", "sensitive"],
    "settings": ["view", "manage"],
    "users": ["view", "manage"],
    "audit": ["view"],
    "premium_communications": ["view", "manage"],
}

# Multi-segment codes (group.subgroup.action) that don't fit GROUP_ACTIONS.
EXTRA_PERMISSIONS = [
    # (code, group, action, is_sensitive)
    ("customers.special_prices.manage", "customers", "special_prices.manage", True),
    ("customers.free_products.manage", "customers", "free_products.manage", False),
    ("customers.statement.export", "customers", "statement.export", False),
    ("suppliers.special_prices.manage", "suppliers", "special_prices.manage", True),
    ("suppliers.agreements.manage", "suppliers", "agreements.manage", False),
    ("suppliers.statement.export", "suppliers", "statement.export", False),
    # Inventory multi-segment codes.
    ("inventory.stocktaking.create", "inventory", "stocktaking.create", False),
    ("inventory.stocktaking.apply", "inventory", "stocktaking.apply", True),
    ("inventory.settings.manage", "inventory", "settings.manage", False),
    # Tax / VAT (Phase 9)
    ("tax.view_sales_vat", "tax", "view_sales_vat", False),
    ("tax.view_purchase_vat", "tax", "view_purchase_vat", False),
    ("tax.view_expense_vat", "tax", "view_expense_vat", False),
    ("tax.view_net_vat", "tax", "view_net_vat", False),
    ("tax.generate_warnings", "tax", "generate_warnings", False),
    ("tax.dismiss_warnings", "tax", "dismiss_warnings", True),
    ("tax.adjust", "tax", "adjust", True),
    ("tax.cancel_adjustment", "tax", "cancel_adjustment", True),
    ("tax.view_audit", "tax", "view_audit", False),
    # Reports & analytics (Phase 10)
    ("reports.view_dashboard", "reports", "view_dashboard", False),
    ("reports.view_sales", "reports", "view_sales", False),
    ("reports.view_purchases", "reports", "view_purchases", False),
    ("reports.view_inventory", "reports", "view_inventory", False),
    ("reports.view_inventory_valuation", "reports", "view_inventory_valuation", True),
    ("reports.view_customer_statement", "reports", "view_customer_statement", False),
    ("reports.view_supplier_statement", "reports", "view_supplier_statement", False),
    ("reports.view_payments", "reports", "view_payments", False),
    ("reports.view_expenses", "reports", "view_expenses", False),
    ("reports.view_profit", "reports", "view_profit", True),
    ("reports.view_tax_summary", "reports", "view_tax_summary", False),
    ("reports.save_snapshot", "reports", "save_snapshot", False),
    ("reports.view_audit", "reports", "view_audit", False),
]

# Actions that are inherently sensitive (require reason + audit when performed).
SENSITIVE_ACTIONS = {
    "approve", "cancel", "sensitive",
    "edit_opening_balance", "override_credit_limit", "override_price",
    "override_kg", "apply_discount", "collection_adjustment", "credit_override",
    "view_cost", "view_profit",
}


def all_permission_codes():
    """Yield ``(code, group, action, is_sensitive)`` for the whole catalog."""
    for group in GROUPS:
        for action in GROUP_ACTIONS.get(group, []):
            code = f"{group}.{action}"
            yield code, group, action, action in SENSITIVE_ACTIONS
    for code, group, action, sensitive in EXTRA_PERMISSIONS:
        yield code, group, action, sensitive


def code_set():
    return {code for code, _, _, _ in all_permission_codes()}


# --- Role defaults --------------------------------------------------------
# Owner/Admin is granted EVERYTHING (handled in seed + short-circuited in the
# checker so an admin can never be locked out). Accountant and Cashier/Sales
# defaults are explicit allow-lists below; anything not listed defaults to deny.

ACCOUNTANT_DEFAULTS = [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.edit",
    "sales.approve",
    "sales.print",
    "sales.export",
    "sales.apply_discount",
    "sales.backdate",
    "sales.view_cost",
    "sales.view_profit",
    "quotations.view",
    "quotations.create",
    "quotations.edit",
    "quotations.send",
    "quotations.accept",
    "quotations.reject",
    "quotations.print",
    "quotations.export",
    "quotations.convert_to_sales",
    # Purchases: accountant handles purchases end-to-end EXCEPT cancellation and
    # price override (Owner/Admin or per-user override required for those).
    "purchases.view", "purchases.create", "purchases.edit",
    "purchases.approve", "purchases.print", "purchases.export",
    "purchases.upload_attachment", "purchases.view_cost",
    "purchases.manage_adjustments", "purchases.backdate",
    "purchases.manage_service_charges",
    # Inventory: read + valuation + export. Adjustments and stocktaking apply
    # stay DISABLED by default (Owner/Admin or per-user override required).
    "inventory.view",
    "inventory.view_movements",
    "inventory.view_valuation",
    "inventory.export",
    # Products: view/create/edit (+ cost visibility & export) for accountant.
    "products.view", "products.create", "products.edit",
    "products.export", "products.view_purchase_cost",
    # Customers: view/create/edit + balances & statement export (conservative:
    # no opening-balance edit / credit override / special-price management).
    "customers.view", "customers.create", "customers.edit",
    "customers.view_balance", "customers.statement.export",
    # Suppliers: same conservative posture.
    "suppliers.view", "suppliers.create", "suppliers.edit",
    "suppliers.view_balance", "suppliers.statement.export",
    "payments.view", "payments.create_customer_collection",
    "payments.create_supplier_payment", "payments.create_customer_refund",
    "payments.create_supplier_refund", "payments.allocate",
    "payments.print", "payments.export", "payments.reconcile",
    "receipts.view", "receipts.print",
    "expenses.view", "expenses.create", "expenses.edit", "expenses.print",
    "expenses.export", "expenses.manage_categories", "expenses.manage_recurring",
    "expenses.purchase_link", "expenses.view_profit_impact", "expenses.upload_attachment",
    "tax.view", "tax.view_sales_vat", "tax.view_purchase_vat", "tax.view_expense_vat",
    "tax.view_net_vat", "tax.generate_warnings", "tax.dismiss_warnings",
    "tax.export", "tax.view_audit",
    "reports.view_dashboard", "reports.view_sales", "reports.view_purchases",
    "reports.view_inventory", "reports.view_inventory_valuation",
    "reports.view_customer_statement", "reports.view_supplier_statement",
    "reports.view_payments", "reports.view_expenses", "reports.view_profit",
    "reports.view_tax_summary", "reports.export", "reports.view_audit",
    "settings.view",
    "treasury.view",
    "treasury.create",
    "treasury.update",
    "treasury.delete",
    "treasury.adjust",
    "treasury.transfer",
    "treasury.movements.view",
    "treasury.statement.view",
    "audit.view",
]

CASHIER_DEFAULTS = [
    "dashboard.view",
    "sales.view", "sales.create", "sales.print",
    "quotations.view", "quotations.create", "quotations.send", "quotations.print",
    "products.view",
    "customers.view",
    "inventory.view",
    "payments.view", "payments.create_customer_collection", "payments.print",
    "treasury.view",
    "receipts.view", "receipts.print",
    "reports.view_dashboard", "reports.view_sales",
]


def role_default_map():
    """Return ``{role_value: {code: allowed_bool}}`` for all tenant roles."""
    from apps.accounts.models import TenantRole

    every = {code: False for code in code_set()}

    owner = {code: True for code in code_set()}

    accountant = dict(every)
    for code in ACCOUNTANT_DEFAULTS:
        accountant[code] = True

    cashier = dict(every)
    for code in CASHIER_DEFAULTS:
        cashier[code] = True

    return {
        TenantRole.OWNER_ADMIN: owner,
        TenantRole.ACCOUNTANT: accountant,
        TenantRole.CASHIER_SALES: cashier,
    }
