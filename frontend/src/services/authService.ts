import type { LoginRequest, LoginResponse, CurrentUser } from "@/shared/types/auth";
import { ApiError } from "./api/errors";
import { clearTokens, request, setTokens } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import { getAppHostKind } from "./tenantUrl";

export async function login(credentials: LoginRequest): Promise<CurrentUser> {
  const data = await request<LoginResponse>(ENDPOINTS.auth.login, {
    method: "POST",
    body: credentials,
    auth: false,
    noRefresh: true,
  });
  setTokens(data.access, data.refresh);
  return data.user;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  if (!isAuthenticated()) {
    throw new ApiError("Not authenticated", { status: 401, code: "unauthorized" });
  }
  return request<CurrentUser>(ENDPOINTS.auth.me);
}

export async function logout(): Promise<void> {
  try {
    await request<void>(ENDPOINTS.auth.logout, { method: "POST" });
  } catch {
    // Stateless JWT — always clear locally.
  } finally {
    clearTokens();
  }
}

export function isAuthenticated(): boolean {
  try {
    return !!localStorage.getItem("poultry_hero_access_token");
  } catch {
    return false;
  }
}
