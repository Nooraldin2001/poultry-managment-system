import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { ApiError } from "./api/errors";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { SalesInvoiceLineRow, SalesInvoiceRow } from "@/shared/types/entities";
import { normalizeSalesInvoiceStatus } from "@/shared/utils/invoiceStatus";
import * as salesMock from "./mock/salesService.mock";

const crud = createCrudService<ApiSalesList, ApiSalesDetail>(ENDPOINTS.tenant.sales);

interface ApiSalesList {
  id: number;
  invoice_number: string;
  customer: number;
  customer_name_snapshot: string;
  invoice_date: string;
  due_date?: string | null;
  status: string;
  payment_status: string;
  subtotal: string;
  vat_amount: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  gross_profit?: string;
}

interface ApiSalesDetail extends ApiSalesList {
  lines?: ApiSalesLine[];
  backdate_reason?: string;
}

interface ApiSalesLine {
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
  price_source?: string;
  line_total?: string;
}

export interface PriceHistoryEntry {
  price: string;
  price_type: string;
  source: string;
  invoice_number?: string | null;
  date?: string | null;
}

export function mapApiSalesToRow(row: ApiSalesList): SalesInvoiceRow {
  return {
    id: String(row.id),
    number: row.invoice_number,
    customer: row.customer_name_snapshot,
    customerId: String(row.customer),
    date: row.invoice_date,
    dueDate: row.due_date ?? undefined,
    status: normalizeSalesInvoiceStatus(row.status),
    paymentStatus: row.payment_status,
    subtotal: parseAmount(row.subtotal),
    vat: parseAmount(row.vat_amount),
    total: parseAmount(row.total_amount),
    paid: parseAmount(row.amount_paid),
    balance: parseAmount(row.balance_due),
    grossProfit: parseAmount(row.gross_profit),
  };
}

function mapSalesLine(line: ApiSalesLine): SalesInvoiceLineRow {
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
    total: parseAmount(line.line_total),
  };
}

export async function listSalesRows(filters?: ApiListFilters): Promise<SalesInvoiceRow[]> {
  if (IS_MOCK_MODE) {
    const mock = await salesMock.listSalesInvoices();
    return (mock as unknown as SalesInvoiceRow[]).map((s) => ({
      id: s.id,
      number: (s as { number?: string }).number ?? s.id,
      customer: (s as { customer?: string }).customer ?? "",
      customerId: "",
      date: (s as { date?: string }).date ?? "",
      status: (s as { status?: string }).status ?? "draft",
      paymentStatus: "unpaid",
      subtotal: 0,
      vat: 0,
      total: (s as { total?: number }).total ?? 0,
      paid: 0,
      balance: 0,
    }));
  }
  const rows = await crud.listAll(filters);
  return rows.map(mapApiSalesToRow);
}

export async function getSalesRow(id: string): Promise<SalesInvoiceRow | null> {
  if (IS_MOCK_MODE) {
    return salesMock.getSalesInvoiceById(id) as Promise<SalesInvoiceRow | null>;
  }
  try {
    const row = await crud.retrieve(id);
    return mapApiSalesToRow(row);
  } catch {
    return null;
  }
}

export async function getSalesDetail(id: string): Promise<{
  invoice: SalesInvoiceRow;
  lines: SalesInvoiceLineRow[];
  backdateReason?: string;
}> {
  if (IS_MOCK_MODE) {
    throw new ApiError("Not found", { status: 404 });
  }
  const row = (await crud.retrieve(id)) as ApiSalesDetail;
  return {
    invoice: mapApiSalesToRow(row),
    lines: (row.lines ?? []).map(mapSalesLine),
    backdateReason: row.backdate_reason ?? "",
  };
}

export async function createSale(payload: Record<string, unknown>): Promise<SalesInvoiceRow> {
  const row = await crud.create(payload as never);
  return mapApiSalesToRow(row);
}

export async function updateSale(id: string, payload: Record<string, unknown>): Promise<SalesInvoiceRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiSalesToRow(row);
}

export async function approveSale(id: string, reason?: string, extra?: Record<string, unknown>): Promise<SalesInvoiceRow> {
  const row = await crud.action<ApiSalesList>(id, "approve/", { reason: reason ?? "", ...extra });
  return mapApiSalesToRow(row);
}

export async function cancelSale(id: string, reason: string): Promise<SalesInvoiceRow> {
  const row = await crud.action<ApiSalesList>(id, "cancel/", { reason });
  return mapApiSalesToRow(row);
}

export async function getSalesSummary(filters?: ApiListFilters): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.salesSummary, {
    query: filters as Record<string, string | number | boolean>,
  });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}

export async function salesPricePreview(query: {
  customer: number;
  product: number;
  price_type?: string;
}): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    customer: String(query.customer),
    product: String(query.product),
  };
  if (query.price_type) params.price_type = query.price_type;
  return request(ENDPOINTS.tenant.salesPricePreview, { query: params });
}

export async function salesPriceHistory(query: {
  customer: number;
  product: number;
}): Promise<PriceHistoryEntry[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<PriceHistoryEntry[]>(ENDPOINTS.tenant.salesPriceHistory, {
    query: {
      customer: String(query.customer),
      product: String(query.product),
    },
  });
  return Array.isArray(data) ? data : [];
}

export async function salesStockCheck(query: {
  product: number;
  cartons?: number;
  pieces?: number;
  kg?: number;
}): Promise<Record<string, unknown>> {
  return request(ENDPOINTS.tenant.salesStockCheck, {
    query: {
      product: String(query.product),
      cartons: String(query.cartons ?? 0),
      pieces: String(query.pieces ?? 0),
      kg: String(query.kg ?? 0),
    },
  });
}

export async function getSalesPrintPreview(id: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.sale(id)}print-preview/`);
}

export async function addSalesLine(saleId: string, payload: Record<string, unknown>): Promise<SalesInvoiceLineRow> {
  const line = await request<ApiSalesLine>(`${ENDPOINTS.tenant.sale(saleId)}lines/`, {
    method: "POST",
    body: payload,
  });
  return mapSalesLine(line);
}

export async function deleteSalesLine(saleId: string, lineId: string): Promise<void> {
  await request(`${ENDPOINTS.tenant.sale(saleId)}lines/${lineId}/`, { method: "DELETE" });
}
