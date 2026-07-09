import { useCallback, useEffect, useState } from "react";
import type { DashboardSummary } from "@/shared/types/reports";
import { IS_MOCK_MODE } from "@/services/config";
import { isAuthenticated } from "@/services/authService";
import { getTenantDashboardSummary } from "@/services/reportsService";

export function useTenantDashboard(query?: { date_from?: string; date_to?: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const dateFrom = query?.date_from;
  const dateTo = query?.date_to;

  const reload = useCallback(async () => {
    if (IS_MOCK_MODE) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!isAuthenticated()) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantDashboardSummary({ date_from: dateFrom, date_to: dateTo });
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, error, reload };
}

export function dashboardDateRange(
  filter: "today" | "yesterday" | "week" | "month",
): { date_from: string; date_to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(today);
  if (filter === "today") return { date_from: to, date_to: to };
  if (filter === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = fmt(y);
    return { date_from: s, date_to: s };
  }
  if (filter === "week") {
    const w = new Date(today);
    w.setDate(w.getDate() - 6);
    return { date_from: fmt(w), date_to: to };
  }
  const m = new Date(today.getFullYear(), today.getMonth(), 1);
  return { date_from: fmt(m), date_to: to };
}
