import { useEffect, useState } from "react";
import type { Lang } from "@/shared/types";
import type { InvoiceLineDraft } from "./types";
import { PriceHistorySelect } from "./PriceHistorySelect";
import { salesPriceHistory, type PriceHistoryEntry } from "@/services/salesService";

type Props = {
  lang: Lang;
  customerId: string;
  line: InvoiceLineDraft;
  isDraft: boolean;
  canEditPrice: boolean;
  onPriceChange: (line: InvoiceLineDraft) => void;
};

export function SalesLinePriceCell({ lang, customerId, line, isDraft, canEditPrice, onPriceChange }: Props) {
  const isRTL = lang === "ar";
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!customerId || !line.productId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    void salesPriceHistory({ customer: Number(customerId), product: Number(line.productId) })
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, line.productId]);

  const handleManualPrice = (raw: string) => {
    const unitPrice = Number(raw);
    if (Number.isNaN(unitPrice) || unitPrice < 0) return;
    onPriceChange({
      ...line,
      unitPrice,
      priceSource: "manual_override",
    });
  };

  const handleHistorySelect = (price: number, priceType: string) => {
    onPriceChange({
      ...line,
      unitPrice: price,
      priceType: priceType as InvoiceLineDraft["priceType"],
      priceSource: "manual_override",
    });
  };

  if (!isDraft || !canEditPrice) {
    return <span className="font-mono text-xs">{line.unitPrice.toFixed(2)}</span>;
  }

  return (
    <div className="space-y-1 min-w-[120px]">
      <input
        type="number"
        step="0.01"
        min="0"
        className="w-full rounded border px-1 py-0.5 text-xs font-mono"
        value={line.unitPrice}
        onChange={(e) => handleManualPrice(e.target.value)}
        aria-label={isRTL ? "سعر الوحدة" : "Unit price"}
      />
      {customerId ? (
        <PriceHistorySelect
          lang={lang}
          entries={history}
          loading={loadingHistory}
          onSelect={handleHistorySelect}
        />
      ) : null}
    </div>
  );
}
