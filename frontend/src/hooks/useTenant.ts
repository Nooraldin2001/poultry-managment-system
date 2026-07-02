import { useAuth } from "@/state/authStore";
import type { CompanyContext } from "@/services/tenantService";
import { briefToCompanyContext } from "@/services/tenantService";

export function useTenant() {
  const { user, isSuperAdmin, tenantRole } = useAuth();

  const company: CompanyContext | null = user?.company
    ? briefToCompanyContext(user.company)
    : null;

  return {
    user,
    company,
    companyId: company?.id ?? null,
    isSuperAdmin,
    tenantRole,
    isTenantUser: !!user && !isSuperAdmin && !!company,
  };
}
