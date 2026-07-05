import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { parseAmount } from "@/services/crud/parse";
import type { ApiListFilters } from "@/services/crud/types";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { ExpenseCategoryRow, ExpenseRow, RecurringExpenseRow } from "@/shared/types/entities";
import * as expenseMock from "./mock/expenseService.mock";

const crud = createCrudService<ApiExpenseList, ApiExpenseDetail>(ENDPOINTS.tenant.expenses);

interface ApiExpenseList {
  id: number;
  category_name?: string;
  category_name_en?: string;
  amount: string;
  expense_date?: string;
  payment_method?: string;
  notes?: string;
  status?: string;
}

interface ApiExpenseDetail extends ApiExpenseList {
  category?: number;
}

interface ApiExpenseCategory {
  id: number;
  name_ar: string;
  name_en: string;
  is_active: boolean;
}

export function mapApiExpenseToRow(row: ApiExpenseList): ExpenseRow {
  return {
    id: String(row.id),
    category: row.category_name,
    categoryEn: row.category_name_en,
    amount: parseAmount(row.amount),
    date: row.expense_date,
    method: row.payment_method,
    note: row.notes,
    status: row.status,
  };
}

export async function listExpenseRows(filters?: ApiListFilters): Promise<ExpenseRow[]> {
  if (IS_MOCK_MODE) {
    return expenseMock.listExpenses() as Promise<ExpenseRow[]>;
  }
  const rows = await crud.listAll(filters);
  return rows.map(mapApiExpenseToRow);
}

export async function getExpenseRow(id: string): Promise<ExpenseRow | null> {
  if (IS_MOCK_MODE) return null;
  try {
    const row = await crud.retrieve(id);
    return mapApiExpenseToRow(row);
  } catch {
    return null;
  }
}

export async function createExpense(payload: Record<string, unknown>): Promise<ExpenseRow> {
  const row = await crud.create(payload as never);
  return mapApiExpenseToRow(row);
}

export async function updateExpense(id: string, payload: Record<string, unknown>): Promise<ExpenseRow> {
  const row = await crud.patch(id, payload as never);
  return mapApiExpenseToRow(row);
}

export async function cancelExpense(id: string, reason: string): Promise<ExpenseRow> {
  const row = await crud.action<ApiExpenseList>(id, "cancel/", { reason });
  return mapApiExpenseToRow(row);
}

export async function getExpensesSummary(filters?: ApiListFilters): Promise<Record<string, number>> {
  if (IS_MOCK_MODE) return {};
  const data = await request<Record<string, string | number>>(ENDPOINTS.tenant.expensesSummary, {
    query: filters as Record<string, string | number | boolean>,
  });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = parseAmount(v);
  }
  return out;
}

export async function getExpenseVoucherPreview(id: string): Promise<unknown> {
  return request(`${ENDPOINTS.tenant.expense(id)}voucher-preview/`);
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: ApiExpenseCategory[] } | ApiExpenseCategory[]>(
    ENDPOINTS.tenant.expenseCategories,
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((c) => ({
    id: c.id,
    nameAr: c.name_ar,
    nameEn: c.name_en,
    active: c.is_active,
  }));
}

export async function listRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: unknown[] } | unknown[]>(ENDPOINTS.tenant.recurringExpenses);
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id ?? i),
    title: String(r.title ?? ""),
    category: String(r.category_name ?? ""),
    amount: parseAmount(r.amount as string),
    frequency: String(r.recurrence ?? r.frequency ?? ""),
    nextDate: String(r.next_due_date ?? r.next_run_date ?? "").slice(0, 10),
    active: r.is_active !== false,
  }));
}

export async function generateRecurringExpense(id: string): Promise<ExpenseRow> {
  const row = await request<ApiExpenseList>(`${ENDPOINTS.tenant.recurringExpenses}${id}/generate/`, {
    method: "POST",
    body: {},
  });
  return mapApiExpenseToRow(row);
}
