import { request } from "@/services/api/client";
import type { PaginatedResponse } from "@/services/api/types";
import { filtersToQuery } from "./parse";
import type { ApiListFilters, CrudService } from "./types";

function joinPath(base: string, segment: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  const s = segment.startsWith("/") ? segment.slice(1) : segment;
  return `${b}${s}`;
}

export function createCrudService<
  TList,
  TDetail = TList,
  TCreate = Partial<TDetail>,
  TUpdate = Partial<TDetail>,
>(basePath: string): CrudService<TList, TDetail, TCreate, TUpdate> {
  const normalized = basePath.endsWith("/") ? basePath : `${basePath}/`;

  async function list(filters?: ApiListFilters): Promise<PaginatedResponse<TList>> {
    return request<PaginatedResponse<TList>>(normalized, { query: filtersToQuery(filters) });
  }

  async function listAll(filters?: ApiListFilters): Promise<TList[]> {
    const first = await list({ ...filters, page: 1, page_size: filters?.page_size ?? 100 });
    const items = [...first.results];
    let nextUrl = first.next;
    let page = 2;
    while (nextUrl && page <= 20) {
      const chunk = await list({ ...filters, page, page_size: filters?.page_size ?? 100 });
      items.push(...chunk.results);
      nextUrl = chunk.next;
      page += 1;
      if (!chunk.results.length) break;
    }
    return items;
  }

  async function retrieve(id: string | number): Promise<TDetail> {
    return request<TDetail>(joinPath(normalized, String(id)));
  }

  async function create(payload: TCreate): Promise<TDetail> {
    return request<TDetail>(normalized, { method: "POST", body: payload });
  }

  async function update(id: string | number, payload: TUpdate): Promise<TDetail> {
    return request<TDetail>(joinPath(normalized, String(id)), { method: "PUT", body: payload });
  }

  async function patch(id: string | number, payload: Partial<TUpdate>): Promise<TDetail> {
    return request<TDetail>(joinPath(normalized, String(id)), { method: "PATCH", body: payload });
  }

  async function remove(id: string | number): Promise<void> {
    await request<void>(joinPath(normalized, String(id)), { method: "DELETE" });
  }

  async function action<T = unknown>(
    id: string | number,
    actionPath: string,
    body?: unknown,
  ): Promise<T> {
    const path = joinPath(joinPath(normalized, String(id)), actionPath);
    return request<T>(path, { method: "POST", body });
  }

  return { list, listAll, retrieve, create, update, patch, remove, action };
}
