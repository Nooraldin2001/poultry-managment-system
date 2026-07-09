import type { Company, CompanyPlan, CompanyStatus } from "@/shared/types/tenant";
import { IS_MOCK_MODE } from "@/services/config";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { PaginatedResponse } from "./api/types";
import { getAppHostKind } from "./tenantUrl";
import * as companyMock from "./mock/companyService.mock";

/** Raw company row from `GET /admin/companies/`. */
export interface ApiCompany {
  id: number;
  name_ar: string;
  name_en: string;
  subdomain: string;
  trade_license?: string;
  license_expiry_date?: string | null;
  trn?: string;
  emirate?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  notes?: string;
  status: string;
  is_active?: boolean;
  subscription?: {
    plan_code?: string;
    plan_name?: string;
    status?: string;
    billing_cycle?: string;
    user_limit?: number;
    renewal_date?: string | null;
    outstanding_amount?: string | number;
    total_paid?: string | number;
    plan?: {
      code?: string;
      name?: string;
      monthly_price?: string | number;
      yearly_price?: string | number;
      enabled_modules?: string[];
    };
    monthly_price_snapshot?: string | number;
    yearly_price_snapshot?: string | number;
    last_payment_date?: string | null;
  } | null;
  active_user_count?: number;
  created_at?: string;
  logo_url?: string | null;
  stamp_url?: string | null;
  signature_url?: string | null;
}

export interface ApiPlan {
  id: number;
  code: string;
  name: string;
  monthly_price: string | number;
  yearly_price: string | number;
  user_limit: number;
  enabled_modules: string[];
  is_active: boolean;
}

export interface ApiSubscriptionPayment {
  id: number;
  company_id?: number;
  amount: string | number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at?: string;
}

