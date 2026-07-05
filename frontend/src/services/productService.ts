import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { ProductCategoryRow, ProductRow, PriceTypeUi, ProductTypeUi } from "@/shared/types/entities";
import type { Product } from "@/shared/types/tenant";
import * as productMock from "./mock/productService.mock";

const crud = createCrudService<ApiProductList, ApiProductDetail>(ENDPOINTS.tenant.products);

interface ApiProductList {
  id: number;
  name_ar: string;
  name_en: string;
  sku: string;
  product_type: string;
  category: number;
  category_name: string;
  sales_price?: string;
  sales_price_type?: string;
  weight_grams?: number | null;
  default_pieces_per_carton?: number | null;
  is_active: boolean;
  track_inventory: boolean;
  carton_weight_kg?: string;
}

interface ApiProductDetail extends ApiProductList {
  purchase_price?: string;
  purchase_price_type?: string;
  minimum_stock_cartons?: string;
  minimum_stock_kg?: string;
  vat_taxable?: boolean;
}

interface ApiCategory {
  id: number;
  name_ar: string;
  name_en: string;
  is_active: boolean;
}

function mapProductType(t: string): ProductTypeUi {
  const m: Record<string, ProductTypeUi> = {
    fixed_weight: "fixed",
    moving_weight: "moving",
    chicken_part: "part",
    by_product: "byproduct",
    service: "service",
    other: "other",
  };
  return m[t] ?? "other";
}

function mapPriceType(t?: string): PriceTypeUi {
  const m: Record<string, PriceTypeUi> = {
    kg: "kg",
    piece: "piece",
    carton: "carton",
    tray: "tray",
  };
  return m[t ?? "kg"] ?? "kg";
}

function catKey(name?: string): string {
  if (!name) return "other";
  const n = name.toLowerCase();
  if (n.includes("whole")) return "whole";
  if (n.includes("moving")) return "moving";
  if (n.includes("part")) return "parts";
  if (n.includes("by")) return "byproduct";
  return "other";
}

export function mapApiProductListToRow(row: ApiProductList, stock?: { cartons?: number; kg?: number }): ProductRow {
  return {
    id: String(row.id),
    nameAr: row.name_ar,
    nameEn: row.name_en,
    sku: row.sku,
    cat: catKey(row.category_name),
    categoryId: row.category,
    type: mapProductType(row.product_type),
    g: row.weight_grams ?? 0,
    ppc: row.default_pieces_per_carton ?? 0,
    saleP: parseAmount(row.sales_price),
    salePT: mapPriceType(row.sales_price_type),
    buyP: 0,
    buyPT: "piece",
    minCt: 0,
    minKg: 0,
    active: row.is_active,
    vatT: true,
    stockCt: stock?.cartons ?? 0,
    stockKg: stock?.kg ?? parseAmount(row.carton_weight_kg),
    trackInv: row.track_inventory,
  };
}

export function mapApiProductDetailToRow(row: ApiProductDetail, stock?: { cartons?: number; kg?: number }): ProductRow {
  const base = mapApiProductListToRow(row, stock);
  return {
    ...base,
    buyP: parseAmount(row.purchase_price),
    buyPT: mapPriceType(row.purchase_price_type),
    minCt: parseAmount(row.minimum_stock_cartons),
    minKg: parseAmount(row.minimum_stock_kg),
    vatT: row.vat_taxable ?? true,
  };
}

export async function listProductRows(filters?: ApiListFilters): Promise<ProductRow[]> {
  if (IS_MOCK_MODE) {
    const mock = await productMock.listProducts();
    return mock.map((p: Product) => ({
      id: p.id,
      nameAr: p.nameAr ?? p.name ?? "",
      nameEn: p.nameEn ?? p.name ?? "",
      sku: (p as { sku?: string }).sku ?? "",
      cat: "whole",
      type: "fixed",
      g: 0,
      ppc: 0,
      saleP: parseAmount(p.priceKg),
      salePT: "kg",
      buyP: 0,
      buyPT: "piece",
      minCt: p.minStock ?? 0,
      minKg: 0,
      active: true,
      vatT: true,
      stockCt: p.cartons ?? 0,
      stockKg: p.weightKg ?? 0,
      trackInv: true,
    }));
  }
  const rows = await crud.listAll(filters);
  return rows.map((r) => mapApiProductListToRow(r));
}

