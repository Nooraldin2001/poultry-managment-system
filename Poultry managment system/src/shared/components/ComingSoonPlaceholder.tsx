// Shared placeholder shown for tenant screens that are routed but not yet built.
// Extracted from App.tsx (visual output unchanged).
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TenantScreen } from "@/shared/types/navigation";
import { T_NAV } from "@/app/navigation/tenantNavigation";
import { TENANT_TITLES } from "@/app/navigation/screenTitles";

export function ComingSoonPlaceholder({
  screen,
  isRTL,
  onBackToDashboard,
}: {
  screen: TenantScreen;
  isRTL: boolean;
  onBackToDashboard: () => void;
}) {
  const navItem = T_NAV.find((x) => x.key === screen);
  const Icon = navItem?.icon;
  const title = TENANT_TITLES[screen];
  return (
    <div className="p-8 pt-16 text-center">
      <div className="w-16 h-16 bg-[#0F2C59]/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {Icon ? <Icon size={28} className="text-[#0F2C59]" /> : null}
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? title[0] : title[1]}</h2>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">{isRTL ? "قريباً" : "Soon"}</span>
      </div>
      <p className="text-slate-400 font-semibold">{isRTL ? "هذه الصفحة قيد التطوير في المرحلة القادمة" : "This page is coming in the next phase"}</p>
      <button onClick={onBackToDashboard} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0F2C59] hover:underline">
        {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}{isRTL ? "العودة للرئيسية" : "Back to Dashboard"}
      </button>
    </div>
  );
}
