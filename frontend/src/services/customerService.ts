import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { CustomerLedgerEntry, CustomerRow, CustomerSpecialPrice } from "@/shared/types/entities";
import * as customerMock from "./mock/customerService.mock";

const crud = createCrudService<ApiCustomerList, ApiCustomerDetail>(ENDPOINTS.tenant.customers);

interface ApiCustomerList {
  id: number;
  name_ar: string;
  name_en?: string;
  phone: string;
  customer_type?: string;
  current_balance: string;
  credit_limit?: string;
  credit_status?: string;
  is_active?: boolean;
  trn?: string;
}

interface ApiCustomerDetail extends ApiCustomerList {
  address?: string;
  email?: string;
}

export function mapApiCustomerToRow(row: ApiCustomerList): CustomerRow {
  const balance = parseAmount(row.current_balance);
  const creditStatus = row.credit_status ?? "";
  return {
    id: String(row.id),
    name: row.name_ar,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    phone: row.phone,
    balance,
    creditLimit: parseAmount(row.credit_limit),
    overdue: creditStatus.toLowerCase().includes("over") || creditStatus.toLowerCase().includes("exceed"),
    trn: row.trn,
    customerType: row.customer_type,
    isActive: row.is_active,
  };
}

export async function listCustomerRows(filters?: ApiListFilters): Promise<CustomerRow[]> {
  if (IS_MOCK_MODE) {
    const mock = await customerMock.listCustomers();
    return (mock as import("@/shared/types/tenant").Customer[]).map((c) => ({
      id: c.id,
      name: c.name,
      nameEn: c.nameEn,
      nameAr: c.name,
      phone: c.phone,
      balance: c.balance,
      creditLimit: c.creditLimit,
      overdue: c.overdue,
      trn: c.trn,
    }));
  }
  const rows = await crud.listAll(filters);
  return rows.map(mapApiCustomerToRow);
}

export async function getCustomerRow(id: string): Promise<CustomerRow | null> {
  if (IS_MOCK_MODE) {
    const c = await customerMock.getCustomerById(id);
    return c
      ? {
          id: c.id,
          name: c.name,
          nameEn: c.nameEn,
          nameAr: c.name,
          phone: c.phone,
          balance: c.balance,
          creditLimit: c.creditLimit,
          overdue: c.overdue,
          trn: c.trn,
        }
      : null;
  }
  try {
    const row = await crud.retrieve(id);
    return mapApiCustomerToRow(row);
  } catch {
    return null;
  }
}

export async function createCustomer(payload: Record<string, unknown>): Promise<CustomerRow> {
  const row = await crud.create(payload as never);
  return mapApiCustomerToRow(row);
}

export async function updateCustomer(id: string, payload: Record<string, unknown>): Promise<CustomerRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiCustomerToRow(row);
}

export async function getCustomerLedger(id: string): Promise<CustomerLedgerEntry[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(`${ENDPOINTS.tenant.customer(id)}ledger/`);
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    date: String(r.date ?? r.entry_date ?? ""),
    description: String(r.description ?? r.narration ?? ""),
    debit: parseAmount(r.debit as string),
    credit: parseAmount(r.credit as string),
    balance: parseAmount(r.balance as string),
  }));
}

function mapNestedRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown[] }).results;
    return Array.isArray(results) ? (results as Record<string, unknown>[]) : [];
  }
  return [];
}

export interface CustomerTabInvoiceRow {
  id: string;
  number: string;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
}

export interface CustomerTabCollectionRow {
  id: string;
  number: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
}

export async function listCustomerSalesInvoices(customerId: string): Promise<CustomerTabInvoiceRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.customerSales(customerId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    number: String(r.invoice_number ?? r.number ?? r.id ?? ""),
    date: String(r.invoice_date ?? r.date ?? "").slice(0, 10),
    total: parseAmount(r.total_amount as string),
    paid: parseAmount(r.amount_paid as string),
    remaining: parseAmount((r.balance_due ?? r.remaining) as string),
    status: String(r.payment_status ?? r.status ?? ""),
  }));
}

export async function listCustomerCollections(customerId: string): Promise<CustomerTabCollectionRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.customerCollections(customerId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    number: String(r.receipt_number ?? r.reference_number ?? r.id ?? ""),
    date: String(r.movement_date ?? r.date ?? "").slice(0, 10),
    amount: parseAmount(r.amount as string),
    method: String(r.payment_method ?? ""),
    reference: r.reference_number ? String(r.reference_number) : undefined,
  }));
}

