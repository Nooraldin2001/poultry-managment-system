/** Purchase invoice display status (UI badge keys). */
export type PurchaseDisplayStatus =
  | "draft"
  | "approved"
  | "paid"
  | "partial"
  | "credit"
  | "cancelled";

export type PurchaseStatusStyle = {
  bg: string;
  text: string;
  border: string;
  labelAr: string;
  labelEn: string;
  /** @deprecated use `text` — kept for legacy badge components */
  t?: string;
  /** @deprecated use `labelAr` / `labelEn` */
  ar?: string;
  en?: string;
};

export const DEFAULT_PURCHASE_STATUS_STYLE: PurchaseStatusStyle = {
  bg: "bg-slate-100",
  text: "text-slate-700",
  border: "border-slate-200",
  labelAr: "غير معروف",
  labelEn: "Unknown",
  t: "text-slate-700",
  ar: "غير معروف",
  en: "Unknown",
};

export const PURCHASE_STATUS_STYLES: Record<string, PurchaseStatusStyle> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    labelAr: "مسودة",
    labelEn: "Draft",
    t: "text-slate-600",
    ar: "مسودة",
    en: "Draft",
  },
  approved: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    labelAr: "معتمدة",
    labelEn: "Approved",
    t: "text-blue-700",
    ar: "معتمدة",
    en: "Approved",
  },
  paid: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    labelAr: "مدفوعة",
    labelEn: "Paid",
    t: "text-emerald-700",
    ar: "مدفوعة",
    en: "Paid",
  },
  partial: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    labelAr: "مدفوعة جزئياً",
    labelEn: "Partial",
    t: "text-amber-700",
    ar: "مدفوعة جزئياً",
    en: "Partial",
  },
  partially_paid: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    labelAr: "مدفوعة جزئياً",
    labelEn: "Partially Paid",
    t: "text-amber-700",
    ar: "مدفوعة جزئياً",
    en: "Partially Paid",
  },
  credit: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    labelAr: "على الحساب",
    labelEn: "On Account",
    t: "text-violet-700",
    ar: "على الحساب",
    en: "On Account",
  },
  unpaid: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    labelAr: "غير مدفوعة",
    labelEn: "Unpaid",
    t: "text-blue-700",
    ar: "غير مدفوعة",
    en: "Unpaid",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    labelAr: "ملغاة",
    labelEn: "Cancelled",
    t: "text-red-700",
    ar: "ملغاة",
    en: "Cancelled",
  },
  canceled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    labelAr: "ملغاة",
    labelEn: "Cancelled",
    t: "text-red-700",
    ar: "ملغاة",
    en: "Cancelled",
  },
  مسودة: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    labelAr: "مسودة",
    labelEn: "Draft",
    t: "text-slate-600",
    ar: "مسودة",
    en: "Draft",
  },
  معتمدة: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    labelAr: "معتمدة",
    labelEn: "Approved",
    t: "text-blue-700",
    ar: "معتمدة",
    en: "Approved",
  },
  ملغية: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    labelAr: "ملغاة",
    labelEn: "Cancelled",
    t: "text-red-700",
    ar: "ملغاة",
    en: "Cancelled",
  },
  ملغاة: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    labelAr: "ملغاة",
    labelEn: "Cancelled",
    t: "text-red-700",
    ar: "ملغاة",
    en: "Cancelled",
  },
};

/** Map API status + optional payment_status to a display badge key. */
export function normalizePurchaseInvoiceStatus(
  status?: string | null,
  paymentStatus?: string | null,
): string {
  const raw = (status ?? "").trim();
  const key = raw.toLowerCase();
  if (key === "partially_paid" || key === "partial") return "partial";
  if (
    key === "draft" ||
    key === "approved" ||
    key === "paid" ||
    key === "cancelled" ||
    key === "canceled" ||
    key === "credit"
  ) {
    return key === "canceled" ? "cancelled" : key;
  }
  if (PURCHASE_STATUS_STYLES[key]) return key;
  if (PURCHASE_STATUS_STYLES[raw]) return raw;

  const pay = (paymentStatus ?? "").toLowerCase();
  if (pay === "partially_paid") return "partial";
  if (pay === "paid") return "paid";
  if (pay === "unpaid" && key === "approved") return "approved";

  return key || "approved";
}

/** Safe Tailwind badge classes for any purchase status string. */
export function getPurchaseStatusStyle(
  status?: string | null,
  paymentStatus?: string | null,
): PurchaseStatusStyle {
  const normalized = normalizePurchaseInvoiceStatus(status, paymentStatus);
  const direct =
    PURCHASE_STATUS_STYLES[normalized] ??
    PURCHASE_STATUS_STYLES[(status ?? "").toLowerCase()] ??
    PURCHASE_STATUS_STYLES[status ?? ""];
  return direct ? { ...DEFAULT_PURCHASE_STATUS_STYLE, ...direct } : DEFAULT_PURCHASE_STATUS_STYLE;
}
