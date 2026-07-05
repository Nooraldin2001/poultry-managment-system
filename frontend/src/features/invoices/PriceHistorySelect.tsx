import type { Lang } from "@/shared/types";
import type { PriceHistoryEntry } from "@/services/salesService";

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  previous_invoice: { ar: "فاتورة سابقة", en: "Previous invoice" },
  customer_special_price: { ar: "سعر خاص للعميل", en: "Customer special price" },
  supplier_special_price: { ar: "سعر خاص للمورد", en: "Supplier special price" },
  default_product_price: { ar: "سعر المنتج الافتراضي", en: "Default product price" },
  default_purchase_price: { ar: "سعر الشراء الافتراضي", en: "Default purchase price" },
};

type Props = {
  lang: Lang;
  entries: PriceHistoryEntry[];
  loading?: boolean;
  disabled?: boolean;
  onSelect: (price: number, priceType: string) => void;
};

export function PriceHistorySelect({ lang, entries, loading, disabled, onSelect }: Props) {
  const isRTL = lang === "ar";

  if (loading) {
    return (
      <span className="text-[10px] text-slate-400 font-semibold">
        {isRTL ? "جاري تحميل الأسعار..." : "Loading prices..."}
      </span>
    );
  }

  if (entries.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 font-semibold">
        {isRTL ? "لا توجد أسعار سابقة" : "No previous prices found"}
      </span>
    );
  }

  return (
    <select
      className="w-full max-w-[200px] rounded border px-1 py-0.5 text-[10px] font-semibold text-slate-600"
      disabled={disabled}
      defaultValue=""
      onChange={(e) => {
        const idx = Number(e.target.value);
        if (Number.isNaN(idx) || idx < 0) return;
        const entry = entries[idx];
        if (entry) onSelect(Number(entry.price), entry.price_type);
        e.target.value = "";
      }}
      aria-label={isRTL ? "اختيار سعر سابق" : "Use previous price"}
    >
      <option value="">{isRTL ? "اختيار سعر سابق" : "Use previous price"}</option>
      {entries.map((entry, idx) => {
        const src = SOURCE_LABELS[entry.source] ?? { ar: entry.source, en: entry.source };
        const label = isRTL ? src.ar : src.en;
        const ref = entry.invoice_number ? ` (${entry.invoice_number})` : "";
        const dt = entry.date ? ` — ${entry.date}` : "";
        return (
          <option key={`${entry.price}-${entry.price_type}-${idx}`} value={idx}>
            {label}
            {ref}: {entry.price} / {entry.price_type}
            {dt}
          </option>
        );
      })}
    </select>
  );
}
