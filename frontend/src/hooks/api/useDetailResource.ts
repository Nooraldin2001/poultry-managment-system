import { useCallback, useEffect, useRef, useState } from "react";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";
import { isAuthenticated } from "@/services/authService";

export interface DetailResourceState<T> {
  item: T | null;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  notFound: boolean;
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
  const [notFound, setNotFound] = useState(false);
  const mockFetcherRef = useRef(mockFetcher);
  const liveFetcherRef = useRef(liveFetcher);
  const fetchSeqRef = useRef(0);
  mockFetcherRef.current = mockFetcher;
  liveFetcherRef.current = liveFetcher;

  const reload = useCallback(async () => {
    const requestId = ++fetchSeqRef.current;
    if (!id) {
      setItem(null);
      setLoading(false);
      setError(null);
      setForbidden(false);
      setNotFound(false);
      return;
    }
    const mockFn = mockFetcherRef.current;
    if (IS_MOCK_MODE && mockFn) {
      setLoading(true);
      setError(null);
      setForbidden(false);
      setNotFound(false);
      try {
        const data = await mockFn(id);
        if (requestId !== fetchSeqRef.current) return;
        setItem(data);
      } catch (err) {
        if (requestId !== fetchSeqRef.current) return;
        setItem(null);
        setError(err);
        setForbidden(ApiError.isForbidden(err));
        setNotFound(ApiError.isNotFound(err));
      } finally {
        if (requestId === fetchSeqRef.current) setLoading(false);
      }
      return;
    }
    if (!IS_MOCK_MODE && !isAuthenticated()) {
      setItem(null);
      setLoading(false);
      setError(null);
      setForbidden(false);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    setNotFound(false);
    try {
      const data = await liveFetcherRef.current(id);
      if (requestId !== fetchSeqRef.current) return;
      setItem(data);
    } catch (err) {
      if (requestId !== fetchSeqRef.current) return;
      setItem(null);
      setError(err);
      setForbidden(ApiError.isForbidden(err));
      setNotFound(ApiError.isNotFound(err));
    } finally {
      if (requestId === fetchSeqRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { item, loading, error, forbidden, notFound, reload };
}
