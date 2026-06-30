// Payment-movement mock data for the service boundary.
// NOTE: PaymentsModule screens use their own internal mock data; this
// representative set backs the future API service (see services/).
import type { PaymentMovement } from "@/shared/types/tenant";

export const PAYMENT_MOVEMENTS: PaymentMovement[] = [
  { id: "M001", type: "collection", party: "مطعم الخليج",         amount: 2001.56, method: "cash",   date: "2025-01-28", reference: "RCV-0086" },
  { id: "M002", type: "collection", party: "سوبر ماركت المدينة", amount: 5000,    method: "credit", date: "2025-01-28", reference: "RCV-0085" },
  { id: "M003", type: "payment",    party: "مزرعة العين للدواجن", amount: 8400,    method: "bank",   date: "2025-01-27", reference: "PAY-0041" },
];
