import type { InvoiceTemplateProps } from "../types";
import { PrintAssetImage } from "./PrintAssetImage";

/** Footer: authorized signature image + receiver signature line. */
export function InvoiceFooterBranding({
  lang,
  company,
  branding,
  theme,
  notes,
}: Pick<InvoiceTemplateProps, "lang" | "company" | "branding" | "theme" | "notes">) {
  const isRTL = lang === "ar";
  const bilingual = branding.show_bilingual_labels;
  const signatureUrl = branding.show_signature ? company.signature_url : null;
  const label = (ar: string, en: string) => (bilingual ? `${ar} / ${en}` : isRTL ? ar : en);

  return (
    <>
      {notes && (
        <p className={`mt-4 text-sm ${isRTL ? "text-right" : "text-left"}`} style={{ color: theme.muted }}>
          {notes}
        </p>
      )}
      <div
        className={`mt-8 pt-4 flex flex-wrap gap-8 items-end justify-between ${isRTL ? "flex-row-reverse" : ""}`}
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <div className={isRTL ? "text-right" : "text-left"}>
          {signatureUrl ? (
            <PrintAssetImage
              src={signatureUrl}
              alt=""
              className="max-w-[180px] max-h-16 object-contain mb-1 print-preview-signature"
            />
          ) : (
            <div className="w-40 h-8 mb-1" style={{ borderBottom: `1px solid ${theme.border}` }} />
          )}
          <p className="text-[10px] font-bold pt-1" style={{ color: theme.muted, borderTop: `1px solid ${theme.border}` }}>
            {label("توقيع المفوض", "Authorized Signature")}
          </p>
        </div>
        <div className={isRTL ? "text-right" : "text-left"}>
          <div className="w-40 h-8 mb-1" style={{ borderBottom: `1px solid ${theme.border}` }} />
          <p className="text-[10px] font-bold" style={{ color: theme.muted }}>
            {label("توقيع المستلم", "Receiver Signature")}
          </p>
        </div>
      </div>
    </>
  );
}
