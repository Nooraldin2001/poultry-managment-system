import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { ApiError } from "./api/errors";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { PurchaseInvoiceLineRow, PurchaseInvoiceRow } from "@/shared/types/entities";
import type { PriceHistoryEntry } from "@/services/salesService";
import { normalizePurchaseInvoiceStatus } from "@/shared/utils/purchaseStatus";
import * as purchaseMock from "./mock/purchaseService.mock";

const crud = createCrudService<ApiPurchaseList, ApiPurchaseDetail>(ENDPOINTS.tenant.purchases);

interface ApiPurchaseList {
  id: number;
  invoice_number: string;
  supplier: number;
  supplier_name_snapshot: string;
  invoice_date: string;
  due_date?: string | null;
  status: string;
  payment_status: string;
  payment_method?: string;
  subtotal: string;
  vat_amount: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  money_account?: number | null;
}

interface ApiPurchaseDetail extends ApiPurchaseList {
  money_account?: number | null;
  lines?: ApiPurchaseLine[];
  backdate_reason?: string;
}

interface ApiPurchaseLine {
  id: number;
  product: number;
  product_name_snapshot?: string;
  quantity_cartons?: string;
  quantity_pieces?: string;
  quantity_kg?: string;
  quantity?: string;
  unit?: string;
  unit_price?: string;
  price_type?: string;
  vat_rate?: string;
  line_subtotal?: string;
  line_total?: string;
}

export function mapApiPurchaseToRow(row: ApiPurchaseList): PurchaseInvoiceRow {
  const paymentStatus = row.payment_status ?? "unpaid";
  return {
    id: String(row.id),
    number: row.invoice_number ?? "",
    supplier: row.supplier_name_snapshot ?? "—",
    supplierId: String(row.supplier ?? ""),
    date: row.invoice_date ?? "",
    dueDate: row.due_date ?? undefined,
    status: normalizePurchaseInvoiceStatus(row.status, paymentStatus),
    paymentStatus,
    paymentMethod: row.payment_method ?? "credit",
    subtotal: parseAmount(row.subtotal),
    vat: parseAmount(row.vat_amount),
    total: parseAmount(row.total_amount),
    paid: parseAmount(row.amount_paid),
    balance: parseAmount(row.balance_due),
    moneyAccountId: row.money_account != null ? String(row.money_account) : "",
  };
}

function mapPurchaseLine(line: ApiPurchaseLine): PurchaseInvoiceLineRow {
  const kg = parseAmount(line.quantity_kg ?? line.quantity);
  const pieces = parseAmount(line.quantity_pieces ?? line.quantity);
  const cartons = parseAmount(line.quantity_cartons);
  return {
    id: String(line.id),
    productId: String(line.product),
    productName: line.product_name_snapshot ?? "",
    qty: kg || pieces,
    cartons,
    pieces,
    kg,
    unit: line.price_type ?? line.unit ?? "kg",
    price: parseAmount(line.unit_price),
    vatRate: parseAmount(line.vat_rate),
    subtotal: parseAmount(line.line_subtotal),
    total: parseAmount(line.line_total),
  };
}

export async function listPurchaseRows(filters?: ApiListFilters): Promise<PurchaseInvoiceRow[]> {
  if (IS_MOCK_MODE) {
    const mock = await purchaseMock.listPurchaseInvoices();
    return (mock as unknown as PurchaseInvoiceRow[]).map((p) => ({
      id: p.id,
      number: (p as { number?: string }).number ?? p.id,
      supplier: (p as { supplier?: string }).supplier ?? "",
      supplierId: "",
      date: (p as { date?: string }).date ?? "",
      status: (p as { status?: string }).status ?? "draft",
      paymentStatus: "unpaid",
      subtotal: 0,
      vat: 0,
      total: (p as { total?: number }).total ?? 0,
      paid: 0,
      balance: 0,
    }));
  }
  const rows = await crud.listAll(filters);
  return rows.map(mapApiPurchaseToRow);
}

export async function getPurchaseRow(id: string): Promise<PurchaseInvoiceRow | null> {
  if (IS_MOCK_MODE) return null;
  try {
    const row = await crud.retrieve(id);
    return mapApiPurchaseToRow(row);
  } catch {
    return null;
  }
}

export async function getPurchaseDetail(id: string): Promise<{
  invoice: PurchaseInvoiceRow;
  lines: PurchaseInvoiceLineRow[];
  backdateReason?: string;
}> {
  if (IS_MOCK_MODE) {
    throw new ApiError("Not found", { status: 404 });
  }
  const row = (await crud.retrieve(id)) as ApiPurchaseDetail;
  return {
    invoice: mapApiPurchaseToRow(row),
    lines: (row.lines ?? []).map(mapPurchaseLine),
    backdateReason: row.backdate_reason ?? "",
  };
}

export async function createPurchase(payload: Record<string, unknown>): Promise<PurchaseInvoiceRow> {
  const row = await crud.create(payload as never);
  return mapApiPurchaseToRow(row);
}

export async function updatePurchase(id: string, payload: Record<string, unknown>): Promise<PurchaseInvoiceRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiPurchaseToRow(row);
}

export async function approvePurchase(id: string, reason?: string): Promise<PurchaseInvoiceRow> {
  const row = await crud.action<ApiPurchaseList>(id, "approve/", { reason: reason ?? "" });
  return mapApiPurchaseToRow(row);
}

export async function cancelPurchase(id: string, reason: string): Promise<PurchaseInvoiceRow> {
  const row = await crud.action<ApiPurchaseList>(id, "cancel/", { reason });
  return mapApiPurchaseToRow(row);
}

export async function getPurchasesSummary(filters?: ApiListFilters): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.purchasesSummary, {
    query: filters as Record<string, string | number | boolean>,
  });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}

export async function addPurchaseLine(purchaseId: string, payload: Record<string, unknown>): Promise<PurchaseInvoiceLineRow> {
  const line = await request<ApiPurchaseLine>(`${ENDPOINTS.tenant.purchase(purchaseId)}lines/`, {
    method: "POST",
    body: payload,
  });
  return mapPurchaseLine(line);
}

export async function deletePurchaseLine(purchaseId: string, lineId: string): Promise<void> {
  await request(`${ENDPOINTS.tenant.purchase(purchaseId)}lines/${lineId}/`, { method: "DELETE" });
}

export async function getPurchasePrintPreview(id: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.purchase(id)}print-preview/`);
}

export async function purchasePriceHistory(query: {
  supplier: number;
  product: number;
}): Promise<PriceHistoryEntry[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<PriceHistoryEntry[]>(ENDPOINTS.tenant.purchasesPriceHistory, {
    query: {
      supplier: String(query.supplier),
      product: String(query.product),
    },
  });
  return Array.isArray(data) ? data : [];
}
