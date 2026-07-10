import { request } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import { parseAmount } from "@/services/crud/parse";
import type { InvoiceKind, InvoiceLineDraft } from "./types";
import { parsePriceType } from "./priceTypeUtils";

export type LinePayloadOptions = {
  manualPriceOverride?: boolean;
  priceOverrideReason?: string;
};

export type SavedLineResponse = {
  price_type?: string;
  line_subtotal?: string;
  line_total?: string;
};

export function syncLineFromApi(line: InvoiceLineDraft, saved: SavedLineResponse): InvoiceLineDraft {
  return {
    ...line,
    priceType: saved.price_type ? parsePriceType(saved.price_type) : line.priceType,
    lineSubtotal:
      saved.line_subtotal != null ? parseAmount(saved.line_subtotal) : line.lineSubtotal,
    lineTotal: saved.line_total != null ? parseAmount(saved.line_total) : line.lineTotal,
  };
}

export function lineToPayload(
  line: InvoiceLineDraft,
  options?: LinePayloadOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    product: Number(line.productId),
    quantity_cartons: String(line.cartons),
    quantity_pieces: String(line.pieces),
    quantity_kg: String(line.kg),
    unit_price: String(line.unitPrice),
    price_type: line.priceType,
    vat_rate: String(line.vatRate),
    notes: line.notes ?? "",
  };
  if (options?.manualPriceOverride || line.priceSource === "manual_override") {
    payload.price_source = "manual_override";
    const reason = options?.priceOverrideReason ?? line.priceOverrideReason;
    if (reason) payload.override_reason = reason;
  }
  return payload;
}

export async function createDraftHeader(
  kind: InvoiceKind,
  payload: Record<string, unknown>,
): Promise<{ id: string; number?: string }> {
  const path =
    kind === "sales"
      ? ENDPOINTS.tenant.sales
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchases
        : ENDPOINTS.tenant.quotations;
  const row = await request<{ id: number; invoice_number?: string; quotation_number?: string }>(path, {
    method: "POST",
    body: payload,
  });
  return {
    id: String(row.id),
    number: row.invoice_number ?? row.quotation_number,
  };
}

export async function patchDraftHeader(
  kind: InvoiceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const path =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(id)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(id)
        : ENDPOINTS.tenant.quotation(id);
  await request(path, { method: "PATCH", body: payload });
}

export async function addDraftLine(
  kind: InvoiceKind,
  id: string,
  line: InvoiceLineDraft,
  options?: LinePayloadOptions,
): Promise<string> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(id)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(id)
        : ENDPOINTS.tenant.quotation(id);
  const created = await request<{ id: number }>(`${base}lines/`, {
    method: "POST",
    body: lineToPayload(line, options),
  });
  return String(created.id);
}

export async function updateDraftLine(
  kind: InvoiceKind,
  docId: string,
  lineId: string,
  line: InvoiceLineDraft,
  options?: LinePayloadOptions,
): Promise<SavedLineResponse> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(docId)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(docId)
        : ENDPOINTS.tenant.quotation(docId);
  return request<SavedLineResponse>(`${base}lines/${lineId}/`, {
    method: "PATCH",
    body: lineToPayload(line, options),
  });
}

export async function removeDraftLine(kind: InvoiceKind, docId: string, lineId: string): Promise<void> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(docId)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(docId)
        : ENDPOINTS.tenant.quotation(docId);
  await request(`${base}lines/${lineId}/`, { method: "DELETE" });
}

export async function approveDocument(
  kind: InvoiceKind,
  id: string,
  reason?: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(id)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(id)
        : ENDPOINTS.tenant.quotation(id);
  await request(`${base}approve/`, {
    method: "POST",
    body: { reason: reason ?? "", ...extra },
  });
}

export async function cancelDocument(kind: InvoiceKind, id: string, reason: string): Promise<void> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(id)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(id)
        : ENDPOINTS.tenant.quotation(id);
  await request(`${base}cancel/`, { method: "POST", body: { reason } });
}