export async function getProductRow(id: string): Promise<ProductRow | null> {
  if (IS_MOCK_MODE) {
    const p = await productMock.getProductById(id);
    if (!p) return null;
    return mapApiProductListToRow({
      id: Number(p.id),
      name_ar: p.nameAr ?? p.name,
      name_en: p.nameEn ?? p.name,
      sku: "",
      product_type: "fixed_weight",
      category: 0,
      category_name: "",
      sales_price: String(p.priceKg),
      is_active: true,
      track_inventory: true,
    }, { cartons: p.cartons, kg: p.weightKg });
  }
  try {
    const row = await crud.retrieve(id);
    return mapApiProductDetailToRow(row as ApiProductDetail);
  } catch {
    return null;
  }
}

export async function createProduct(payload: Record<string, unknown>): Promise<ProductRow> {
  const row = await crud.create(payload as never);
  return mapApiProductDetailToRow(row as ApiProductDetail);
}

export async function updateProduct(id: string, payload: Record<string, unknown>): Promise<ProductRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiProductDetailToRow(row as ApiProductDetail);
}

export async function disableProduct(id: string, reason?: string): Promise<ProductRow> {
  const row = await crud.action<ApiProductDetail>(id, "disable/", reason ? { reason } : {});
  return mapApiProductDetailToRow(row);
}

export async function reactivateProduct(id: string): Promise<ProductRow> {
  const row = await crud.action<ApiProductDetail>(id, "reactivate/", {});
  return mapApiProductDetailToRow(row);
}

export async function listProductCategories(): Promise<ProductCategoryRow[]> {
  if (IS_MOCK_MODE) return [];
  const res = await request<{ results?: ApiCategory[] } | ApiCategory[]>(ENDPOINTS.tenant.productCategories);
  const rows = Array.isArray(res) ? res : (res.results ?? []);
  return rows.map((c) => ({
    id: c.id,
    key: String(c.id),
    nameAr: c.name_ar,
    nameEn: c.name_en,
    active: c.is_active,
    count: 0,
  }));
}

function slugCategoryCode(name: string): string {
  const base = name.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "").toUpperCase().slice(0, 28);
  return base || `CAT${Date.now()}`;
}

export async function createProductCategory(form: {
  nameAr: string;
  nameEn?: string;
  code?: string;
}): Promise<ProductCategoryRow> {
  const row = await request<ApiCategory>(ENDPOINTS.tenant.productCategories, {
    method: "POST",
    body: {
      name_ar: form.nameAr.trim(),
      name_en: (form.nameEn?.trim() || form.nameAr.trim()),
      code: form.code?.trim() || slugCategoryCode(form.nameAr),
      is_active: true,
    },
  });
  return {
    id: row.id,
    key: String(row.id),
    nameAr: row.name_ar,
    nameEn: row.name_en,
    active: row.is_active !== false,
    count: 0,
  };
}

export function buildProductCreatePayload(form: {
  nameAr: string;
  nameEn: string;
  sku: string;
  categoryId: number;
  productType: string;
  weightGrams?: number;
  piecesPerCarton?: number;
  salesPrice: number;
  salesPriceType: string;
  purchasePrice: number;
  purchasePriceType: string;
  trackInventory: boolean;
  vatTaxable: boolean;
  minCartons?: number;
  minKg?: number;
}): Record<string, unknown> {
  return buildProductFormPayload(form);
}

const PRODUCT_TYPE_MAP: Record<string, string> = {
  fixed: "fixed_weight",
  moving: "moving_weight",
  part: "chicken_part",
  byproduct: "by_product",
  service: "service",
  other: "other",
};

