import type { SInvStatus } from "@/shared/types/documents";

/** Map API sales invoice status to UI badge status. */
export function normalizeSalesInvoiceStatus(status: string | null | undefined): SInvStatus {
  const key = (status ?? "").toLowerCase();
  if (key === "partially_paid" || key === "partial") return "partial";
  if (key === "draft" || key === "approved" || key === "paid" || key === "cancelled" || key === "adjusted") {
    return key;
  }
  return "approved";
}

export function isSalesCollectibleStatus(status: string): boolean {
  const n = normalizeSalesInvoiceStatus(status);
  return n === "approved" || n === "partial";
}
