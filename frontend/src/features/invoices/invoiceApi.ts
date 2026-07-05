import { request } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { InvoiceKind, InvoiceLineDraft } from "./types";

export function lineToPayload(line: InvoiceLineDraft): Record<string, unknown> {
  return {
    product: Number(line.productId),
    quantity_cartons: String(line.cartons),
    quantity_pieces: String(line.pieces),
    quantity_kg: String(line.kg),
    unit_price: String(line.unitPrice),
    price_type: line.priceType,
    vat_rate: String(line.vatRate),
    notes: line.notes ?? "",
  };
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

export async function addDraftLine(kind: InvoiceKind, id: string, line: InvoiceLineDraft): Promise<string> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(id)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(id)
        : ENDPOINTS.tenant.quotation(id);
  const created = await request<{ id: number }>(`${base}lines/`, {
    method: "POST",
    body: lineToPayload(line),
  });
  return String(created.id);
}

export async function updateDraftLine(
  kind: InvoiceKind,
  docId: string,
  lineId: string,
  line: InvoiceLineDraft,
): Promise<void> {
  const base =
    kind === "sales"
      ? ENDPOINTS.tenant.sale(docId)
      : kind === "purchase"
        ? ENDPOINTS.tenant.purchase(docId)
        : ENDPOINTS.tenant.quotation(docId);
  await request(`${base}lines/${lineId}/`, { method: "PATCH", body: lineToPayload(line) });
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
