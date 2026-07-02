import type { Company, CompanyPlan, CompanyStatus } from "@/shared/types/tenant";
import { IS_MOCK_MODE } from "@/services/config";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import type { PaginatedResponse } from "./api/types";
import * as companyMock from "./mock/companyService.mock";

/** Raw company row from `GET /admin/companies/`. */
export interface ApiCompany {
  id: number;
  name_ar: string;
  name_en: string;
  subdomain: string;
  trade_license?: string;
  trn?: string;
  emirate?: string;
  address?: string;
  phone?: string;
  email?: string;
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
    adminName: row.email || "—",
    adminPhone: row.phone || "—",
    adminEmail: row.email || "—",
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
    const row = await request<ApiCompany>(ENDPOINTS.admin.company(id));
    return mapApiCompanyToUi(row);
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

export async function listCompanies(params?: { search?: string }): Promise<Company[]> {
  if (IS_MOCK_MODE) return companyMock.listCompanies();
  return listCompaniesLive(params);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  if (IS_MOCK_MODE) return companyMock.getCompanyById(id);
  return getCompanyByIdLive(id);
}
