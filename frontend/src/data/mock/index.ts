// Centralized mock-data barrel — PRODUCTION-GATED.
//
// Screens (App.tsx) import demo/business data from here. Every business array is
// passed through `gate()`, which returns the demo data ONLY in mock mode
// (VITE_USE_MOCK_DATA=true in a dev build) and an EMPTY array otherwise.
//
// Result: a production build (where IS_MOCK_MODE is forced false) renders clean
// empty states instead of fake companies / revenue / customers / etc. The raw
// demo literals still live in the individual *.mock.ts files for local dev.
//
// `ALL_MODULES` is app configuration (the module catalogue), NOT business data,
// so it is always exported.

import { IS_MOCK_MODE } from "@/services/config";

import * as company from "./company.mock";
import * as products from "./products.mock";
import * as customers from "./customers.mock";
import * as suppliers from "./suppliers.mock";
import * as sales from "./sales.mock";
import * as purchases from "./purchases.mock";
import * as reports from "./reports.mock";
import * as notifications from "./notifications.mock";
import * as inventory from "./inventory.mock";
import * as expenses from "./expenses.mock";
import * as payments from "./payments.mock";
import * as users from "./users.mock";

export type { TaxSummary } from "./tax.mock";

/** Demo data in mock mode, empty array in live/production mode. */
function gate<T>(items: readonly T[]): T[] {
  return IS_MOCK_MODE ? [...items] : [];
}

// ── Config (always available) ────────────────────────────────────────────────
export const ALL_MODULES = company.ALL_MODULES;

// ── Super Admin business data (gated) ─────────────────────────────────────────
export const COMPANIES = gate(company.COMPANIES);
export const REVENUE_DATA = gate(company.REVENUE_DATA);
export const STATUS_PIE = gate(company.STATUS_PIE);
export const PAYMENTS_DATA = gate(company.PAYMENTS_DATA);
export const AUDIT_LOGS = gate(company.AUDIT_LOGS);
export const PLANS_DATA = gate(company.PLANS_DATA);
export const RECENT_ACTIVITY = gate(company.RECENT_ACTIVITY);

// ── Tenant business data (gated) ──────────────────────────────────────────────
export const T_PRODUCTS = gate(products.T_PRODUCTS);
export const S_PRODUCTS = gate(products.S_PRODUCTS);
export const T_CUSTOMERS = gate(customers.T_CUSTOMERS);
export const S_CUSTOMERS = gate(customers.S_CUSTOMERS);
export const T_SUPPLIERS = gate(suppliers.T_SUPPLIERS);
export const T_INVOICES = gate(sales.T_INVOICES);
export const S_INVOICES = gate(sales.S_INVOICES);
export const T_PURCHASES = gate(purchases.T_PURCHASES);
export const T_DAILY = gate(reports.T_DAILY);
export const T_MONTHLY_PROFIT = gate(reports.T_MONTHLY_PROFIT);
export const T_PAY_PIE = gate(reports.T_PAY_PIE);
export const T_NOTIFS = gate(notifications.T_NOTIFS);
export const EXPENSES = gate(expenses.EXPENSES);
export const INVENTORY_ITEMS = gate(inventory.INVENTORY_ITEMS);
export const PAYMENT_MOVEMENTS = gate(payments.PAYMENT_MOVEMENTS);
export const TENANT_USERS = gate(users.TENANT_USERS);
