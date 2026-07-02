import type { DashboardSummary } from "@/shared/types/reports";
import { IS_MOCK_MODE } from "@/services/config";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import * as reportMock from "./mock/reportService.mock";

export interface DashboardQuery {
  date_from?: string;
  date_to?: string;
}

export async function getTenantDashboardSummary(
  query?: DashboardQuery,
): Promise<DashboardSummary> {
  if (IS_MOCK_MODE) {
    const mock = await reportMock.getDashboardSummary();
    return {
      date_from: query?.date_from ?? "",
      date_to: query?.date_to ?? "",
      total_sales: mock.totalSalesToday,
      total_purchases: 0,
      gross_profit: 0,
      net_profit_foundation: 0,
      total_expenses: 0,
      customer_receivables: 0,
      supplier_payables: 0,
      inventory_value: 0,
      inventory_kg: 0,
      low_stock_count: 0,
      sales_trend: [],
    };
  }
  const params: Record<string, string> = {};
  if (query?.date_from) params.date_from = query.date_from;
  if (query?.date_to) params.date_to = query.date_to;
  return request<DashboardSummary>(ENDPOINTS.tenant.reportsDashboard, { query: params });
}

export function parseAmount(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export interface ReportQuery {
  date_from?: string;
  date_to?: string;
  customer_id?: string | number;
  supplier_id?: string | number;
  product_id?: string | number;
  report_type?: string;
  search?: string;
}

function reportQueryToParams(query?: ReportQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (!query) return params;
  if (query.date_from) params.date_from = query.date_from;
  if (query.date_to) params.date_to = query.date_to;
  if (query.customer_id != null) params.customer_id = String(query.customer_id);
  if (query.supplier_id != null) params.supplier_id = String(query.supplier_id);
  if (query.product_id != null) params.product_id = String(query.product_id);
  if (query.report_type) params.report_type = query.report_type;
  if (query.search) params.search = query.search;
  return params;
}

export async function getSalesReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsSales, { query: reportQueryToParams(query) });
}

export async function getPurchasesReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsPurchases, { query: reportQueryToParams(query) });
}

export async function getInventoryReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsInventory, { query: reportQueryToParams(query) });
}

export async function getInventoryMovementsReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsInventoryMovements, { query: reportQueryToParams(query) });
}

export async function getPaymentsReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsPayments, { query: reportQueryToParams(query) });
}

export async function getExpensesReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsExpenses, { query: reportQueryToParams(query) });
}

export async function getProfitReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsProfit, { query: reportQueryToParams(query) });
}

export async function getTaxSummaryReport(query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [], totals: {} };
  return request(ENDPOINTS.tenant.reportsTaxSummary, { query: reportQueryToParams(query) });
}

export async function getReportsExportPayload(query?: ReportQuery): Promise<unknown> {
  if (IS_MOCK_MODE) return {};
  return request(ENDPOINTS.tenant.reportsExportPayload, { query: reportQueryToParams(query) });
}

export async function getCustomerStatementReport(customerId: string, query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.reportsCustomerStatement(customerId), {
    query: reportQueryToParams(query),
  });
}

export async function getSupplierStatementReport(supplierId: string, query?: ReportQuery): Promise<Record<string, unknown>> {
  if (IS_MOCK_MODE) return { rows: [] };
  return request(ENDPOINTS.tenant.reportsSupplierStatement(supplierId), {
    query: reportQueryToParams(query),
  });
}