function buildProductFormPayload(form: {
  nameAr: string;
  nameEn: string;
  sku: string;
  categoryId: number;
  productType: string;
  weightGrams?: number;
  piecesPerCarton?: number;
  salesPrice: number;
  salesPriceType: string;
  purchasePrice: number;
  purchasePriceType: string;
  trackInventory: boolean;
  vatTaxable: boolean;
  minCartons?: number;
  minKg?: number;
}): Record<string, unknown> {
  return {
    name_ar: form.nameAr.trim(),
    name_en: (form.nameEn.trim() || form.nameAr.trim()),
    sku: form.sku.trim(),
    category: form.categoryId,
    product_type: PRODUCT_TYPE_MAP[form.productType] ?? "other",
    weight_grams: form.weightGrams ?? null,
    default_pieces_per_carton: form.piecesPerCarton ?? null,
    sales_price: String(form.salesPrice),
    sales_price_type: form.salesPriceType,
    purchase_price: String(form.purchasePrice),
    purchase_price_type: form.purchasePriceType,
    track_inventory: form.trackInventory,
    vat_taxable: form.vatTaxable,
    minimum_stock_cartons: form.minCartons != null ? String(form.minCartons) : "0",
    minimum_stock_kg: form.minKg != null ? String(form.minKg) : "0",
  };
}

export type ProductFormSnapshot = {
  nameAr: string;
  nameEn: string;
  sku: string;
  categoryId: number;
  productType: string;
  weightGrams?: number;
  piecesPerCarton?: number;
  salesPrice: number;
  salesPriceType: string;
  purchasePrice: number;
  purchasePriceType: string;
  trackInventory: boolean;
  vatTaxable: boolean;
  minCartons?: number;
  minKg?: number;
};

function normMoney(value: unknown): string {
  const n = parseFloat(String(value ?? "0"));
  return Number.isNaN(n) ? "0.00" : n.toFixed(2);
}

function payloadValuesEqual(key: string, a: unknown, b: unknown): boolean {
  const moneyKeys = new Set(["sales_price", "purchase_price", "minimum_stock_cartons", "minimum_stock_kg"]);
  if (moneyKeys.has(key)) return normMoney(a) === normMoney(b);
  return a === b;
}

export function buildProductUpdatePayload(
  form: ProductFormSnapshot,
  loaded?: ProductFormSnapshot | null,
  reason?: string,
): Record<string, unknown> {
  const full = buildProductFormPayload(form);
  if (!loaded) {
    return reason ? { ...full, reason } : full;
  }

  const payload: Record<string, unknown> = {};
  const loadedPayload = buildProductFormPayload(loaded);
  for (const [key, value] of Object.entries(full)) {
    if (!payloadValuesEqual(key, loadedPayload[key], value)) {
      payload[key] = value;
    }
  }

  const priceKeys = ["sales_price", "sales_price_type", "purchase_price", "purchase_price_type"];
  const cartonKeys = ["weight_grams", "default_pieces_per_carton"];
  const sensitiveChanged =
    priceKeys.some((k) => k in payload) || cartonKeys.some((k) => k in payload);

  if (Object.keys(payload).length === 0) {
    return { name_ar: full.name_ar };
  }
  if (sensitiveChanged && reason) {
    payload.reason = reason;
  }
  return payload;
}

export function productFormNeedsReason(
  form: ProductFormSnapshot,
  loaded: ProductFormSnapshot | null,
): boolean {
  if (!loaded) return false;
  const patch = buildProductUpdatePayload(form, loaded);
  const priceKeys = ["sales_price", "sales_price_type", "purchase_price", "purchase_price_type"];
  const cartonKeys = ["weight_grams", "default_pieces_per_carton"];
  return (
    priceKeys.some((k) => k in patch) ||
    cartonKeys.some((k) => k in patch)
  );
}
