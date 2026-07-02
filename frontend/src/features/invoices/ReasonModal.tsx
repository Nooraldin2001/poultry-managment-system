import { useState } from "react";
import type { Lang } from "@/shared/types";

export function ReasonModal({
  lang,
  titleAr,
  titleEn,
  confirmLabelAr,
  confirmLabelEn,
  onConfirm,
  onClose,
  loading = false,
  optionalReason = false,
}: {
  lang: Lang;
  titleAr: string;
  titleEn: string;
  confirmLabelAr: string;
  confirmLabelEn: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
  optionalReason?: boolean;
}) {
  const isRTL = lang === "ar";
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
        <h3 className="font-black text-[#0F2C59]">{isRTL ? titleAr : titleEn}</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder={isRTL ? "السبب..." : "Reason..."}
        />
        <div className="flex gap-2 justify-end flex-wrap">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-bold">
            {isRTL ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={loading || (!optionalReason && !reason.trim())}
            onClick={() => void onConfirm(reason.trim())}
            className="px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold disabled:opacity-50"
          >
            {isRTL ? confirmLabelAr : confirmLabelEn}
          </button>
        </div>
      </div>
    </div>
  );
}
