import type { CompanyBrief, CurrentUser } from "@/shared/types/auth";
import type { Company } from "@/shared/types/tenant";
import type { TenantRole } from "@/shared/types/roles";

export interface CompanyContext {
  id: number;
  nameAr: string;
  nameEn: string;
  subdomain: string;
  status: string;
}

export function mapBackendRole(role: string): TenantRole {
  if (role === "accountant") return "accountant";
  if (role === "cashier_sales") return "cashier";
  return "owner";
}

export function briefToCompanyContext(brief: CompanyBrief): CompanyContext {
  return {
    id: brief.id,
    nameAr: brief.name_ar,
    nameEn: brief.name_en,
    subdomain: brief.subdomain,
    status: brief.status,
  };
}

/** Minimal UI company from auth brief (tenant session). */
export function briefToUiCompany(brief: CompanyBrief): Company {
  return {
    id: String(brief.id),
    nameAr: brief.name_ar,
    nameEn: brief.name_en,
    subdomain: brief.subdomain,
    adminName: "",
    adminPhone: "",
    adminEmail: "",
    plan: "basic",
    status: brief.status === "trial" ? "trial" : brief.status === "suspended" ? "suspended" : "active",
    monthlyPrice: 0,
    yearlyPrice: 0,
    renewalDate: "—",
    outstandingAmount: 0,
    totalPaid: 0,
    lastPaymentDate: "—",
    createdDate: "—",
    emirate: "—",
    tradeLicense: "—",
    modules: [],
  };
}

export function resolveTenantCompany(
  user: CurrentUser | null,
  companyId: string,
  adminCompanies: Company[],
): Company | null {
  if (!user) return null;
  if (user.is_superuser) {
    return adminCompanies.find((c) => c.id === companyId) ?? null;
  }
  if (user.company && String(user.company.id) === companyId) {
    return briefToUiCompany(user.company);
  }
  return null;
}
