import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CurrentUser } from "@/shared/types/auth";
import type { TenantRole } from "@/shared/types/roles";
import { IS_MOCK_MODE } from "@/services/config";
import * as authService from "@/services/authService";
import { resetSessionExpiredFlag } from "@/services/api/session";
import { mapBackendRole } from "@/services/tenantService";
import { ApiError } from "@/services/api/errors";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  tenantRole: TenantRole;
  permissions: string[];
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (IS_MOCK_MODE) {
      setLoading(false);
      return;
    }
    if (!authService.isAuthenticated()) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await authService.fetchCurrentUser();
      setUser(me);
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && (err.status === 401 || err.code === "session_expired")) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load session");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    if (IS_MOCK_MODE) {
      const mockUser: CurrentUser = {
        id: 0,
        email,
        full_name: email.split("@")[0] || "Dev User",
        phone: "",
        role: "owner_admin",
        is_superuser: true,
        is_active: true,
        force_password_change: false,
        company: null,
        plan: null,
        permissions: [],
      };
      setUser(mockUser);
      setError(null);
      return mockUser;
    }
    const loggedIn = await authService.login({ email, password });
    resetSessionExpiredFlag();
    setUser(loggedIn);
    setError(null);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    if (!IS_MOCK_MODE) {
      await authService.logout();
    }
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isSuperAdmin: !!user?.is_superuser,
      tenantRole: user ? mapBackendRole(user.role) : "owner",
      permissions: user?.permissions ?? [],
      login,
      logout,
      refreshUser,
    }),
    [user, loading, error, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
