import { useEffect, useState } from "react";
import type { Lang } from "@/shared/types";
import type { InvoiceLineDraft } from "./types";
import { PriceHistorySelect } from "./PriceHistorySelect";
import { purchasePriceHistory } from "@/services/purchaseService";
import type { PriceHistoryEntry } from "@/services/salesService";

type Props = {
  lang: Lang;
  supplierId: string;
  line: InvoiceLineDraft;
  isDraft: boolean;
  canEditPrice: boolean;
  onPriceChange: (line: InvoiceLineDraft) => void;
};

export function PurchaseLinePriceCell({ lang, supplierId, line, isDraft, canEditPrice, onPriceChange }: Props) {
  const isRTL = lang === "ar";
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!supplierId || !line.productId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    void purchasePriceHistory({ supplier: Number(supplierId), product: Number(line.productId) })
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
  }, [supplierId, line.productId]);

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
        aria-label={isRTL ? "سعر الشراء" : "Purchase price"}
      />
      {supplierId ? (
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