export interface AdminDashboardSummary {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  suspendedCompanies: number;
  expectedMonthly: number;
  totalOutstanding: number;
  statusPie: { name: string; nameEn: string; value: number; color: string }[];
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPlanCode(code?: string): CompanyPlan {
  const c = (code ?? "basic").toLowerCase();
  if (c === "pro") return "pro";
  if (c === "enterprise") return "enterprise";
  return "basic";
}

function mapStatus(status?: string): CompanyStatus {
  const s = (status ?? "active").toLowerCase();
  if (s === "trial") return "trial";
  if (s === "suspended") return "suspended";
  return "active";
}

export function mapApiCompanyToUi(row: ApiCompany): Company {
  const sub = row.subscription;
  const planCode = sub?.plan_code ?? sub?.plan?.code;
  const monthly =
    num(sub?.monthly_price_snapshot) ||
    num(sub?.plan?.monthly_price) ||
    0;
  const yearly =
    num(sub?.yearly_price_snapshot) ||
    num(sub?.plan?.yearly_price) ||
    monthly * 12;

  return {
    id: String(row.id),
    nameAr: row.name_ar,
    nameEn: row.name_en,
    subdomain: row.subdomain,
    adminName: row.manager_name || row.email || "—",
    adminPhone: row.manager_phone || row.phone || "—",
    adminEmail: row.manager_email || row.email || "—",
    managerName: row.manager_name || "",
    managerPhone: row.manager_phone || "",
    managerEmail: row.manager_email || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    licenseExpiryDate: row.license_expiry_date ? String(row.license_expiry_date).slice(0, 10) : "",
    notes: row.notes || "",
    plan: mapPlanCode(planCode),
    status: mapStatus(row.status),
    monthlyPrice: monthly,
    yearlyPrice: yearly,
    renewalDate: sub?.renewal_date ?? "—",
    outstandingAmount: num(sub?.outstanding_amount),
    totalPaid: num(sub?.total_paid),
    lastPaymentDate: sub?.last_payment_date ? String(sub.last_payment_date) : "—",
    createdDate: row.created_at ? String(row.created_at).slice(0, 10) : "—",
    emirate: row.emirate || "—",
    tradeLicense: row.trade_license || "—",
    modules: sub?.plan?.enabled_modules ?? [],
    trn: row.trn ?? "",
    logoUrl: row.logo_url ?? null,
    stampUrl: row.stamp_url ?? null,
    signatureUrl: row.signature_url ?? null,
  };
}

export function buildAdminDashboardSummary(companies: Company[]): AdminDashboardSummary {
  const statusPie = [
    { name: "نشط", nameEn: "Active", value: companies.filter((c) => c.status === "active").length, color: "#22C55E" },
    { name: "تجريبي", nameEn: "Trial", value: companies.filter((c) => c.status === "trial").length, color: "#F59E0B" },
    { name: "موقوف", nameEn: "Suspended", value: companies.filter((c) => c.status === "suspended").length, color: "#EF4444" },
  ].filter((s) => s.value > 0);

  const expectedMonthly = companies
    .filter((c) => c.status !== "suspended")
    .reduce((s, c) => s + c.monthlyPrice, 0);
  const totalOutstanding = companies.reduce((s, c) => s + c.outstandingAmount, 0);

  return {
    totalCompanies: companies.length,
    activeCompanies: companies.filter((c) => c.status === "active").length,
    trialCompanies: companies.filter((c) => c.status === "trial").length,
    suspendedCompanies: companies.filter((c) => c.status === "suspended").length,
    expectedMonthly,
    totalOutstanding,
    statusPie,
  };
}

export async function listCompaniesLive(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<Company[]> {
  // Tenant subdomains must never call Super Admin APIs (403 for tenant JWT).
  if (getAppHostKind() === "tenant") {
    return [];
  }
  const data = await request<PaginatedResponse<ApiCompany>>(ENDPOINTS.admin.companies, {
    query: {
      search: params?.search,
      page: params?.page,
      page_size: params?.pageSize ?? 100,
    },
  });
  return data.results.map(mapApiCompanyToUi);
}

export async function getCompanyByIdLive(id: string): Promise<Company | null> {
  try {
    const row = await fetchAdminCompanyLive(id);
    return row ? mapApiCompanyToUi(row) : null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function fetchAdminCompanyLive(id: string): Promise<ApiCompany | null> {
  try {
    return await request<ApiCompany>(ENDPOINTS.admin.company(id));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function listPlansLive(): Promise<ApiPlan[]> {
  const data = await request<PaginatedResponse<ApiPlan> | ApiPlan[]>(ENDPOINTS.admin.plans);
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function listSubscriptionPaymentsLive(): Promise<ApiSubscriptionPayment[]> {
  const data = await request<PaginatedResponse<ApiSubscriptionPayment> | ApiSubscriptionPayment[]>(
    ENDPOINTS.admin.subscriptionPayments,
  );
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export interface AdminCompanyUpdatePayload {
  name_ar?: string;
  name_en?: string;
  subdomain?: string;
  status?: string;
  trade_license?: string;
  license_expiry_date?: string | null;
  trn?: string;
  emirate?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  notes?: string;
}

export interface CreateCompanyPayload {
  name_ar: string;
  name_en: string;
  subdomain: string;
  plan_code: string;
  status?: string;
  trade_license?: string;
  trn?: string;
  emirate?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CreateCompanyAdminUserPayload {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

export async function createCompanyLive(payload: CreateCompanyPayload): Promise<ApiCompany> {
  return request<ApiCompany>(ENDPOINTS.admin.companies, {
    method: "POST",
    body: payload,
  });
}

export async function createCompanyAdminUserLive(
  companyId: number | string,
  payload: CreateCompanyAdminUserPayload,
): Promise<unknown> {
  return request(ENDPOINTS.admin.companyCreateAdminUser(companyId), {
    method: "POST",
    body: payload,
  });
}

export async function updateCompanyLive(
  companyId: number | string,
  payload: Record<string, unknown> | FormData,
): Promise<ApiCompany> {
  return request<ApiCompany>(ENDPOINTS.admin.company(companyId), {
    method: "PATCH",
    body: payload,
  });
}

export async function updateCompanyAssetsLive(
  companyId: number | string,
  assets: Partial<Record<"logo" | "stamp" | "signature", File | null>>,
  fields?: Partial<Pick<CreateCompanyPayload, "trn" | "name_ar" | "name_en" | "phone" | "address">>,
): Promise<ApiCompany> {
  const form = new FormData();
  for (const [key, file] of Object.entries(assets)) {
    if (file === null) form.append(key, "");
    else if (file instanceof File) form.append(key, file);
  }
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) form.append(key, String(value));
    }
  }
  return updateCompanyLive(companyId, form);
}

export async function createCompany(payload: CreateCompanyPayload): Promise<ApiCompany> {
  if (IS_MOCK_MODE) {
    throw new Error("createCompany is not available in mock mode");
  }
  return createCompanyLive(payload);
}

export async function createCompanyAdminUser(
  companyId: number | string,
  payload: CreateCompanyAdminUserPayload,
): Promise<unknown> {
  if (IS_MOCK_MODE) {
    throw new Error("createCompanyAdminUser is not available in mock mode");
  }
  return createCompanyAdminUserLive(companyId, payload);
}

export async function listCompanies(params?: { search?: string }): Promise<Company[]> {
  if (IS_MOCK_MODE) return companyMock.listCompanies();
  return listCompaniesLive(params);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  if (IS_MOCK_MODE) return companyMock.getCompanyById(id);
  return getCompanyByIdLive(id);
}

export async function listPlans(): Promise<ApiPlan[]> {
  if (IS_MOCK_MODE) return [];
  return listPlansLive();
}

export interface ModuleResetCatalogItem {
  key: string;
  label_ar: string;
  label_en: string;
  danger_level: "low" | "medium" | "high" | "critical";
  description_ar: string;
  description_en: string;
  requires_confirmation: boolean;
}

export interface ModuleResetCatalogResponse {
  company: { id: number; name_ar: string; name_en: string; subdomain: string };
  modules: ModuleResetCatalogItem[];
  backup_warning_en: string;
  backup_warning_ar: string;
}

export interface ModuleResetDryRunResponse {
  company: { id: number; name_ar: string; name_en: string; subdomain: string };
  module: string;
  can_reset: boolean;
  danger_level: string;
  affected_counts: Record<string, number>;
  side_effects: string[];
  blocking_dependencies: string[];
  blocking_dependencies_ar?: string[];
  required_reset_order?: string[];
  required_confirmation_text: string;
  dry_run_token?: string;
}

export interface ModuleResetConfirmResponse {
  company: { id: number; name_ar: string; name_en: string; subdomain: string };
  module: string;
  success: boolean;
  deleted_counts: Record<string, number>;
  recalculation: Record<string, unknown>;
  completed_at: string;
}

export interface ModuleResetHistoryItem {
  id: number;
  action: string;
  module: string | null;
  reason: string;
  user_id: number | null;
  user_email: string | null;
  new_value: Record<string, unknown> | null;
  previous_value: Record<string, unknown> | null;
  created_at: string | null;
}

export async function getModuleResetCatalog(companyId: number | string): Promise<ModuleResetCatalogResponse> {
  return request<ModuleResetCatalogResponse>(ENDPOINTS.admin.moduleResetCatalog(companyId));
}

export async function moduleResetDryRun(
  companyId: number | string,
  module: string,
): Promise<ModuleResetDryRunResponse> {
  return request<ModuleResetDryRunResponse>(ENDPOINTS.admin.moduleResetDryRun(companyId), {
    method: "POST",
    body: { module },
  });
}

export async function moduleResetConfirm(
  companyId: number | string,
  payload: {
    module: string;
    confirmation_text: string;
    reason: string;
    dry_run_token?: string;
    backup_confirmed?: boolean;
  },
): Promise<ModuleResetConfirmResponse> {
  return request<ModuleResetConfirmResponse>(ENDPOINTS.admin.moduleResetConfirm(companyId), {
    method: "POST",
    body: payload,
  });
}

export async function getModuleResetHistory(companyId: number | string): Promise<{
  company_id: number;
  history: ModuleResetHistoryItem[];
}> {
  return request(ENDPOINTS.admin.moduleResetHistory(companyId));
}
