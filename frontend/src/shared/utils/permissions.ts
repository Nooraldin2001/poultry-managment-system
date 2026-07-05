import type { TenantRole } from "@/shared/types/roles";

/** True when the user may manage tenant users (owner or explicit permission). */
export function canManageUsers(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("users.manage") || permissions.includes("users.view");
  }
  return false;
}

/** True when the user may override sales line prices. */
export function canOverrideSalesPrice(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("sales.override_price");
  }
  return role === "accountant";
}

/** True when the user may edit tenant customers. */
export function canEditCustomer(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("customers.edit");
  }
  return role === "accountant";
}

/** True when the user may create tenant customers. */
export function canCreateCustomer(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("customers.create");
  }
  return role === "accountant";
}

/** True when the user may edit customer opening balance. */
export function canEditCustomerOpeningBalance(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("customers.edit_opening_balance");
  }
  return role === "accountant";
}

/** True when the user may edit tenant suppliers. */
export function canEditSupplier(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("suppliers.edit");
  }
  return role === "accountant";
}

/** True when the user may create tenant suppliers. */
export function canCreateSupplier(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("suppliers.create");
  }
  return role === "accountant";
}

/** True when the user may override purchase line prices. */
export function canOverridePurchasePrice(role: TenantRole, permissions: string[]): boolean {
  if (role === "owner") return true;
  if (permissions.length > 0) {
    return permissions.includes("purchases.override_price");
  }
  return role === "accountant";
}
