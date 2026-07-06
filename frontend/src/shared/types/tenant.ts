// Tenant-domain entity types (company + master data).
// Lightweight frontend/API-boundary shapes aligned to the current mock data.

import type { MoneyAmount } from "./money";

export type CompanyStatus = "active" | "trial" | "suspended";
export type CompanyPlan = "basic" | "pro" | "enterprise";

/** A tenant company managed by the Super Admin SaaS dashboard. */
export interface Company {
  id: string; nameAr: string; nameEn: string; subdomain: string;
  adminName: string; adminPhone: string; adminEmail: string;
  managerName?: string; managerPhone?: string; managerEmail?: string;
  phone?: string; email?: string; address?: string;
  licenseExpiryDate?: string; notes?: string;
  plan: CompanyPlan; status: CompanyStatus;
  monthlyPrice: number; yearlyPrice: number;
  renewalDate: string; outstandingAmount: number;
  totalPaid: number; lastPaymentDate: string;
  createdDate: string; emirate: string; tradeLicense: string;
  modules: string[];
  trn?: string;
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
}

/** A sellable product (whole birds by weight grade, or by-products / parts). */
export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
  cartons?: number;
  pieces?: number;
  weightKg?: number;
  minStock?: number;
  priceKg: MoneyAmount;
  variable?: boolean;
  isPart?: boolean;
}

/** A customer account. */
export interface Customer {
  id: string;
  name: string;
  nameEn?: string;
  phone?: string;
  balance: MoneyAmount;
  creditLimit?: MoneyAmount;
  overdue?: boolean;
  days?: number;
  trn?: string;
}

/** A supplier account. */
export interface Supplier {
  id: string;
  name: string;
  nameEn?: string;
  balance: MoneyAmount;
  due?: string;
  overdue?: boolean;
}

/** A stock line in the inventory overview. */
export interface InventoryItem {
  id: string;
  name: string;
  nameEn?: string;
  cartons?: number;
  pieces?: number;
  weightKg?: number;
  minStock?: number;
  priceKg?: MoneyAmount;
}

/** An expense record. */
export interface Expense {
  id: string;
  category?: string;
  categoryEn?: string;
  amount: MoneyAmount;
  date?: string;
  method?: string;
  note?: string;
}

/** A single financial movement (collection / payment / refund). */
export interface PaymentMovement {
  id: string;
  type?: string;
  party?: string;
  amount: MoneyAmount;
  method?: string;
  date?: string;
  reference?: string;
}

/** A generic report/KPI summary row used by reports + dashboards. */
export interface ReportSummary {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number | string;
  sub?: string;
}
