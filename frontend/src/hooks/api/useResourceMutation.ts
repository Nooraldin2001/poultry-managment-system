import { useCallback, useState } from "react";
import { ApiError } from "@/services/api/errors";
import type { ValidationErrors } from "@/services/crud/types";

export interface MutationState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  fieldErrors: ValidationErrors;
  forbidden: boolean;
  mutate: () => Promise<T | null>;
  reset: () => void;
}

export function useResourceMutation<T>(
  mutator: () => Promise<T>,
): MutationState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [forbidden, setForbidden] = useState(false);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setFieldErrors({});
    setForbidden(false);
  }, []);

  const mutate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setForbidden(false);
    try {
      const result = await mutator();
      setData(result);
      return result;
    } catch (err) {
      setData(null);
      setError(err);
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setForbidden(err.status === 403);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [mutator]);

  return { data, loading, error, fieldErrors, forbidden, mutate, reset };
}

export function useResourceAction<TArg extends unknown[], TResult>(
  action: (...args: TArg) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [forbidden, setForbidden] = useState(false);

  const run = useCallback(
    async (...args: TArg): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      setFieldErrors({});
      setForbidden(false);
      try {
        return await action(...args);
      } catch (err) {
        setError(err);
        if (err instanceof ApiError) {
          setFieldErrors(err.fieldErrors);
          setForbidden(err.status === 403);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  return { run, loading, error, fieldErrors, forbidden };
}
