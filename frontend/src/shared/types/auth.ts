/** Auth / session types aligned with `/api/v1/auth/*` responses. */

export interface CompanyBrief {
  id: number;
  name_ar: string;
  name_en: string;
  subdomain: string;
  status: string;
}

export interface UserPlanBrief {
  code: string;
  name: string;
  status: string;
  user_limit?: number;
  enabled_modules?: string[];
  premium_whatsapp_enabled?: boolean;
  advanced_reports_enabled?: boolean;
}

export type BackendTenantRole = "owner_admin" | "accountant" | "cashier_sales" | string;

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: BackendTenantRole;
  is_superuser: boolean;
  is_active: boolean;
  force_password_change: boolean;
  company: CompanyBrief | null;
  plan: UserPlanBrief | null;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: CurrentUser;
}

export interface TokenRefreshResponse {
  access: string;
}
