import type { TenantScreen } from "@/shared/types/navigation";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantNavItem } from "./tenantNavigation";
import { T_NAV } from "./tenantNavigation";

/** Minimum permission to view a top-level nav module. */
const NAV_PERMISSION: Partial<Record<TenantScreen, string>> = {
  dashboard: "dashboard.view",
  sales: "sales.view",
  quotations: "quotations.view",
  purchases: "purchases.view",
  inventory: "inventory.view",
  products: "products.view",
  customers: "customers.view",
  suppliers: "suppliers.view",
  payments: "payments.view",
  expenses: "expenses.view",
  tax: "tax.view",
  reports: "reports.view",
  users: "users.view",
  settings: "settings.view",
};

/** Screens that require a specific permission (includes sub-screens). */
const SCREEN_PERMISSION: Partial<Record<TenantScreen, string>> = {
  ...NAV_PERMISSION,
  "sales-new": "sales.create",
  "sales-edit": "sales.create",
  "sales-detail": "sales.view",
  "purchases-new": "purchases.create",
  "purchases-edit": "purchases.create",
  "purchases-detail": "purchases.view",
  "quotations-new": "quotations.create",
  "quotation-detail": "quotations.view",
  "products-new": "products.create",
  "products-edit": "products.edit",
  "product-detail": "products.view",
  "customers-create": "customers.create",
  "customers-edit": "customers.edit",
  "suppliers-new": "suppliers.create",
  "suppliers-edit": "suppliers.edit",
  "inventory-valuation": "inventory.view_valuation",
  "inventory-stocktaking": "inventory.manage",
  "tax-warnings": "tax.view",
  "tax-export-preview": "tax.export",
  "reports-profit": "reports.view",
  "settings-company": "settings.manage",
  "settings-vat": "settings.manage",
  "settings-numbering": "settings.manage",
  "settings-print-templates": "settings.manage",
  "settings-invoice-design": "settings.manage",
  "settings-users": "users.view",
  "settings-user-new": "users.manage",
  "settings-user-permissions": "users.manage",
  "payments-customer-refund": "payments.create_customer_refund",
  "payments-supplier-payment": "payments.create_supplier_payment",
};

/** Role-based fallback when permissions array is empty (dev/mock). */
const CASHIER_DENIED_SCREENS: TenantScreen[] = [
  "purchases", "purchases-list", "purchases-new", "purchases-edit", "purchases-preview", "purchases-detail",
  "accounts", "tax", "tax-sales", "tax-purchases", "tax-net", "tax-warnings", "tax-audit",
  "tax-credit-notes", "tax-non-taxable", "tax-settings", "tax-export-preview",
  "reports", "reports-daily", "reports-sales", "reports-purchases", "reports-inventory",
  "reports-customers", "reports-suppliers", "reports-tax", "reports-profit", "reports-statements",
  "reports-builder", "users", "settings-users", "settings-user-new", "settings-user-permissions",
  "settings-roles", "settings-vat", "settings-numbering", "settings-print-templates", "settings-invoice-design",
  "products-new", "product-categories", "products-bulk-setup", "products-byproducts", "products-import-export",
  "customers-create", "customers-edit",
  "suppliers-edit",
];

const ACCOUNTANT_DENIED_SCREENS: TenantScreen[] = ["users", "settings-user-new", "settings-roles"];

export function hasPermission(permissions: string[], code: string): boolean {
  if (!code) return true;
  if (permissions.includes(code)) return true;
  const [group] = code.split(".");
  return permissions.includes(`${group}.manage`);
}

export function canViewScreen(
  screen: TenantScreen,
  permissions: string[],
  role: TenantRole,
): boolean {
  const required = SCREEN_PERMISSION[screen];
  if (permissions.length > 0) {
    return required ? hasPermission(permissions, required) : true;
  }
  if (role === "cashier" && CASHIER_DENIED_SCREENS.includes(screen)) return false;
  if (role === "accountant" && ACCOUNTANT_DENIED_SCREENS.includes(screen)) return false;
  return true;
}

export function filterNavForUser(
  nav: TenantNavItem[],
  permissions: string[],
  role: TenantRole,
): TenantNavItem[] {
  return nav.filter((item) => {
    const code = NAV_PERMISSION[item.key];
    if (permissions.length > 0) {
      return code ? hasPermission(permissions, code) : true;
    }
    if (role === "cashier") {
      return !["purchases", "tax", "reports", "users", "accounts"].includes(item.key);
    }
    return true;
  });
}

export function getFilteredTenantNav(permissions: string[], role: TenantRole): TenantNavItem[] {
  return filterNavForUser(T_NAV, permissions, role);
}
