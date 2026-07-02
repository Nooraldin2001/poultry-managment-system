import type { ReactNode } from "react";
import type { Lang } from "@/shared/types";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";

export function ModuleDataGate({
  lang,
  loading,
  error,
  forbidden,
  onRetry,
  isEmpty,
  emptyAr,
  emptyEn,
  children,
}: {
  lang: Lang;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyAr: string;
  emptyEn: string;
  children: ReactNode;
}) {
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState lang={lang} messageAr={emptyAr} messageEn={emptyEn} />;
  return <>{children}</>;
}
