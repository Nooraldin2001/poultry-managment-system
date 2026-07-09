import { useCallback, useEffect, useRef, useState } from "react";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";
import { isAuthenticated } from "@/services/authService";

export interface DetailResourceState<T> {
  item: T | null;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  reload: () => Promise<void>;
}

export function useDetailResource<T>(
  id: string | null | undefined,
  liveFetcher: (id: string) => Promise<T | null>,
  mockFetcher?: (id: string) => Promise<T | null>,
): DetailResourceState<T> {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<unknown>(null);
  const [forbidden, setForbidden] = useState(false);
  const mockFetcherRef = useRef(mockFetcher);
  mockFetcherRef.current = mockFetcher;

  const reload = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    const mockFn = mockFetcherRef.current;
    if (IS_MOCK_MODE && mockFn) {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        setItem(await mockFn(id));
      } catch (err) {
        setItem(null);
        setError(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!IS_MOCK_MODE && !isAuthenticated()) {
      setItem(null);
      setLoading(false);
      setError(null);
      setForbidden(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setItem(await liveFetcher(id));
    } catch (err) {
      setItem(null);
      setError(err);
      setForbidden(ApiError.isForbidden(err));
    } finally {
      setLoading(false);
    }
  }, [id, liveFetcher]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { item, loading, error, forbidden, reload };
}
