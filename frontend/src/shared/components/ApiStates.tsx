import { Loader2, ShieldOff } from "lucide-react";
import type { Lang } from "@/shared/types";
import { ProductionEmptyState, EMPTY_MESSAGES } from "./ProductionEmptyState";
import { ApiError } from "@/services/api/errors";

const MESSAGES = {
  loading: { ar: "جارٍ تحميل البيانات...", en: "Loading data..." },
  empty: { ar: "لا توجد بيانات فعلية بعد", en: "No real data yet" },
  error: { ar: "تعذر تحميل البيانات من الخادم", en: "Unable to load data from server" },
  forbidden: { ar: "ليس لديك صلاحية للوصول إلى هذه البيانات", en: "You do not have permission to access this data" },
} as const;

export function LoadingState({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const isRTL = lang === "ar";
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${compact ? "py-8" : "py-14"}`}>
      <Loader2 className="w-8 h-8 text-[#0F2C59] animate-spin" />
      <p className="text-sm font-bold text-slate-500">{isRTL ? MESSAGES.loading.ar : MESSAGES.loading.en}</p>
    </div>
  );
}

export function EmptyState({
  lang,
  messageAr,
  messageEn,
  compact = false,
}: {
  lang: Lang;
  messageAr?: string;
  messageEn?: string;
  compact?: boolean;
}) {
  return (
    <ProductionEmptyState
      lang={lang}
      compact={compact}
      messageAr={messageAr ?? MESSAGES.empty.ar}
      messageEn={messageEn ?? MESSAGES.empty.en}
    />
  );
}

export function ErrorState({
  lang,
  error,
  onRetry,
  compact = false,
}: {
  lang: Lang;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const isRTL = lang === "ar";
  const msg =
    error instanceof ApiError
      ? error.message
      : isRTL
        ? MESSAGES.error.ar
        : MESSAGES.error.en;
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 ${compact ? "py-8" : "py-14"}`}>
      <p className="text-sm font-bold text-red-600 max-w-sm">{msg}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-[#0F2C59] hover:underline"
        >
          {isRTL ? "إعادة المحاولة" : "Retry"}
        </button>
      )}
    </div>
  );
}

export function PermissionDeniedState({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const isRTL = lang === "ar";
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 ${compact ? "py-8" : "py-14"}`}>
      <ShieldOff className="w-10 h-10 text-amber-500" />
      <p className="text-sm font-bold text-slate-600 max-w-xs">
        {isRTL ? MESSAGES.forbidden.ar : MESSAGES.forbidden.en}
      </p>
    </div>
  );
}

export { ApiUnavailableState, ProductionEmptyState, EMPTY_MESSAGES } from "./ProductionEmptyState";
