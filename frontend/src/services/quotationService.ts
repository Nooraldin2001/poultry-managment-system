import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { QuotationLineRow, QuotationRow } from "@/shared/types/entities";

const crud = createCrudService<ApiQuotationList, ApiQuotationDetail>(ENDPOINTS.tenant.quotations);

interface ApiQuotationList {
  id: number;
  quotation_number: string;
  customer: number;
  customer_name_snapshot: string;
  quotation_date: string;
  valid_until?: string | null;
  status: string;
  subtotal: string;
  vat_amount: string;
  total_amount: string;
}

interface ApiQuotationDetail extends ApiQuotationList {
  lines?: ApiQuotationLine[];
}

interface ApiQuotationLine {
  id: number;
  product: number;
  product_name_snapshot?: string;
  quantity?: string;
  unit?: string;
  unit_price?: string;
  line_total?: string;
}

export function mapApiQuotationToRow(row: ApiQuotationList): QuotationRow {
  return {
    id: String(row.id),
    number: row.quotation_number,
    customer: row.customer_name_snapshot,
    customerId: String(row.customer),
    date: row.quotation_date,
    validUntil: row.valid_until ?? undefined,
    status: row.status,
    subtotal: parseAmount(row.subtotal),
    vat: parseAmount(row.vat_amount),
    total: parseAmount(row.total_amount),
  };
}

function mapQuotationLine(line: ApiQuotationLine): QuotationLineRow {
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

export async function listQuotationRows(filters?: ApiListFilters): Promise<QuotationRow[]> {
  if (IS_MOCK_MODE) return [];
  const rows = await crud.listAll(filters);
  return rows.map(mapApiQuotationToRow);
}

export async function getQuotationDetail(id: string): Promise<{ quotation: QuotationRow; lines: QuotationLineRow[] } | null> {
  if (IS_MOCK_MODE) return null;
  try {
    const row = (await crud.retrieve(id)) as ApiQuotationDetail;
    return {
      quotation: mapApiQuotationToRow(row),
      lines: (row.lines ?? []).map(mapQuotationLine),
    };
  } catch {
    return null;
  }
}

export async function createQuotation(payload: Record<string, unknown>): Promise<QuotationRow> {
  const row = await crud.create(payload as never);
  return mapApiQuotationToRow(row);
}

export async function updateQuotation(id: string, payload: Record<string, unknown>): Promise<QuotationRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiQuotationToRow(row);
}

export async function sendQuotation(id: string): Promise<QuotationRow> {
  const row = await crud.action<ApiQuotationList>(id, "send/", {});
  return mapApiQuotationToRow(row);
}

export async function acceptQuotation(id: string): Promise<QuotationRow> {
  const row = await crud.action<ApiQuotationList>(id, "accept/", {});
  return mapApiQuotationToRow(row);
}

export async function rejectQuotation(id: string, reason?: string): Promise<QuotationRow> {
  const row = await crud.action<ApiQuotationList>(id, "reject/", reason ? { reason } : {});
  return mapApiQuotationToRow(row);
}

export async function cancelQuotation(id: string, reason: string): Promise<QuotationRow> {
  const row = await crud.action<ApiQuotationList>(id, "cancel/", { reason });
  return mapApiQuotationToRow(row);
}

export async function convertQuotationToSales(id: string): Promise<Record<string, unknown>> {
  return crud.action(id, "convert-to-sales/", {});
}

export async function getQuotationPrintPreview(id: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.quotation(id)}print-preview/`);
}

export async function getQuotationStockWarning(id: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.quotation(id)}stock-warning/`);
}

export async function getQuotationsSummary(filters?: ApiListFilters): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.quotationsSummary, {
    query: filters as Record<string, string | number | boolean>,
  });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}
