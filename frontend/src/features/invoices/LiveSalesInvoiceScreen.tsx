import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantScreen } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { useCustomers, useProducts } from "@/hooks/api/useTenantResources";
import { getSalesDetail, salesPricePreview, salesStockCheck, approveSale, cancelSale, reopenSale } from "@/services/salesService";
import {
  eligibleMoneyAccounts,
  formatMoneyAccountLabel,
  listMoneyAccounts,
  type MoneyAccountRow,
} from "@/services/treasuryService";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState, NotFoundState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import type { InvoiceLineDraft } from "./types";
import type { LinePayloadOptions } from "./invoiceApi";
import {
  addDraftLine,
  createDraftHeader,
  patchDraftHeader,
  removeDraftLine,
  syncLineFromApi,
  updateDraftLine,
} from "./invoiceApi";
import { applyLineTotals } from "./lineTotals";
import { deriveQuantitiesFromCartons } from "./lineQuantities";
import { defaultLineQuantitiesForProduct, isCartonBasedProduct, isKgPrimaryProduct } from "./productLineMode";
import { defaultLinePriceType, parsePriceType, priceColumnLabel } from "./priceTypeUtils";
import { LinePriceTypeSelect } from "./LinePriceTypeSelect";
import { SalesLinePriceCell } from "./SalesLinePriceCell";
import { canDeleteSalesLine, canOverrideSalesPrice, canBackdateSalesInvoice } from "@/shared/utils/permissions";
import type { ProductRow } from "@/shared/types/entities";
import { ReasonModal } from "./ReasonModal";
import { BackdateInvoiceFields, isBackdatedDate, todayIso } from "./BackdateInvoiceFields";
import { parseAmount } from "@/services/crud/parse";

function recalcLineFromProduct(line: InvoiceLineDraft, prod: ProductRow | undefined): InvoiceLineDraft {
  if (!prod) return line;
  const derived = deriveQuantitiesFromCartons({
    weightGrams: prod.g || 0,
    piecesPerCarton: prod.ppc || 0,
    cartons: line.cartons,
    loosePieces: 0,
    productType: prod.type,
    kgOverride: line.kgOverride,
    manualKg: line.kg,
  });
  return { ...line, pieces: derived.pieces, kg: derived.kg };
}

type Props = {
  lang: Lang;
  role: TenantRole;
  permissions?: string[];
  onNavigate: (s: TenantScreen) => void;
  invoiceId?: string | null;
  onSaved?: (id: string) => void;
};

const DEFAULT_VAT_RATE = 5;

