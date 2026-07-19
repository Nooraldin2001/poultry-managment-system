import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types/navigation";
import { LoadingState, ErrorState, EmptyState } from "@/shared/components/ApiStates";
import { PrintPreviewLayout, type PrintLineRow } from "./PrintPreviewLayout";
import { InvoiceTemplateRenderer } from "./InvoiceTemplateRenderer";
import { resolveTheme } from "./theme";
import { parseBranding, parseCompanyIdentity, parsePartyIdentity, type InvoiceLineTotals } from "./types";

function lineDisplayTotal(line: Record<string, unknown>): string | undefined {
  const exVat =
    line.display_total ??
    line.line_subtotal ??
    null;
  if (exVat != null && exVat !== "") return String(exVat);
  if (line.line_total != null) return String(line.line_total);
  if (line.amount != null) return String(line.amount);
  return undefined;
}

function mapPrintLines(data: Record<string, unknown>): PrintLineRow[] {
  const raw = (data.lines ?? data.items ?? data.line_items ?? []) as Record<string, unknown>[];
  if (!Array.isArray(raw)) return [];
  return raw.map((line, i) => {
    const cartonsRaw = line.cartons ?? line.quantity_cartons;
    const kgRaw = line.kg ?? line.quantity_kg;
    return {
      label: String(line.product_name ?? line.description ?? line.name ?? `Line ${i + 1}`),
      cartons: cartonsRaw != null && cartonsRaw !== "" ? String(cartonsRaw) : undefined,
      pieces: line.quantity_pieces != null ? String(line.quantity_pieces) : undefined,
      kg: kgRaw != null && kgRaw !== "" ? String(kgRaw) : undefined,
      qty: cartonsRaw != null ? String(cartonsRaw) : undefined,
      unit: kgRaw != null ? String(kgRaw) : String(line.unit ?? line.price_type ?? ""),
      price: line.unit_price != null ? String(line.unit_price) : undefined,
      total: lineDisplayTotal(line),
    };
  });
}

function mapTotals(
  data: Record<string, unknown>,
  lang: Lang,
): { label: string; value: string; emphasize?: boolean }[] {
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const isRTL = lang === "ar";
  const L = (ar: string, en: string) => (isRTL ? ar : en);
  const isPurchase =
    totals.gross_total != null ||
    totals.net_supplier_payable != null ||
    totals.slaughterhouse_deduction != null;
  const pairs: [label: string, value: string, monetary: boolean, emphasize?: boolean][] = [];
  const subtotal = data.subtotal ?? totals.subtotal;
  const vat = data.vat_amount ?? data.vat ?? totals.vat_amount;
  const gross = totals.gross_total ?? data.gross_total;
  const slaughter = totals.slaughterhouse_deduction;
  const transport = totals.transport_deduction;
  const total = data.total_amount ?? data.total ?? totals.total_amount ?? totals.net_supplier_payable;
  const paid = data.amount_paid ?? totals.amount_paid;
  const balance = data.balance ?? totals.balance_due;
  const paymentMethod = data.payment_method ?? totals.payment_method;
  const moneyAccountName = data.money_account_name ?? totals.money_account_name;
  const paymentLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: "كاش", en: "Cash" },
    bank_transfer: { ar: "تحويل بنكي", en: "Bank transfer" },
    credit: { ar: "آجل", en: "Credit" },
    cheque: { ar: "شيك", en: "Cheque" },
    other: { ar: "أخرى", en: "Other" },
  };
  if (subtotal != null) pairs.push([L("الإجمالي قبل الضريبة", "Subtotal before VAT"), String(subtotal), true]);
  if (vat != null && String(vat) !== "0" && String(vat) !== "0.00") {
    pairs.push([L("ضريبة القيمة المضافة", "VAT"), String(vat), true]);
  }
  if (gross != null && isPurchase) {
    pairs.push([L("الإجمالي شامل الضريبة", "Total incl. VAT"), String(gross), true, balance == null]);
  }
  if (slaughter != null && parseFloat(String(slaughter)) > 0) {
    pairs.push([L("خصم المسلخ", "Slaughterhouse Deduction"), `-${slaughter}`, true]);
  }
  if (transport != null && parseFloat(String(transport)) > 0) {
    pairs.push([L("خصم النقل", "Transport Deduction"), `-${transport}`, true]);
  }
  if (total != null) {
    pairs.push([
      isPurchase ? L("صافي المستحق للمورد", "Net Supplier Payable") : L("الإجمالي شامل الضريبة", "Total incl. VAT"),
      String(total),
      true,
      balance == null,
    ]);
  }
  if (paid != null) pairs.push([L("المدفوع", "Paid"), String(paid), true]);
  if (balance != null) {
    pairs.push([
      isPurchase ? L("الرصيد", "Balance") : L("المتبقي", "Balance"),
      String(balance),
      true,
      true,
    ]);
  }
  if (paymentMethod) {
    const pm = paymentLabels[String(paymentMethod)] ?? { ar: String(paymentMethod), en: String(paymentMethod) };
    pairs.push([L("طريقة الدفع", "Payment method"), isRTL ? pm.ar : pm.en, false]);
  }
  if (moneyAccountName) {
    pairs.push([L("حساب الدفع", "Payment account"), String(moneyAccountName), false]);
  }
  return pairs.map(([label, value, monetary, emphasize]) => ({
    label,
    value: monetary ? `AED ${value}` : value,
    emphasize: emphasize === true,
  }));
}

