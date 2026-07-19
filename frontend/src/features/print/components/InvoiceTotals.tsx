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
  const emphasizedIndex = (() => {
    const marked = totals.findIndex((row) => row.emphasize);
    if (marked >= 0) return marked;
    // Never emphasize payment/account rows even if they are last.
    for (let i = totals.length - 1; i >= 0; i -= 1) {
      const label = totals[i]?.label ?? "";
      if (/payment|طريقة|حساب|account/i.test(label)) continue;
      return i;
    }
    return -1;
  })();

  return (
    <div className={`mt-4 flex gap-6 items-end invoice-totals ${isRTL ? "flex-row-reverse" : ""}`}>
      {stampUrl && (
        <PrintAssetImage
          src={stampUrl}
          alt=""
          className="max-w-[160px] max-h-24 object-contain shrink-0 print-preview-stamp"
        />
      )}
      <div className="flex-1" />
      <div className="w-64 max-w-full space-y-0.5">
        {totals.map((t, i) => {
          const emphasized = i === emphasizedIndex;
          return (
            <div
              key={t.label}
              className={`invoice-total-row flex justify-between text-sm font-bold px-2 py-1 ${emphasized ? "rounded" : ""}`}
              style={
                emphasized
                  ? { background: theme.primary, color: "#FFFFFF" }
                  : { color: theme.text, borderBottom: `1px solid ${theme.border}` }
              }
            >
              <span style={emphasized ? undefined : { color: theme.muted }}>{t.label}</span>
              <span className="font-mono">{t.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
