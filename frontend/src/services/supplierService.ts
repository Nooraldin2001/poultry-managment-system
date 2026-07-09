import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { SupplierLedgerEntry, SupplierRow } from "@/shared/types/entities";
import * as supplierMock from "./mock/supplierService.mock";

const crud = createCrudService<ApiSupplierList, ApiSupplierDetail>(ENDPOINTS.tenant.suppliers);

interface ApiSupplierList {
  id: number;
  name_ar: string;
  name_en?: string;
  phone?: string;
  current_balance?: string;
  payment_terms_days?: number;
  is_active?: boolean;
}

interface ApiSupplierDetail extends ApiSupplierList {
  trn?: string;
  address?: string;
  email?: string;
  whatsapp?: string;
  emirate?: string;
  supplier_type?: string;
  category?: number | null;
  opening_balance?: string;
  opening_balance_type?: string;
  payment_terms_days?: number;
  default_payment_method?: string;
  track_balance?: boolean;
  notes?: string;
}

export interface SupplierFormValues {
  nameAr: string;
  nameEn: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  emirate: string;
  trn: string;
  supplierType: string;
  categoryId?: number;
  openingBalance: number;
  openingBalanceType: string;
  paymentTermsDays: number;
  defaultPaymentMethod: string;
  trackBalance: boolean;
  notes: string;
  isActive: boolean;
}

export function mapApiSupplierToRow(row: ApiSupplierList): SupplierRow {
  const balance = parseAmount(row.current_balance);
  return {
    id: String(row.id),
    name: row.name_ar,
    nameEn: row.name_en,
    balance,
    due: row.payment_terms_days != null ? `${row.payment_terms_days}d` : undefined,
    overdue: balance > 0,
    phone: row.phone,
    isActive: row.is_active,
  };
}

export async function listSupplierRows(filters?: ApiListFilters): Promise<SupplierRow[]> {
  if (IS_MOCK_MODE) {
    return supplierMock.listSuppliers() as Promise<SupplierRow[]>;
  }
  const rows = await crud.listAll(filters);
  return rows.map(mapApiSupplierToRow);
}

export async function listSlaughterhouseSuppliers(): Promise<SupplierRow[]> {
  return listSupplierRows({ category_code: "slaughterhouse", is_active: "true" });
}

export async function listTransportSuppliers(): Promise<SupplierRow[]> {
  return listSupplierRows({ category_code: "transport", is_active: "true" });
}

export async function getSupplierRow(id: string): Promise<SupplierRow | null> {
  if (IS_MOCK_MODE) {
    return supplierMock.getSupplierById(id) as Promise<SupplierRow | null>;
  }
  try {
    const row = await crud.retrieve(id);
    return mapApiSupplierToRow(row);
  } catch {
    return null;
  }
}

function reverseOpeningBalanceType(api: string): string {
  const labels: Record<string, string> = {
    we_owe_supplier: "للمورد علينا",
    supplier_owes_us: "على المورد",
    zero: "صفر",
  };
  return labels[api] ?? api;
}

export function mapApiSupplierDetailToForm(row: ApiSupplierDetail): SupplierFormValues {
  return {
    nameAr: row.name_ar,
    nameEn: row.name_en ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    emirate: row.emirate ?? "",
    trn: row.trn ?? "",
    supplierType: row.supplier_type ?? "credit",
    categoryId: row.category ?? undefined,
    openingBalance: parseAmount(row.opening_balance),
    openingBalanceType: reverseOpeningBalanceType(row.opening_balance_type ?? "zero"),
    paymentTermsDays: row.payment_terms_days ?? 0,
    defaultPaymentMethod: row.default_payment_method ?? "bank_transfer",
    trackBalance: row.track_balance !== false,
    notes: row.notes ?? "",
    isActive: row.is_active !== false,
  };
}

/** Load full supplier detail for edit form prefill. */
export async function getSupplierDetail(id: string): Promise<SupplierFormValues | null> {
  if (IS_MOCK_MODE) return null;
  try {
    const row = await crud.retrieve(id);
    return mapApiSupplierDetailToForm(row);
  } catch {
    return null;
  }
}

export async function createSupplier(payload: Record<string, unknown>): Promise<SupplierRow> {
  const row = await crud.create(payload as never);
  return mapApiSupplierToRow(row);
}

export async function updateSupplier(id: string, payload: Record<string, unknown>): Promise<SupplierRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiSupplierToRow(row);
}

