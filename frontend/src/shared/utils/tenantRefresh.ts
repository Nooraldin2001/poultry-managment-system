/** Lightweight cross-screen cache refresh after tenant mutations (approve, cancel, etc.). */

export type TenantRefreshScope = "purchases" | "sales" | "inventory" | "products" | "suppliers" | "customers";

const EVENT = "ph:tenant-data-changed";

export function notifyTenantDataChanged(...scopes: TenantRefreshScope[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { scopes } }));
}

export function subscribeTenantRefresh(
  scopes: TenantRefreshScope[],
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ scopes?: TenantRefreshScope[] }>).detail;
    const changed = detail?.scopes ?? [];
    if (changed.some((s) => scopes.includes(s))) listener();
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
