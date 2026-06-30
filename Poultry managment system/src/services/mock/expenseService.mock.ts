import type { Expense } from "@/shared/types/tenant";
import type { ListResponse } from "@/services/api/types";
import { EXPENSES } from "@/data/mock/expenses.mock";
import { mockDelay } from "./mockDelay";

export function listExpenses(): ListResponse<Expense> {
  return mockDelay(EXPENSES);
}
