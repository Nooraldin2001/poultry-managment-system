import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { SalesInvoiceLineRow, SalesInvoiceRow } from "@/shared/types/entities";
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
}

interface ApiSalesLine {
  id: number;
  product: number;
  product_name_snapshot?: string;
  quantity?: string;
  unit?: string;
  unit_price?: string;
  line_total?: string;
}

export function mapApiSalesToRow(row: ApiSalesList): SalesInvoiceRow {
  return {
    id: String(row.id),
    number: row.invoice_number,
    customer: row.customer_name_snapshot,
    customerId: String(row.customer),
    date: row.invoice_date,
    dueDate: row.due_date ?? undefined,
    status: row.status,
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
  return {
    id: String(line.id),
    productId: String(line.product),
    productName: line.product_name_snapshot ?? "",
    qty: parseAmount(line.quantity),
    unit: line.unit ?? "kg",
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

export async function getSalesDetail(id: string): Promise<{ invoice: SalesInvoiceRow; lines: SalesInvoiceLineRow[] } | null> {
  if (IS_MOCK_MODE) return null;
  try {
    const row = (await crud.retrieve(id)) as ApiSalesDetail;
    return {
      invoice: mapApiSalesToRow(row),
      lines: (row.lines ?? []).map(mapSalesLine),
    };
  } catch {
    return null;
  }
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
  const row = await crud.action<ApiSalesList>(id, "approve/", { approval_reason: reason ?? "", ...extra });
  return mapApiSalesToRow(row);
}

export async function cancelSale(id: string, reason: string): Promise<SalesInvoiceRow> {
  const row = await crud.action<ApiSalesList>(id, "cancel/", { cancel_reason: reason });
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

export async function salesPricePreview(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request(ENDPOINTS.tenant.salesPricePreview, { method: "POST", body: payload });
}

export async function salesStockCheck(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request(ENDPOINTS.tenant.salesStockCheck, { method: "POST", body: payload });
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
