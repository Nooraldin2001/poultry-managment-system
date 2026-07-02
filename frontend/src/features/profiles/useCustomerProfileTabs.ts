import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/errors";
import { IS_MOCK_MODE } from "@/services/config";
import {
  getCustomerLedger,
  getCustomerSpecialPrices,
  listCustomerCollections,
  listCustomerFreeProducts,
  listCustomerQuotations,
  listCustomerSalesInvoices,
  type CustomerTabCollectionRow,
  type CustomerTabInvoiceRow,
} from "@/services/customerService";
import type { CustomerLedgerEntry, CustomerSpecialPrice } from "@/shared/types/entities";

export type CustomerProfileTabKey =
  | "overview"
  | "invoices"
  | "collections"
  | "statement"
  | "prices"
  | "free"
  | "discounts"
  | "audit";

type TabState<T> = {
  data: T;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  unavailable: boolean;
};

const emptyInvoices: CustomerTabInvoiceRow[] = [];
const emptyCollections: CustomerTabCollectionRow[] = [];
const emptyLedger: CustomerLedgerEntry[] = [];
const emptyPrices: CustomerSpecialPrice[] = [];
const emptyFree: { id: string; product: string; active: boolean }[] = [];

function tabErrorState<T>(fallback: T): TabState<T> {
  return { data: fallback, loading: false, error: null, forbidden: false, unavailable: false };
}

export function useCustomerProfileTabs(customerId: string, activeTab: CustomerProfileTabKey) {
  const [invoices, setInvoices] = useState<TabState<CustomerTabInvoiceRow[]>>({
    ...tabErrorState(emptyInvoices),
    loading: !IS_MOCK_MODE,
  });
  const [collections, setCollections] = useState<TabState<CustomerTabCollectionRow[]>>({
    ...tabErrorState(emptyCollections),
    loading: false,
  });
  const [ledger, setLedger] = useState<TabState<CustomerLedgerEntry[]>>({
    ...tabErrorState(emptyLedger),
    loading: false,
  });
  const [quotations, setQuotations] = useState<TabState<CustomerTabInvoiceRow[]>>({
    ...tabErrorState(emptyInvoices),
    loading: false,
  });
  const [specialPrices, setSpecialPrices] = useState<TabState<CustomerSpecialPrice[]>>({
    ...tabErrorState(emptyPrices),
    loading: false,
  });
  const [freeProducts, setFreeProducts] = useState<TabState<{ id: string; product: string; active: boolean }[]>>({
    ...tabErrorState(emptyFree),
    loading: false,
  });

  const loadTab = useCallback(
    async <T,>(
      loader: () => Promise<T>,
      setter: (s: TabState<T>) => void,
      fallback: T,
    ) => {
      if (IS_MOCK_MODE || !customerId) return;
      setter({ data: fallback, loading: true, error: null, forbidden: false, unavailable: false });
      try {
        const data = await loader();
        setter({ data, loading: false, error: null, forbidden: false, unavailable: false });
      } catch (e) {
        const forbidden = e instanceof ApiError && e.status === 403;
        const unavailable = e instanceof ApiError && (e.status === 404 || e.status === 501);
        setter({
          data: fallback,
          loading: false,
          error: forbidden || unavailable ? null : e,
          forbidden,
          unavailable,
        });
      }
    },
    [customerId],
  );

  useEffect(() => {
    if (IS_MOCK_MODE || !customerId) return;
    if (activeTab === "invoices" || activeTab === "overview") {
      void loadTab(() => listCustomerSalesInvoices(customerId), setInvoices, emptyInvoices);
    }
    if (activeTab === "collections" || activeTab === "overview") {
      void loadTab(() => listCustomerCollections(customerId), setCollections, emptyCollections);
    }
    if (activeTab === "statement") {
      void loadTab(() => getCustomerLedger(customerId), setLedger, emptyLedger);
    }
    if (activeTab === "overview") {
      void loadTab(() => listCustomerQuotations(customerId), setQuotations, emptyInvoices);
    }
    if (activeTab === "prices") {
      void loadTab(() => getCustomerSpecialPrices(customerId), setSpecialPrices, emptyPrices);
    }
    if (activeTab === "free") {
      void loadTab(() => listCustomerFreeProducts(customerId), setFreeProducts, emptyFree);
    }
  }, [activeTab, customerId, loadTab]);

  const reloadInvoices = () => void loadTab(() => listCustomerSalesInvoices(customerId), setInvoices, emptyInvoices);
  const reloadCollections = () => void loadTab(() => listCustomerCollections(customerId), setCollections, emptyCollections);
  const reloadLedger = () => void loadTab(() => getCustomerLedger(customerId), setLedger, emptyLedger);
  const reloadPrices = () => void loadTab(() => getCustomerSpecialPrices(customerId), setSpecialPrices, emptyPrices);
  const reloadFree = () => void loadTab(() => listCustomerFreeProducts(customerId), setFreeProducts, emptyFree);

  return {
    invoices,
    collections,
    ledger,
    quotations,
    specialPrices,
    freeProducts,
    reloadInvoices,
    reloadCollections,
    reloadLedger,
    reloadPrices,
    reloadFree,
  };
}
