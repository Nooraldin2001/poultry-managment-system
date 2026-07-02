import { IS_MOCK_MODE } from "@/services/config";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { TaxSummary, TaxWarning } from "@/shared/types/entities";
import * as taxMock from "./mock/taxService.mock";

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
    query: filters as Record<string, string | number | boolean>,
  });
  return {
    outputVat: parseAmount(data.output_vat as string),
    inputVat: parseAmount(data.input_vat as string),
    netVat: parseAmount(data.net_vat as string),
    payableOrRecoverable: String(data.payable_or_recoverable ?? ""),
    warningCount: parseAmount(data.warning_count as string),
    disabledVatCount: parseAmount(data.disabled_vat_count as string),
  };
}

export async function getTaxSalesVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxSalesVat, { query: filters as Record<string, string | number | boolean> });
}

export async function getTaxPurchaseVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxPurchaseVat, { query: filters as Record<string, string | number | boolean> });
}

export async function getTaxExpenseVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.taxExpenseVat, { query: filters as Record<string, string | number | boolean> });
}

export async function getTaxNetVat(filters?: ApiListFilters): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return {};
  return request(ENDPOINTS.tenant.taxNetVat, { query: filters as Record<string, string | number | boolean> });
}

export async function listTaxWarnings(): Promise<TaxWarning[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(ENDPOINTS.tenant.taxWarnings);
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    severity: String(r.severity ?? ""),
    message: String(r.message ?? r.warning_message ?? ""),
    documentType: String(r.document_type ?? ""),
    documentId: r.document_id != null ? String(r.document_id) : undefined,
    dismissed: !!r.dismissed_at,
  }));
}

export async function generateTaxWarnings(): Promise<unknown> {
  return request(ENDPOINTS.tenant.taxWarningsGenerate, { method: "POST", body: {} });
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
    query: filters as Record<string, string | number | boolean>,
  });
}

export async function getTaxExportPayload(filters?: ApiListFilters): Promise<unknown> {
  if (IS_MOCK_MODE) return {};
  return request(ENDPOINTS.tenant.taxExportPayload, {
    query: filters as Record<string, string | number | boolean>,
  });
}
