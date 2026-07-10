// Screen-name unions for navigation. Kept identical to the original
// inline unions in App.tsx so existing screen state keeps working.

/** Super Admin (SaaS operator) screens. */
export type SuperAdminScreen =
  | "login" | "dashboard" | "companies" | "company-detail" | "company-edit"
  | "create-company" | "payments" | "outstanding" | "plans" | "audit-log" | "settings";

/** All tenant workspace screens (sidebar targets + sub-screens + modals routed via state). */
export type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "sales-edit" | "sales-preview" | "sales-detail"
  | "purchases" | "purchases-list" | "purchases-new" | "purchases-edit" | "purchases-preview" | "purchases-detail"
  | "quotations" | "inventory" | "inventory-product" | "inventory-stocktaking" | "inventory-alerts" | "inventory-movement" | "inventory-valuation"
  | "customers" | "customers-create" | "customers-edit" | "customers-profile" | "customers-statement"
  | "suppliers" | "suppliers-new" | "suppliers-edit" | "supplier-profile" | "supplier-statement"
  | "payments" | "expenses" | "expenses-list" | "expenses-recurring" | "expenses-report" | "expense-detail" | "expense-voucher"
  | "accounts" | "accounts-list" | "accounts-new" | "accounts-edit" | "accounts-detail" | "accounts-statement"
  | "tax" | "tax-sales" | "tax-purchases" | "tax-net" | "tax-warnings" | "tax-audit" | "tax-credit-notes" | "tax-non-taxable" | "tax-settings" | "tax-export-preview" | "users" | "qa-summary"
  | "payments-movements" | "payments-customer-collection" | "payments-supplier-payment" | "payments-customer-refund" | "payments-supplier-refund" | "payment-receipt-detail" | "payment-receipt-preview" | "payments-method-summary" | "payments-cash-bank" | "payments-report"
  | "products" | "products-new" | "products-edit" | "product-detail" | "product-categories" | "products-bulk-setup" | "products-byproducts" | "products-import-export"
  | "quotations-new" | "quotation-detail" | "quotation-preview" | "quotation-convert" | "quotation-analytics"
  | "settings" | "settings-company" | "settings-users" | "settings-user-new" | "settings-user-permissions"
  | "settings-roles" | "settings-sensitive-actions" | "settings-audit" | "settings-numbering"
  | "settings-vat" | "settings-print-templates" | "settings-invoice-design" | "settings-transactions" | "settings-plan" | "settings-security"
  | "reports" | "reports-daily" | "reports-sales" | "reports-purchases" | "reports-inventory"
  | "reports-customers" | "reports-suppliers" | "reports-tax" | "reports-profit" | "reports-statements" | "reports-builder";

/** Tenant navigation callback signature used by screen components. */
export type TenantNavigate = (screen: string) => void;
