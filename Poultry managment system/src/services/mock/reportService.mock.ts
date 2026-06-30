import type { ObjectResponse } from "@/services/api/types";
import { T_DAILY, T_MONTHLY_PROFIT, T_PAY_PIE } from "@/data/mock/reports.mock";
import { T_INVOICES } from "@/data/mock/sales.mock";
import { T_CUSTOMERS } from "@/data/mock/customers.mock";
import { mockDelay } from "./mockDelay";

export interface ReportSummaryData {
  daily: typeof T_DAILY;
  monthlyProfit: typeof T_MONTHLY_PROFIT;
  paymentSplit: typeof T_PAY_PIE;
}

export interface DashboardSummary {
  totalSalesToday: number;
  openInvoices: number;
  overdueCustomers: number;
}

export function getReportSummary(): ObjectResponse<ReportSummaryData> {
  return mockDelay({
    daily: T_DAILY,
    monthlyProfit: T_MONTHLY_PROFIT,
    paymentSplit: T_PAY_PIE,
  });
}

export function getDashboardSummary(): ObjectResponse<DashboardSummary> {
  return mockDelay({
    totalSalesToday: T_DAILY[T_DAILY.length - 1]?.sales ?? 0,
    openInvoices: T_INVOICES.filter((i) => i.remaining > 0).length,
    overdueCustomers: T_CUSTOMERS.filter((c) => c.overdue).length,
  });
}
