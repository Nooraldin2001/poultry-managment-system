import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, Printer, RefreshCw } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantScreen } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { usePurchaseSuppliers, useProducts } from "@/hooks/api/useTenantResources";
import { getPurchaseDetail, approvePurchase, cancelPurchase } from "@/services/purchaseService";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState, NotFoundState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import type { InvoiceLineDraft } from "./types";
import type { LinePayloadOptions } from "./invoiceApi";
import { addDraftLine, createDraftHeader, patchDraftHeader, removeDraftLine, updateDraftLine } from "./invoiceApi";
import { applyLineTotals } from "./lineTotals";
import { deriveQuantitiesFromCartons } from "./lineQuantities";
import {
  defaultLineQuantitiesForProduct,
  isCartonBasedProduct,
  isKgPrimaryProduct,
} from "./productLineMode";
import { PurchaseLinePriceCell } from "./PurchaseLinePriceCell";
import { canDeletePurchaseLine, canOverridePurchasePrice, canBackdatePurchaseInvoice } from "@/shared/utils/permissions";
import { notifyTenantDataChanged } from "@/shared/utils/tenantRefresh";
import { ReasonModal } from "./ReasonModal";
import { BackdateInvoiceFields, isBackdatedDate, todayIso } from "./BackdateInvoiceFields";
import { parseAmount } from "@/services/crud/parse";
import type { ProductRow } from "@/shared/types/entities";
import { listMoneyAccounts, type MoneyAccountRow } from "@/services/treasuryService";
import { listSlaughterhouseSuppliers, listTransportSuppliers, getSupplierDetail } from "@/services/supplierService";
import { mapSupplierPaymentToPurchase } from "@/shared/utils/supplierPaymentMethod";
import type { SupplierRow } from "@/shared/types/entities";

function recalcLineFromProduct(line: InvoiceLineDraft, prod: ProductRow | undefined): InvoiceLineDraft {
  if (!prod) return line;
  if (isKgPrimaryProduct(prod)) {
    return { ...line, cartons: 0, pieces: line.pieces ?? 0, kg: line.kg };
  }
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
  onApproved?: () => void;
  onOpenPrint?: () => void;
};

const DEFAULT_VAT_RATE = 5;

