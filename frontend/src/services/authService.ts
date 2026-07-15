import type { LoginRequest, LoginResponse, CurrentUser } from "@/shared/types/auth";
import { ApiError } from "./api/errors";
import {
  clearLegacyTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasLegacyTokens,
  migrateLegacyTokens,
  request,
  setTokens,
} from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import {
  incompatibleSessionMessage,
  isSessionCompatibleWithHost,
  resolveHostContext,
} from "./hostContext";

function assertCompatibleSession(user: CurrentUser): void {
  const ctx = resolveHostContext();
  if (isSessionCompatibleWithHost(user, ctx)) return;
  clearTokens(ctx, true);
  throw new ApiError(incompatibleSessionMessage(ctx), {
    status: 401,
    code: "session_incompatible",
  });
}

export async function login(credentials: LoginRequest): Promise<CurrentUser> {
  let data: LoginResponse;
  try {
    data = await request<LoginResponse>(ENDPOINTS.auth.login, {
      method: "POST",
      body: credentials,
      auth: false,
      noRefresh: true,
    });
  } catch (err) {
    const ctx = resolveHostContext();
    if (err instanceof ApiError && err.code === "auth_host_mismatch" && ctx.kind === "super_admin") {
      throw new ApiError(incompatibleSessionMessage(ctx), {
        status: err.status,
        code: "session_incompatible",
        raw: err.raw,
      });
    }
    throw err;
  }
  assertCompatibleSession(data.user);
  setTokens(data.access, data.refresh, resolveHostContext());
  clearLegacyTokens();
  return data.user;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  if (!isAuthenticated()) {
    throw new ApiError("Not authenticated", { status: 401, code: "unauthorized" });
  }
  const ctx = resolveHostContext();
  const hadLegacyTokens = hasLegacyTokens();
  const me = await request<CurrentUser>(ENDPOINTS.auth.me);
  if (!isSessionCompatibleWithHost(me, ctx)) {
    clearTokens(ctx, true);
    throw new ApiError(incompatibleSessionMessage(ctx), {
      status: 401,
      code: "session_incompatible",
    });
  }
  if (hadLegacyTokens) {
    const access = getAccessToken(ctx);
    const refresh = getRefreshToken(ctx);
    if (access && refresh) migrateLegacyTokens(access, refresh, ctx);
    else clearLegacyTokens();
  }
  return me;
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
  return !!getAccessToken(resolveHostContext());
}
