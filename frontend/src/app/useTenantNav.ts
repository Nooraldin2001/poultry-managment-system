import { useCallback, useState } from "react";
import type { TenantScreen } from "@/shared/types";

/** Selected-entity IDs for in-app tenant navigation (no React Router). */
export interface TenantSelection {
  productId: string;
  customerId: string;
  supplierId: string;
  purchaseId: string;
  salesId: string;
  quotationId: string;
  expenseId: string;
  receiptId: string;
  inventoryProductId: string;
  paymentMovementId: string;
}

const EMPTY: TenantSelection = {
  productId: "",
  customerId: "",
  supplierId: "",
  purchaseId: "",
  salesId: "",
  quotationId: "",
  expenseId: "",
  receiptId: "",
  inventoryProductId: "",
  paymentMovementId: "",
};

export function useTenantNav(initialScreen: TenantScreen = "dashboard") {
  const [screen, setScreen] = useState<TenantScreen>(initialScreen);
  const [selection, setSelection] = useState<TenantSelection>(EMPTY);

  const navigate = useCallback((s: TenantScreen, patch?: Partial<TenantSelection>) => {
    if (patch) setSelection((prev) => ({ ...prev, ...patch }));
    setScreen(s);
  }, []);

  const setSelectionField = useCallback(<K extends keyof TenantSelection>(key: K, value: TenantSelection[K]) => {
    setSelection((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { screen, setScreen, selection, setSelection, setSelectionField, navigate };
}
