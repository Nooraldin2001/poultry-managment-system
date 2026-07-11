/** Money on the wire — backend returns decimal strings. */
export type Money = string | number;

export type ProductTypeUi = "fixed" | "moving" | "part" | "byproduct" | "service" | "other";
export type PriceTypeUi = "kg" | "piece" | "carton" | "tray";

export interface ProductRow {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  cat: string;
  categoryId?: number;
  type: ProductTypeUi;
  g: number;
  ppc: number;
  saleP: number;
  salePT: PriceTypeUi;
  buyP: number;
  buyPT: PriceTypeUi;
  minCt: number;
  minKg: number;
  active: boolean;
  vatT: boolean;
  stockCt: number;
  stockKg: number;
  trackInv: boolean;
}

export interface ProductCategoryRow {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  count: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
  phone?: string;
  balance: number;
  creditLimit?: number;
  overdue?: boolean;
  days?: number;
  trn?: string;
  customerType?: string;
  isActive?: boolean;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  entryType?: string;
}

export interface CustomerSpecialPrice {
  id: string;
  customer: string;
  product: string;
  price: number;
  pt: string;
  diff: number;
  active: boolean;
  updated: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  nameEn?: string;
  balance: number;
  due?: string;
  overdue?: boolean;
  phone?: string;
  isActive?: boolean;
  categoryCode?: string;
}

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface InventoryBalanceRow {
  id: string;
  productId: string;
  name: string;
  nameEn?: string;
  cartons: number;
  pieces: number;
  weightKg: number;
  minStock: number;
  priceKg?: number;
  status?: "ok" | "low" | "out";
}

export interface StockMovementRow {
  id: string;
  date: string;
  product: string;
  type: string;
  cartons: number;
  pieces: number;
  weightKg: number;
  reference?: string;
  balanceAfter?: number;
  createdByName?: string;
  notes?: string;
}

export interface PurchaseInvoiceRow {
  id: string;
  number: string;
  supplier: string;
  supplierId: string;
  date: string;
  dueDate?: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
  moneyAccountId?: string;
  grossTotal?: number;
  slaughterhouseSupplierId?: string;
  slaughterhouseDeduction?: number;
  transportSupplierId?: string;
  transportDeduction?: number;
  deductionNotes?: string;
}

export interface PurchaseInvoiceLineRow {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  cartons?: number;
  pieces?: number;
  kg?: number;
  unit: string;
  price: number;
  vatRate?: number;
  subtotal?: number;
  total: number;
}

export interface SalesInvoiceRow {
  id: string;
  number: string;
  customer: string;
  customerId: string;
  date: string;
  dueDate?: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
  paymentMethod?: string;
  moneyAccountId?: string;
  grossProfit?: number;
}

export interface SalesInvoiceLineRow {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  cartons?: number;
  pieces?: number;
  kg?: number;
  unit: string;
  price: number;
  subtotal: number;
  total: number;
}

export interface PaymentMovementRow {
  id: string;
  type: string;
  party: string;
  partyId?: string;
  amount: number;
  method: string;
  date: string;
  reference?: string;
  status?: string;
}

export interface ReceiptPreview {
  id: string;
  number: string;
  party: string;
  amount: number;
  date: string;
  method: string;
  lines?: { label: string; amount: number }[];
}

export interface QuotationRow {
  id: string;
  number: string;
  customer: string;
  customerId: string;
  date: string;
  validUntil?: string;
  status: string;
  subtotal: number;
  vat: number;
  total: number;
}

export interface QuotationLineRow {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface ExpenseRow {
  id: string;
  category?: string;
  categoryEn?: string;
  amount: number;
  date?: string;
  method?: string;
  note?: string;
  status?: string;
}

export interface ExpenseCategoryRow {
  id: number;
  nameAr: string;
  nameEn: string;
  active: boolean;
}

export interface RecurringExpenseRow {
  id: string;
  title?: string;
  category: string;
  amount: number;
  frequency: string;
  nextDate?: string;
  active: boolean;
}

export interface TaxSummary {
  outputVat: number;
  inputVat: number;
  purchaseVat?: number;
  expenseVat?: number;
  netVat: number;
  payableOrRecoverable?: string;
  warningCount?: number;
  disabledVatCount?: number;
  note?: string;
}

export interface TaxWarning {
  id: string;
  severity: string;
  message: string;
  documentType?: string;
  documentId?: string;
  dismissed?: boolean;
}

export interface ReportPayload {
  report: string;
  date_from?: string;
  date_to?: string;
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
}

export interface KpiSummary {
  labelAr: string;
  labelEn: string;
  value: number | string;
  sub?: string;
}
