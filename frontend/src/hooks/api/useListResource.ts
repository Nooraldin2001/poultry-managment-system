import { useCallback, useEffect, useState } from "react";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";
import { isAuthenticated } from "@/services/authService";
import { subscribeTenantRefresh, type TenantRefreshScope } from "@/shared/utils/tenantRefresh";

export interface ListResourceState<T> {
  items: T[];
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  reload: () => Promise<void>;
}

export function useListResource<T>(
  liveFetcher: () => Promise<T[]>,
  mockFetcher?: () => Promise<T[]>,
  deps: unknown[] = [],
  refreshScopes?: TenantRefreshScope[],
): ListResourceState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [forbidden, setForbidden] = useState(false);

  const reload = useCallback(async () => {
    if (IS_MOCK_MODE && mockFetcher) {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        setItems(await mockFetcher());
      } catch (err) {
        setItems([]);
        setError(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!IS_MOCK_MODE && !isAuthenticated()) {
      setItems([]);
      setLoading(false);
      setError(null);
      setForbidden(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setItems(await liveFetcher());
    } catch (err) {
      setItems([]);
      setError(err);
      setForbidden(ApiError.isForbidden(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [IS_MOCK_MODE, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!refreshScopes?.length) return;
    return subscribeTenantRefresh(refreshScopes, () => {
      void reload();
    });
  }, [reload, refreshScopes]);

  return { items, loading, error, forbidden, reload };
}
