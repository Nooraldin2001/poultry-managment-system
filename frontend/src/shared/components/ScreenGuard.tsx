import type { ReactNode } from "react";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types/navigation";
import type { TenantRole } from "@/shared/types/roles";
import { canViewScreen } from "@/app/navigation/permissions";
import { PermissionDeniedState } from "./ApiStates";

export function ScreenGuard({
  screen,
  permissions,
  role,
  lang,
  children,
}: {
  screen: TenantScreen;
  permissions: string[];
  role: TenantRole;
  lang: Lang;
  children: ReactNode;
}) {
  if (!canViewScreen(screen, permissions, role)) {
    return <PermissionDeniedState lang={lang} />;
  }
  return <>{children}</>;
}
