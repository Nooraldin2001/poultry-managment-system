import type { Product } from "@/shared/types/tenant";
import type { ItemResponse, ListResponse } from "@/services/api/types";
import { S_PRODUCTS } from "@/data/mock/products.mock";
import { mockDelay } from "./mockDelay";

export function listProducts(): ListResponse<Product> {
  return mockDelay(S_PRODUCTS as unknown as Product[]);
}

export function getProductById(id: string): ItemResponse<Product> {
  return mockDelay(
    (S_PRODUCTS as unknown as Product[]).find((p) => p.id === id) ?? null,
  );
}
