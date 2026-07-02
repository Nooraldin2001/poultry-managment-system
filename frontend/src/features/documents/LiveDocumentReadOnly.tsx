import { useCallback, useEffect, useState } from "react";
import { Printer, Check, XCircle } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types";
import { LoadingState, ErrorState } from "@/shared/components/ApiStates";

export type DocumentLine = {
  id: string;
  label: string;
  qty?: string | number;
  unit?: string;
  price?: number;
  total?: number;
};

export type DocumentDetail = {
  id: string;
  number: string;
  status: string;
  date: string;
  partyName?: string;
  subtotal?: number;
  vat?: number;
  total?: number;
  paid?: number;
  balance?: number;
  notes?: string;
  lines: DocumentLine[];
};

type Props = {
  lang: Lang;
  onNavigate: (s: TenantScreen) => void;
  backScreen: TenantScreen;
  titleAr: string;
  titleEn: string;
  loadDetail: () => Promise<DocumentDetail | null>;
  printScreen?: TenantScreen;
  onApprove?: () => Promise<void>;
  onCancel?: (reason: string) => Promise<void>;
  canApprove?: boolean;
  canCancel?: boolean;
};

function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const isRTL = lang === "ar";
  const s = status.toLowerCase();
  const cfg =
    s === "approved" || s === "paid"
      ? { bg: "bg-emerald-100 text-emerald-700", ar: "معتمد", en: "Approved" }
      : s === "draft"
        ? { bg: "bg-amber-100 text-amber-700", ar: "مسودة", en: "Draft" }
        : s === "cancelled"
          ? { bg: "bg-red-100 text-red-700", ar: "ملغى", en: "Cancelled" }
          : { bg: "bg-slate-100 text-slate-600", ar: status, en: status };
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg}`}>{isRTL ? cfg.ar : cfg.en}</span>;
}

export function LiveDocumentReadOnly({
  lang,
  onNavigate,
  backScreen,
  titleAr,
  titleEn,
  loadDetail,
  printScreen,
  onApprove,
  onCancel,
  canApprove,
  canCancel,
}: Props) {
  const isRTL = lang === "ar";
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [acting, setActing] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchDoc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDoc(await loadDetail());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [loadDetail]);

  useEffect(() => {
    void fetchDoc();
  }, [fetchDoc]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void fetchDoc()} />;
  if (!doc) {
    return <ErrorState lang={lang} error={new Error("Not found")} onRetry={() => void fetchDoc()} />;
  }

  const isDraft = doc.status.toLowerCase() === "draft";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          aria-label={isRTL ? "رجوع" : "Back"}
          onClick={() => onNavigate(backScreen)}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          {isRTL ? "→" : "←"}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? titleAr : titleEn}</h2>
            <StatusBadge status={doc.status} lang={lang} />
          </div>
          <div className="text-sm text-slate-400 mt-0.5 font-mono">{doc.number}</div>
          {doc.partyName && <div className="text-sm text-slate-500">{doc.partyName} · {doc.date}</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-2">
        {printScreen && (
          <button
            type="button"
            onClick={() => onNavigate(printScreen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold"
          >
            <Printer size={14} />
            {isRTL ? "معاينة الطباعة" : "Print preview"}
          </button>
        )}
        {isDraft && canApprove && onApprove && (
          <button
            type="button"
            disabled={acting}
            onClick={() => {
              setActing(true);
              void onApprove().then(() => void fetchDoc()).finally(() => setActing(false));
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
          >
            <Check size={14} />
            {isRTL ? "اعتماد" : "Approve"}
          </button>
        )}
        {canCancel && onCancel && doc.status.toLowerCase() !== "cancelled" && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold"
          >
            <XCircle size={14} />
            {isRTL ? "إلغاء" : "Cancel"}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-3 text-start font-black text-slate-500">{isRTL ? "البند" : "Item"}</th>
                <th className="p-3 font-black text-slate-500">{isRTL ? "الكمية" : "Qty"}</th>
                <th className="p-3 font-black text-slate-500">{isRTL ? "السعر" : "Price"}</th>
                <th className="p-3 font-black text-slate-500">{isRTL ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="p-3 font-semibold text-slate-800">{line.label}</td>
                  <td className="p-3 font-mono text-center text-slate-600">
                    {line.qty ?? "—"} {line.unit ?? ""}
                  </td>
                  <td className="p-3 font-mono text-center">{line.price != null ? `AED ${line.price.toFixed(2)}` : "—"}</td>
                  <td className="p-3 font-mono font-bold text-center text-[#0F2C59]">
                    {line.total != null ? `AED ${line.total.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-2 max-w-sm ms-auto text-sm">
        {doc.subtotal != null && (
          <div className="flex justify-between font-bold">
            <span>{isRTL ? "المجموع" : "Subtotal"}</span>
            <span className="font-mono">AED {doc.subtotal.toFixed(2)}</span>
          </div>
        )}
        {doc.vat != null && (
          <div className="flex justify-between font-bold">
            <span>{isRTL ? "ض.ق.م" : "VAT"}</span>
            <span className="font-mono">AED {doc.vat.toFixed(2)}</span>
          </div>
        )}
        {doc.total != null && (
          <div className="flex justify-between font-black text-[#0F2C59]">
            <span>{isRTL ? "الإجمالي" : "Total"}</span>
            <span className="font-mono">AED {doc.total.toFixed(2)}</span>
          </div>
        )}
        {doc.paid != null && (
          <div className="flex justify-between font-bold text-emerald-600">
            <span>{isRTL ? "المدفوع" : "Paid"}</span>
            <span className="font-mono">AED {doc.paid.toFixed(2)}</span>
          </div>
        )}
        {doc.balance != null && doc.balance > 0 && (
          <div className="flex justify-between font-bold text-red-500">
            <span>{isRTL ? "المتبقي" : "Balance"}</span>
            <span className="font-mono">AED {doc.balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {doc.notes && (
        <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600">
          <div className="font-bold text-slate-700 mb-1">{isRTL ? "ملاحظات" : "Notes"}</div>
          {doc.notes}
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-doc-title">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 id="cancel-doc-title" className="text-lg font-black text-slate-800">{isRTL ? "إلغاء المستند" : "Cancel document"}</h3>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded-xl border p-3 text-sm min-h-[80px]"
              placeholder={isRTL ? "سبب الإلغاء" : "Cancellation reason"}
              aria-label={isRTL ? "سبب الإلغاء" : "Cancellation reason"}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCancel(false)} className="px-4 py-2 rounded-xl border text-sm font-bold">
                {isRTL ? "إغلاق" : "Close"}
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || acting}
                onClick={() => {
                  setActing(true);
                  void onCancel!(cancelReason)
                    .then(() => {
                      setShowCancel(false);
                      void fetchDoc();
                    })
                    .finally(() => setActing(false));
                }}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {isRTL ? "تأكيد الإلغاء" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
