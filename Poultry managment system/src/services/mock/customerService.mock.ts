import type { Customer } from "@/shared/types/tenant";
import type { ItemResponse, ListResponse } from "@/services/api/types";
import { S_CUSTOMERS } from "@/data/mock/customers.mock";
import { mockDelay } from "./mockDelay";

export function listCustomers(): ListResponse<Customer> {
  return mockDelay(S_CUSTOMERS as Customer[]);
}

export function getCustomerById(id: string): ItemResponse<Customer> {
  return mockDelay((S_CUSTOMERS as Customer[]).find((c) => c.id === id) ?? null);
}
