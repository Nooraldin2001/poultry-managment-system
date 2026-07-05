import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { PaymentMovementRow, ReceiptPreview } from "@/shared/types/entities";
import * as paymentMock from "./mock/paymentService.mock";

const movementCrud = createCrudService<ApiMovement>(ENDPOINTS.tenant.paymentsMovements);

interface ApiMovement {
  id: number;
  movement_type?: string;
  party_type?: string;
  party_name?: string;
  party_name_snapshot?: string;
  party_id?: number;
  movement_number?: string;
  receipt_number?: string;
  amount: string;
  payment_method?: string;
  movement_date?: string;
  reference_number?: string;
  status?: string;
}

export type PaymentsSummaryData = {
  totals: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
};

function mapMovement(row: ApiMovement): PaymentMovementRow {
  return {
    id: String(row.id),
    type: row.movement_type ?? "",
    party: row.party_name ?? row.party_name_snapshot ?? "",
    partyId: row.party_id != null ? String(row.party_id) : undefined,
    amount: parseAmount(row.amount),
    method: row.payment_method ?? "",
    date: String(row.movement_date ?? "").slice(0, 10),
    reference: row.reference_number ?? row.movement_number ?? row.receipt_number,
    status: row.status,
  };
}

export async function listPaymentMovementRows(filters?: ApiListFilters): Promise<PaymentMovementRow[]> {
  if (IS_MOCK_MODE) {
    return paymentMock.listPaymentMovements() as Promise<PaymentMovementRow[]>;
  }
  const rows = await movementCrud.listAll(filters);
  return rows.map(mapMovement);
}

export async function getPaymentsSummary(filters?: ApiListFilters): Promise<PaymentsSummaryData> {
  if (IS_MOCK_MODE) return { totals: {}, paymentMethodBreakdown: {} };
  const data = await request<Record<string, unknown>>(ENDPOINTS.tenant.paymentsSummary, {
    query: filters as Record<string, string | number | boolean>,
  });
  const totals: Record<string, number> = {};
  let paymentMethodBreakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "payment_method_breakdown" && v && typeof v === "object") {
      paymentMethodBreakdown = Object.fromEntries(
        Object.entries(v as Record<string, string | number>).map(([method, amount]) => [
          method,
          parseAmount(amount),
        ]),
      );
      continue;
    }
    if (typeof v === "string" || typeof v === "number") {
      totals[k] = parseAmount(v);
    }
  }
  return { totals, paymentMethodBreakdown };
}

export async function createCustomerCollection(payload: Record<string, unknown>): Promise<PaymentMovementRow> {
  const row = await request<ApiMovement>(ENDPOINTS.tenant.paymentsCustomerCollections, {
    method: "POST",
    body: payload,
  });
  return mapMovement(row);
}

export async function createSupplierPayment(payload: Record<string, unknown>): Promise<PaymentMovementRow> {
  const row = await request<ApiMovement>(ENDPOINTS.tenant.paymentsSupplierPayments, {
    method: "POST",
    body: payload,
  });
  return mapMovement(row);
}

export async function createCustomerRefund(payload: Record<string, unknown>): Promise<PaymentMovementRow> {
  const row = await request<ApiMovement>(ENDPOINTS.tenant.paymentsCustomerRefunds, {
    method: "POST",
    body: payload,
  });
  return mapMovement(row);
}

export async function createSupplierRefund(payload: Record<string, unknown>): Promise<PaymentMovementRow> {
  const row = await request<ApiMovement>(ENDPOINTS.tenant.paymentsSupplierRefunds, {
    method: "POST",
    body: payload,
  });
  return mapMovement(row);
}

export async function getPaymentMovementPrintPreviewRaw(id: string): Promise<unknown> {
  if (IS_MOCK_MODE) return null;
  return request(ENDPOINTS.tenant.paymentMovementPrintPreview(id));
}

export async function getReceiptPrintPreviewRaw(id: string): Promise<unknown> {
  if (IS_MOCK_MODE) return null;
  return request(ENDPOINTS.tenant.receiptPrintPreview(id));
}

export async function cancelPaymentMovement(id: string, reason: string): Promise<PaymentMovementRow> {
  const row = await movementCrud.action<ApiMovement>(id, "cancel/", { reason });
  return mapMovement(row);
}

export async function getPaymentPrintPreview(id: string): Promise<ReceiptPreview | null> {
  if (IS_MOCK_MODE) return null;
  const data = await request<Record<string, unknown>>(`${ENDPOINTS.tenant.paymentsMovements}${id}/print-preview/`);
  return {
    id,
    number: String(data.receipt_number ?? data.number ?? id),
    party: String(data.party_name ?? ""),
    amount: parseAmount(data.amount as string),
    date: String(data.date ?? "").slice(0, 10),
    method: String(data.payment_method ?? ""),
  };
}

export async function listReceipts(filters?: ApiListFilters): Promise<ReceiptPreview[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(ENDPOINTS.tenant.receipts, {
    query: filters as Record<string, string | number | boolean>,
  });
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    number: String(r.receipt_number ?? r.number ?? ""),
    party: String(r.party_name ?? ""),
    amount: parseAmount(r.amount as string),
    date: String(r.date ?? "").slice(0, 10),
    method: String(r.payment_method ?? ""),
  }));
}
