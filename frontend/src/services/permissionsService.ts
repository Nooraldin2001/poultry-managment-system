import { IS_MOCK_MODE } from "@/services/config";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";

export interface PermissionCodeRow {
  code: string;
  group: string;
  action: string;
  isSensitive?: boolean;
}

export async function listPermissionCodes(): Promise<PermissionCodeRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: PermissionCodeRow[] } | PermissionCodeRow[]>(
    ENDPOINTS.tenant.permissions,
  );
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map((r) => ({
    code: r.code,
    group: r.group ?? r.code.split(".")[0] ?? "",
    action: r.action ?? r.code.split(".").slice(1).join("."),
    isSensitive: (r as { is_sensitive?: boolean }).is_sensitive,
  }));
}