function mapLineTotals(data: Record<string, unknown>): InvoiceLineTotals | undefined {
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const cartons = totals.total_cartons;
  const kg = totals.total_kg;
  const subtotal = totals.subtotal ?? data.subtotal;
  if (cartons == null && kg == null && subtotal == null) return undefined;
  return {
    totalCartons: cartons != null ? String(cartons) : "0",
    totalKg: kg != null ? String(kg) : "0",
    subtotal: subtotal != null ? String(subtotal) : "0",
  };
}

type Props = {
  lang: Lang;
  onNavigate: (s: TenantScreen) => void;
  backScreen: TenantScreen;
  titleAr: string;
  titleEn: string;
  loadPreview: () => Promise<unknown>;
};

function normalizePrintPreviewData(raw: Record<string, unknown>): Record<string, unknown> {
  const invoice = (raw.invoice ?? raw.quotation ?? raw.voucher ?? {}) as Record<string, unknown>;
  const totals = (raw.totals ?? {}) as Record<string, unknown>;
  const party = (raw.customer ?? raw.supplier ?? raw.party ?? {}) as Record<string, unknown>;
  return {
    ...raw,
    title_ar: raw.title_ar,
    title_en: raw.title_en,
    customer: party,
    supplier: party,
    party,
    invoice_number: raw.invoice_number ?? invoice.number ?? raw.quotation_number ?? raw.receipt_number,
    invoice_date: raw.invoice_date ?? invoice.date ?? raw.date,
    notes: raw.notes ?? invoice.notes,
    subtotal: raw.subtotal ?? totals.subtotal,
    vat_amount: raw.vat_amount ?? totals.vat_amount,
    total_amount: raw.total_amount ?? totals.total_amount,
    amount_paid: raw.amount_paid ?? totals.amount_paid,
    balance: raw.balance ?? totals.balance_due,
    lines: raw.lines ?? [],
  };
}

export function LivePrintPreviewScreen({ lang, onNavigate, backScreen, titleAr, titleEn, loadPreview }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadPreview();
      setData(normalizePrintPreviewData((res ?? {}) as Record<string, unknown>));
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
  const lineTotals = useMemo(() => (data ? mapLineTotals(data) : undefined), [data]);
  const totals = useMemo(() => (data ? mapTotals(data, lang) : []), [data, lang]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void fetchPreview()} />;
  if (!data || Object.keys(data).length === 0) {
    return <EmptyState lang={lang} messageAr="لا توجد بيانات طباعة" messageEn="No print data available" />;
  }

  const company = (data.company ?? data.tenant ?? {}) as Record<string, unknown>;
  const party = (data.customer ?? data.supplier ?? data.party ?? {}) as Record<string, unknown>;
  const resolvedTitleAr = String(data.title_ar ?? titleAr);
  const resolvedTitleEn = String(data.title_en ?? titleEn);
  const meta = [
    data.invoice_number || data.quotation_number || data.receipt_number
      ? { label: lang === "ar" ? "الرقم" : "Number", value: String(data.invoice_number ?? data.quotation_number ?? data.receipt_number) }
      : null,
    data.date || data.invoice_date
      ? { label: lang === "ar" ? "التاريخ" : "Date", value: String(data.date ?? data.invoice_date).slice(0, 10) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const partyKind = data.supplier || (party as { type?: string }).type === "supplier" ? "supplier" : "customer";

  // Invoice previews (sales/purchase) carry a `branding` block — render them
  // with the tenant-selected template + color theme. Other documents
  // (receipts, vouchers, statements) keep the shared layout below.
  if (data.branding && typeof data.branding === "object") {
    const branding = parseBranding(data.branding);
    const supplierInvNo = String((party as { supplier_invoice_number?: unknown }).supplier_invoice_number ?? "").trim();
    const templateMeta = [...meta];
    if (supplierInvNo) {
      templateMeta.push({
        label: lang === "ar" ? "رقم فاتورة المورد" : "Supplier Inv #",
        value: supplierInvNo,
      });
    }
    return (
      <InvoiceTemplateRenderer
        onBack={() => onNavigate(backScreen)}
        data={{
          lang,
          titleAr: resolvedTitleAr,
          titleEn: resolvedTitleEn,
          company: parseCompanyIdentity(company),
          party: parsePartyIdentity(party),
          partyKind: partyKind as "customer" | "supplier",
          meta: templateMeta,
          lines,
          lineTotals,
          totals,
          notes: data.notes ? String(data.notes) : undefined,
          branding,
          theme: resolveTheme(branding.color_theme),
        }}
      />
    );
  }

  return (
    <PrintPreviewLayout
      lang={lang}
      titleAr={resolvedTitleAr}
      titleEn={resolvedTitleEn}
      company={company}
      party={party}
      partyKind={partyKind as "customer" | "supplier"}
      meta={meta}
      lines={lines}
      totals={totals}
      notes={data.notes ? String(data.notes) : undefined}
      onBack={() => onNavigate(backScreen)}
    />
  );
}
