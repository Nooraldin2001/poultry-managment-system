import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/errors";
import { IS_MOCK_MODE } from "@/services/config";
import {
  getSupplierLedger,
  listSupplierAgreements,
  listSupplierPayments,
  listSupplierPurchases,
  listSupplierSpecialPrices,
  type SupplierTabInvoiceRow,
  type SupplierTabPaymentRow,
} from "@/services/supplierService";
import type { SupplierLedgerEntry } from "@/shared/types/entities";

export type SupplierProfileTabKey =
  | "overview"
  | "invoices"
  | "payments"
  | "statement"
  | "prices"
  | "agreements"
  | "deductions"
  | "audit";

type TabState<T> = {
  data: T;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  unavailable: boolean;
};

const emptyInvoices: SupplierTabInvoiceRow[] = [];
const emptyPayments: SupplierTabPaymentRow[] = [];
const emptyLedger: SupplierLedgerEntry[] = [];
const emptyAgreements: { id: string; product: string; price: number; active: boolean }[] = [];
const emptySpecialPrices: { id: string; product: string; price: number; active: boolean }[] = [];

function tabErrorState<T>(fallback: T): TabState<T> {
  return { data: fallback, loading: false, error: null, forbidden: false, unavailable: false };
}

export function useSupplierProfileTabs(
  supplierId: string,
  activeTab: SupplierProfileTabKey,
  enabled = true,
) {
  const [purchases, setPurchases] = useState<TabState<SupplierTabInvoiceRow[]>>(tabErrorState(emptyInvoices));
  const [payments, setPayments] = useState<TabState<SupplierTabPaymentRow[]>>(tabErrorState(emptyPayments));
  const [ledger, setLedger] = useState<TabState<SupplierLedgerEntry[]>>(tabErrorState(emptyLedger));
  const [agreements, setAgreements] = useState<TabState<{ id: string; product: string; price: number; active: boolean }[]>>(tabErrorState(emptyAgreements));
  const [specialPrices, setSpecialPrices] = useState<TabState<{ id: string; product: string; price: number; active: boolean }[]>>(tabErrorState(emptySpecialPrices));

  const loadTab = useCallback(
    async <T,>(
      loader: () => Promise<T>,
      setter: (s: TabState<T>) => void,
      fallback: T,
    ) => {
      if (IS_MOCK_MODE || !supplierId || !enabled) return;
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
    [supplierId, enabled],
  );

  useEffect(() => {
    if (IS_MOCK_MODE || !supplierId || !enabled) return;
    if (activeTab === "invoices" || activeTab === "overview") {
      void loadTab(() => listSupplierPurchases(supplierId), setPurchases, emptyInvoices);
    }
    if (activeTab === "payments" || activeTab === "overview") {
      void loadTab(() => listSupplierPayments(supplierId), setPayments, emptyPayments);
    }
    if (activeTab === "statement") {
      void loadTab(() => getSupplierLedger(supplierId), setLedger, emptyLedger);
    }
    if (activeTab === "agreements") {
      void loadTab(() => listSupplierAgreements(supplierId), setAgreements, emptyAgreements);
    }
    if (activeTab === "prices") {
      void loadTab(() => listSupplierSpecialPrices(supplierId), setSpecialPrices, emptySpecialPrices);
    }
  }, [activeTab, supplierId, enabled, loadTab]);

  return { purchases, payments, ledger, agreements, specialPrices };
}
