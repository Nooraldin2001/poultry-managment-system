import type { Lang } from "@/shared/types";
import type { InvoiceLineDraft } from "./types";
import { priceTypeShortLabel } from "./priceTypeUtils";

type Props = {
  lang: Lang;
  line: InvoiceLineDraft;
  disabled?: boolean;
  onChange: (line: InvoiceLineDraft) => void;
};

const OPTIONS: InvoiceLineDraft["priceType"][] = ["kg", "piece", "carton"];

export function LinePriceTypeSelect({ lang, line, disabled, onChange }: Props) {
  const isRTL = lang === "ar";
  return (
    <select
      className="w-full min-w-[72px] rounded border px-1 py-0.5 text-xs"
      value={line.priceType}
      disabled={disabled}
      aria-label={isRTL ? "نوع السعر" : "Price type"}
      onChange={(e) =>
        onChange({ ...line, priceType: e.target.value as InvoiceLineDraft["priceType"] })
      }
    >
      {OPTIONS.map((pt) => (
        <option key={pt} value={pt}>
          {priceTypeShortLabel(pt, lang)}
        </option>
      ))}
    </select>
  );
}
