import { useCallback, useEffect, useState } from "react";
import type { Company } from "@/shared/types/tenant";
import { IS_MOCK_MODE } from "@/services/config";
import { listCompanies } from "@/services/adminService";
import { COMPANIES } from "@/data/mock";

export function useAdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>(IS_MOCK_MODE ? COMPANIES : []);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (IS_MOCK_MODE) {
      setCompanies(COMPANIES);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listCompanies();
      setCompanies(rows);
    } catch (err) {
      setCompanies([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { companies, loading, error, reload };
}
