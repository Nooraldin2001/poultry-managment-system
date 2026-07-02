import { IS_MOCK_MODE } from "@/services/config";
import { createCrudService } from "@/services/crud/createCrudService";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";

export interface TenantUserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  dateJoined: string;
}

interface ApiTenantUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  force_password_change: boolean;
  date_joined: string;
}

const crud = createCrudService<ApiTenantUser>(ENDPOINTS.tenant.users);

function mapUser(row: ApiTenantUser): TenantUserRow {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? "",
    role: row.role,
    isActive: row.is_active,
    forcePasswordChange: row.force_password_change,
    dateJoined: String(row.date_joined ?? "").slice(0, 10),
  };
}

export async function listTenantUsers(): Promise<TenantUserRow[]> {
  if (IS_MOCK_MODE) return [];
  const rows = await crud.listAll();
  return rows.map(mapUser);
}

export async function getTenantUser(id: string): Promise<TenantUserRow | null> {
  if (IS_MOCK_MODE) return null;
  try {
    return mapUser(await crud.retrieve(id));
  } catch {
    return null;
  }
}

export async function createTenantUser(payload: Record<string, unknown>): Promise<TenantUserRow> {
  const row = await crud.create(payload as never);
  return mapUser(row);
}

export async function updateTenantUser(id: string, payload: Record<string, unknown>): Promise<TenantUserRow> {
  const row = await crud.patch(id, payload as never);
  return mapUser(row);
}

export async function suspendTenantUser(id: string, reason?: string): Promise<void> {
  await request(ENDPOINTS.tenant.userSuspend(id), {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export async function reactivateTenantUser(id: string): Promise<void> {
  await request(ENDPOINTS.tenant.userReactivate(id), { method: "POST", body: {} });
}

export async function getUserPermissionOverrides(id: string): Promise<{ code: string; allowed: boolean }[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ permissions?: { code: string; allowed: boolean }[] } | { code: string; allowed: boolean }[]>(
    ENDPOINTS.tenant.userPermissions(id),
  );
  if (Array.isArray(data)) return data;
  return data.permissions ?? [];
}

export async function updateUserPermissionOverrides(
  id: string,
  permissions: { code: string; allowed: boolean }[],
): Promise<void> {
  await request(ENDPOINTS.tenant.userPermissions(id), {
    method: "PATCH",
    body: { permissions },
  });
}
