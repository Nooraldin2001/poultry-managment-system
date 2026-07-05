import { IS_MOCK_MODE } from "@/services/config";
import { parseAmount } from "@/services/reportsService";

/** In live mode never return mock/sample rows. */
export function liveOrMockRows<T>(mockRows: T[], liveRows: T[] | undefined | null): T[] {
  if (IS_MOCK_MODE) return mockRows;
  return liveRows ?? [];
}

export function liveOrMockChart<T>(mockPoints: T[], livePoints: T[] | undefined | null): T[] {
  if (IS_MOCK_MODE) return mockPoints;
  return livePoints ?? [];
}

export function reportRecords(data: Record<string, unknown>): Record<string, unknown>[] {
  const records = data.records ?? data.rows;
  return Array.isArray(records) ? (records as Record<string, unknown>[]) : [];
}

export function reportBreakdown(
  data: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const breakdowns = data.breakdowns;
  if (!breakdowns || typeof breakdowns !== "object") return [];
  const section = (breakdowns as Record<string, unknown>)[key];
  return Array.isArray(section) ? (section as Record<string, unknown>[]) : [];
}

export function mapSalesRecordsToTableRows(records: Record<string, unknown>[]) {
  return records.map((r) => ({
    id: String(r.invoice_number ?? r.id ?? ""),
    date: String(r.invoice_date ?? r.date ?? "").slice(0, 10),
    customer: String(r.customer_name_snapshot ?? r.customer_name ?? r.customer ?? ""),
    kg: parseAmount(r.quantity_kg as string),
    sub: parseAmount(r.subtotal as string),
    vat: parseAmount(r.vat_amount as string),
    total: parseAmount(r.total_amount as string),
    paid: parseAmount(r.amount_paid as string),
    rem: parseAmount(r.balance_due as string),
    status: String(r.payment_status ?? r.status ?? ""),
  }));
}

export function mapPurchaseRecordsToTableRows(records: Record<string, unknown>[]) {
  return records.map((r) => ({
    id: String(r.invoice_number ?? r.id ?? ""),
    suppInv: String(r.supplier_invoice_number ?? r.supplier_inv_no ?? ""),
    date: String(r.invoice_date ?? r.date ?? "").slice(0, 10),
    supplier: String(r.supplier_name_snapshot ?? r.supplier_name ?? r.supplier ?? ""),
    ct: parseAmount(r.total_cartons as string),
    kg: parseAmount(r.total_kg as string),
    goods: parseAmount(r.goods_total as string),
    ded: parseAmount(r.deduction_total as string),
    vat: parseAmount(r.vat_amount as string),
    netP: parseAmount(r.net_payable as string),
    paid: parseAmount(r.amount_paid as string),
    rem: parseAmount(r.balance_due as string),
    status: String(r.payment_status ?? r.status ?? ""),
  }));
}

export function mapDateBreakdownToTrend(
  rows: Record<string, unknown>[],
  valueKey = "total",
) {
  return rows.map((r) => ({
    day: String(r.date ?? ""),
    dayEn: String(r.date ?? ""),
    sales: parseAmount(r[valueKey] as string),
    purchases: 0,
    expenses: 0,
  }));
}

export function mapPaymentRecordsToTableRows(records: Record<string, unknown>[]) {
  return records.map((r) => ({
    id: String(r.reference_number ?? r.receipt_number ?? r.id ?? ""),
    date: String(r.movement_date ?? r.date ?? "").slice(0, 10),
    type: String(r.movement_type ?? r.type ?? ""),
    party: String(r.party_name ?? r.customer_name ?? r.supplier_name ?? ""),
    amount: parseAmount(r.amount as string),
    dir: String(r.direction ?? r.dir ?? "in"),
    method: String(r.payment_method ?? r.method ?? ""),
    receipt: String(r.receipt_number ?? r.reference_number ?? ""),
    status: String(r.status ?? "posted"),
  }));
}

export function inventoryBalances(data: Record<string, unknown>): Record<string, unknown>[] {
  const balances = data.balances;
  return Array.isArray(balances) ? (balances as Record<string, unknown>[]) : [];
}

export function mapInventoryBalancesToTableRows(records: Record<string, unknown>[]) {
  return records.map((b) => {
    const kg = parseAmount(b.available_kg as string);
    const fifoValue = parseAmount(b.fifo_value as string);
    const status = String(b.stock_status ?? "available");
    return {
      name: String(b.product_name ?? b.name ?? ""),
      ct: parseAmount(b.available_cartons as string),
      kg,
      minCt: parseAmount(b.min_cartons as string),
      status: status === "out_of_stock" ? "out" : status === "low" ? "low" : "available",
      fifo: kg > 0 ? fifoValue / kg : fifoValue,
      lastP: "—",
      lastS: "—",
    };
  });
}

export const EMPTY_REPORT_MSG = {
  ar: "لا توجد بيانات حقيقية بعد",
  en: "No real data yet",
} as const;

export function formatReportAed(amount: string | number | null | undefined): string {
  const n = parseAmount(amount);
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