export async function listCustomerQuotations(customerId: string): Promise<CustomerTabInvoiceRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.customerQuotations(customerId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    number: String(r.quotation_number ?? r.number ?? r.id ?? ""),
    date: String(r.quotation_date ?? r.date ?? "").slice(0, 10),
    total: parseAmount(r.total_amount as string),
    paid: 0,
    remaining: parseAmount(r.total_amount as string),
    status: String(r.status ?? ""),
  }));
}

export async function listCustomerFreeProducts(customerId: string): Promise<{ id: string; product: string; active: boolean }[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.customerFreeProducts(customerId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    product: String(r.product_name ?? r.product_name_snapshot ?? ""),
    active: r.is_active !== false,
  }));
}

export async function getCustomerSpecialPrices(id: string): Promise<CustomerSpecialPrice[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(
    `${ENDPOINTS.tenant.customer(id)}special-prices/`,
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    customer: String(r.customer_name ?? ""),
    product: String(r.product_name ?? ""),
    price: parseAmount(r.price as string),
    pt: String(r.price_type ?? "kg"),
    diff: 0,
    active: r.is_active !== false,
    updated: String(r.updated_at ?? "").slice(0, 10),
  }));
}

export interface CustomerCategoryRow {
  id: number;
  nameAr: string;
  nameEn: string;
  code: string;
  active: boolean;
}

export async function listCustomerCategories(): Promise<CustomerCategoryRow[]> {
  if (IS_MOCK_MODE) return [];
  const res = await request<{ results?: ApiCustomerCategory[] } | ApiCustomerCategory[]>(
    ENDPOINTS.tenant.customerCategories,
  );
  const rows = Array.isArray(res) ? res : (res.results ?? []);
  return rows.map((c) => ({
    id: c.id,
    nameAr: c.name_ar,
    nameEn: c.name_en || c.name_ar,
    code: c.code,
    active: c.is_active !== false,
  }));
}

interface ApiCustomerCategory {
  id: number;
  name_ar: string;
  name_en?: string;
  code: string;
  is_active?: boolean;
}

function mapOpeningBalanceType(raw: string): string {
  const labels: Record<string, string> = {
    "على العميل": "customer_owes_us",
    "للعميل": "we_owe_customer",
    "صفر": "zero",
    Debit: "customer_owes_us",
    Credit: "we_owe_customer",
    Zero: "zero",
  };
  return labels[raw] ?? raw;
}

export function buildCustomerCreatePayload(form: {
  nameAr: string;
  nameEn?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  emirate?: string;
  trn?: string;
  customerType?: string;
  categoryId?: number;
  creditLimit?: number;
  openingBalance?: number;
  openingBalanceType?: string;
  paymentTermsDays?: number;
  blockSalesWhenCreditExceeded?: boolean;
  allowAdminCreditOverride?: boolean;
  notes?: string;
  includeFinancials?: boolean;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name_ar: form.nameAr.trim(),
    name_en: (form.nameEn?.trim() || form.nameAr.trim()),
    phone: form.phone.trim(),
    customer_type: form.customerType ?? "cash",
  };

  const whatsapp = form.whatsapp?.trim();
  if (whatsapp) payload.whatsapp = whatsapp;

  const email = form.email?.trim();
  if (email) payload.email = email;

  const address = form.address?.trim();
  if (address) payload.address = address;

  const emirate = form.emirate?.trim();
  if (emirate) payload.emirate = emirate;

  const trn = form.trn?.trim();
  if (trn) payload.trn = trn;

  if (form.categoryId != null && form.categoryId > 0) {
    payload.category = form.categoryId;
  }

  const notes = form.notes?.trim();
  if (notes) payload.notes = notes;

  if (form.includeFinancials !== false) {
    const obType = mapOpeningBalanceType(form.openingBalanceType ?? "zero");
    const obAmount = form.openingBalance ?? 0;
    payload.opening_balance_type = obType;
    payload.opening_balance = String(obAmount >= 0 ? obAmount : 0);

    if (form.customerType === "credit") {
      payload.credit_limit = String(form.creditLimit ?? 0);
      if (form.blockSalesWhenCreditExceeded != null) {
        payload.block_sales_when_credit_exceeded = form.blockSalesWhenCreditExceeded;
      }
      if (form.allowAdminCreditOverride != null) {
        payload.allow_admin_credit_override = form.allowAdminCreditOverride;
      }
    } else {
      payload.credit_limit = "0";
    }

    if (form.paymentTermsDays != null && form.paymentTermsDays >= 0) {
      payload.payment_terms_days = form.paymentTermsDays;
    }
  }

  return payload;
}
