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

function PrintAssetImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
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
  const companyNameAr = String(company?.name_ar ?? "");
  const companyNameEn = String(company?.name_en ?? "");
  const trn = String(company?.trn ?? "").trim();
  const phone = String(company?.phone ?? "").trim();
  const address = String(company?.address ?? "").trim();
  const logoUrl = company?.logo_url ? String(company.logo_url) : null;
  const stampUrl = company?.stamp_url ? String(company.stamp_url) : null;
  const signatureUrl = company?.signature_url ? String(company.signature_url) : null;
  const partyName = String(
    party?.name_ar ?? party?.name ?? party?.customer_name ?? party?.supplier_name ?? "",
  );

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl border text-sm font-bold"
          >
            {isRTL ? "رجوع" : "Back"}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold"
        >
          <Printer size={15} />
          {isRTL ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 print:border-0 print:shadow-none print-preview-doc">
        {/* Header: logo + company identity + title */}
        <div
          className={`flex gap-4 items-start mb-6 pb-4 border-b border-slate-100 ${
            isRTL ? "flex-row-reverse text-right" : "text-left"
          }`}
        >
          {logoUrl && (
            <PrintAssetImage
              src={logoUrl}
              alt=""
              className="h-[80px] w-auto max-w-[140px] object-contain shrink-0 print-preview-logo"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-[#0F2C59]">
              {isRTL ? titleAr : titleEn}
            </h1>
            {companyNameAr && (
              <p className="text-sm font-bold text-slate-800 mt-1">{companyNameAr}</p>
            )}
            {companyNameEn && companyNameEn !== companyNameAr && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{companyNameEn}</p>
            )}
            {trn && (
              <p className="text-xs font-mono text-slate-600 mt-1">
                {isRTL ? `الرقم الضريبي TRN: ${trn}` : `TRN: ${trn}`}
              </p>
            )}
            {(phone || address) && (
              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                {phone && <p>{phone}</p>}
                {address && <p>{address}</p>}
              </div>
            )}
          </div>
        </div>

        {partyName && (
          <div className={`mb-4 text-sm ${isRTL ? "text-right" : "text-left"}`}>
            <p className="font-bold text-slate-500">{isRTL ? "الطرف" : "Party"}</p>
            <p className="font-black text-slate-800">{partyName}</p>
          </div>
        )}

        {meta && meta.length > 0 && (
          <div
            className={`grid grid-cols-2 gap-2 mb-4 text-sm ${
              isRTL ? "text-right" : "text-left"
            }`}
          >
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
                <th
                  className={`py-2 font-black text-slate-500 ${
                    isRTL ? "text-right" : "text-left"
                  }`}
                >
                  {isRTL ? "البند" : "Item"}
                </th>
                <th className="py-2 font-black text-slate-500 text-center">
                  {isRTL ? "الكمية" : "Qty"}
                </th>
                <th className="py-2 font-black text-slate-500 text-center">
                  {isRTL ? "السعر" : "Price"}
                </th>
                <th
                  className={`py-2 font-black text-slate-500 ${
                    isRTL ? "text-left" : "text-right"
                  }`}
                >
                  {isRTL ? "الإجمالي" : "Total"}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-semibold">{line.label}</td>
                  <td className="py-2 font-mono text-xs text-center">{line.qty ?? "—"}</td>
                  <td className="py-2 font-mono text-xs text-center">{line.price ?? "—"}</td>
                  <td
                    className={`py-2 font-mono font-bold ${
                      isRTL ? "text-left" : "text-right"
                    }`}
                  >
                    {line.total ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`mt-4 flex gap-6 items-end ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <div className="flex-1 space-y-1 max-w-xs ms-auto">
            {totals.map((t) => (
              <div key={t.label} className="flex justify-between text-sm font-bold">
                <span className="text-slate-500">{t.label}</span>
                <span className="font-mono">{t.value}</span>
              </div>
            ))}
          </div>
          {stampUrl && (
            <PrintAssetImage
              src={stampUrl}
              alt=""
              className="max-w-[150px] max-h-20 object-contain shrink-0 print-preview-stamp"
            />
          )}
        </div>

        {notes && (
          <p className={`mt-4 text-sm text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
            {notes}
          </p>
        )}

        {(signatureUrl || footer) && (
          <div
            className={`mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-8 items-end ${
              isRTL ? "flex-row-reverse justify-between" : "justify-between"
            }`}
          >
            {signatureUrl && (
              <div className={`${isRTL ? "text-right" : "text-left"}`}>
                <PrintAssetImage
                  src={signatureUrl}
                  alt=""
                  className="max-w-[170px] max-h-16 object-contain mb-1 print-preview-signature"
                />
                <p className="text-[10px] font-bold text-slate-400 border-t border-slate-200 pt-1">
                  {isRTL ? "التوقيع المعتمد" : "Authorized Signature"}
                </p>
              </div>
            )}
            <div className={`${isRTL ? "text-right" : "text-left"}`}>
              <div className="w-40 border-b border-slate-300 mb-1 h-8" />
              <p className="text-[10px] font-bold text-slate-400">
                {isRTL ? "توقيع المستلم" : "Receiver Signature"}
              </p>
            </div>
          </div>
        )}

        {footer}
      </div>
    </div>
  );
}
