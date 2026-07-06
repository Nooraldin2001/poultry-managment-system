import type { InvoiceTemplateProps } from "../types";
import { PrintAssetImage } from "./PrintAssetImage";

/** Totals block with optional company stamp beside it. */
export function InvoiceTotals({
  lang,
  totals,
  company,
  branding,
  theme,
}: Pick<InvoiceTemplateProps, "lang" | "totals" | "company" | "branding" | "theme">) {
  const isRTL = lang === "ar";
  const stampUrl = branding.show_stamp ? company.stamp_url : null;
  const last = totals.length - 1;

  return (
    <div className={`mt-4 flex gap-6 items-end ${isRTL ? "flex-row-reverse" : ""}`}>
      {stampUrl && (
        <PrintAssetImage
          src={stampUrl}
          alt=""
          className="max-w-[160px] max-h-24 object-contain shrink-0 print-preview-stamp"
        />
      )}
      <div className="flex-1" />
      <div className="w-64 max-w-full space-y-0.5">
        {totals.map((t, i) => (
          <div
            key={t.label}
            className={`flex justify-between text-sm font-bold px-2 py-1 ${i === last ? "rounded" : ""}`}
            style={
              i === last
                ? { background: theme.primary, color: "#FFFFFF" }
                : { color: theme.text, borderBottom: `1px solid ${theme.border}` }
            }
          >
            <span style={i === last ? undefined : { color: theme.muted }}>{t.label}</span>
            <span className="font-mono">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
