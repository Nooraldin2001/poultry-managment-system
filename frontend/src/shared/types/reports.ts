/** Phase 10 tenant reports dashboard (`GET /tenant/reports/dashboard/`). */

export interface TrendPoint {
  date: string;
  sales: string | number;
  gross_profit?: string | number;
}

export interface DashboardSummary {
  date_from: string;
  date_to: string;
  total_sales: string | number;
  total_purchases: string | number;
  gross_profit: string | number;
  net_profit_foundation: string | number;
  total_expenses: string | number;
  customer_receivables: string | number;
  supplier_payables: string | number;
  inventory_value: string | number;
  inventory_kg: string | number;
  low_stock_count: number;
  overdue_customer_balance_count?: number;
  overdue_supplier_payable_count?: number;
  sales_invoice_count?: number;
  purchase_invoice_count?: number;
  quotations_open_count?: number;
  pending_payments_count?: number;
  tax_net_vat_estimate?: string | number | null;
  sales_trend: TrendPoint[];
}

export interface TaxSummaryBridge {
  available?: boolean;
  message?: string;
  output_vat?: string | number;
  input_vat?: string | number;
  net_vat?: string | number;
  payable_or_recoverable?: string;
  warning_count?: number;
  disabled_vat_count?: number;
  note?: string;
}
