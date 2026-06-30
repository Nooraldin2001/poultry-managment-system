// Service boundary entry point.
//
// Screens should import data accessors from here (not from data/mock directly),
// so the future swap from mock → Django REST only touches this folder.
//
// Currently every function returns mock data (services/mock/*).

export { listCompanies, getCompanyById } from "./mock/companyService.mock";
export { listCustomers, getCustomerById } from "./mock/customerService.mock";
export { listSuppliers, getSupplierById } from "./mock/supplierService.mock";
export { listProducts, getProductById } from "./mock/productService.mock";
export { listInventoryItems } from "./mock/inventoryService.mock";
export { listSalesInvoices, getSalesInvoiceById } from "./mock/salesService.mock";
export { listPurchaseInvoices } from "./mock/purchaseService.mock";
export { listPaymentMovements } from "./mock/paymentService.mock";
export { listExpenses } from "./mock/expenseService.mock";
export { getReportSummary, getDashboardSummary } from "./mock/reportService.mock";
export { getTaxSummary } from "./mock/taxService.mock";

export { API_CONFIG } from "./api/client";
export type { ListResponse, ItemResponse, ObjectResponse, ListParams } from "./api/types";
