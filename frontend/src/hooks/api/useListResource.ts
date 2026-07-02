import { useCallback, useEffect, useState } from "react";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";

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

  return { items, loading, error, forbidden, reload };
}
