import { IS_MOCK_MODE } from "@/services/config";
import { resolveApiBase } from "@/services/tenantUrl";
import { notifySessionExpired } from "./session";
import { ApiError } from "./errors";

const ACCESS_KEY = "poultry_hero_access_token";
const REFRESH_KEY = "poultry_hero_refresh_token";

export const API_CONFIG = {
  get baseUrl() {
    return resolveApiBase();
  },
  useMock: IS_MOCK_MODE,
};

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
  const base = resolveApiBase().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}/v1${normalized}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function parseDrfErrors(data: unknown): { message: string; fieldErrors: Record<string, string[]> } {
  if (typeof data === "string") {
    if (data.includes("<title>Bad Request (400)</title>")) {
      return {
        message: "This workspace host is not allowed by the server. Contact support.",
        fieldErrors: {},
      };
    }
    return { message: data.slice(0, 200) || "Request failed", fieldErrors: {} };
  }
  if (!data || typeof data !== "object") {
    return { message: "Request failed", fieldErrors: {} };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === "string") {
    return { message: obj.detail, fieldErrors: {} };
  }
  if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length) {
    return { message: String(obj.non_field_errors[0]), fieldErrors: {} };
  }
  const fieldErrors: Record<string, string[]> = {};
  const messages: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      fieldErrors[key] = val.map(String);
      messages.push(...fieldErrors[key]);
    } else if (typeof val === "string") {
      fieldErrors[key] = [val];
      messages.push(val);
    }
  }
  return { message: messages[0] ?? "Validation failed", fieldErrors };
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(buildUrl("/auth/refresh/"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
          clearTokens();
          notifySessionExpired();
          return null;
        }
        const data = (await res.json()) as { access: string };
        localStorage.setItem(ACCESS_KEY, data.access);
        return data.access;
      } catch {
        clearTokens();
        notifySessionExpired();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  /** Skip automatic token refresh retry on 401. */
  noRefresh?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, noRefresh = false } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && method !== "GET" && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = buildUrl(path, query);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        body === undefined ? undefined :
        isFormData ? (body as FormData) :
        JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection.", {
      code: "network_error",
      status: 0,
    });
  }

  if (res.status === 401 && auth && !noRefresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return request<T>(path, { ...options, noRefresh: true });
    }
    notifySessionExpired();
    throw new ApiError(
      "Session expired. Please sign in again.",
      { status: 401, code: "session_expired" },
    );
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const isHtml =
      typeof data === "string" &&
      (data.includes("<!doctype html>") || data.includes("<title>Server Error"));
    const { message, fieldErrors } = parseDrfErrors(data);
    const code =
      res.status === 401 ? "unauthorized" :
      res.status === 403 ? "forbidden" :
      res.status === 404 ? "not_found" :
      isHtml || res.status >= 500 ? "server_error" :
      "api_error";
    const safeMessage =
      isHtml || (res.status >= 500 && typeof data === "string")
        ? "Server error while approving purchase invoice. Please contact support."
        : message;
    throw new ApiError(safeMessage, { status: res.status, code, fieldErrors, raw: data });
  }

  return data as T;
}

export { ApiError, ApiUnavailableError } from "./errors";
