import type { Lang } from "@/shared/types";
import type { ProductRow } from "@/shared/types/entities";
import type { PriceType } from "./types";
import { isCartonBasedProduct, isKgPrimaryProduct } from "./productLineMode";

const VALID: PriceType[] = ["kg", "piece", "carton", "tray"];

export function parsePriceType(value?: string | null, fallback: PriceType = "kg"): PriceType {
  const v = (value ?? "").trim().toLowerCase();
  return (VALID.includes(v as PriceType) ? v : fallback) as PriceType;
}

/** Default line price type when adding a product to an invoice. */
export function defaultLinePriceType(
  prod: ProductRow | undefined,
  mode: "sales" | "purchase",
): PriceType {
  if (!prod) return "kg";
  const configured = mode === "purchase" ? prod.buyPT : prod.salePT;
  if (isKgPrimaryProduct(prod)) return "kg";
  // Poultry fixed-weight carton products are invoiced per KG unless the product
  // is explicitly configured for carton pricing.
  if (mode === "purchase" && isCartonBasedProduct(prod) && configured !== "carton") {
    return "kg";
  }
  return parsePriceType(configured, "kg");
}

export function priceTypeShortLabel(priceType: PriceType, lang: Lang): string {
  const isRTL = lang === "ar";
  switch (priceType) {
    case "kg":
      return isRTL ? "كجم" : "KG";
    case "piece":
      return isRTL ? "حبة" : "Pc";
    case "carton":
      return isRTL ? "كرتون" : "Ct";
    case "tray":
      return isRTL ? "صينية" : "Tray";
    default:
      return priceType;
  }
}

/** Column header for the unit-price input. */
export function priceColumnLabel(priceType: PriceType, lang: Lang): string {
  const isRTL = lang === "ar";
  switch (priceType) {
    case "kg":
      return isRTL ? "السعر لكل كيلو" : "Price per KG";
    case "piece":
      return isRTL ? "السعر لكل حبة" : "Price per piece";
    case "carton":
      return isRTL ? "السعر لكل كرتون" : "Price per carton";
    case "tray":
      return isRTL ? "السعر لكل صينية" : "Price per tray";
    default:
      return isRTL ? "السعر" : "Price";
  }
}
