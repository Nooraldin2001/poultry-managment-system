import { useState } from "react";
import type { Lang } from "@/shared/types";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";

export function ExportPayloadModal({
  lang,
  titleAr,
  titleEn,
  payload,
  onClose,
}: {
  lang: Lang;
  titleAr: string;
  titleEn: string;
  payload: unknown;
  onClose: () => void;
}) {
  const isRTL = lang === "ar";
  const [json] = useState(() => JSON.stringify(payload, null, 2));

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    toast.success(isRTL ? "تم النسخ" : "Copied");
  };

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between gap-2">
          <h3 className="font-black text-[#0F2C59]">{isRTL ? titleAr : titleEn}</h3>
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-500">
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          <pre className="text-xs bg-slate-50 rounded-xl p-3 overflow-x-auto">{json}</pre>
          <p className="text-xs text-slate-400 mt-3 font-semibold">
            {isRTL ? "تصدير PDF/Excel قريباً — هذا معاينة JSON فقط." : "PDF/Excel export coming later — JSON preview only."}
          </p>
        </div>
        <div className="p-4 border-t flex gap-2 flex-wrap">
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold">
            <Copy size={14} />
            {isRTL ? "نسخ" : "Copy"}
          </button>
          <button type="button" onClick={download} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold">
            <Download size={14} />
            {isRTL ? "تحميل JSON" : "Download JSON"}
          </button>
          <button type="button" disabled className="px-4 py-2 rounded-xl border text-sm font-bold opacity-40">
            PDF ({isRTL ? "قريباً" : "soon"})
          </button>
          <button type="button" disabled className="px-4 py-2 rounded-xl border text-sm font-bold opacity-40">
            Excel ({isRTL ? "قريباً" : "soon"})
          </button>
        </div>
      </div>
    </div>
  );
}
