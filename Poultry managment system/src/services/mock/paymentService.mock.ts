import type { PaymentMovement } from "@/shared/types/tenant";
import type { ListResponse } from "@/services/api/types";
import { PAYMENT_MOVEMENTS } from "@/data/mock/payments.mock";
import { mockDelay } from "./mockDelay";

export function listPaymentMovements(): ListResponse<PaymentMovement> {
  return mockDelay(PAYMENT_MOVEMENTS);
}