export function LiveSalesInvoiceScreen({ lang, role, permissions = [], onNavigate, invoiceId, onSaved }: Props) {
  const isRTL = lang === "ar";
  const canApprove = role === "owner" || role === "accountant";
  const canEditPrice = canOverrideSalesPrice(role, permissions);
  const canDeleteLine = canDeleteSalesLine(role, permissions);
  const canBackdate = canBackdateSalesInvoice(role, permissions);
  const [docId, setDocId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [backdateReason, setBackdateReason] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [status, setStatus] = useState("draft");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccountRow[]>([]);
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [vatEnabled, setVatEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(!!invoiceId && !IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [needsCreditOverride, setNeedsCreditOverride] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { items: customers, loading: loadingCustomers } = useCustomers();
  const { items: products, loading: loadingProducts } = useProducts();

  const resetDraft = useCallback(() => {
    setDocId("");
    setCustomerId("");
    setLines([]);
    setStatus("draft");
    setInvoiceNumber("");
    setPaymentMethod("cash");
    setMoneyAccountId("");
    setAmountPaid("0");
    setNotes("");
    setVatEnabled(true);
    setInvoiceDate(todayIso());
    setBackdateReason("");
    setError(null);
    setFieldErrors({});
    setNotFound(false);
  }, []);

  const mapDetailLines = (detail: Awaited<ReturnType<typeof getSalesDetail>>): InvoiceLineDraft[] =>
    detail.lines.map((l) => ({
      id: l.id,
      serverId: l.id,
      productId: l.productId,
      productName: l.productName,
      cartons: l.cartons ?? 0,
      pieces: l.pieces ?? l.qty,
      kg: l.kg ?? l.qty,
      unitPrice: l.price,
      priceType: parsePriceType(l.unit),
      vatRate: detail.invoice.vat > 0 ? DEFAULT_VAT_RATE : 0,
      lineSubtotal: l.subtotal,
      lineTotal: l.total,
    }));

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    void listMoneyAccounts()
      .then(setMoneyAccounts)
      .catch(() => setMoneyAccounts([]));
  }, []);

  const loadDoc = useCallback(async () => {
    if (!invoiceId || IS_MOCK_MODE) return;
    setLoadingDoc(true);
    setNotFound(false);
    setError(null);
    try {
      const detail = await getSalesDetail(invoiceId);
      setDocId(detail.invoice.id);
      setCustomerId(detail.invoice.customerId);
      setInvoiceNumber(detail.invoice.number);
      setStatus(detail.invoice.status);
      setInvoiceDate(detail.invoice.date?.slice(0, 10) || todayIso());
      setBackdateReason(detail.backdateReason ?? "");
      setAmountPaid(String(detail.invoice.paid));
      setPaymentMethod(detail.invoice.paymentMethod ?? "cash");
      setMoneyAccountId(detail.invoice.moneyAccountId ?? "");
      setVatEnabled(detail.invoice.vat > 0);
      setLines(mapDetailLines(detail));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
        resetDraft();
      } else {
        setError(err);
      }
    } finally {
      setLoadingDoc(false);
    }
  }, [invoiceId, resetDraft]);

  useEffect(() => {
    if (!invoiceId) {
      resetDraft();
      setLoadingDoc(false);
      return;
    }
    void loadDoc();
  }, [invoiceId, loadDoc, resetDraft]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const vat = vatEnabled ? Math.round(subtotal * DEFAULT_VAT_RATE) / 100 : 0;
    const total = subtotal + vat;
    const paid = parseAmount(amountPaid);
    return { subtotal, vat, total, paid, balance: Math.max(0, total - paid) };
  }, [lines, vatEnabled, amountPaid]);

  const headerDatePayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = { invoice_date: invoiceDate };
    if (isBackdatedDate(invoiceDate) && canBackdate) {
      payload.backdate_reason = backdateReason.trim();
    }
    return payload;
  };

  const validateSalesHeader = (): boolean => {
    if (!customerId) {
      toast.error(isRTL ? "اختر العميل أولاً" : "Select a customer first");
      return false;
    }
    if (isBackdatedDate(invoiceDate) && canBackdate && !backdateReason.trim()) {
      const msg = isRTL ? "سبب إدخال تاريخ سابق مطلوب" : "Backdate reason is required for backdated invoices";
      setFieldErrors({ backdate_reason: [msg] });
      toast.error(msg);
      return false;
    }
    const paid = parseAmount(amountPaid || "0");
    if (paid > totals.total) {
      toast.error(isRTL ? "المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي" : "Paid amount cannot exceed total");
      return false;
    }
    if (paymentMethod === "cash" && paid > 0 && !moneyAccountId) {
      toast.error(isRTL ? "اختر الخزنة" : "Select a cashbox");
      return false;
    }
    if (paymentMethod === "bank_transfer" && paid > 0 && !moneyAccountId) {
      toast.error(isRTL ? "اختر الحساب البنكي" : "Select a bank account");
      return false;
    }
    return true;
  };

  const paymentPayload = (): Record<string, unknown> => {
    if (paymentMethod === "credit") {
      return { payment_method: "credit", money_account: null, amount_paid: "0" };
    }
    const selected = customers.find((c) => c.id === customerId);
    const isCashCustomer = selected?.customerType === "cash";
    const paidValue =
      isCashCustomer || paymentMethod === "cash"
        ? totals.total.toFixed(2)
        : amountPaid || "0";
    return {
      payment_method: paymentMethod,
      money_account: moneyAccountId ? Number(moneyAccountId) : null,
      amount_paid: paidValue,
    };
  };

  const ensureDraft = async (): Promise<string> => {
    if (docId) return docId;
    if (!customerId) throw new ApiError(isRTL ? "اختر العميل" : "Select customer", { status: 400 });
    if (isBackdatedDate(invoiceDate) && canBackdate && !backdateReason.trim()) {
      throw new ApiError(
        isRTL ? "سبب إدخال تاريخ سابق مطلوب" : "Backdate reason is required",
        { status: 400, fieldErrors: { backdate_reason: ["Required"] } },
      );
    }
    const created = await createDraftHeader("sales", {
      customer: Number(customerId),
      ...headerDatePayload(),
      ...paymentPayload(),
      notes,
      vat_rate: vatEnabled ? "5.00" : "0.00",
    });
    setDocId(created.id);
    setInvoiceNumber(created.number ?? "");
    onSaved?.(created.id);
    return created.id;
  };

  const saveHeader = async (id: string) => {
    const payload = paymentPayload();
    await patchDraftHeader("sales", id, {
      customer: Number(customerId),
      ...headerDatePayload(),
      ...payload,
      vat_rate: vatEnabled ? "5.00" : "0.00",
      notes,
    });
    const paidStr = String(payload.amount_paid ?? amountPaid);
    if (paidStr !== amountPaid) {
      setAmountPaid(paidStr);
    }
  };

  const addLine = async (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const id = await ensureDraft();
      const qtyDefaults = defaultLineQuantitiesForProduct(prod);
      const draftBase: InvoiceLineDraft = {
        id: `tmp-${Date.now()}`,
        productId,
        productName: isRTL ? prod.nameAr : prod.nameEn,
        cartons: qtyDefaults.cartons,
        pieces: qtyDefaults.pieces,
        kg: qtyDefaults.kg,
        unitPrice: prod.saleP,
        priceType: defaultLinePriceType(prod, "sales"),
        vatRate: vatEnabled ? DEFAULT_VAT_RATE : 0,
        lineSubtotal: 0,
        lineTotal: 0,
      };
      const draft = recalcLineFromProduct(draftBase, prod);
      let withTotals = applyLineTotals(draft);
      try {
        const preview = await salesPricePreview({
          customer: Number(customerId),
          product: Number(productId),
          price_type: draft.priceType,
        });
        const price = parseAmount((preview as { unit_price?: string }).unit_price);
        if (price > 0) {
          withTotals = applyLineTotals({ ...withTotals, unitPrice: price });
        }
      } catch {
        /* use product default */
      }
      const finalized = withTotals;
      const serverId = await addDraftLine("sales", id, finalized);
      const detail = await getSalesDetail(id);
      setLines(mapDetailLines(detail));
      await saveHeader(id);
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(err);
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const persistLine = async (line: InvoiceLineDraft, options?: LinePayloadOptions) => {
    if (!docId || !line.serverId || status !== "draft") return line;
    const payloadOpts: LinePayloadOptions =
      options ??
      (line.priceSource === "manual_override"
        ? { manualPriceOverride: true, priceOverrideReason: line.priceOverrideReason }
        : {});
    const saved = await updateDraftLine("sales", docId, line.serverId, line, payloadOpts);
    return syncLineFromApi(line, saved);
  };

  const updateLine = (next: InvoiceLineDraft, options?: { skipQuantityRecalc?: boolean; kgOverride?: boolean }) => {
    const prod = products.find((p) => p.id === next.productId);
    let merged = next;
    if (options?.kgOverride) {
      merged = { ...next, kgOverride: true };
    }
    if (!options?.skipQuantityRecalc && !merged.kgOverride) {
      merged = recalcLineFromProduct(merged, prod);
    }
    const withTotals = applyLineTotals(merged);
    setLines((prev) => prev.map((l) => (l.id === withTotals.id ? withTotals : l)));
    void persistLine(withTotals).then((synced) => {
      setLines((prev) => prev.map((l) => (l.id === synced.id ? synced : l)));
    });
  };

  const removeLine = async (line: InvoiceLineDraft) => {
    if (!canDeleteLine) {
      toast.error(isRTL ? "لا تملك صلاحية حذف هذا البند" : "You do not have permission to delete this line");
      return;
    }
    try {
      if (line.serverId && docId) {
        await removeDraftLine("sales", docId, line.serverId);
        // Backend recalculated totals — reload lines from the server.
        const detail = await getSalesDetail(docId);
        setLines(mapDetailLines(detail));
      } else {
        setLines((prev) => prev.filter((l) => l.id !== line.id));
      }
      toast.success(isRTL ? "تم حذف البند" : "Line deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "تعذر حذف البند" : "Unable to delete line"));
    }
  };

  const runStockCheck = async (): Promise<boolean> => {
    const byProduct = new Map<
      string,
      { name: string; cartons: number; pieces: number; kg: number }
    >();
    for (const line of lines) {
      if (!line.productId) continue;
      const bucket = byProduct.get(line.productId) ?? {
        name: line.productName,
        cartons: 0,
        pieces: 0,
        kg: 0,
      };
      bucket.cartons += line.cartons;
      bucket.pieces += line.pieces;
      bucket.kg += line.kg;
      byProduct.set(line.productId, bucket);
    }

    const shortages: string[] = [];
    for (const [productId, bucket] of byProduct) {
      try {
        const res = await salesStockCheck({
          product: Number(productId),
          cartons: bucket.cartons,
          pieces: bucket.pieces,
          kg: bucket.kg,
          invoiceId: docId || undefined,
        });
        const data = res as {
          is_available?: boolean;
          available?: boolean;
          available_for_edit?: { kg?: string; cartons?: string; pieces?: string };
          requested?: { kg?: string };
        };
        const ok = data.is_available ?? data.available ?? false;
        if (!ok) {
          const reqKg = data.requested?.kg ?? String(bucket.kg);
          const availKg = data.available_for_edit?.kg ?? "?";
          shortages.push(
            isRTL
              ? `${bucket.name}: المطلوب ${reqKg} كجم، المتاح ${availKg} كجم`
              : `${bucket.name}: requested ${reqKg} kg, available ${availKg} kg`,
          );
        }
      } catch (err) {
        shortages.push(err instanceof ApiError ? err.message : String(err));
      }
    }

    if (shortages.length) {
      const header = isRTL
        ? "تعذر اعتماد الفاتورة بسبب عدم كفاية المخزون:"
        : "Insufficient stock for approval:";
      setStockWarning(`${header}\n- ${shortages.join("\n- ")}`);
      return false;
    }
    setStockWarning(null);
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateSalesHeader()) return;
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      const id = await ensureDraft();
      await saveHeader(id);
      toast.success(isRTL ? "تم حفظ المسودة" : "Draft saved");
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(err);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (reason: string) => {
    if (!docId) return;
    if (!validateSalesHeader()) return;
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      // Persist payment fields before approval — backend validates stored amount_paid.
      await saveHeader(docId);
      const stockOk = await runStockCheck();
      if (!stockOk) {
        toast.error(isRTL ? "المخزون غير كافٍ" : "Insufficient stock");
        return;
      }
      await approveSale(docId, reason, {
        ...(needsCreditOverride ? { credit_override: true } : {}),
        ...(isBackdatedDate(invoiceDate) && backdateReason.trim()
          ? { backdate_reason: backdateReason.trim() }
          : {}),
      });
      setStatus("approved");
      setShowApprove(false);
      setNeedsCreditOverride(false);
      toast.success(isRTL ? "تم اعتماد الفاتورة" : "Invoice approved");
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      if (err instanceof ApiError && err.message.toLowerCase().includes("credit")) {
        setNeedsCreditOverride(true);
        toast.error(isRTL ? "تجاوز حد الائتمان — أعد المحاولة مع سبب التجاوز" : "Credit limit exceeded — retry with override reason");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Approve failed");
      }
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async (reason: string) => {
    if (!docId) return;
    setSaving(true);
    try {
      await reopenSale(docId, reason);
      setStatus("draft");
      setShowReopen(false);
      setStockWarning(null);
      await loadDoc();
      toast.success(isRTL ? "تم إعادة فتح الفاتورة للتعديل" : "Invoice reopened for editing");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Reopen failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!docId) return;
    setSaving(true);
    try {
      await cancelSale(docId, reason);
      setStatus("cancelled");
      setShowCancel(false);
      toast.success(isRTL ? "تم إلغاء الفاتورة بنجاح" : "Invoice cancelled successfully");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && ApiError.isForbidden(error)) return <PermissionDeniedState lang={lang} />;
  if (loadingDoc || loadingCustomers || loadingProducts) return <LoadingState lang={lang} />;
  if (notFound) {
    return (
      <div className="p-3 lg:p-6 max-w-screen-xl mx-auto">
        <NotFoundState
          lang={lang}
          messageAr="فاتورة البيع غير موجودة أو لا تتبع هذه الشركة"
          messageEn="Sales invoice was not found or does not belong to this company"
          backLabelAr="رجوع إلى المبيعات"
          backLabelEn="Back to Sales"
          onBack={() => onNavigate("sales-list")}
        />
      </div>
    );
  }
  if (error && !docId && invoiceId) return <ErrorState lang={lang} error={error} onRetry={() => void loadDoc()} />;

  const isDraft = status === "draft";
  const accountSourceType: "cashbox" | "bank" | "" =
    paymentMethod === "cash" ? "cashbox" : paymentMethod === "bank_transfer" ? "bank" : "";
  const eligibleAccounts = eligibleMoneyAccounts(moneyAccounts, paymentMethod);

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    setMoneyAccountId("");
    if (method === "credit") setAmountPaid("0");
  };

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onNavigate("sales-list")} className="px-3 py-2 rounded-xl border text-sm font-bold">
          {isRTL ? "رجوع" : "Back"}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59] flex-1">
          {invoiceId ? (isRTL ? "تعديل فاتورة بيع" : "Edit Sales Invoice") : isRTL ? "فاتورة بيع جديدة" : "New Sales Invoice"}
        </h2>
      </div>
      <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">
        <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "رقم الفاتورة الداخلي" : "Internal invoice number"}</div>
        {invoiceNumber ? (
          <span className="font-mono font-bold text-[#0F2C59]">{invoiceNumber}</span>
        ) : (
          <span className="text-slate-400 italic">
            {isRTL ? "سيتم إنشاء الرقم تلقائياً عند الحفظ" : "Number will be generated automatically on save"}
          </span>
        )}
      </div>

      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />
      {stockWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="whitespace-pre-line">{stockWarning}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <label className="text-sm font-bold text-slate-700">{isRTL ? "العميل" : "Customer"}</label>
            <select
              value={customerId}
              disabled={!isDraft}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">{isRTL ? "— اختر —" : "— Select —"}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr ?? c.name}
                </option>
              ))}
            </select>
            <BackdateInvoiceFields
              lang={lang}
              invoiceDate={invoiceDate}
              backdateReason={backdateReason}
              canBackdate={canBackdate}
              isDraft={isDraft}
              onDateChange={setInvoiceDate}
              onReasonChange={setBackdateReason}
              fieldErrors={fieldErrors}
            />
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-2 text-start font-black text-slate-500">{isRTL ? "المنتج" : "Product"}</th>
                    <th className="p-2">{isRTL ? "كرتون" : "Ct"}</th>
                    <th className="p-2">{isRTL ? "كجم" : "KG"}</th>
                    <th className="p-2">{isRTL ? "نوع السعر" : "Price type"}</th>
                    <th className="p-2">{isRTL ? "السعر قبل الضريبة" : "Price before VAT"}</th>
                    <th className="p-2">{isRTL ? "الإجمالي قبل الضريبة" : "Subtotal before VAT"}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const prod = products.find((p) => p.id === line.productId);
                    const kgPrimary = isKgPrimaryProduct(prod);
                    return (
                    <tr key={line.id} className="border-b">
                      <td className="p-2 font-semibold">{line.productName}</td>
                      <td className="p-2">
                        {kgPrimary ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <input
                            type="number"
                            disabled={!isDraft}
                            className="w-16 rounded border px-1 py-0.5 text-xs"
                            value={line.cartons}
                            onChange={(e) => {
                              const cartons = Number(e.target.value);
                              updateLine({ ...line, cartons });
                            }}
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          disabled={!isDraft}
                          className="w-20 rounded border px-1 py-0.5 text-xs"
                          value={line.kg}
                          onChange={(e) => {
                            const kg = Number(e.target.value);
                            updateLine({ ...line, kg }, { kgOverride: true });
                          }}
                          readOnly={isCartonBasedProduct(prod) && !line.kgOverride}
                        />
                      </td>
                      <td className="p-2">
                        {isDraft ? (
                          <LinePriceTypeSelect
                            lang={lang}
                            line={line}
                            onChange={(next) => updateLine(applyLineTotals(next))}
                          />
                        ) : (
                          <span className="text-xs">{priceColumnLabel(line.priceType, lang)}</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="space-y-0.5">
                          <span className="block text-[10px] text-slate-400">
                            {priceColumnLabel(line.priceType, lang)}
                          </span>
                          <SalesLinePriceCell
                            lang={lang}
                            customerId={customerId}
                            line={line}
                            isDraft={isDraft}
                            canEditPrice={canEditPrice}
                            onPriceChange={updateLine}
                          />
                        </div>
                      </td>
                      <td className="p-2 font-mono font-bold">{line.lineSubtotal.toFixed(2)}</td>
                      <td className="p-2">
                        {isDraft && canDeleteLine && (
                          <button type="button" onClick={() => void removeLine(line)} className="text-red-500">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lines.length === 0 && <EmptyState lang={lang} messageAr="أضف بنود الفاتورة" messageEn="Add invoice lines" compact />}
            {isDraft && (
              <div className="p-3 border-t flex flex-wrap gap-2">
                <select
                  className="flex-1 min-w-[140px] rounded-xl border px-2 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void addLine(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">{isRTL ? "+ إضافة منتج" : "+ Add product"}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr ?? p.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-2 text-sm">
            <div className="flex justify-between font-bold">
              <span>{isRTL ? "الإجمالي قبل الضريبة" : "Subtotal before VAT"}</span>
              <span className="font-mono">AED {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>
                {vatEnabled
                  ? isRTL ? "ضريبة القيمة المضافة" : "VAT"
                  : isRTL ? "بدون ضريبة" : "VAT disabled"}
              </span>
              <span className="font-mono">AED {totals.vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-[#0F2C59]">
              <span>{isRTL ? "الإجمالي شامل الضريبة" : "Total incl. VAT"}</span>
              <span className="font-mono">AED {totals.total.toFixed(2)}</span>
            </div>
            <label className="block pt-2 font-bold">{isRTL ? "طريقة الدفع" : "Payment"}</label>
            <select
              value={paymentMethod}
              disabled={!isDraft}
              onChange={(e) => handlePaymentMethodChange(e.target.value)}
              className="w-full rounded-xl border px-2 py-2"
            >
              <option value="cash">{isRTL ? "نقدي" : "Cash"}</option>
              <option value="bank_transfer">{isRTL ? "تحويل" : "Bank"}</option>
              <option value="credit">{isRTL ? "آجل" : "Credit"}</option>
            </select>
            {accountSourceType && parseAmount(amountPaid || "0") > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  {accountSourceType === "cashbox"
                    ? (isRTL ? "الخزنة" : "Cashbox")
                    : (isRTL ? "الحساب البنكي" : "Bank Account")}
                </label>
                {eligibleAccounts.length === 0 ? (
                  <p className="text-xs font-bold text-amber-600">
                    {accountSourceType === "cashbox"
                      ? (isRTL ? "لا توجد خزنة نشطة" : "No active cashbox found")
                      : (isRTL ? "لا توجد حسابات بنكية نشطة" : "No active bank account found")}
                  </p>
                ) : (
                  <select
                    value={moneyAccountId}
                    disabled={!isDraft}
                    onChange={(e) => setMoneyAccountId(e.target.value)}
                    className="w-full rounded-xl border px-2 py-2 text-sm"
                  >
                    <option value="">
                      {accountSourceType === "cashbox"
                        ? (isRTL ? "— اختر الخزنة —" : "— Select cashbox —")
                        : (isRTL ? "— اختر الحساب البنكي —" : "— Select bank account —")}
                    </option>
                    {eligibleAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {formatMoneyAccountLabel(acc)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {paymentMethod === "credit" ? (
              <p className="text-xs text-slate-500">
                {isRTL
                  ? "بيع آجل — يُسجّل المبلغ كاملاً على رصيد العميل"
                  : "Credit sale — the full amount goes to the customer balance"}
              </p>
            ) : (
              <>
                <label className="block font-bold">{isRTL ? "المبلغ المدفوع" : "Amount paid"}</label>
                <input
                  value={amountPaid}
                  disabled={!isDraft}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-xl border px-2 py-2 font-mono"
                />
              </>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {isDraft && (
              <button
                type="button"
                disabled={saving || !customerId}
                onClick={() => void handleSaveDraft()}
                className="w-full py-2 rounded-xl border border-[#0F2C59]/30 text-[#0F2C59] font-bold disabled:opacity-50"
              >
                {isRTL ? "حفظ مسودة" : "Save draft"}
              </button>
            )}
            {isDraft && canApprove && (
              <button
                type="button"
                disabled={saving || lines.length === 0}
                onClick={() => setShowApprove(true)}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={16} />
                {isRTL ? "اعتماد" : "Approve"}
              </button>
            )}
            {canApprove && (status === "approved" || status === "partial" || status === "paid") && (
              <button
                type="button"
                onClick={() => setShowReopen(true)}
                className="w-full py-2 rounded-xl border border-amber-300 text-amber-800 font-bold"
              >
                {isRTL ? "إعادة فتح للتعديل" : "Reopen for editing"}
              </button>
            )}
            {status === "approved" && (
              <button type="button" onClick={() => onNavigate("sales-preview")} className="w-full py-2 rounded-xl border font-bold">
                {isRTL ? "معاينة الطباعة" : "Print preview"}
              </button>
            )}
            {canApprove && status !== "cancelled" && docId && (
              <button type="button" onClick={() => setShowCancel(true)} className="w-full py-2 rounded-xl border border-red-200 text-red-600 font-bold">
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showApprove && (
        <ReasonModal
          lang={lang}
          titleAr={needsCreditOverride ? "تجاوز حد الائتمان" : "اعتماد فاتورة البيع"}
          titleEn={needsCreditOverride ? "Credit limit override" : "Approve sales invoice"}
          confirmLabelAr="اعتماد"
          confirmLabelEn="Approve"
          loading={saving}
          onClose={() => { setShowApprove(false); setNeedsCreditOverride(false); }}
          onConfirm={handleApprove}
        />
      )}
      {showReopen && (
        <ReasonModal
          lang={lang}
          titleAr="إعادة فتح فاتورة البيع"
          titleEn="Reopen sales invoice"
          confirmLabelAr="إعادة فتح"
          confirmLabelEn="Reopen"
          loading={saving}
          onClose={() => setShowReopen(false)}
          onConfirm={handleReopen}
        />
      )}
      {showCancel && (
        <ReasonModal
          lang={lang}
          titleAr="إلغاء فاتورة البيع"
          titleEn="Cancel sales invoice"
          confirmLabelAr="إلغاء"
          confirmLabelEn="Cancel"
          loading={saving}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}
