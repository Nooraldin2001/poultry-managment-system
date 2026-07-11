import type { CustomerRow, SupplierRow, InventoryBalanceRow, PurchaseInvoiceRow, SalesInvoiceRow, PaymentMovementRow, ExpenseRow, QuotationRow, ProductRow } from "@/shared/types/entities";

/** Map API customer row → CustomerModule local shape (minimal fields for list/detail). */
export function toModuleCustomer(row: CustomerRow) {
  const limit = row.creditLimit ?? 0;
  let creditStatus: "clear" | "active" | "near" | "exceeded" = "clear";
  if (row.overdue || (limit > 0 && row.balance > limit)) creditStatus = "exceeded";
  else if (limit > 0 && row.balance > limit * 0.85) creditStatus = "near";
  else if (row.balance > 0) creditStatus = "active";
  return {
    id: row.id,
    nameAr: row.nameAr ?? row.name,
    nameEn: row.nameEn ?? row.name,
    type: (row.customerType === "cash" ? "cash" : "credit") as "cash" | "credit",
    category: "other",
    phone: row.phone ?? "",
    whatsapp: row.phone ?? "",
    email: "",
    trn: row.trn ?? "",
    emirate: "",
    balance: row.balance,
    creditLimit: limit,
    creditStatus,
    lastInvoice: "",
    lastCollection: "",
    active: row.isActive !== false,
    openingBalance: 0,
  };
}

export function toModuleSupplier(row: SupplierRow) {
  return {
    id: row.id,
    nameAr: row.name,
    nameEn: row.nameEn ?? row.name,
    type: "credit" as const,
    category: row.categoryCode || "other",
    phone: row.phone ?? "",
    balance: row.balance,
    due: row.due ?? "",
    overdue: row.overdue ?? row.balance > 0,
    active: row.isActive !== false,
    trn: "",
    emirate: "",
    lastInvoice: "",
    lastPayment: "",
    openingBalance: 0,
  };
}

export function toModuleInvProduct(row: InventoryBalanceRow) {
  const productId = row.productId || row.id;
  return {
    id: productId,
    productId,
    nameAr: row.name,
    nameEn: row.nameEn ?? row.name,
    sku: "",
    cartons: row.cartons,
    pieces: row.pieces,
    kg: row.weightKg,
    minCt: row.minStock,
    minKg: 0,
    status: row.status ?? "ok",
    value: (row.priceKg ?? 0) * row.weightKg,
    avgCost: row.priceKg ?? 0,
  };
}

export function toModulePurchase(row: PurchaseInvoiceRow) {
  return {
    id: row.id,
    number: row.number,
    supplier: row.supplier,
    supplierId: row.supplierId,
    date: row.date,
    dueDate: row.dueDate ?? row.date,
    status: row.status,
    paymentStatus: row.paymentStatus,
    subtotal: row.subtotal,
    vat: row.vat,
    total: row.total,
    paid: row.paid,
    balance: row.balance,
    lines: 0,
  };
}

export function toModuleSale(row: SalesInvoiceRow) {
  return {
    id: row.id,
    number: row.number,
    customer: row.customer,
    customerId: row.customerId,
    date: row.date,
    dueDate: row.dueDate ?? row.date,
    status: row.status,
    paymentStatus: row.paymentStatus,
    subtotal: row.subtotal,
    vat: row.vat,
    total: row.total,
    paid: row.paid,
    balance: row.balance,
    profit: row.grossProfit ?? 0,
  };
}

export function toModulePayment(row: PaymentMovementRow) {
  return {
    id: row.id,
    type: row.type,
    party: row.party,
    amount: row.amount,
    method: row.method,
    date: row.date,
    reference: row.reference ?? "",
    status: row.status ?? "posted",
  };
}

export function toModuleExpense(row: ExpenseRow) {
  return {
    id: row.id,
    category: row.category ?? "",
    categoryEn: row.categoryEn ?? row.category ?? "",
    amount: row.amount,
    date: row.date ?? "",
    method: row.method ?? "cash",
    note: row.note ?? "",
    status: row.status ?? "posted",
  };
}

export function toModuleQuotation(row: QuotationRow) {
  return {
    id: row.id,
    number: row.number,
    customer: row.customer,
    customerId: row.customerId,
    date: row.date,
    validUntil: row.validUntil ?? row.date,
    status: row.status,
    subtotal: row.subtotal,
    vat: row.vat,
    total: row.total,
    lines: 0,
  };
}

export type { ProductRow };
