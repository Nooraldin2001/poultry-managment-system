import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types";
import { LoadingState, ErrorState, EmptyState } from "@/shared/components/ApiStates";
import { PrintPreviewLayout, type PrintLineRow } from "./PrintPreviewLayout";

function mapPrintLines(data: Record<string, unknown>): PrintLineRow[] {
  const raw = (data.lines ?? data.items ?? data.line_items ?? []) as Record<string, unknown>[];
  if (!Array.isArray(raw)) return [];
  return raw.map((line, i) => ({
    label: String(line.product_name ?? line.description ?? line.name ?? `Line ${i + 1}`),
    qty: String(line.quantity_kg ?? line.quantity ?? line.qty ?? line.kg ?? "—"),
    unit: String(line.unit ?? line.price_type ?? ""),
    price: line.unit_price != null ? String(line.unit_price) : undefined,
    total: line.line_total != null ? String(line.line_total) : line.amount != null ? String(line.amount) : undefined,
  }));
}

function mapTotals(data: Record<string, unknown>): { label: string; value: string }[] {
  const pairs: [string, string][] = [];
  if (data.subtotal != null) pairs.push(["Subtotal", String(data.subtotal)]);
  if (data.vat_amount != null || data.vat != null) pairs.push(["VAT", String(data.vat_amount ?? data.vat)]);
  if (data.total_amount != null || data.total != null) pairs.push(["Total", String(data.total_amount ?? data.total)]);
  if (data.amount_paid != null) pairs.push(["Paid", String(data.amount_paid)]);
  if (data.balance != null) pairs.push(["Balance", String(data.balance)]);
  return pairs.map(([label, value]) => ({ label, value: `AED ${value}` }));
}

type Props = {
  lang: Lang;
  onNavigate: (s: TenantScreen) => void;
  backScreen: TenantScreen;
  titleAr: string;
  titleEn: string;
  loadPreview: () => Promise<unknown>;
};

export function LivePrintPreviewScreen({ lang, onNavigate, backScreen, titleAr, titleEn, loadPreview }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadPreview();
      setData((res ?? {}) as Record<string, unknown>);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const lines = useMemo(() => (data ? mapPrintLines(data) : []), [data]);
  const totals = useMemo(() => (data ? mapTotals(data) : []), [data]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void fetchPreview()} />;
  if (!data || Object.keys(data).length === 0) {
    return <EmptyState lang={lang} messageAr="لا توجد بيانات طباعة" messageEn="No print data available" />;
  }

  const company = (data.company ?? data.tenant ?? {}) as Record<string, unknown>;
  const party = (data.customer ?? data.supplier ?? data.party ?? {}) as Record<string, unknown>;
  const meta = [
    data.invoice_number || data.quotation_number || data.receipt_number
      ? { label: lang === "ar" ? "الرقم" : "Number", value: String(data.invoice_number ?? data.quotation_number ?? data.receipt_number) }
      : null,
    data.date || data.invoice_date
      ? { label: lang === "ar" ? "التاريخ" : "Date", value: String(data.date ?? data.invoice_date).slice(0, 10) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <PrintPreviewLayout
      lang={lang}
      titleAr={titleAr}
      titleEn={titleEn}
      company={company}
      party={party}
      meta={meta}
      lines={lines}
      totals={totals}
      notes={data.notes ? String(data.notes) : undefined}
      onBack={() => onNavigate(backScreen)}
    />
  );
}
