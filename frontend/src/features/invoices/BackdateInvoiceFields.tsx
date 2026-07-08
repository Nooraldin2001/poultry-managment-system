import { AlertTriangle } from "lucide-react";
import type { Lang } from "@/shared/types";

type Props = {
  lang: Lang;
  invoiceDate: string;
  backdateReason: string;
  canBackdate: boolean;
  isDraft: boolean;
  onDateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  fieldErrors?: Record<string, string[]>;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isBackdatedDate(invoiceDate: string): boolean {
  return invoiceDate < todayIso();
}

export function BackdateInvoiceFields({
  lang,
  invoiceDate,
  backdateReason,
  canBackdate,
  isDraft,
  onDateChange,
  onReasonChange,
  fieldErrors,
}: Props) {
  const isRTL = lang === "ar";
  const today = todayIso();
  const backdated = isBackdatedDate(invoiceDate);
  const dateReadOnly = !isDraft;
  const dateDisabled = dateReadOnly || (!canBackdate && invoiceDate === today);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-1">
          {isRTL ? "تاريخ الفاتورة" : "Invoice date"}
        </label>
        <input
          type="date"
          value={invoiceDate}
          max={today}
          min={canBackdate ? undefined : today}
          disabled={dateReadOnly || (!canBackdate && !dateReadOnly)}
          readOnly={dateDisabled && !dateReadOnly}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
        />
        {!canBackdate && isDraft && (
          <p className="text-xs text-slate-500 mt-1">
            {isRTL
              ? "لا تملك صلاحية إنشاء فاتورة بتاريخ سابق"
              : "You do not have permission to create a backdated invoice"}
          </p>
        )}
        {fieldErrors?.invoice_date?.map((msg) => (
          <p key={msg} className="text-xs text-red-600 mt-1">{msg}</p>
        ))}
      </div>

      {backdated && isDraft && canBackdate && (
        <>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              {isRTL
                ? "هذه فاتورة بتاريخ سابق، يجب إدخال سبب"
                : "This is a backdated invoice. A reason is required."}
            </span>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">
              {isRTL ? "سبب إدخال تاريخ سابق" : "Backdate reason"}
              <span className="text-red-500"> *</span>
            </label>
            <textarea
              value={backdateReason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder={
                isRTL
                  ? "مثال: تم إدخال الفاتورة متأخراً بعد استلام المستندات"
                  : "e.g. Invoice entered late after receiving documents"
              }
            />
            {fieldErrors?.backdate_reason?.map((msg) => (
              <p key={msg} className="text-xs text-red-600 mt-1">{msg}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { todayIso };
