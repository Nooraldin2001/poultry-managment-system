import type { InvoiceTemplateProps } from "../types";
import { PrintAssetImage } from "./PrintAssetImage";

/**
 * Branded invoice header: logo, bilingual company name, title strip, TRN.
 * `variant` controls the visual weight so templates can share this component.
 */
export function InvoiceHeader({
  lang,
  titleAr,
  titleEn,
  company,
  branding,
  theme,
  variant = "banded",
}: Pick<InvoiceTemplateProps, "lang" | "titleAr" | "titleEn" | "company" | "branding" | "theme"> & {
  variant?: "banded" | "plain" | "solid";
}) {
  const isRTL = lang === "ar";
  const showLogo = branding.show_logo && !!company.logo_url;
  const showTrn = branding.show_company_trn && !!company.trn;
  const showPhone = branding.show_company_phone && !!company.phone;
  const bilingual = branding.show_bilingual_labels;

  const title = bilingual
    ? `${titleAr} / ${titleEn}`
    : isRTL
      ? titleAr
      : titleEn;

  if (variant === "plain") {
    return (
      <div
        className={`invoice-header flex gap-4 items-start pb-4 mb-4 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
        style={{ borderBottom: `2px solid ${theme.primary}` }}
      >
        {showLogo && (
          <PrintAssetImage
            src={company.logo_url!}
            alt=""
            className="h-[80px] w-auto max-w-[140px] object-contain shrink-0 print-preview-logo"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black" style={{ color: theme.primary }}>{title}</h1>
          {company.name_ar && <p className="text-sm font-bold mt-1" style={{ color: theme.text }}>{company.name_ar}</p>}
          {company.name_en && company.name_en !== company.name_ar && (
            <p className="text-xs font-semibold mt-0.5" style={{ color: theme.muted }}>{company.name_en}</p>
          )}
          {showTrn && (
            <p className="text-xs font-mono mt-1" style={{ color: theme.text }}>
              {bilingual ? `الرقم الضريبي TRN: ${company.trn}` : isRTL ? `الرقم الضريبي: ${company.trn}` : `TRN: ${company.trn}`}
            </p>
          )}
          {(showPhone || company.address) && (
            <div className="text-[11px] mt-1 space-y-0.5" style={{ color: theme.muted }}>
              {showPhone && <p dir="ltr">{company.phone}</p>}
              {company.email && <p dir="ltr">{company.email}</p>}
              {company.address && <p>{company.address}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "solid") {
    // Full-width colored header block (modern).
    return (
      <div className="invoice-header mb-4 rounded-lg overflow-hidden print:overflow-visible">
        <div
          className={`flex gap-4 items-center p-4 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
          style={{ background: theme.headerBg, color: "#FFFFFF" }}
        >
          {showLogo && (
            <div className="bg-white rounded-md p-1 shrink-0">
              <PrintAssetImage
                src={company.logo_url!}
                alt=""
                className="h-[64px] w-auto max-w-[120px] object-contain print-preview-logo"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {company.name_ar && <p className="text-base font-black">{company.name_ar}</p>}
            {company.name_en && company.name_en !== company.name_ar && (
              <p className="text-xs font-semibold opacity-90">{company.name_en}</p>
            )}
            {(showPhone || company.address) && (
              <p className="text-[10px] opacity-80 mt-0.5">
                {[showPhone ? company.phone : "", company.address].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <h1 className="text-lg font-black shrink-0">{title}</h1>
        </div>
        {showTrn && (
          <div
            className="text-center text-xs font-mono font-bold py-1"
            style={{ background: theme.titleBg, color: "#FFFFFF" }}
          >
            {bilingual ? `الرقم الضريبي TRN: ${company.trn}` : `TRN: ${company.trn}`}
          </div>
        )}
      </div>
    );
  }

  // "banded" — official style: dark header band + colored title strip + TRN row.
  return (
    <div className="invoice-header mb-4">
      <div
        className={`flex gap-4 items-center p-4 rounded-t-lg ${isRTL ? "flex-row-reverse" : ""}`}
        style={{ background: theme.headerBg, color: "#FFFFFF" }}
      >
        {showLogo && (
          <div className="bg-white rounded-md p-1.5 shrink-0">
            <PrintAssetImage
              src={company.logo_url!}
              alt=""
              className="h-[70px] w-auto max-w-[130px] object-contain print-preview-logo"
            />
          </div>
        )}
        <div className="flex-1 min-w-0 text-center">
          {company.name_ar && <p className="text-lg font-black leading-tight">{company.name_ar}</p>}
          {company.name_en && company.name_en !== company.name_ar && (
            <p className="text-sm font-bold opacity-90 leading-tight">{company.name_en}</p>
          )}
          {(showPhone || company.address || company.email) && (
            <p className="text-[10px] opacity-80 mt-1">
              {[showPhone ? company.phone : "", company.email, company.address]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        {/* Spacer keeps the company block centered when a logo is shown */}
        {showLogo && <div className="w-[130px] shrink-0 hidden sm:block print:block" />}
      </div>
      <div
        className="text-center py-1.5 font-black text-sm tracking-wide"
        style={{ background: theme.titleBg, color: "#FFFFFF" }}
      >
        {title}
      </div>
      {showTrn && (
        <div
          className="text-center text-xs font-mono font-bold py-1 rounded-b-lg"
          style={{ background: "#FFFFFF", color: theme.text, border: `1px solid ${theme.border}`, borderTop: "none" }}
        >
          {bilingual ? `الرقم الضريبي TRN: ${company.trn}` : isRTL ? `الرقم الضريبي: ${company.trn}` : `TRN: ${company.trn}`}
        </div>
      )}
    </div>
  );
}
