import type { ReactNode } from "react";
import type { Lang } from "@/shared/types";
import {
  ApiUnavailableState,
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "@/shared/components/ApiStates";

type TabStateProps = {
  lang: Lang;
  loading: boolean;
  error: unknown;
  forbidden: boolean;
  unavailable: boolean;
  empty: boolean;
  onRetry?: () => void;
  children: ReactNode;
  emptyAr?: string;
  emptyEn?: string;
};

export function ProfileTabBody({
  lang,
  loading,
  error,
  forbidden,
  unavailable,
  empty,
  onRetry,
  children,
  emptyAr,
  emptyEn,
}: TabStateProps) {
  if (loading) return <LoadingState lang={lang} compact />;
  if (forbidden) return <PermissionDeniedState lang={lang} compact />;
  if (unavailable) return <ApiUnavailableState lang={lang} compact />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={onRetry} compact />;
  if (empty) return <EmptyState lang={lang} messageAr={emptyAr} messageEn={emptyEn} compact />;
  return <>{children}</>;
}
