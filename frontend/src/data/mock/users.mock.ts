// Tenant user mock data for the service boundary.
// NOTE: SettingsModule screens use their own internal mock data; this
// representative set backs the future API service (see services/).
import type { TenantRole } from "@/shared/types/roles";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  active: boolean;
}

export const TENANT_USERS: TenantUser[] = [
  { id: "u1", name: "أحمد (مالك)",   email: "owner@alwataniyah.com",      role: "owner",      active: true },
  { id: "u2", name: "سارة (محاسبة)", email: "accountant@alwataniyah.com", role: "accountant", active: true },
  { id: "u3", name: "محمد (كاشير)",  email: "cashier@alwataniyah.com",    role: "cashier",    active: true },
];
