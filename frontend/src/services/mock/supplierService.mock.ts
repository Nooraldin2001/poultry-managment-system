import type { Supplier } from "@/shared/types/tenant";
import type { ItemResponse, ListResponse } from "@/services/api/types";
import { T_SUPPLIERS } from "@/data/mock/suppliers.mock";
import { mockDelay } from "./mockDelay";

export function listSuppliers(): ListResponse<Supplier> {
  return mockDelay(T_SUPPLIERS as Supplier[]);
}

export function getSupplierById(id: string): ItemResponse<Supplier> {
  return mockDelay((T_SUPPLIERS as Supplier[]).find((s) => s.id === id) ?? null);
}
