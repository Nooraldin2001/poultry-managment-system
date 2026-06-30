import type { SalesInvoice } from "@/shared/types/documents";
import type { ItemResponse, ListResponse } from "@/services/api/types";
import { S_INVOICES } from "@/data/mock/sales.mock";
import { mockDelay } from "./mockDelay";

export function listSalesInvoices(): ListResponse<SalesInvoice> {
  return mockDelay(S_INVOICES as SalesInvoice[]);
}

export function getSalesInvoiceById(id: string): ItemResponse<SalesInvoice> {
  return mockDelay((S_INVOICES as SalesInvoice[]).find((i) => i.id === id) ?? null);
}
