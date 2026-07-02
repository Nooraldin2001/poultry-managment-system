import type { PaginatedResponse } from "@/services/api/types";

/** Query params accepted by most tenant list endpoints. */
export interface ApiListFilters {
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface DateRange {
  date_from?: string;
  date_to?: string;
}

export type EntityStatus = "draft" | "approved" | "cancelled" | "active" | "inactive";

export type ValidationErrors = Record<string, string[]>;

export interface CrudService<TList, TDetail = TList, TCreate = Partial<TDetail>, TUpdate = Partial<TDetail>> {
  list: (filters?: ApiListFilters) => Promise<PaginatedResponse<TList>>;
  listAll: (filters?: ApiListFilters) => Promise<TList[]>;
  retrieve: (id: string | number) => Promise<TDetail>;
  create: (payload: TCreate) => Promise<TDetail>;
  update: (id: string | number, payload: TUpdate) => Promise<TDetail>;
  patch: (id: string | number, payload: Partial<TUpdate>) => Promise<TDetail>;
  remove: (id: string | number) => Promise<void>;
  action: <T = unknown>(id: string | number, actionPath: string, body?: unknown) => Promise<T>;
}
