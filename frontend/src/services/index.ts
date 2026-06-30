// Service boundary entry point.
//
// Screens import data accessors from here (never from data/mock directly), so the
// mock → Django REST swap only touches this folder.
//
// Mock vs live is decided HERE, centrally, via IS_MOCK_MODE:
//   * Mock mode (dev + VITE_USE_MOCK_DATA=true): delegate to services/mock/*.
//   * Live mode (production / flag off): the live REST client is not wired yet, so
//     list endpoints return a controlled EMPTY result and object/summary endpoints
//     throw ApiUnavailableError. We NEVER fall back to demo data in live mode.

import { IS_MOCK_MODE } from "@/services/config";
import { ApiUnavailableError } from "./api/client";

import * as companyMock from "./mock/companyService.mock";
import * as customerMock from "./mock/customerService.mock";
import * as supplierMock from "./mock/supplierService.mock";
import * as productMock from "./mock/productService.mock";
import * as inventoryMock from "./mock/inventoryService.mock";
import * as salesMock from "./mock/salesService.mock";
import * as purchaseMock from "./mock/purchaseService.mock";
import * as paymentMock from "./mock/paymentService.mock";
import * as expenseMock from "./mock/expenseService.mock";
import * as reportMock from "./mock/reportService.mock";
import * as taxMock from "./mock/taxService.mock";

// Live-mode fallbacks (no demo data).
const liveEmptyList = async () => [];
const liveNoItem = async () => null;
const liveUnavailable = async () => {
  throw new ApiUnavailableError("Live endpoint not implemented yet.");
};

const pick = <T>(mockImpl: T, liveImpl: T): T => (IS_MOCK_MODE ? mockImpl : liveImpl);

export const listCompanies: typeof companyMock.listCompanies = pick(companyMock.listCompanies, liveEmptyList);
export const getCompanyById: typeof companyMock.getCompanyById = pick(companyMock.getCompanyById, liveNoItem);
export const listCustomers: typeof customerMock.listCustomers = pick(customerMock.listCustomers, liveEmptyList);
export const getCustomerById: typeof customerMock.getCustomerById = pick(customerMock.getCustomerById, liveNoItem);
export const listSuppliers: typeof supplierMock.listSuppliers = pick(supplierMock.listSuppliers, liveEmptyList);
export const getSupplierById: typeof supplierMock.getSupplierById = pick(supplierMock.getSupplierById, liveNoItem);
export const listProducts: typeof productMock.listProducts = pick(productMock.listProducts, liveEmptyList);
export const getProductById: typeof productMock.getProductById = pick(productMock.getProductById, liveNoItem);
export const listInventoryItems: typeof inventoryMock.listInventoryItems = pick(inventoryMock.listInventoryItems, liveEmptyList);
export const listSalesInvoices: typeof salesMock.listSalesInvoices = pick(salesMock.listSalesInvoices, liveEmptyList);
export const getSalesInvoiceById: typeof salesMock.getSalesInvoiceById = pick(salesMock.getSalesInvoiceById, liveNoItem);
export const listPurchaseInvoices: typeof purchaseMock.listPurchaseInvoices = pick(purchaseMock.listPurchaseInvoices, liveEmptyList);
export const listPaymentMovements: typeof paymentMock.listPaymentMovements = pick(paymentMock.listPaymentMovements, liveEmptyList);
export const listExpenses: typeof expenseMock.listExpenses = pick(expenseMock.listExpenses, liveEmptyList);
export const getReportSummary: typeof reportMock.getReportSummary = pick(reportMock.getReportSummary, liveUnavailable);
export const getDashboardSummary: typeof reportMock.getDashboardSummary = pick(reportMock.getDashboardSummary, liveUnavailable);
export const getTaxSummary: typeof taxMock.getTaxSummary = pick(taxMock.getTaxSummary, liveUnavailable);

export { API_CONFIG, ApiUnavailableError } from "./api/client";
export { IS_MOCK_MODE, IS_PRODUCTION, API_BASE_URL } from "./config";
export type { ListResponse, ItemResponse, ObjectResponse, ListParams } from "./api/types";