export async function getSupplierLedger(id: string): Promise<SupplierLedgerEntry[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(`${ENDPOINTS.tenant.supplier(id)}ledger/`);
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    date: String(r.date ?? r.entry_date ?? ""),
    description: String(r.description ?? r.narration ?? ""),
    debit: parseAmount(r.debit as string),
    credit: parseAmount(r.credit as string),
    balance: parseAmount((r.balance_after ?? r.balance) as string),
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

export interface SupplierTabInvoiceRow {
  id: string;
  number: string;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
}

export interface SupplierTabPaymentRow {
  id: string;
  number: string;
  date: string;
  amount: number;
  method: string;
}

export async function listSupplierPurchases(supplierId: string): Promise<SupplierTabInvoiceRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.supplierPurchases(supplierId));
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

export async function listSupplierPayments(supplierId: string): Promise<SupplierTabPaymentRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.supplierPayments(supplierId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    number: String(r.receipt_number ?? r.reference_number ?? r.id ?? ""),
    date: String(r.movement_date ?? r.date ?? "").slice(0, 10),
    amount: parseAmount(r.amount as string),
    method: String(r.payment_method ?? ""),
  }));
}

export async function listSupplierAgreements(supplierId: string): Promise<{ id: string; product: string; price: number; active: boolean }[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request(ENDPOINTS.tenant.supplierAgreements(supplierId));
  return mapNestedRows(data).map((r, i) => ({
    id: String(r.id ?? i),
    product: String(r.product_name ?? r.product_name_snapshot ?? ""),
    price: parseAmount(r.price as string),
    active: r.is_active !== false,
  }));
}

export function buildSupplierCreatePayload(form: {
  nameAr: string;
  nameEn?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  emirate?: string;
  trn?: string;
  supplierType?: string;
  openingBalance?: number;
  openingBalanceType?: string;
  paymentTermsDays?: number;
  defaultPaymentMethod?: string;
  trackBalance?: boolean;
  notes?: string;
  includeFinancials?: boolean;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name_ar: form.nameAr.trim(),
    name_en: (form.nameEn?.trim() || form.nameAr.trim()),
    phone: form.phone.trim(),
    supplier_type: form.supplierType ?? "credit",
    track_balance: form.trackBalance !== false,
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

  const notes = form.notes?.trim();
  if (notes) payload.notes = notes;

  if (form.defaultPaymentMethod) payload.default_payment_method = form.defaultPaymentMethod;

  if (form.includeFinancials !== false) {
    const obLabels: Record<string, string> = {
      "للمورد علينا": "we_owe_supplier",
      "على المورد": "supplier_owes_us",
      "صفر": "zero",
    };
    payload.opening_balance_type = obLabels[form.openingBalanceType ?? ""] ?? "zero";
    payload.opening_balance = String(Math.max(0, form.openingBalance ?? 0));
    payload.payment_terms_days = form.paymentTermsDays ?? 0;
  }

  return payload;
}

/** PATCH payload for supplier profile edits (excludes opening balance — use dedicated endpoint). */
export function buildSupplierUpdatePayload(form: {
  nameAr: string;
  nameEn?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  emirate?: string;
  trn?: string;
  supplierType?: string;
  categoryId?: number | null;
  paymentTermsDays?: number;
  defaultPaymentMethod?: string;
  trackBalance?: boolean;
  notes?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name_ar: form.nameAr.trim(),
    name_en: (form.nameEn?.trim() || form.nameAr.trim()),
    phone: form.phone.trim(),
    supplier_type: form.supplierType ?? "credit",
    track_balance: form.trackBalance !== false,
    email: form.email?.trim() ?? "",
    address: form.address?.trim() ?? "",
    notes: form.notes?.trim() ?? "",
  };

  payload.whatsapp = form.whatsapp?.trim() ?? "";

  const emirate = form.emirate?.trim();
  if (emirate) payload.emirate = emirate;

  const trn = form.trn?.trim();
  if (trn) payload.trn = trn;

  if (form.categoryId != null && form.categoryId > 0) {
    payload.category = form.categoryId;
  } else {
    payload.category = null;
  }

  if (form.defaultPaymentMethod) payload.default_payment_method = form.defaultPaymentMethod;

  if (form.paymentTermsDays != null && form.paymentTermsDays >= 0) {
    payload.payment_terms_days = form.paymentTermsDays;
  }

  return payload;
}
