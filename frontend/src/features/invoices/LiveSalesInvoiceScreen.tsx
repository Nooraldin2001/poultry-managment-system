import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantScreen } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { useCustomers, useProducts } from "@/hooks/api/useTenantResources";
import { getSalesDetail, salesPricePreview, salesStockCheck, approveSale, cancelSale } from "@/services/salesService";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import type { InvoiceLineDraft } from "./types";
import type { LinePayloadOptions } from "./invoiceApi";
import { applyLineTotals } from "./lineTotals";
import { deriveQuantitiesFromCartons } from "./lineQuantities";
import { isCartonBasedProduct, isKgPrimaryProduct } from "./productLineMode";
import { SalesLinePriceCell } from "./SalesLinePriceCell";
import { canOverrideSalesPrice } from "@/shared/utils/permissions";
import type { ProductRow } from "@/shared/types/entities";
import {
  addDraftLine,
  createDraftHeader,
  patchDraftHeader,
  removeDraftLine,
  updateDraftLine,
} from "./invoiceApi";
import { ReasonModal } from "./ReasonModal";
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

export function LiveSalesInvoiceScreen({ lang, role, permissions = [], onNavigate, invoiceId, onSaved }: Props) {
  const isRTL = lang === "ar";
  const canApprove = role === "owner" || role === "accountant";
  const canEditPrice = canOverrideSalesPrice(role, permissions);
  const [docId, setDocId] = useState(invoiceId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [status, setStatus] = useState("draft");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
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
  const [needsCreditOverride, setNeedsCreditOverride] = useState(false);

  const { items: customers, loading: loadingCustomers } = useCustomers();
  const { items: products, loading: loadingProducts } = useProducts();

  const loadDoc = useCallback(async () => {
    if (!invoiceId || IS_MOCK_MODE) return;
    setLoadingDoc(true);
    setError(null);
    try {
      const detail = await getSalesDetail(invoiceId);
      if (!detail) {
        setError(new ApiError("Not found", { status: 404 }));
        return;
      }
      setDocId(detail.invoice.id);
      setCustomerId(detail.invoice.customerId);
      setInvoiceNumber(detail.invoice.number);
      setStatus(detail.invoice.status);
      setAmountPaid(String(detail.invoice.paid));
      setLines(
        detail.lines.map((l) => ({
          id: l.id,
          serverId: l.id,
          productId: l.productId,
          productName: l.productName,
          cartons: l.cartons ?? 0,
          pieces: l.pieces ?? l.qty,
          kg: l.kg ?? l.qty,
          unitPrice: l.price,
          priceType: (l.unit as "kg") || "kg",
          vatRate: 5,
          lineSubtotal: l.total,
          lineTotal: l.total,
        })),
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoadingDoc(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void loadDoc();
  }, [loadDoc]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const vat = vatEnabled ? Math.round(subtotal * 5) / 100 : 0;
    const total = subtotal + vat;
    const paid = parseAmount(amountPaid);
    return { subtotal, vat, total, paid, balance: Math.max(0, total - paid) };
  }, [lines, vatEnabled, amountPaid]);

  const ensureDraft = async (): Promise<string> => {
    if (docId) return docId;
    if (!customerId) throw new ApiError(isRTL ? "اختر العميل" : "Select customer", { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    const created = await createDraftHeader("sales", {
      customer: Number(customerId),
      invoice_date: today,
      payment_method: paymentMethod,
      amount_paid: amountPaid || "0",
      notes,
      vat_rate: vatEnabled ? "5.00" : "0.00",
    });
    setDocId(created.id);
    setInvoiceNumber(created.number ?? "");
    onSaved?.(created.id);
    return created.id;
  };

  const saveHeader = async (id: string, overrides?: { amountPaid?: string }) => {
    const selected = customers.find((c) => c.id === customerId);
    const isCashCustomer = selected?.customerType === "cash";
    const paidValue =
      overrides?.amountPaid ??
      (isCashCustomer || paymentMethod === "cash"
        ? totals.total.toFixed(2)
        : amountPaid || "0");
    await patchDraftHeader("sales", id, {
      customer: Number(customerId),
      payment_method: paymentMethod,
      amount_paid: paidValue,
      vat_rate: vatEnabled ? "5.00" : "0.00",
      notes,
    });
    if (paidValue !== amountPaid) {
      setAmountPaid(paidValue);
    }
  };

  const addLine = async (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const id = await ensureDraft();
      const draftBase: InvoiceLineDraft = {
        id: `tmp-${Date.now()}`,
        productId,
        productName: isRTL ? prod.nameAr : prod.nameEn,
        cartons: 1,
        pieces: 0,
        kg: 0,
        unitPrice: prod.saleP,
        priceType: prod.salePT,
        vatRate: 5,
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
      setLines((prev) => [...prev, { ...finalized, serverId }]);
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
    if (!docId || !line.serverId || status !== "draft") return;
    const payloadOpts: LinePayloadOptions =
      options ??
      (line.priceSource === "manual_override"
        ? { manualPriceOverride: true, priceOverrideReason: line.priceOverrideReason }
        : {});
    await updateDraftLine("sales", docId, line.serverId, line, payloadOpts);
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
    void persistLine(withTotals);
  };

  const removeLine = async (line: InvoiceLineDraft) => {
    if (line.serverId && docId) await removeDraftLine("sales", docId, line.serverId);
    setLines((prev) => prev.filter((l) => l.id !== line.id));
  };

  const runStockCheck = async (): Promise<boolean> => {
    const warnings: string[] = [];
    for (const line of lines) {
      try {
        const res = await salesStockCheck({
          product: Number(line.productId),
          cartons: line.cartons,
          pieces: line.pieces,
          kg: line.kg,
        });
        if (!(res as { available?: boolean }).available) {
          const avail = res as { available_kg?: string; available_cartons?: string };
          warnings.push(`${line.productName}: ${isRTL ? "مخزون غير كافٍ" : "insufficient stock"} (${avail.available_kg ?? "?"} kg)`);
        }
      } catch (err) {
        warnings.push(err instanceof ApiError ? err.message : String(err));
      }
    }
    const msg = warnings.length ? warnings.join("; ") : null;
    setStockWarning(msg);
    return !msg;
  };

  const handleSaveDraft = async () => {
    if (!customerId) {
      toast.error(isRTL ? "اختر العميل أولاً" : "Select a customer first");
      return;
    }
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
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      // Persist payment fields before approval — backend validates stored amount_paid.
      await saveHeader(docId);
      await runStockCheck();
      await approveSale(
        docId,
        reason,
        needsCreditOverride ? { credit_override: true } : undefined,
      );
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
  if (error && !docId && invoiceId) return <ErrorState lang={lang} error={error} onRetry={() => void loadDoc()} />;

  const isDraft = status === "draft";

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
          <span>{stockWarning}</span>
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
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-2 text-start font-black text-slate-500">{isRTL ? "المنتج" : "Product"}</th>
                    <th className="p-2">{isRTL ? "كرتون" : "Ct"}</th>
                    <th className="p-2">{isRTL ? "كجم" : "KG"}</th>
                    <th className="p-2">{isRTL ? "السعر" : "Price"}</th>
                    <th className="p-2">{isRTL ? "الإجمالي" : "Total"}</th>
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
                        <SalesLinePriceCell
                          lang={lang}
                          customerId={customerId}
                          line={line}
                          isDraft={isDraft}
                          canEditPrice={canEditPrice}
                          onPriceChange={updateLine}
                        />
                      </td>
                      <td className="p-2 font-mono font-bold">{line.lineTotal.toFixed(2)}</td>
                      <td className="p-2">
                        {isDraft && (
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
              <span>{isRTL ? "المجموع" : "Subtotal"}</span>
              <span className="font-mono">AED {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>{isRTL ? "ض.ق.م" : "VAT"}</span>
              <span className="font-mono">AED {totals.vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-[#0F2C59]">
              <span>{isRTL ? "الإجمالي" : "Total"}</span>
              <span className="font-mono">AED {totals.total.toFixed(2)}</span>
            </div>
            <label className="block pt-2 font-bold">{isRTL ? "طريقة الدفع" : "Payment"}</label>
            <select value={paymentMethod} disabled={!isDraft} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border px-2 py-2">
              <option value="cash">{isRTL ? "نقدي" : "Cash"}</option>
              <option value="bank_transfer">{isRTL ? "تحويل" : "Bank"}</option>
              <option value="credit">{isRTL ? "آجل" : "Credit"}</option>
            </select>
            <label className="block font-bold">{isRTL ? "المبلغ المدفوع" : "Amount paid"}</label>
            <input value={amountPaid} disabled={!isDraft} onChange={(e) => setAmountPaid(e.target.value)} className="w-full rounded-xl border px-2 py-2 font-mono" />
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
