import { IS_MOCK_MODE } from "@/services/config";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { InventoryBalanceRow, StockMovementRow } from "@/shared/types/entities";
import * as inventoryMock from "./mock/inventoryService.mock";

interface ApiInventoryRow {
  id?: number;
  product?: number;
  product_id?: number;
  product_name?: string;
  product_name_ar?: string;
  product_name_en?: string;
  /** Legacy / summary aliases */
  total_cartons?: string | number;
  total_pieces?: string | number;
  total_weight_kg?: string | number;
  /** Current balance API fields (InventoryBalanceSerializer) */
  available_cartons?: string | number;
  available_pieces?: string | number;
  available_kg?: string | number;
  minimum_stock_cartons?: string | number;
  average_cost_per_kg?: string | number;
  estimated_fifo_value?: string | number;
  stock_status?: string;
}

function mapInventoryRow(row: ApiInventoryRow, index: number): InventoryBalanceRow {
  const productId = String(row.product ?? row.product_id ?? "");
  const cartons = parseAmount(row.available_cartons ?? row.total_cartons);
  const pieces = parseAmount(row.available_pieces ?? row.total_pieces);
  const weightKg = parseAmount(row.available_kg ?? row.total_weight_kg);
  const minStock = parseAmount(row.minimum_stock_cartons);
  const fifoValue = parseAmount(row.estimated_fifo_value);
  const priceKg =
    weightKg > 0 && fifoValue > 0
      ? fifoValue / weightKg
      : parseAmount(row.average_cost_per_kg);
  const statusRaw = (row.stock_status ?? "").toLowerCase();
  let status: InventoryBalanceRow["status"] = "ok";
  if (statusRaw.includes("out") || (cartons === 0 && pieces === 0 && weightKg === 0)) status = "out";
  else if (statusRaw.includes("low") || (minStock > 0 && cartons < minStock)) status = "low";
  const navId = productId || String(row.id ?? index);
  return {
    id: navId,
    productId: navId,
    name: row.product_name_ar ?? row.product_name ?? "",
    nameEn: row.product_name_en ?? row.product_name,
    cartons,
    pieces,
    weightKg,
    minStock,
    priceKg,
    status,
  };
}

export async function listInventoryRows(filters?: ApiListFilters): Promise<InventoryBalanceRow[]> {
  if (IS_MOCK_MODE) {
    const mock = await inventoryMock.listInventoryItems();
    return (mock as InventoryBalanceRow[]).map((i) => ({
      id: i.id,
      productId: i.id,
      name: i.name,
      nameEn: i.nameEn,
      cartons: i.cartons ?? 0,
      pieces: i.pieces ?? 0,
      weightKg: i.weightKg ?? 0,
      minStock: i.minStock ?? 0,
      priceKg: i.priceKg,
      status: "ok",
    }));
  }
  const data = await request<{ results?: ApiInventoryRow[] } | ApiInventoryRow[]>(
    ENDPOINTS.tenant.inventory,
    { query: filters as Record<string, string | number | boolean> },
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map(mapInventoryRow);
}

export async function getInventorySummary(): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.inventorySummary);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}

export async function listLowStockRows(): Promise<InventoryBalanceRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: ApiInventoryRow[] } | ApiInventoryRow[]>(
    ENDPOINTS.tenant.inventoryLowStock,
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map(mapInventoryRow);
}

export async function listStockMovements(filters?: ApiListFilters): Promise<StockMovementRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(ENDPOINTS.tenant.inventoryMovements, {
    query: filters as Record<string, string | number | boolean>,
  });
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    date: String(r.created_at ?? r.movement_date ?? r.date ?? "").slice(0, 10),
    product: String(r.product_name ?? ""),
    type: String(r.movement_type ?? r.movement_type_label ?? r.type ?? ""),
    cartons: parseAmount((r.cartons_delta ?? r.cartons) as string),
    pieces: parseAmount((r.pieces_delta ?? r.pieces) as string),
    weightKg: parseAmount((r.kg_delta ?? r.weight_kg ?? r.weightKg) as string),
    reference: String(r.reference_number ?? r.reference ?? r.document_number ?? ""),
    balanceAfter: parseAmount((r.balance_kg_after ?? r.balance_after_kg) as string),
  }));
}

export async function createInventoryAdjustment(payload: Record<string, unknown>): Promise<unknown> {
  return request(ENDPOINTS.tenant.inventoryAdjustments, { method: "POST", body: payload });
}

export interface InventoryProductDetail {
  productId: string;
  name: string;
  nameEn?: string;
  cartons: number;
  pieces: number;
  weightKg: number;
  minCartons: number;
  minKg: number;
  status: InventoryBalanceRow["status"];
  fifoCostPerKg: number;
  estimatedFifoValue: number | null;
  lastMovementAt: string | null;
  recentMovements: StockMovementRow[];
}

