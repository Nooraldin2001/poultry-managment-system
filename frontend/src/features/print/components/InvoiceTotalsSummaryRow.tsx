import type { Lang } from "@/shared/types";
import type { InvoiceThemeTokens } from "../theme";
import { summaryRowColors } from "../theme";

export interface InvoiceLineTotals {
  totalCartons: string;
  totalKg: string;
  subtotal: string;
}

type Props = {
  lang: Lang;
  lineTotals: InvoiceLineTotals;
  theme: InvoiceThemeTokens;
  bilingual?: boolean;
  isRTL: boolean;
};

/** Highlighted table footer row: total cartons, total kg, subtotal before VAT. */
export function InvoiceTotalsSummaryRow({
  lang,
  lineTotals,
  theme,
  bilingual = false,
  isRTL,
}: Props) {
  const { bg, text } = summaryRowColors(theme);
  const label = (ar: string, en: string) => (bilingual ? `${ar} / ${en}` : lang === "ar" ? ar : en);

  const cellBase = "py-1.5 px-2 text-[11px] font-black whitespace-nowrap";

  return (
    <tr className="invoice-summary-row" style={{ background: bg, color: text }}>
      <td className={`${cellBase} ${isRTL ? "text-right" : "text-left"}`}>
        {label("الإجمالي", "Total")}
      </td>
      <td className={`${cellBase} text-center font-mono`}>{lineTotals.totalCartons}</td>
      <td className={`${cellBase} text-center font-mono`}>{lineTotals.totalKg}</td>
      <td className={`${cellBase} text-center`}>—</td>
      <td className={`${cellBase} font-mono ${isRTL ? "text-left" : "text-right"}`}>
        {lineTotals.subtotal}
      </td>
    </tr>
  );
}
