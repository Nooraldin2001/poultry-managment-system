import type { ObjectResponse } from "@/services/api/types";
import { TAX_SUMMARY, type TaxSummary } from "@/data/mock/tax.mock";
import { mockDelay } from "./mockDelay";

export function getTaxSummary(): ObjectResponse<TaxSummary> {
  return mockDelay(TAX_SUMMARY);
}
