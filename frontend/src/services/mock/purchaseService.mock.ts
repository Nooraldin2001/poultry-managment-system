import type { PurchaseInvoice } from "@/shared/types/documents";
import type { ListResponse } from "@/services/api/types";
import { T_PURCHASES } from "@/data/mock/purchases.mock";
import { mockDelay } from "./mockDelay";

export function listPurchaseInvoices(): ListResponse<PurchaseInvoice> {
  return mockDelay(T_PURCHASES as PurchaseInvoice[]);
}
