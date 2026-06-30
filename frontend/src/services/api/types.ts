// Service-layer result types. These describe the *shape* of what the future
// Django REST API will return, independent of the current mock implementation.

/** A successful list response. */
export type ListResponse<T> = Promise<T[]>;

/** A successful single-item response (null when not found). */
export type ItemResponse<T> = Promise<T | null>;

/** A generic object response. */
export type ObjectResponse<T> = Promise<T>;

/** Pagination params the API will eventually accept. */
export interface ListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}
