// Reusable "no real data yet" / "API unavailable" placeholders.
//
// Shown in live/production mode where a screen is not wired to a backend endpoint
// yet (or an endpoint returned nothing). They communicate an honest empty state in
// Arabic/English and NEVER render fake business data.

import type { ElementType } from "react";
import { Inbox, CloudOff } from "lucide-react";
import type { Lang } from "@/shared/types";

/** Common Arabic empty-state messages used across the app. */
export const EMPTY_MESSAGES = {
  noData: { ar: "لا توجد بيانات فعلية بعد", en: "No data yet" },
  pendingApi: {
    ar: "سيتم عرض البيانات هنا بعد ربط الشاشة بواجهة API",
    en: "Data will appear here once this screen is connected to the API",
  },
  noCompanies: { ar: "لم يتم إنشاء أي شركات بعد", en: "No companies created yet" },
  noPayments: { ar: "لا توجد مدفوعات مسجلة", en: "No payments recorded" },
  noRenewals: { ar: "لا توجد تجديدات قريبة", en: "No upcoming renewals" },
  loadFailed: { ar: "تعذر تحميل البيانات من الخادم", en: "Failed to load data from the server" },
} as const;

export function ProductionEmptyState({
  lang,
  messageAr,
  messageEn,
  icon: Icon = Inbox,
  compact = false,
}: {
  lang: Lang;
  messageAr?: string;
  messageEn?: string;
  icon?: ElementType;
  compact?: boolean;
}) {
  const isRTL = lang === "ar";
  const ar = messageAr ?? EMPTY_MESSAGES.noData.ar;
  const en = messageEn ?? EMPTY_MESSAGES.noData.en;
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={24} className="text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-500 max-w-xs">{isRTL ? ar : en}</p>
    </div>
  );
}

export function ApiUnavailableState({
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
      icon={CloudOff}
      compact={compact}
      messageAr={messageAr ?? EMPTY_MESSAGES.loadFailed.ar}
      messageEn={messageEn ?? EMPTY_MESSAGES.loadFailed.en}
    />
  );
}
