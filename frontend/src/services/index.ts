import { IS_MOCK_MODE } from "@/services/config";
import * as companyMock from "./mock/companyService.mock";
import * as productMock from "./mock/productService.mock";
import * as customerMock from "./mock/customerService.mock";
import * as supplierMock from "./mock/supplierService.mock";
import * as inventoryMock from "./mock/inventoryService.mock";
import * as salesMock from "./mock/salesService.mock";
import * as purchaseMock from "./mock/purchaseService.mock";
import * as paymentMock from "./mock/paymentService.mock";
import * as expenseMock from "./mock/expenseService.mock";
import * as reportMock from "./mock/reportService.mock";
import * as taxMock from "./mock/taxService.mock";

import { listCompanies as listCompaniesLive, getCompanyById as getCompanyByIdLive } from "./adminService";
import { listProductRows, getProductRow } from "./productService";
import { listCustomerRows, getCustomerRow } from "./customerService";
import { listSupplierRows, getSupplierRow } from "./supplierService";
import { listInventoryRows } from "./inventoryService";
import { listPurchaseRows } from "./purchaseService";
import { listSalesRows, getSalesRow } from "./salesService";
import { listPaymentMovementRows } from "./paymentService";
import { listExpenseRows } from "./expenseService";
import { getTaxSummaryLive } from "./taxService";
import { listQuotationRows } from "./quotationService";

const pick = <T>(mockImpl: T, liveImpl: T): T => (IS_MOCK_MODE ? mockImpl : liveImpl);

export const listCompanies = pick(companyMock.listCompanies, listCompaniesLive);
export const getCompanyById = pick(companyMock.getCompanyById, getCompanyByIdLive);

export async function listProducts() {
  if (IS_MOCK_MODE) return productMock.listProducts();
  return (await listProductRows()) as unknown as Awaited<ReturnType<typeof productMock.listProducts>>;
}

export async function getProductById(id: string) {
  if (IS_MOCK_MODE) return productMock.getProductById(id);
  return (await getProductRow(id)) as unknown as Awaited<ReturnType<typeof productMock.getProductById>>;
}

export async function listCustomers() {
  if (IS_MOCK_MODE) return customerMock.listCustomers();
  return (await listCustomerRows()) as unknown as Awaited<ReturnType<typeof customerMock.listCustomers>>;
}

export async function getCustomerById(id: string) {
  if (IS_MOCK_MODE) return customerMock.getCustomerById(id);
  return (await getCustomerRow(id)) as unknown as Awaited<ReturnType<typeof customerMock.getCustomerById>>;
}

export async function listSuppliers() {
  if (IS_MOCK_MODE) return supplierMock.listSuppliers();
  return (await listSupplierRows()) as unknown as Awaited<ReturnType<typeof supplierMock.listSuppliers>>;
}

export async function getSupplierById(id: string) {
  if (IS_MOCK_MODE) return supplierMock.getSupplierById(id);
  return (await getSupplierRow(id)) as unknown as Awaited<ReturnType<typeof supplierMock.getSupplierById>>;
}

export async function listInventoryItems() {
  if (IS_MOCK_MODE) return inventoryMock.listInventoryItems();
  return (await listInventoryRows()) as unknown as Awaited<ReturnType<typeof inventoryMock.listInventoryItems>>;
}

export async function listSalesInvoices() {
  if (IS_MOCK_MODE) return salesMock.listSalesInvoices();
  return (await listSalesRows()) as unknown as Awaited<ReturnType<typeof salesMock.listSalesInvoices>>;
}

export async function getSalesInvoiceById(id: string) {
  if (IS_MOCK_MODE) return salesMock.getSalesInvoiceById(id);
  return (await getSalesRow(id)) as unknown as Awaited<ReturnType<typeof salesMock.getSalesInvoiceById>>;
}

export async function listPurchaseInvoices() {
  if (IS_MOCK_MODE) return purchaseMock.listPurchaseInvoices();
  return (await listPurchaseRows()) as unknown as Awaited<ReturnType<typeof purchaseMock.listPurchaseInvoices>>;
}

export async function listPaymentMovements() {
  if (IS_MOCK_MODE) return paymentMock.listPaymentMovements();
  return (await listPaymentMovementRows()) as unknown as Awaited<ReturnType<typeof paymentMock.listPaymentMovements>>;
}

export async function listExpenses() {
  if (IS_MOCK_MODE) return expenseMock.listExpenses();
  return (await listExpenseRows()) as unknown as Awaited<ReturnType<typeof expenseMock.listExpenses>>;
}

export async function listQuotations() {
  if (IS_MOCK_MODE) return [] as Awaited<ReturnType<typeof listQuotationRows>>;
  return listQuotationRows();
}

export const getReportSummary = pick(reportMock.getReportSummary, reportMock.getReportSummary);

export async function getTaxSummary() {
  if (IS_MOCK_MODE) return taxMock.getTaxSummary();
  return (await getTaxSummaryLive()) as unknown as Awaited<ReturnType<typeof taxMock.getTaxSummary>>;
}

export { API_CONFIG, ApiError, ApiUnavailableError, request, clearTokens } from "./api/client";
export { IS_MOCK_MODE, IS_PRODUCTION, API_BASE_URL } from "./config";
export type { ListResponse, ItemResponse, ObjectResponse, ListParams, PaginatedResponse, SelectOption } from "./api/types";
export * from "./authService";
export * from "./adminService";
export * from "./reportsService";
export * from "./tenantService";
export * from "./productService";
export * from "./customerService";
export * from "./supplierService";
export * from "./inventoryService";
export * from "./purchaseService";
export * from "./salesService";
export * from "./paymentService";
export * from "./quotationService";
export * from "./expenseService";
export * from "./taxService";
