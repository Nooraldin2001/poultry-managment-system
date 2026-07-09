import type { Lang } from "@/shared/types";

export const SUPPLIER_PAYMENT_METHODS = [
  { value: "cash", labelAr: "نقدي", labelEn: "Cash" },
  { value: "bank", labelAr: "حساب بنكي", labelEn: "Bank" },
  { value: "credit", labelAr: "آجل", labelEn: "Credit" },
] as const;

export type SupplierPaymentMethodValue = (typeof SUPPLIER_PAYMENT_METHODS)[number]["value"];

export function supplierPaymentMethodOptions(lang: Lang) {
  const isRTL = lang === "ar";
  return SUPPLIER_PAYMENT_METHODS.map((m) => ({
    value: m.value,
    label: isRTL ? m.labelAr : m.labelEn,
  }));
}

/** Normalize API/legacy values to canonical supplier payment method. */
export function normalizeSupplierPaymentMethod(value: string | null | undefined): SupplierPaymentMethodValue {
  const raw = (value ?? "cash").trim().toLowerCase();
  if (raw === "bank_transfer" || raw === "cheque") return "bank";
  if (raw === "deferred") return "credit";
  if (raw === "cash" || raw === "bank" || raw === "credit") return raw;
  return "cash";
}

/** Map supplier default payment method to purchase invoice payment_method. */
export function mapSupplierPaymentToPurchase(value: string | null | undefined): string {
  const normalized = normalizeSupplierPaymentMethod(value);
  if (normalized === "bank") return "bank_transfer";
  if (normalized === "credit") return "credit";
  return "cash";
}
