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
    "sales": ["view", "create", "edit", "approve", "cancel", "print", "export", "sensitive"],
    "quotations": ["view", "create", "edit", "cancel", "print"],
    "purchases": [
        "view", "create", "edit", "approve", "cancel", "print", "export",
        "sensitive", "upload_attachment", "view_cost", "manage_adjustments",
        "override_price",
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
    "payments": ["view", "create", "cancel", "print", "sensitive"],
    "expenses": ["view", "create", "edit", "cancel"],
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
]

# Actions that are inherently sensitive (require reason + audit when performed).
SENSITIVE_ACTIONS = {
    "approve", "cancel", "sensitive",
    "edit_opening_balance", "override_credit_limit", "override_price",
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
    "sales.print",
    "quotations.view",
    # Purchases: accountant handles purchases end-to-end EXCEPT cancellation and
    # price override (Owner/Admin or per-user override required for those).
    "purchases.view", "purchases.create", "purchases.edit",
    "purchases.approve", "purchases.print", "purchases.export",
    "purchases.upload_attachment", "purchases.view_cost",
    "purchases.manage_adjustments",
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
    "payments.view", "payments.create", "payments.print",
    "expenses.view", "expenses.create", "expenses.edit",
    "reports.view", "reports.export",
    "tax.view", "tax.export",
    "settings.view",
    "audit.view",
]

CASHIER_DEFAULTS = [
    "dashboard.view",
    "sales.view", "sales.create", "sales.print",
    "quotations.view", "quotations.create", "quotations.print",
    "products.view",
    "customers.view",
    "inventory.view",
    "payments.create", "payments.print",
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