export function LivePurchaseInvoiceScreen({ lang, role, permissions = [], onNavigate, invoiceId, onSaved, onApproved, onOpenPrint }: Props) {
  const isRTL = lang === "ar";
  const canApprove = role === "owner" || role === "accountant";
  const canEditPrice = canOverridePurchasePrice(role, permissions);
  const canDeleteLine = canDeletePurchaseLine(role, permissions);
  const canBackdate = canBackdatePurchaseInvoice(role, permissions);
  const [docId, setDocId] = useState(invoiceId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [backdateReason, setBackdateReason] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [status, setStatus] = useState("draft");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(!!invoiceId && !IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccountRow[]>([]);
  const [slaughterSuppliers, setSlaughterSuppliers] = useState<SupplierRow[]>([]);
  const [transportSuppliers, setTransportSuppliers] = useState<SupplierRow[]>([]);
  const [slaughterhouseSupplierId, setSlaughterhouseSupplierId] = useState("");
  const [slaughterDeduction, setSlaughterDeduction] = useState("0");
  const [transportSupplierId, setTransportSupplierId] = useState("");
  const [transportDeduction, setTransportDeduction] = useState("0");
  const [deductionNotes, setDeductionNotes] = useState("");

  const { items: suppliers, loading: loadingSuppliers, reload: reloadSuppliers } = usePurchaseSuppliers();
  const { items: products, loading: loadingProducts } = useProducts();
  const [supplierNameSnapshot, setSupplierNameSnapshot] = useState("");

  const resetDraft = useCallback(() => {
    setDocId("");
    setSupplierId("");
    setSupplierNameSnapshot("");
    setSupplierInvNo("");
    setLines([]);
    setStatus("draft");
    setInvoiceNumber("");
    setPaymentMethod("bank_transfer");
    setMoneyAccountId("");
    setAmountPaid("0");
    setNotes("");
    setVatEnabled(false);
    setInvoiceDate(todayIso());
    setBackdateReason("");
    setSlaughterhouseSupplierId("");
    setSlaughterDeduction("0");
    setTransportSupplierId("");
    setTransportDeduction("0");
    setDeductionNotes("");
    setError(null);
    setFieldErrors({});
    setNotFound(false);
  }, []);

  const loadDoc = useCallback(async () => {
    if (!invoiceId || IS_MOCK_MODE) return;
    setLoadingDoc(true);
    setNotFound(false);
    setError(null);
    try {
      const detail = await getPurchaseDetail(invoiceId);
      setDocId(detail.invoice.id);
      setSupplierId(detail.invoice.supplierId);
      setSupplierNameSnapshot(detail.invoice.supplier ?? "");
      setInvoiceNumber(detail.invoice.number);
      setStatus(detail.invoice.status);
      setInvoiceDate(detail.invoice.date?.slice(0, 10) || todayIso());
      setBackdateReason(detail.backdateReason ?? "");
      setPaymentMethod((detail.invoice as unknown as { paymentMethod?: string }).paymentMethod ?? "bank_transfer");
      setAmountPaid(String(detail.invoice.paid));
      setMoneyAccountId(detail.invoice.moneyAccountId ?? "");
      setSlaughterhouseSupplierId(detail.invoice.slaughterhouseSupplierId ?? "");
      setSlaughterDeduction(String(detail.invoice.slaughterhouseDeduction ?? 0));
      setTransportSupplierId(detail.invoice.transportSupplierId ?? "");
      setTransportDeduction(String(detail.invoice.transportDeduction ?? 0));
      setDeductionNotes(detail.invoice.deductionNotes ?? "");
      setVatEnabled(detail.invoice.vat > 0);
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
          priceType: (l.unit as InvoiceLineDraft["priceType"]) || "kg",
          vatRate: l.vatRate ?? (detail.invoice.vat > 0 ? DEFAULT_VAT_RATE : 0),
          lineSubtotal: l.subtotal ?? l.total,
          lineTotal: l.total,
        })),
      );
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

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    void listMoneyAccounts()
      .then(setMoneyAccounts)
      .catch(() => setMoneyAccounts([]));
    void listSlaughterhouseSuppliers().then(setSlaughterSuppliers).catch(() => setSlaughterSuppliers([]));
    void listTransportSuppliers().then(setTransportSuppliers).catch(() => setTransportSuppliers([]));
  }, []);

  useEffect(() => {
    if (IS_MOCK_MODE || invoiceId || !supplierId) return;
    let cancelled = false;
    void getSupplierDetail(supplierId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setPaymentMethod(mapSupplierPaymentToPurchase(detail.defaultPaymentMethod));
        setMoneyAccountId("");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supplierId, invoiceId]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const vat = vatEnabled ? Math.round(subtotal * DEFAULT_VAT_RATE) / 100 : 0;
    const gross = subtotal + vat;
    const slaughter = parseAmount(slaughterDeduction || "0");
    const transport = parseAmount(transportDeduction || "0");
    const net = Math.max(0, gross - slaughter - transport);
    const paid = parseAmount(amountPaid);
    return { subtotal, vat, gross, slaughter, transport, total: net, paid, balance: Math.max(0, net - paid) };
  }, [lines, vatEnabled, amountPaid, slaughterDeduction, transportDeduction]);

  const deductionPayload = (): Record<string, unknown> => ({
    slaughterhouse_supplier: slaughterhouseSupplierId ? Number(slaughterhouseSupplierId) : null,
    slaughterhouse_deduction_amount: slaughterDeduction || "0",
    transport_supplier: transportSupplierId ? Number(transportSupplierId) : null,
    transport_deduction_amount: transportDeduction || "0",
    deduction_notes: deductionNotes,
  });

  const lineVatRate = vatEnabled ? DEFAULT_VAT_RATE : 0;

  const headerDatePayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = { invoice_date: invoiceDate };
    if (isBackdatedDate(invoiceDate) && canBackdate) {
      payload.backdate_reason = backdateReason.trim();
    }
    return payload;
  };

  const saveHeader = async (id: string) => {
    const selectedAccount = moneyAccounts.find((a) => a.id === moneyAccountId);
    const resolvedPaymentMethod =
      paymentMethod === "partial"
        ? (selectedAccount?.accountType === "cashbox" ? "cash" : "bank_transfer")
        : paymentMethod;
    await patchDraftHeader("purchase", id, {
      supplier: Number(supplierId),
      supplier_invoice_number: supplierInvNo,
      ...headerDatePayload(),
      payment_method: resolvedPaymentMethod,
      money_account: moneyAccountId ? Number(moneyAccountId) : null,
      amount_paid: amountPaid || "0",
      vat_rate: vatEnabled ? "5.00" : "0.00",
      notes,
      ...deductionPayload(),
    });
  };

  const ensureDraft = async (): Promise<string> => {
    if (docId) return docId;
    if (!supplierId) throw new ApiError(isRTL ? "اختر المورد" : "Select supplier", { status: 400 });
    if (isBackdatedDate(invoiceDate) && canBackdate && !backdateReason.trim()) {
      throw new ApiError(
        isRTL ? "سبب إدخال تاريخ سابق مطلوب" : "Backdate reason is required",
        { status: 400, fieldErrors: { backdate_reason: ["Required"] } },
      );
    }
    const selectedAccount = moneyAccounts.find((a) => a.id === moneyAccountId);
    const resolvedPaymentMethod =
      paymentMethod === "partial"
        ? (selectedAccount?.accountType === "cashbox" ? "cash" : "bank_transfer")
        : paymentMethod;
    const created = await createDraftHeader("purchase", {
      supplier: Number(supplierId),
      ...headerDatePayload(),
      supplier_invoice_number: supplierInvNo,
      payment_method: resolvedPaymentMethod,
      money_account: moneyAccountId ? Number(moneyAccountId) : null,
      amount_paid: amountPaid || "0",
      notes,
      vat_rate: vatEnabled ? "5.00" : "0.00",
      ...deductionPayload(),
    });
    setDocId(created.id);
    setInvoiceNumber(created.number ?? "");
    onSaved?.(created.id);
    return created.id;
  };

  const handleSaveDraft = async () => {
    if (!supplierId) {
      toast.error(isRTL ? "اختر المورد أولاً" : "Select a supplier first");
      return;
    }
    const paid = parseAmount(amountPaid || "0");
    if (paid > totals.total) {
      toast.error(isRTL ? "المبلغ المدفوع لا يمكن أن يتجاوز صافي المستحق للمورد" : "Paid amount cannot exceed net supplier payable");
      return;
    }
    const slaughter = parseAmount(slaughterDeduction || "0");
    const transport = parseAmount(transportDeduction || "0");
    if (slaughter > 0 && !slaughterhouseSupplierId) {
      toast.error(isRTL ? "اختر المسلخ عند إدخال خصم المسلخ" : "Select slaughterhouse when deduction amount is set");
      return;
    }
    if (transport > 0 && !transportSupplierId) {
      toast.error(isRTL ? "اختر النقل عند إدخال خصم النقل" : "Select transport account when deduction amount is set");
      return;
    }
    if (slaughter + transport > totals.gross) {
      toast.error(isRTL ? "مجموع الخصومات يتجاوز إجمالي الفاتورة" : "Total deductions exceed gross total");
      return;
    }
    if ((paymentMethod === "cash" || paymentMethod === "bank_transfer" || paymentMethod === "partial") && !moneyAccountId) {
      toast.error(isRTL ? "اختر الخزنة / الحساب البنكي" : "Select cashbox / bank account");
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

  const addLine = async (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setSaving(true);
    try {
      const id = await ensureDraft();
      const qtyDefaults = defaultLineQuantitiesForProduct(prod);
      const draftBase: InvoiceLineDraft = {
        id: `tmp-${Date.now()}`,
        productId,
        productName: prod.nameAr,
        cartons: qtyDefaults.cartons,
        pieces: qtyDefaults.pieces,
        kg: qtyDefaults.kg,
        unitPrice: prod.buyP || prod.saleP,
        priceType: isKgPrimaryProduct(prod) ? "kg" : (prod.buyPT ?? prod.salePT ?? "kg"),
        vatRate: lineVatRate,
        lineSubtotal: 0,
        lineTotal: 0,
        kgOverride: isKgPrimaryProduct(prod),
      };
      const draft = isKgPrimaryProduct(prod) ? draftBase : recalcLineFromProduct(draftBase, prod);
      const finalized = applyLineTotals(draft);
      const serverId = await addDraftLine("purchase", id, finalized);
      setLines((prev) => [...prev, { ...finalized, serverId }]);
      await patchDraftHeader("purchase", id, { supplier_invoice_number: supplierInvNo });
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (line: InvoiceLineDraft) => {
    if (!canDeleteLine) {
      toast.error(isRTL ? "لا تملك صلاحية حذف هذا البند" : "You do not have permission to delete this line");
      return;
    }
    try {
      if (line.serverId && docId) await removeDraftLine("purchase", docId, line.serverId);
      setLines((prev) => prev.filter((l) => l.id !== line.id));
      if (docId) {
        const detail = await getPurchaseDetail(docId);
        setAmountPaid(String(detail.invoice.paid));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "تعذر حذف البند" : "Unable to delete line"));
    }
  };

  const persistLine = async (line: InvoiceLineDraft, options?: LinePayloadOptions) => {
    if (!docId || !line.serverId || status !== "draft") return;
    const payloadOpts: LinePayloadOptions =
      options ??
      (line.priceSource === "manual_override"
        ? { manualPriceOverride: true, priceOverrideReason: line.priceOverrideReason }
        : {});
    await updateDraftLine("purchase", docId, line.serverId, line, payloadOpts);
  };

  const updateLine = (next: InvoiceLineDraft, options?: { skipQuantityRecalc?: boolean; kgOverride?: boolean }) => {
    const prod = products.find((p) => p.id === next.productId);
    let merged = next;
    if (options?.kgOverride) {
      merged = { ...next, kgOverride: true };
    }
    if (!options?.skipQuantityRecalc && !merged.kgOverride && !isKgPrimaryProduct(prod)) {
      merged = recalcLineFromProduct(merged, prod);
    }
    const withTotals = applyLineTotals(merged);
    setLines((prev) => prev.map((l) => (l.id === withTotals.id ? withTotals : l)));
    void persistLine(withTotals);
  };

  const handleVatToggle = (enabled: boolean) => {
    setVatEnabled(enabled);
    if (status !== "draft") return;
    const nextRate = enabled ? DEFAULT_VAT_RATE : 0;
    setLines((prev) =>
      prev.map((line) => {
        const updated = applyLineTotals({ ...line, vatRate: nextRate });
        if (line.serverId && docId) void updateDraftLine("purchase", docId, line.serverId, updated);
        return updated;
      }),
    );
  };

  const handleApprove = async (reason: string) => {
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      const id = await ensureDraft();
      await saveHeader(id);
      for (const line of lines) {
        const prod = products.find((p) => p.id === line.productId);
        if (isKgPrimaryProduct(prod) && line.kg <= 0) {
          throw new ApiError(
            isRTL ? `أدخل الكمية بالكيلو لـ ${line.productName}` : `Enter KG for ${line.productName}`,
            { status: 400 },
          );
        }
        const synced = applyLineTotals({ ...line, vatRate: lineVatRate });
        if (line.serverId) await updateDraftLine("purchase", id, line.serverId, synced);
      }
      const approved = await approvePurchase(id, reason);
      setStatus(approved.status);
      setAmountPaid(String(approved.paid));
      setVatEnabled(approved.vat > 0);
      setShowApprove(false);
      notifyTenantDataChanged("purchases", "inventory", "products", "suppliers");
      onApproved?.();
      if (invoiceId) await loadDoc();
      toast.success(isRTL ? "تم الاعتماد" : "Approved");
    } catch (e) {
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && ApiError.isForbidden(error)) return <PermissionDeniedState lang={lang} />;
  if (loadingDoc || loadingSuppliers || loadingProducts) return <LoadingState lang={lang} />;
  if (notFound) {
    return (
      <div className="p-3 lg:p-6 max-w-screen-xl mx-auto">
        <NotFoundState
          lang={lang}
          messageAr="فاتورة الشراء غير موجودة أو تم حذفها"
          messageEn="Purchase invoice was not found"
          backLabelAr="رجوع إلى المشتريات"
          backLabelEn="Back to Purchases"
          onBack={() => onNavigate("purchases-list")}
        />
      </div>
    );
  }
  if (error && !docId && invoiceId) return <ErrorState lang={lang} error={error} onRetry={() => void loadDoc()} />;

  const isDraft = status === "draft";
  const activeCashboxes = moneyAccounts.filter((a) => a.isActive && a.accountType === "cashbox");
  const activeBanks = moneyAccounts.filter((a) => a.isActive && a.accountType === "bank");
  const eligibleAccounts =
    paymentMethod === "cash"
      ? activeCashboxes
      : paymentMethod === "bank_transfer"
        ? activeBanks
        : paymentMethod === "partial"
          ? [...activeCashboxes, ...activeBanks]
          : [];

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto space-y-4 pb-24">
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={() => onNavigate("purchases-list")} className="px-3 py-2 rounded-xl border text-sm font-bold">
          {isRTL ? "رجوع" : "Back"}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59] flex-1">
          {invoiceId ? (isRTL ? "فاتورة شراء" : "Purchase Invoice") : isRTL ? "فاتورة شراء جديدة" : "New Purchase"}
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
      <div className="flex flex-wrap gap-3 items-center">
        {docId && onOpenPrint && (
          <button
            type="button"
            onClick={onOpenPrint}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#0F2C59]/30 text-[#0F2C59] text-sm font-bold"
          >
            <Printer size={15} />
            {isRTL ? "طباعة / حفظ PDF" : "Print / Save PDF"}
          </button>
        )}
      </div>
      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <select value={supplierId} disabled={!isDraft} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
                <option value="">{isRTL ? "— المورد —" : "— Supplier —"}</option>
                {supplierId && !suppliers.some((s) => s.id === supplierId) && (
                  <option value={supplierId}>{supplierNameSnapshot || (isRTL ? "المورد الحالي" : "Current supplier")}</option>
                )}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void reloadSuppliers()}
                title={isRTL ? "تحديث الموردين" : "Refresh suppliers"}
                aria-label={isRTL ? "تحديث الموردين" : "Refresh suppliers"}
                className="p-2 rounded-xl border text-slate-500 hover:bg-slate-50 shrink-0"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {!loadingSuppliers && suppliers.length === 0 && (
              <p className="text-xs font-bold text-amber-600">{isRTL ? "لا يوجد موردين متاحين" : "No suppliers available"}</p>
            )}
            <input
              value={supplierInvNo}
              disabled={!isDraft}
              onChange={(e) => setSupplierInvNo(e.target.value)}
              placeholder={isRTL ? "رقم فاتورة المورد" : "Supplier Invoice No."}
              aria-label={isRTL ? "رقم فاتورة المورد" : "Supplier Invoice No."}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
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
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="p-2 text-start">{isRTL ? "المنتج" : "Product"}</th>
                  <th className="p-2">{isRTL ? "نوع السطر" : "Line type"}</th>
                  <th className="p-2">{isRTL ? "كراتين" : "Cartons"}</th>
                  <th className="p-2">{isRTL ? "مقطعات" : "Pieces"}</th>
                  <th className="p-2">{isRTL ? "الكمية بالكيلو" : "Quantity KG"}</th>
                  <th className="p-2">{isRTL ? "السعر لكل كيلو" : "Price per KG"}</th>
                  <th className="p-2">{isRTL ? "الإجمالي" : "Total"}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const prod = products.find((p) => p.id === line.productId);
                  const kgPrimary = isKgPrimaryProduct(prod);
                  const cartonBased = isCartonBasedProduct(prod);
                  return (
                  <tr key={line.id} className="border-b">
                    <td className="p-2 font-semibold">{line.productName}</td>
                    <td className="p-2 text-xs text-slate-500">
                      {kgPrimary
                        ? isRTL ? "مقطعات" : "Cuts"
                        : isRTL ? "كراتين" : "Cartons"}
                    </td>
                    <td className="p-2">
                      {kgPrimary ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          disabled={!isDraft}
                          className="w-16 border rounded px-1"
                          value={line.cartons}
                          onChange={(e) => updateLine({ ...line, cartons: Number(e.target.value) })}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {kgPrimary ? (
                        <input
                          type="number"
                          min={0}
                          disabled={!isDraft}
                          className="w-16 border rounded px-1"
                          value={line.pieces}
                          onChange={(e) =>
                            updateLine({ ...line, pieces: Number(e.target.value) }, { skipQuantityRecalc: true })
                          }
                        />
                      ) : (
                        <span className="font-mono text-xs">{line.pieces || "—"}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        disabled={!isDraft}
                        readOnly={cartonBased && !line.kgOverride}
                        className="w-24 border rounded px-1"
                        value={line.kg}
                        onChange={(e) =>
                          updateLine({ ...line, kg: Number(e.target.value) }, { kgOverride: true })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <PurchaseLinePriceCell
                        lang={lang}
                        supplierId={supplierId}
                        line={line}
                        isDraft={isDraft}
                        canEditPrice={canEditPrice}
                        onPriceChange={updateLine}
                      />
                    </td>
                    <td className="p-2 font-mono font-bold">{line.lineSubtotal.toFixed(2)}</td>
                    <td className="p-2">{isDraft && canDeleteLine && <button type="button" onClick={() => void removeLine(line)}><Trash2 size={14} className="text-red-500" /></button>}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {lines.length === 0 && <EmptyState lang={lang} messageAr="أضف بنود الشراء" messageEn="Add purchase lines" compact />}
            {isDraft && (
              <select className="m-3 rounded-xl border px-2 py-2 text-sm" defaultValue="" onChange={(e) => { if (e.target.value) void addLine(e.target.value); e.target.value = ""; }}>
                <option value="">{isRTL ? "+ منتج" : "+ Product"}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
              </select>
            )}
          </div>
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-black text-[#0F2C59] text-sm">
              {isRTL ? "خصومات مرتبطة بالفاتورة" : "Invoice Deductions"}
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "المسلخ" : "Slaughterhouse"}</label>
                <select
                  value={slaughterhouseSupplierId}
                  disabled={!isDraft}
                  onChange={(e) => setSlaughterhouseSupplierId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">{isRTL ? "— اختر المسلخ —" : "— Select slaughterhouse —"}</option>
                  {slaughterSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "خصم المسلخ" : "Slaughterhouse Deduction"}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!isDraft}
                  value={slaughterDeduction}
                  onChange={(e) => setSlaughterDeduction(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "النقل / السائق" : "Transport / Driver"}</label>
                <select
                  value={transportSupplierId}
                  disabled={!isDraft}
                  onChange={(e) => setTransportSupplierId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">{isRTL ? "— اختر النقل —" : "— Select transport —"}</option>
                  {transportSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "خصم النقل" : "Transport Deduction"}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!isDraft}
                  value={transportDeduction}
                  onChange={(e) => setTransportDeduction(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <textarea
              value={deductionNotes}
              disabled={!isDraft}
              onChange={(e) => setDeductionNotes(e.target.value)}
              rows={2}
              placeholder={isRTL ? "ملاحظات الخصومات (اختياري)" : "Deduction notes (optional)"}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 space-y-2 text-sm">
          <div className="flex justify-between font-bold">
            <span>{isRTL ? "المجموع" : "Subtotal"}</span>
            <span className="font-mono">AED {totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-100 pt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-600">
                {vatEnabled
                  ? isRTL ? "ضريبة القيمة المضافة 5%" : "VAT 5%"
                  : isRTL ? "بدون ضريبة" : "No VAT"}
              </span>
              {isDraft && (
                <button
                  type="button"
                  aria-label={isRTL ? "تبديل الضريبة" : "Toggle VAT"}
                  onClick={() => handleVatToggle(!vatEnabled)}
                  className={`w-10 h-[22px] rounded-full flex items-center transition-all ${vatEnabled ? "bg-[#0F2C59]" : "bg-slate-300"}`}
                >
                  <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${vatEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              )}
            </div>
            <div className="flex justify-between font-bold">
              <span>{isRTL ? "ض.ق.م" : "VAT"}</span>
              <span className="font-mono">AED {totals.vat.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between font-bold text-slate-700">
            <span>{isRTL ? "إجمالي الفاتورة" : "Gross Total"}</span>
            <span className="font-mono">AED {totals.gross.toFixed(2)}</span>
          </div>
          {(totals.slaughter > 0 || slaughterDeduction !== "0") && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>{isRTL ? "خصم المسلخ" : "Slaughterhouse Deduction"}</span>
              <span className="font-mono">- AED {totals.slaughter.toFixed(2)}</span>
            </div>
          )}
          {(totals.transport > 0 || transportDeduction !== "0") && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>{isRTL ? "خصم النقل" : "Transport Deduction"}</span>
              <span className="font-mono">- AED {totals.transport.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[#0F2C59] pt-1 border-t">
            <span>{isRTL ? "صافي المستحق للمورد" : "Net Supplier Payable"}</span>
            <span className="font-mono">AED {totals.total.toFixed(2)}</span>
          </div>
          <select value={paymentMethod} disabled={!isDraft} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-xl px-2 py-2 text-sm">
            <option value="cash">{isRTL ? "طريقة الدفع: كاش" : "Payment method: Cash"}</option>
            <option value="bank_transfer">{isRTL ? "طريقة الدفع: بنك" : "Payment method: Bank"}</option>
            <option value="credit">{isRTL ? "طريقة الدفع: آجل" : "Payment method: Credit"}</option>
            <option value="partial">{isRTL ? "طريقة الدفع: جزئي" : "Payment method: Partial"}</option>
          </select>
          {(paymentMethod === "cash" || paymentMethod === "bank_transfer" || paymentMethod === "partial") && (
            <select value={moneyAccountId} disabled={!isDraft} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full border rounded-xl px-2 py-2 text-sm">
              <option value="">{isRTL ? "الخزنة / الحساب البنكي" : "Cashbox / Bank account"}</option>
              {eligibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currentBalance.toFixed(2)} {acc.currency})
                </option>
              ))}
            </select>
          )}
          <input value={amountPaid} disabled={!isDraft} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border rounded-xl px-2 py-2 font-mono" placeholder={isRTL ? "المدفوع" : "Paid"} />
          <div className="text-xs text-slate-500">
            {isRTL ? "المتبقي على المورد" : "Remaining payable"}:{" "}
            <span className="font-mono">{totals.balance.toFixed(2)}</span>
          </div>
          {isDraft && (
            <button type="button" disabled={saving || !supplierId} onClick={() => void handleSaveDraft()} className="w-full py-2 rounded-xl border border-[#0F2C59]/30 text-[#0F2C59] font-bold disabled:opacity-50">
              {isRTL ? "حفظ مسودة" : "Save draft"}
            </button>
          )}
          {isDraft && canApprove && (
            <button type="button" disabled={saving || !lines.length} onClick={() => setShowApprove(true)} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2">
              <Check size={16} />{isRTL ? "اعتماد" : "Approve"}
            </button>
          )}
          {canApprove && docId && status !== "cancelled" && (
            <button type="button" onClick={() => setShowCancel(true)} className="w-full py-2 border border-red-200 text-red-600 rounded-xl font-bold">{isRTL ? "إلغاء" : "Cancel"}</button>
          )}
        </div>
      </div>
      {showApprove && <ReasonModal lang={lang} titleAr="اعتماد الشراء" titleEn="Approve purchase" confirmLabelAr="اعتماد" confirmLabelEn="Approve" loading={saving} onClose={() => setShowApprove(false)} onConfirm={(r) => void handleApprove(r)} />}
      {showCancel && <ReasonModal lang={lang} titleAr="إلغاء الشراء" titleEn="Cancel purchase" confirmLabelAr="إلغاء" confirmLabelEn="Cancel" loading={saving} onClose={() => setShowCancel(false)} onConfirm={async (r) => { if (!docId) return; setSaving(true); try { await cancelPurchase(docId, r); setStatus("cancelled"); toast.success(isRTL ? "تم إلغاء الفاتورة بنجاح" : "Invoice cancelled successfully"); setShowCancel(false); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }} />}
    </div>
  );
}
