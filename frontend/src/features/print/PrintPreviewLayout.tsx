import type { ReactNode } from "react";
import type { Lang } from "@/shared/types";
import { PrintA4Shell } from "./PrintA4Shell";
import { PrintActionButtons } from "./PrintActionButtons";

export interface PrintLineRow {
  label: string;
  cartons?: string;
  pieces?: string;
  kg?: string;
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
  partyKind = "customer",
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
  partyKind?: "customer" | "supplier";
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
  const companyTrn = String(company?.trn ?? "").trim();
  const phone = String(company?.phone ?? "").trim();
  const address = String(company?.address ?? "").trim();
  const email = String(company?.email ?? "").trim();
  const logoUrl = company?.logo_url ? String(company.logo_url) : null;
  const stampUrl = company?.stamp_url ? String(company.stamp_url) : null;
  const signatureUrl = company?.signature_url ? String(company.signature_url) : null;
  const partyName = String(
    party?.name_ar ?? party?.name ?? party?.customer_name ?? party?.supplier_name ?? "",
  ).trim();
  const partyTrn = String(party?.trn ?? "").trim();
  const partyPhone = String(party?.phone ?? "").trim();
  const partyAddress = String(party?.address ?? "").trim();
  const partyLabel = partyKind === "supplier"
    ? "المورد / SUPPLIER"
    : "العميل / CUSTOMER";
  const partyTrnLabel = partyKind === "supplier"
    ? (isRTL ? "الرقم الضريبي للمورد" : "Supplier TRN")
    : (isRTL ? "الرقم الضريبي للعميل" : "Customer TRN");

  return (
    <PrintA4Shell
      dir={isRTL ? "rtl" : "ltr"}
      actions={<PrintActionButtons isRTL={isRTL} onBack={onBack} />}
    >
      {/* Header: logo + company identity + title */}
      <div
        className={`invoice-header flex gap-4 items-start mb-6 pb-4 border-b border-slate-100 ${
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
          {companyTrn && (
            <p className="text-xs font-mono text-slate-600 mt-1">
              {isRTL ? `الرقم الضريبي للشركة: ${companyTrn}` : `Company TRN: ${companyTrn}`}
            </p>
          )}
          {(phone || address || email) && (
            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
              {phone && <p>{phone}</p>}
              {email && <p>{email}</p>}
              {address && <p>{address}</p>}
            </div>
          )}
        </div>
      </div>

      {partyName && (
        <div className={`mb-4 text-sm ${isRTL ? "text-right" : "text-left"}`}>
          <div className="invoice-party-heading flex items-baseline gap-1 flex-wrap">
            <span className="invoice-party-label font-bold text-slate-500">{partyLabel}:</span>
            <strong className="invoice-party-name font-black text-slate-800">{partyName}</strong>
          </div>
          {partyPhone && (
            <p className="text-xs text-slate-600 mt-0.5">{partyPhone}</p>
          )}
          {partyAddress && (
            <p className="text-xs text-slate-600 mt-0.5">{partyAddress}</p>
          )}
          {partyTrn && (
            <p className="text-xs font-mono text-slate-600 mt-1">
              {partyTrnLabel}: {partyTrn}
            </p>
          )}
        </div>
      )}

      {meta && meta.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-2 mb-4 text-sm print:grid-cols-2 ${
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

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-sm border-collapse print-line-table">
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
                {isRTL ? "الوحدة" : "Unit"}
              </th>
              <th className="py-2 font-black text-slate-500 text-center">
                {isRTL ? "السعر قبل الضريبة" : "Price before VAT"}
              </th>
              <th
                className={`py-2 font-black text-slate-500 ${
                  isRTL ? "text-left" : "text-right"
                }`}
              >
                {isRTL ? "الإجمالي قبل الضريبة" : "Subtotal before VAT"}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 font-semibold">{line.label}</td>
                <td className="py-2 font-mono text-xs text-center">
                  {line.cartons ?? line.qty ?? "—"}
                </td>
                <td className="py-2 font-mono text-xs text-center">{line.kg ?? "—"}</td>
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

      <section className="invoice-final-summary">
        <div
          className={`invoice-totals mt-4 flex gap-6 items-end ${
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
              className="max-w-[160px] max-h-20 object-contain shrink-0 print-preview-stamp"
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
            className="signature-section invoice-footer mt-8 pt-4 border-t border-slate-100 grid grid-cols-2 gap-8 items-end"
          >
            <div className={`invoice-signature-column ${isRTL ? "text-right" : "text-left"}`}>
              {signatureUrl ? (
                <PrintAssetImage
                  src={signatureUrl}
                  alt=""
                  className="invoice-signature-asset max-w-[180px] max-h-16 object-contain mb-1 print-preview-signature"
                />
              ) : (
                <div className="invoice-signature-space w-full h-8 mb-1" />
              )}
              <p className="invoice-signature-label text-[10px] font-bold text-slate-400 border-t border-slate-200 pt-1">
                {isRTL ? "توقيع المفوض / Authorized Signature" : "Authorized Signature / توقيع المفوض"}
              </p>
            </div>
            <div className={`invoice-signature-column ${isRTL ? "text-right" : "text-left"}`}>
              <div className="invoice-signature-space w-full h-8 mb-1" />
              <p className="invoice-signature-label text-[10px] font-bold text-slate-400 border-t border-slate-200 pt-1">
                {isRTL ? "توقيع المستلم / Receiver Signature" : "Receiver Signature / توقيع المستلم"}
              </p>
            </div>
          </div>
        )}

        {footer}
      </section>
    </PrintA4Shell>
  );
}
