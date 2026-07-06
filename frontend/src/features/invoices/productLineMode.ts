import type { ProductRow } from "@/shared/types/entities";

/** Fixed-weight whole birds — cartons drive KG calculation. */
export function isCartonBasedProduct(prod: ProductRow | undefined): boolean {
  if (!prod) return false;
  return prod.type === "fixed" && (prod.g ?? 0) > 0 && (prod.ppc ?? 0) > 0;
}

/** Poultry cuts, moving weight, loose by-products — purchased/sold by KG. */
export function isKgPrimaryProduct(prod: ProductRow | undefined): boolean {
  if (!prod) return false;
  if (prod.type === "part" || prod.type === "moving") return true;
  if (prod.type === "byproduct") {
    return !((prod.g ?? 0) > 0 && (prod.ppc ?? 0) > 0);
  }
  return false;
}

export function defaultLineQuantitiesForProduct(prod: ProductRow | undefined): {
  cartons: number;
  pieces: number;
  kg: number;
} {
  if (isKgPrimaryProduct(prod)) {
    return { cartons: 0, pieces: 0, kg: 0 };
  }
  return { cartons: 1, pieces: 0, kg: 0 };
}
