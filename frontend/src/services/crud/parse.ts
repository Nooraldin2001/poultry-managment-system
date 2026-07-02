import type { ApiListFilters } from "./types";

export function parseAmount(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function filtersToQuery(
  filters?: ApiListFilters,
): Record<string, string | number | boolean> | undefined {
  if (!filters) return undefined;
  const query: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") {
      query[k] = v as string | number | boolean;
    }
  }
  if (filters.pageSize !== undefined && query.page_size === undefined) {
    query.page_size = filters.pageSize;
  }
  return Object.keys(query).length ? query : undefined;
}
