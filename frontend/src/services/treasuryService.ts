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
  createdAt?: string;
  updatedAt?: string;
};

export type TreasurySummary = {
  cashboxTotal: number;
  bankTotal: number;
  availableTotal: number;
  accountsCount: number;
  activeCashboxes: number;
  activeBanks: number;
  todayInflows: number;
  todayOutflows: number;
};

export type MoneyMovementRow = {
  id: string;
  direction: "in" | "out";
  movementType: string;
  amount: number;
  description: string;
  reason: string;
  movementDate: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type AccountStatement = {
  openingBalance: number;
  closingBalance: number;
  movements: MoneyMovementRow[];
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
  created_at?: string;
  updated_at?: string;
};

type ApiMoneyMovement = {
  id: number;
  direction: "in" | "out";
  movement_type: string;
  amount: string;
  description?: string;
  reason?: string;
  movement_date?: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
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
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

function mapMovement(m: ApiMoneyMovement): MoneyMovementRow {
  return {
    id: String(m.id),
    direction: m.direction,
    movementType: m.movement_type,
    amount: n(m.amount),
    description: m.description ?? "",
    reason: m.reason ?? "",
    movementDate: m.movement_date ?? m.created_at?.slice(0, 10) ?? "",
    referenceType: m.reference_type ?? "",
    referenceId: m.reference_id ?? "",
    createdAt: m.created_at,
  };
}

export async function listMoneyAccounts(filters?: {
  accountType?: "cashbox" | "bank";
  isActive?: boolean;
}): Promise<MoneyAccountRow[]> {
  const data = await request<ApiMoneyAccount[] | { results?: ApiMoneyAccount[] }>(
    ENDPOINTS.tenant.moneyAccounts,
    {
      query: {
        account_type: filters?.accountType,
        is_active: filters?.isActive,
      },
    },
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map(mapAccount);
}

export async function getMoneyAccount(id: string): Promise<MoneyAccountRow> {
  const row = await request<ApiMoneyAccount>(ENDPOINTS.tenant.moneyAccount(id));
  return mapAccount(row);
}

export async function createMoneyAccount(payload: Record<string, unknown>): Promise<MoneyAccountRow> {
  const row = await request<ApiMoneyAccount>(ENDPOINTS.tenant.moneyAccounts, {
    method: "POST",
    body: payload,
  });
  return mapAccount(row);
}

export async function updateMoneyAccount(
  id: string,
  payload: Record<string, unknown>,
): Promise<MoneyAccountRow> {
  const row = await request<ApiMoneyAccount>(ENDPOINTS.tenant.moneyAccount(id), {
    method: "PATCH",
    body: payload,
  });
  return mapAccount(row);
}

export async function listMoneyAccountMovements(
  accountId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    movementType?: string;
    search?: string;
  },
): Promise<MoneyMovementRow[]> {
  const data = await request<ApiMoneyMovement[]>(
    ENDPOINTS.tenant.moneyAccountMovements(accountId),
    {
      query: {
        date_from: filters?.dateFrom,
        date_to: filters?.dateTo,
        movement_type: filters?.movementType,
        search: filters?.search,
      },
    },
  );
  return (data ?? []).map(mapMovement);
}

/** Map UI payment labels to API payment_method values. */
export function mapTreasuryPaymentMethod(method: string): string {
  return method === "bank" ? "bank_transfer" : method;
}

/** Active accounts matching cash vs bank payment methods. */
export function eligibleMoneyAccounts(
  accounts: MoneyAccountRow[],
  paymentMethod: string,
): MoneyAccountRow[] {
  const active = accounts.filter((a) => a.isActive);
  if (paymentMethod === "cash") return active.filter((a) => a.accountType === "cashbox");
  if (["bank", "bank_transfer", "cheque"].includes(paymentMethod)) {
    return active.filter((a) => a.accountType === "bank");
  }
  return [];
}

export function formatMoneyAccountLabel(acc: MoneyAccountRow): string {
  const balance = `${acc.currentBalance.toFixed(2)} ${acc.currency}`;
  if (acc.accountType === "bank") {
    const bankInfo = [acc.bankName, acc.accountNumber].filter(Boolean).join(" ");
    return `${acc.name}${bankInfo ? ` — ${bankInfo}` : ""} (${balance})`;
  }
  return `${acc.name} (${balance})`;
}

export async function getAccountStatement(
  accountId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    movementType?: string;
    search?: string;
  },
): Promise<AccountStatement> {
  const res = await request<{
    opening_balance: string;
    closing_balance: string;
    movements: ApiMoneyMovement[];
  }>(ENDPOINTS.tenant.moneyAccountStatement(accountId), {
    query: {
      date_from: filters?.dateFrom,
      date_to: filters?.dateTo,
      movement_type: filters?.movementType,
      search: filters?.search,
    },
  });
  return {
    openingBalance: n(res.opening_balance),
    closingBalance: n(res.closing_balance),
    movements: (res.movements ?? []).map(mapMovement),
  };
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

export async function transferBetweenAccounts(payload: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  reason: string;
  description?: string;
}): Promise<void> {
  await request(ENDPOINTS.tenant.treasuryTransfer, {
    method: "POST",
    body: {
      from_account: Number(payload.fromAccountId),
      to_account: Number(payload.toAccountId),
      amount: payload.amount,
      reason: payload.reason,
      description: payload.description ?? "",
    },
  });
}

export async function getTreasurySummary(): Promise<TreasurySummary> {
  const res = await request<{
    cashbox_total: string;
    bank_total: string;
    available_total: string;
    accounts_count: number;
    active_cashboxes: number;
    active_banks: number;
    today_inflows: string;
    today_outflows: string;
  }>(ENDPOINTS.tenant.treasurySummary);
  return {
    cashboxTotal: n(res.cashbox_total),
    bankTotal: n(res.bank_total),
    availableTotal: n(res.available_total),
    accountsCount: res.accounts_count ?? 0,
    activeCashboxes: res.active_cashboxes ?? 0,
    activeBanks: res.active_banks ?? 0,
    todayInflows: n(res.today_inflows),
    todayOutflows: n(res.today_outflows),
  };
}

export const MOVEMENT_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  purchase_payment: { ar: "دفع شراء", en: "Purchase payment" },
  sales_payment: { ar: "تحصيل مبيعات", en: "Sales payment" },
  supplier_payment: { ar: "دفع مورد", en: "Supplier payment" },
  customer_collection: { ar: "تحصيل عميل", en: "Customer collection" },
  expense_payment: { ar: "دفع مصروف", en: "Expense payment" },
  manual_adjustment: { ar: "تعديل يدوي", en: "Manual adjustment" },
  account_transfer: { ar: "تحويل بين حسابات", en: "Account transfer" },
  refund: { ar: "استرداد", en: "Refund" },
  opening_balance: { ar: "رصيد افتتاحي", en: "Opening balance" },
};
