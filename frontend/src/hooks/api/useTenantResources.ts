import { useListResource } from "./useListResource";
import { useDetailResource } from "./useDetailResource";
import { listProductRows, getProductRow } from "@/services/productService";
import { listCustomerRows, getCustomerRow } from "@/services/customerService";
import { listSupplierRows, getSupplierRow } from "@/services/supplierService";
import { listInventoryRows } from "@/services/inventoryService";
import { listPurchaseRows, getPurchaseRow } from "@/services/purchaseService";
import { listSalesRows, getSalesRow } from "@/services/salesService";
import { listPaymentMovementRows } from "@/services/paymentService";
import { listQuotationRows, getQuotationDetail } from "@/services/quotationService";
import { listExpenseRows } from "@/services/expenseService";
import type { ApiListFilters } from "@/services/crud/types";

export function useProducts(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").ProductRow[]>) {
  return useListResource(() => listProductRows(filters), mockFetcher, [JSON.stringify(filters)], ["products", "inventory"]);
}

export function useProductDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").ProductRow | null>) {
  return useDetailResource(id, getProductRow, mockFetcher);
}

export function useCustomers(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").CustomerRow[]>) {
  return useListResource(() => listCustomerRows(filters), mockFetcher, [JSON.stringify(filters)], ["customers"]);
}

export function useCustomerDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").CustomerRow | null>) {
  return useDetailResource(id, getCustomerRow, mockFetcher);
}

export function useSuppliers(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").SupplierRow[]>) {
  return useListResource(() => listSupplierRows(filters), mockFetcher, [JSON.stringify(filters)], ["suppliers"]);
}

export function useSupplierDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").SupplierRow | null>) {
  return useDetailResource(id, getSupplierRow, mockFetcher);
}

export function useInventory(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").InventoryBalanceRow[]>) {
  return useListResource(() => listInventoryRows(filters), mockFetcher, [JSON.stringify(filters)], ["inventory"]);
}

export function usePurchases(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").PurchaseInvoiceRow[]>) {
  return useListResource(() => listPurchaseRows(filters), mockFetcher, [JSON.stringify(filters)], ["purchases"]);
}

export function usePurchaseDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").PurchaseInvoiceRow | null>) {
  return useDetailResource(id, getPurchaseRow, mockFetcher);
}

export function useSales(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").SalesInvoiceRow[]>) {
  return useListResource(() => listSalesRows(filters), mockFetcher, [JSON.stringify(filters)]);
}

export function useSaleDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").SalesInvoiceRow | null>) {
  return useDetailResource(id, getSalesRow, mockFetcher);
}

export function usePaymentMovements(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").PaymentMovementRow[]>) {
  return useListResource(() => listPaymentMovementRows(filters), mockFetcher, [JSON.stringify(filters)]);
}

export function useQuotations(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").QuotationRow[]>) {
  return useListResource(() => listQuotationRows(filters), mockFetcher, [JSON.stringify(filters)]);
}

export function useQuotationDetail(id: string | null, mockFetcher?: (id: string) => Promise<import("@/shared/types/entities").QuotationRow | null>) {
  return useDetailResource(
    id,
    async (quotationId) => {
      const result = await getQuotationDetail(quotationId);
      return result?.quotation ?? null;
    },
    mockFetcher,
  );
}

export function useExpenses(filters?: ApiListFilters, mockFetcher?: () => Promise<import("@/shared/types/entities").ExpenseRow[]>) {
  return useListResource(() => listExpenseRows(filters), mockFetcher, [JSON.stringify(filters)]);
}
