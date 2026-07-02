import type { ReactNode } from "react";
import type { Lang } from "@/shared/types";
import { Printer } from "lucide-react";

export interface PrintLineRow {
  label: string;
  qty?: string;
  unit?: string;
  price?: string;
  total?: string;
}

export function PrintPreviewLayout({
  lang,
  titleAr,
  titleEn,
  company,
  party,
  meta,
  lines,
  totals,
  notes,
  footer,
  onBack,
}: {
  lang: Lang;
  titleAr: string;
  titleEn: string;
  company?: Record<string, unknown>;
  party?: Record<string, unknown>;
  meta?: { label: string; value: string }[];
  lines: PrintLineRow[];
  totals: { label: string; value: string }[];
  notes?: string;
  footer?: ReactNode;
  onBack?: () => void;
}) {
  const isRTL = lang === "ar";
  const companyName = String(company?.name_ar ?? company?.name ?? company?.name_en ?? "");
  const partyName = String(party?.name_ar ?? party?.name ?? party?.customer_name ?? party?.supplier_name ?? "");

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        {onBack && (
          <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl border text-sm font-bold">
            {isRTL ? "رجوع" : "Back"}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold"
        >
          <Printer size={15} />
          {isRTL ? "طباعة" : "Print"}
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 print:border-0 print:shadow-none print-preview-doc">
        <div className="text-center mb-6">
          {company?.logo_url && (
            <img src={String(company.logo_url)} alt="" className="h-14 mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? titleAr : titleEn}</h1>
          {companyName && <p className="text-sm font-bold text-slate-600 mt-1">{companyName}</p>}
        </div>
        {partyName && (
          <div className="mb-4 text-sm">
            <p className="font-bold text-slate-500">{isRTL ? "الطرف" : "Party"}</p>
            <p className="font-black text-slate-800">{partyName}</p>
          </div>
        )}
        {meta && meta.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
            {meta.map((m) => (
              <div key={m.label}>
                <span className="text-slate-400 font-bold">{m.label}: </span>
                <span className="font-mono">{m.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={`py-2 font-black text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
                  {isRTL ? "البند" : "Item"}
                </th>
                <th className="py-2 font-black text-slate-500">{isRTL ? "الكمية" : "Qty"}</th>
                <th className="py-2 font-black text-slate-500">{isRTL ? "السعر" : "Price"}</th>
                <th className={`py-2 font-black text-slate-500 ${isRTL ? "text-left" : "text-right"}`}>
                  {isRTL ? "الإجمالي" : "Total"}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">{line.label}</td>
                  <td className="py-2 font-mono text-xs">{line.qty ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{line.price ?? "—"}</td>
                  <td className={`py-2 font-mono font-bold ${isRTL ? "text-left" : "text-right"}`}>
                    {line.total ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-1 max-w-xs ms-auto">
          {totals.map((t) => (
            <div key={t.label} className="flex justify-between text-sm font-bold">
              <span className="text-slate-500">{t.label}</span>
              <span className="font-mono">{t.value}</span>
            </div>
          ))}
        </div>
        {notes && <p className="mt-4 text-sm text-slate-500">{notes}</p>}
        {footer}
      </div>
    </div>
  );
}
