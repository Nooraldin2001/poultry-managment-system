import { IS_MOCK_MODE } from "@/services/config";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { getDefaultTaxDateRange } from "@/shared/utils/dateRanges";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { TaxSummary, TaxWarning } from "@/shared/types/entities";
import * as taxMock from "./mock/taxService.mock";

export function withTaxDateRange(filters?: ApiListFilters): ApiListFilters {
  const defaults = getDefaultTaxDateRange();
  return {
    ...defaults,
    ...(filters ?? {}),
    date_from: filters?.date_from || defaults.date_from,
    date_to: filters?.date_to || defaults.date_to,
  };
}

function mapTaxSummary(data: Record<string, string | number>): TaxSummary {
  const salesVat = parseAmount(data.sales_vat as string);
  const purchaseVat = parseAmount(data.purchase_vat as string);
  const expenseVat = parseAmount(data.expense_vat as string);
  return {
    outputVat: salesVat,
    inputVat: purchaseVat + expenseVat,
    purchaseVat,
    expenseVat,
    netVat: parseAmount(data.net_vat as string),
    payableOrRecoverable: String(data.net_vat_status ?? data.payable_or_recoverable ?? ""),
    warningCount: parseAmount(data.open_warnings_count ?? data.warning_count),
    disabledVatCount: parseAmount(data.disabled_vat_count),
    note: String(data.note ?? ""),
  };
}

export function mapSalesVatRecords(data: Record<string, unknown>) {
  const raw = Array.isArray(data.records)
    ? data.records
    : Array.isArray(data.rows)
      ? data.rows
      : [];
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const rows = raw.map((r: Record<string, unknown>, i: number) => {
    const missingTrn = Boolean(r.missing_customer_trn);
    const vatDisabled = Boolean(r.vat_disabled);
    return {
      id: String(r.invoice_number ?? r.id ?? i),
      date: String(r.invoice_date ?? r.date ?? ""),
      customer: String(r.customer_name ?? r.customer ?? ""),
      trn: String(r.customer_trn ?? r.trn ?? ""),
      subtotal: parseAmount(r.subtotal as string),
      vatRate: parseAmount(r.vat_rate as string),
      vat: parseAmount((r.vat_amount ?? r.vat) as string | number),
      total: parseAmount((r.total_amount ?? r.total) as string | number),
      taxStatus: vatDisabled ? "disabled" : "taxable",
      trnStatus: missingTrn ? "missing" : "ok",
      user: String(r.user ?? ""),
    };
  });
  return {
    rows,
    totals: {
      subtotal: parseAmount(totals.sales_subtotal as string),
      vat: parseAmount(totals.sales_vat_amount as string),
      total: parseAmount(totals.sales_total_amount as string),
      invoiceCount: Number(totals.invoice_count ?? rows.length),
      missingTrnCount: Number(totals.missing_customer_trn_count ?? 0),
      vatDisabledCount: Number(totals.vat_disabled_count ?? 0),
    },
  };
}

export function mapPurchaseVatRecords(data: Record<string, unknown>) {
  const raw = Array.isArray(data.records)
    ? data.records
    : Array.isArray(data.rows)
      ? data.rows
      : [];
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const rows = raw.map((r: Record<string, unknown>, i: number) => {
    const missingTrn = Boolean(r.missing_supplier_trn);
    const vatDisabled = Boolean(r.vat_disabled);
    return {
      id: String(r.invoice_number ?? r.id ?? i),
      suppInv: String(r.supplier_invoice_number ?? r.supp_inv ?? ""),
      date: String(r.invoice_date ?? r.date ?? ""),
      supplier: String(r.supplier_name ?? r.supplier ?? ""),
      trn: String(r.supplier_trn ?? r.trn ?? ""),
      subtotal: parseAmount(r.subtotal as string),
      vatRate: parseAmount(r.vat_rate as string),
      vat: parseAmount((r.vat_amount ?? r.vat) as string | number),
      total: parseAmount((r.total_amount ?? r.total) as string | number),
      taxStatus: vatDisabled ? "disabled" : "taxable",
      trnStatus: missingTrn ? "missing" : "ok",
      user: String(r.user ?? ""),
    };
  });
  return {
    rows,
    totals: {
      subtotal: parseAmount(totals.purchase_subtotal as string),
      vat: parseAmount(totals.purchase_vat_amount as string),
      total: parseAmount(totals.purchase_total_amount as string),
      invoiceCount: Number(totals.invoice_count ?? rows.length),
      missingTrnCount: Number(totals.missing_supplier_trn_count ?? 0),
      vatDisabledCount: Number(totals.vat_disabled_count ?? 0),
    },
  };
}

export async function getTaxSummaryLive(filters?: ApiListFilters): Promise<TaxSummary> {
  if (IS_MOCK_MODE) {
    const mock = await taxMock.getTaxSummary();
    const m = mock as { outputVat?: number; inputVat?: number; netVat?: number };
    return {
      outputVat: m.outputVat ?? 0,
      inputVat: m.inputVat ?? 0,
      netVat: m.netVat ?? 0,
    };
  }
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.taxSummary, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
  return mapTaxSummary(data);
}

export async function getTaxSalesVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxSalesVat, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}

export async function getTaxPurchaseVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxPurchaseVat, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}

export async function getTaxExpenseVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxExpenseVat, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}

export async function getTaxNetVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return {};
  return request(ENDPOINTS.tenant.taxNetVat, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}

export async function listTaxWarnings(): Promise<TaxWarning[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(ENDPOINTS.tenant.taxWarnings);
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    severity: String(r.severity ?? ""),
    message: String(r.message ?? r.warning_message ?? ""),
    documentType: String(r.source_type ?? r.document_type ?? ""),
    documentId: r.source_reference != null
      ? String(r.source_reference)
      : r.document_id != null
        ? String(r.document_id)
        : undefined,
    dismissed: r.status === "dismissed" || !!r.dismissed_at,
  }));
}

export async function generateTaxWarnings(filters?: ApiListFilters): Promise<unknown> {
  const dates = withTaxDateRange(filters);
  return request(ENDPOINTS.tenant.taxWarningsGenerate, {
    method: "POST",
    body: { date_from: dates.date_from, date_to: dates.date_to },
  });
}

export async function dismissTaxWarning(id: string, reason: string): Promise<void> {
  await request(`${ENDPOINTS.tenant.taxWarnings}${id}/dismiss/`, { method: "POST", body: { reason } });
}

export async function resolveTaxWarning(id: string, reason?: string): Promise<void> {
  await request(`${ENDPOINTS.tenant.taxWarnings}${id}/resolve/`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export async function getDisabledVatDocuments(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxDisabledVatDocuments, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}

export async function getTaxExportPayload(filters?: ApiListFilters): Promise<unknown> {
  if (IS_MOCK_MODE) return {};
  return request(ENDPOINTS.tenant.taxExportPayload, {
    query: withTaxDateRange(filters) as Record<string, string | number | boolean>,
  });
}
