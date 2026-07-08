import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";

export type MoneyAccountRow = {
  id: string;
  name: string;
  accountType: "cashbox" | "bank";
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  allowNegative: boolean;
  notes?: string;
};

type ApiMoneyAccount = {
  id: number;
  name: string;
  account_type: "cashbox" | "bank";
  bank_name?: string;
  account_number?: string;
  iban?: string;
  currency: string;
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
  allow_negative: boolean;
  notes?: string;
};

function n(v: unknown): number {
  return Number(String(v ?? "0")) || 0;
}

function mapAccount(a: ApiMoneyAccount): MoneyAccountRow {
  return {
    id: String(a.id),
    name: a.name,
    accountType: a.account_type,
    bankName: a.bank_name ?? "",
    accountNumber: a.account_number ?? "",
    iban: a.iban ?? "",
    currency: a.currency ?? "AED",
    openingBalance: n(a.opening_balance),
    currentBalance: n(a.current_balance),
    isActive: a.is_active,
    allowNegative: a.allow_negative,
    notes: a.notes ?? "",
  };
}

export async function listMoneyAccounts(): Promise<MoneyAccountRow[]> {
  const data = await request<ApiMoneyAccount[] | { results?: ApiMoneyAccount[] }>(
    ENDPOINTS.tenant.moneyAccounts,
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map(mapAccount);
}

export async function createMoneyAccount(payload: Record<string, unknown>): Promise<MoneyAccountRow> {
  const row = await request<ApiMoneyAccount>(ENDPOINTS.tenant.moneyAccounts, {
    method: "POST",
    body: payload,
  });
  return mapAccount(row);
}

export type MoneyMovementRow = {
  id: string;
  direction: "in" | "out";
  movementType: string;
  amount: number;
  description: string;
  reason: string;
  createdAt: string;
};

type ApiMoneyMovement = {
  id: number;
  direction: "in" | "out";
  movement_type: string;
  amount: string;
  description?: string;
  reason?: string;
  created_at: string;
};

export async function listMoneyAccountMovements(accountId: string): Promise<MoneyMovementRow[]> {
  const data = await request<ApiMoneyMovement[]>(ENDPOINTS.tenant.moneyAccountMovements(accountId));
  return (data ?? []).map((m) => ({
    id: String(m.id),
    direction: m.direction,
    movementType: m.movement_type,
    amount: n(m.amount),
    description: m.description ?? "",
    reason: m.reason ?? "",
    createdAt: m.created_at,
  }));
}

export async function createMoneyAdjustment(
  accountId: string,
  payload: { direction: "in" | "out"; amount: number; reason: string; description?: string },
): Promise<void> {
  await request(ENDPOINTS.tenant.moneyAccountAdjustments(accountId), {
    method: "POST",
    body: payload,
  });
}

export async function getTreasurySummary(): Promise<{ cashboxTotal: number; bankTotal: number; availableTotal: number }> {
  const res = await request<{ cashbox_total: string; bank_total: string; available_total: string }>(
    ENDPOINTS.tenant.treasurySummary,
  );
  return {
    cashboxTotal: n(res.cashbox_total),
    bankTotal: n(res.bank_total),
    availableTotal: n(res.available_total),
  };
}

