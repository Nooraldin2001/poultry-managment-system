// Document (invoice / quotation) boundary types.

import type { MoneyAmount, PaymentMethod } from "./money";

/** Generic lifecycle status for trade documents. */
export type DocumentStatus =
  | "draft" | "approved" | "partial" | "paid" | "cancelled" | "adjusted";

// ── Sales-invoice working types (used by the sales workflow in App.tsx) ──────────
export interface SProduct {
  id: string; name: string; nameAr: string; g: number; ppc: number;
  priceKg: number; stock: number; variable?: boolean; isPart?: boolean;
}

export interface SInvLine {
  id: string; productId: string; cartons: number; pcs: number; kg: number;
  priceKg: number; amount: number; kgOverride: boolean; priceOverride: boolean;
}

export type SInvStatus = "draft" | "approved" | "partial" | "paid" | "cancelled" | "adjusted";

export interface SInvoice {
  id: string; date: string; customerId: string; customer: string; customerEn: string;
  cartons: number; kg: number; subtotal: number; vat: number; total: number;
  paid: number; remaining: number; method: string; status: SInvStatus; user: string;
}

// ── API-boundary document shapes (for the future Django REST integration) ────────
export interface SalesInvoice {
  id: string;
  date: string;
  customerId?: string;
  customer: string;
  customerEn?: string;
  cartons?: number;
  weightKg?: number;
  subtotal?: MoneyAmount;
  vat?: MoneyAmount;
  total: MoneyAmount;
  paid?: MoneyAmount;
  remaining?: MoneyAmount;
  method?: PaymentMethod | string;
  status: string;
}

export interface PurchaseInvoice {
  id: string;
  date?: string;
  supplier: string;
  supplierEn?: string;
  cartons?: number;
  weightKg?: number;
  total: MoneyAmount;
  method?: PaymentMethod | string;
  status?: string;
}