function mapApiMovementRow(r: Record<string, unknown>, i: number): StockMovementRow {
  return {
    id: String(r.id ?? i),
    date: String(r.created_at ?? r.movement_date ?? r.date ?? "").slice(0, 16).replace("T", " "),
    product: String(r.product_name ?? ""),
    type: String(r.movement_type ?? r.movement_type_label ?? r.type ?? ""),
    cartons: parseAmount((r.cartons_delta ?? r.cartons) as string | number),
    pieces: parseAmount((r.pieces_delta ?? r.pieces) as string | number),
    weightKg: parseAmount((r.kg_delta ?? r.weight_kg ?? r.weightKg) as string | number),
    reference: String(r.reference_number ?? r.reference ?? r.document_number ?? ""),
    balanceAfter: parseAmount((r.balance_kg_after ?? r.balance_after_kg) as string | number),
    createdByName: String(r.created_by_name ?? ""),
    notes: String(r.notes ?? r.reason ?? ""),
  };
}

function mapBalanceStatus(
  statusRaw: string,
  cartons: number,
  pieces: number,
  weightKg: number,
  minStock: number,
): InventoryBalanceRow["status"] {
  const normalized = statusRaw.toLowerCase();
  if (normalized.includes("out") || (cartons === 0 && pieces === 0 && weightKg === 0)) return "out";
  if (normalized.includes("low") || (minStock > 0 && cartons < minStock)) return "low";
  return "ok";
}

export async function getInventoryProductDetail(productId: string): Promise<InventoryProductDetail> {
  if (IS_MOCK_MODE) {
    throw new Error("getInventoryProductDetail is not available in mock mode");
  }
  const data = await request<{
    balance: ApiInventoryRow & {
      minimum_stock_kg?: string | number;
      last_movement_at?: string | null;
    };
    recent_movements?: Record<string, unknown>[];
    estimated_fifo_value?: string | number | null;
  }>(ENDPOINTS.tenant.inventoryProduct(productId));

  const balance = data.balance;
  const cartons = parseAmount(balance.available_cartons ?? balance.total_cartons);
  const pieces = parseAmount(balance.available_pieces ?? balance.total_pieces);
  const weightKg = parseAmount(balance.available_kg ?? balance.total_weight_kg);
  const minCartons = parseAmount(balance.minimum_stock_cartons);
  const minKg = parseAmount(balance.minimum_stock_kg);
  const fifoValue = parseAmount(data.estimated_fifo_value);
  const fifoCostPerKg = weightKg > 0 && fifoValue > 0 ? fifoValue / weightKg : parseAmount(balance.average_cost_per_kg);
  const resolvedProductId = String(balance.product ?? balance.product_id ?? productId);

  return {
    productId: resolvedProductId,
    name: balance.product_name_ar ?? balance.product_name ?? "",
    nameEn: balance.product_name_en ?? balance.product_name,
    cartons,
    pieces,
    weightKg,
    minCartons,
    minKg,
    status: mapBalanceStatus(balance.stock_status ?? "", cartons, pieces, weightKg, minCartons),
    fifoCostPerKg,
    estimatedFifoValue: data.estimated_fifo_value == null ? null : fifoValue,
    lastMovementAt: balance.last_movement_at ?? null,
    recentMovements: (data.recent_movements ?? []).map(mapApiMovementRow),
  };
}

export async function createOpeningStock(payload: Record<string, unknown>): Promise<unknown> {
  return request(ENDPOINTS.tenant.inventoryOpeningStock, { method: "POST", body: payload });
}

export async function getInventoryValuation(): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.inventoryValuation);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}

export interface StocktakingLineDraft {
  productId: string;
  systemCartons: number;
  systemKg: number;
  actualCartons: number;
  actualPieces: number;
  actualKg: number;
}

export async function createStocktakingSession(notes?: string): Promise<{ id: string }> {
  const row = await request<{ id: number }>(ENDPOINTS.tenant.inventoryStocktaking, {
    method: "POST",
    body: { notes: notes ?? "" },
  });
  return { id: String(row.id) };
}

export async function getStocktakingSession(id: string): Promise<Record<string, unknown>> {
  return request(`${ENDPOINTS.tenant.inventoryStocktakingSession(id)}`);
}

export async function addStocktakingLine(
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const row = await request<{ id: number }>(`${ENDPOINTS.tenant.inventoryStocktakingSession(sessionId)}lines/`, {
    method: "POST",
    body: payload,
  });
  return { id: String(row.id) };
}

export async function updateStocktakingLine(
  sessionId: string,
  lineId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await request(`${ENDPOINTS.tenant.inventoryStocktakingSession(sessionId)}lines/${lineId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function applyStocktaking(sessionId: string, reason: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.inventoryStocktakingSession(sessionId)}apply/`, {
    method: "POST",
    body: { apply_reason: reason },
  });
}
