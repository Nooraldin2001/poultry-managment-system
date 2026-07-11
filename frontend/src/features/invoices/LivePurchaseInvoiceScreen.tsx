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
import { addDraftLine, createDraftHeader, patchDraftHeader, removeDraftLine, syncLineFromApi, updateDraftLine } from "./invoiceApi";
import { applyLineTotals } from "./lineTotals";
import { deriveQuantitiesFromCartons } from "./lineQuantities";
import {
  defaultLineQuantitiesForProduct,
  isCartonBasedProduct,
  isKgPrimaryProduct,
} from "./productLineMode";
import { defaultLinePriceType, parsePriceType, priceColumnLabel } from "./priceTypeUtils";
import { LinePriceTypeSelect } from "./LinePriceTypeSelect";
import { PurchaseLinePriceCell } from "./PurchaseLinePriceCell";
import { canDeletePurchaseLine, canOverridePurchasePrice, canBackdatePurchaseInvoice } from "@/shared/utils/permissions";
import { notifyTenantDataChanged, subscribeTenantRefresh } from "@/shared/utils/tenantRefresh";
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

type ServiceChargeMode = "add" | "deduct";

type Props = {
  lang: Lang;
  role: TenantRole;
  permissions?: string[];
  onNavigate: (s: TenantScreen) => void;
  invoiceId?: string | null;
  initialSupplierId?: string;
  onSaved?: (id: string) => void;
  onApproved?: () => void;
  onOpenPrint?: () => void;
};

const DEFAULT_VAT_RATE = 5;

export function LivePurchaseInvoiceScreen({ lang, role, permissions = [], onNavigate, invoiceId, initialSupplierId, onSaved, onApproved, onOpenPrint }: Props) {
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
  const [partialSource, setPartialSource] = useState<"cashbox" | "bank" | "">("");
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
  const [slaughterAmount, setSlaughterAmount] = useState("0");
  const [slaughterMode, setSlaughterMode] = useState<ServiceChargeMode>("deduct");
  const [transportSupplierId, setTransportSupplierId] = useState("");
  const [transportAmount, setTransportAmount] = useState("0");
  const [transportMode, setTransportMode] = useState<ServiceChargeMode>("deduct");
  const [serviceNotes, setServiceNotes] = useState("");
  const [loadingServiceSuppliers, setLoadingServiceSuppliers] = useState(!IS_MOCK_MODE);

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
    setPartialSource("");
    setMoneyAccountId("");
    setAmountPaid("0");
    setNotes("");
    setVatEnabled(false);
    setInvoiceDate(todayIso());
    setBackdateReason("");
    setSlaughterhouseSupplierId("");
    setSlaughterAmount("0");
    setSlaughterMode("deduct");
    setTransportSupplierId("");
    setTransportAmount("0");
    setTransportMode("deduct");
    setServiceNotes("");
    setError(null);
    setFieldErrors({});
    setNotFound(false);
  }, []);

  const mapDetailLines = (detail: Awaited<ReturnType<typeof getPurchaseDetail>>): InvoiceLineDraft[] =>
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
      vatRate: l.vatRate ?? (detail.invoice.vat > 0 ? DEFAULT_VAT_RATE : 0),
      lineSubtotal: l.subtotal ?? l.total,
      lineTotal: l.total,
    }));

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
      setSlaughterAmount(String(detail.invoice.slaughterhouseAmount ?? detail.invoice.slaughterhouseDeduction ?? 0));
      setSlaughterMode(detail.invoice.slaughterhouseMode ?? "deduct");
      setTransportSupplierId(detail.invoice.transportSupplierId ?? "");
      setTransportAmount(String(detail.invoice.transportAmount ?? detail.invoice.transportDeduction ?? 0));
      setTransportMode(detail.invoice.transportMode ?? "deduct");
      setServiceNotes(detail.invoice.serviceNotes ?? detail.invoice.deductionNotes ?? "");
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
      if (initialSupplierId && !IS_MOCK_MODE) {
        setSupplierId(initialSupplierId);
      }
      setLoadingDoc(false);
      return;
    }
    void loadDoc();
  }, [invoiceId, initialSupplierId, loadDoc, resetDraft]);

  const reloadServiceSuppliers = useCallback(() => {
    if (IS_MOCK_MODE) return;
    setLoadingServiceSuppliers(true);
    Promise.all([listSlaughterhouseSuppliers(), listTransportSuppliers()])
      .then(([slaughter, transport]) => {
        setSlaughterSuppliers(slaughter);
        setTransportSuppliers(transport);
      })
      .catch(() => {
        setSlaughterSuppliers([]);
        setTransportSuppliers([]);
      })
      .finally(() => setLoadingServiceSuppliers(false));
  }, []);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    reloadServiceSuppliers();
    const unsub = subscribeTenantRefresh(["suppliers"], reloadServiceSuppliers);
    const onFocus = () => reloadServiceSuppliers();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [reloadServiceSuppliers]);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    void listMoneyAccounts()
      .then(setMoneyAccounts)
      .catch(() => setMoneyAccounts([]));
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
    const slaughter = parseAmount(slaughterAmount || "0");
    const transport = parseAmount(transportAmount || "0");
    const slaughterAdd = slaughterMode === "add" ? slaughter : 0;
    const slaughterDeduct = slaughterMode === "deduct" ? slaughter : 0;
    const transportAdd = transportMode === "add" ? transport : 0;
    const transportDeduct = transportMode === "deduct" ? transport : 0;
    const serviceAdditions = slaughterAdd + transportAdd;
    const serviceDeductions = slaughterDeduct + transportDeduct;
    const finalTotal = gross + serviceAdditions;
    const netPoultry = Math.max(0, gross - serviceDeductions);
    const paid = parseAmount(amountPaid);
    return {
      subtotal,
      vat,
      gross,
      slaughter,
      transport,
      slaughterAdd,
      transportAdd,
      serviceAdditions,
      serviceDeductions,
      finalTotal,
      total: netPoultry,
      paid,
      balance: Math.max(0, netPoultry - paid),
    };
  }, [lines, vatEnabled, amountPaid, slaughterAmount, transportAmount, slaughterMode, transportMode]);

  const servicePayload = (): Record<string, unknown> => ({
    slaughterhouse_supplier: slaughterhouseSupplierId ? Number(slaughterhouseSupplierId) : null,
    slaughterhouse_amount: slaughterAmount || "0",
    slaughterhouse_mode: slaughterMode,
    transport_supplier: transportSupplierId ? Number(transportSupplierId) : null,
    transport_amount: transportAmount || "0",
    transport_mode: transportMode,
    service_notes: serviceNotes,
  });

  const lineVatRate = vatEnabled ? DEFAULT_VAT_RATE : 0;

  const headerDatePayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = { invoice_date: invoiceDate };
    if (isBackdatedDate(invoiceDate) && canBackdate) {
      payload.backdate_reason = backdateReason.trim();
    }
    return payload;
  };

  const validatePurchaseHeader = (): boolean => {
    if (!supplierId) {
      toast.error(isRTL ? "اختر المورد أولاً" : "Select a supplier first");
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
      toast.error(isRTL ? "المبلغ المدفوع لا يمكن أن يتجاوز صافي المستحق للمورد" : "Paid amount cannot exceed net supplier payable");
      return false;
    }
    const slaughter = parseAmount(slaughterAmount || "0");
    const transport = parseAmount(transportAmount || "0");
    if (slaughter > 0 && !slaughterhouseSupplierId) {
      toast.error(isRTL ? "اختر المسلخ عند إدخال مبلغ المسلخ" : "Select slaughterhouse when amount is set");
      return false;
    }
    if (transport > 0 && !transportSupplierId) {
      toast.error(isRTL ? "اختر النقل عند إدخال مبلغ النقل" : "Select transport account when amount is set");
      return false;
    }
    const deductTotal =
      (slaughterMode === "deduct" ? slaughter : 0) + (transportMode === "deduct" ? transport : 0);
    if (deductTotal > totals.gross) {
      toast.error(isRTL ? "مجموع الخصومات يتجاوز إجمالي الدجاج" : "Total deductions exceed gross poultry total");
      return false;
    }
    if (paymentMethod === "cash" && !moneyAccountId) {
      toast.error(isRTL ? "اختر الخزنة" : "Select a cashbox");
      return false;
    }
    if (paymentMethod === "bank_transfer" && !moneyAccountId) {
      toast.error(isRTL ? "اختر الحساب البنكي" : "Select a bank account");
      return false;
    }
    if (paymentMethod === "partial" && paid > 0 && !moneyAccountId) {
      toast.error(
        isRTL ? "اختر مصدر الدفع (خزنة أو حساب بنكي)" : "Select a payment source (cashbox or bank account)",
      );
      return false;
    }
    return true;
  };

  const paymentPayload = (): Record<string, unknown> => {
    const selectedAccount = moneyAccounts.find((a) => a.id === moneyAccountId);
    const resolvedPaymentMethod =
      paymentMethod === "partial"
        ? (selectedAccount?.accountType === "cashbox" ? "cash" : "bank_transfer")
        : paymentMethod;
    // Credit purchases never carry a money account and paid amount is zero.
    if (paymentMethod === "credit") {
      return { payment_method: "credit", money_account: null, amount_paid: "0" };
    }
    return {
      payment_method: resolvedPaymentMethod,
      money_account: moneyAccountId ? Number(moneyAccountId) : null,
      amount_paid: amountPaid || "0",
    };
  };

  const saveHeader = async (id: string) => {
    await patchDraftHeader("purchase", id, {
      supplier: Number(supplierId),
      supplier_invoice_number: supplierInvNo,
      ...headerDatePayload(),
      ...paymentPayload(),
      vat_rate: vatEnabled ? "5.00" : "0.00",
      notes,
      ...servicePayload(),
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
    const created = await createDraftHeader("purchase", {
      supplier: Number(supplierId),
      ...headerDatePayload(),
      supplier_invoice_number: supplierInvNo,
      ...paymentPayload(),
      notes,
      vat_rate: vatEnabled ? "5.00" : "0.00",
      ...servicePayload(),
    });
    setDocId(created.id);
    setInvoiceNumber(created.number ?? "");
    onSaved?.(created.id);
    return created.id;
  };

  const handleSaveDraft = async () => {
    if (!validatePurchaseHeader()) return;
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
        priceType: defaultLinePriceType(prod, "purchase"),
        vatRate: lineVatRate,
        lineSubtotal: 0,
        lineTotal: 0,
        kgOverride: isKgPrimaryProduct(prod),
      };
      const draft = isKgPrimaryProduct(prod) ? draftBase : recalcLineFromProduct(draftBase, prod);
      const finalized = applyLineTotals(draft);
      await addDraftLine("purchase", id, finalized);
      const detail = await getPurchaseDetail(id);
      setAmountPaid(String(detail.invoice.paid));
      setLines(mapDetailLines(detail));
      await patchDraftHeader("purchase", id, { supplier_invoice_number: supplierInvNo });
      toast.success(isRTL ? "تمت إضافة البند" : "Line added");
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(err);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل إضافة البند" : "Failed to add line"));
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
      if (line.serverId && docId) {
        await removeDraftLine("purchase", docId, line.serverId);
        // Backend recalculated totals — reload lines + totals from the server.
        const detail = await getPurchaseDetail(docId);
        setLines(mapDetailLines(detail));
        setAmountPaid(String(detail.invoice.paid));
      } else {
        setLines((prev) => prev.filter((l) => l.id !== line.id));
      }
      toast.success(isRTL ? "تم حذف البند" : "Line deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "تعذر حذف البند" : "Unable to delete line"));
    }
  };

  const persistLine = async (line: InvoiceLineDraft, options?: LinePayloadOptions) => {
    if (!docId || !line.serverId || status !== "draft") return line;
    const payloadOpts: LinePayloadOptions =
      options ??
      (line.priceSource === "manual_override"
        ? { manualPriceOverride: true, priceOverrideReason: line.priceOverrideReason }
        : {});
    const saved = await updateDraftLine("purchase", docId, line.serverId, line, payloadOpts);
    return syncLineFromApi(line, saved);
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
    void persistLine(withTotals).then((synced) => {
      setLines((prev) => prev.map((l) => (l.id === synced.id ? synced : l)));
    });
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
    if (!validatePurchaseHeader()) {
      setSaving(false);
      return;
    }
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/00c03889-4edf-41f7-887a-9f04d03e7a1c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd5244'},body:JSON.stringify({sessionId:'cd5244',location:'LivePurchaseInvoiceScreen.tsx:handleApprove:start',message:'approve flow started',data:{invoiceId:docId,invoiceDate,isBackdated:isBackdatedDate(invoiceDate),vatEnabled,paymentMethod,lines:lines.length},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const id = await ensureDraft();
      await saveHeader(id);
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/00c03889-4edf-41f7-887a-9f04d03e7a1c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd5244'},body:JSON.stringify({sessionId:'cd5244',location:'LivePurchaseInvoiceScreen.tsx:handleApprove:afterSaveHeader',message:'saveHeader ok',data:{id},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/00c03889-4edf-41f7-887a-9f04d03e7a1c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd5244'},body:JSON.stringify({sessionId:'cd5244',location:'LivePurchaseInvoiceScreen.tsx:handleApprove:afterLineSync',message:'line sync ok',data:{id,lineCount:lines.length},hypothesisId:'B',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const approved = await approvePurchase(
        id,
        reason,
        isBackdatedDate(invoiceDate) && backdateReason.trim()
          ? { backdate_reason: backdateReason.trim() }
          : undefined,
      );
      setStatus(approved.status);
      setAmountPaid(String(approved.paid));
      setVatEnabled(approved.vat > 0);
      setShowApprove(false);
      notifyTenantDataChanged("purchases", "inventory", "products", "suppliers");
      onApproved?.();
      if (invoiceId) await loadDoc();
      toast.success(isRTL ? "تم الاعتماد" : "Approved");
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/00c03889-4edf-41f7-887a-9f04d03e7a1c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd5244'},body:JSON.stringify({sessionId:'cd5244',location:'LivePurchaseInvoiceScreen.tsx:handleApprove:error',message:'approve flow failed',data:{errorType:e instanceof ApiError?'ApiError':'unknown',status:e instanceof ApiError?e.status:0,code:e instanceof ApiError?e.code:'',msgPreview:e instanceof ApiError?String(e.message).slice(0,120):String(e).slice(0,120),isHtml:e instanceof ApiError&&typeof e.raw==='string'&&e.raw.includes('<!doctype html>')},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      const fallbackAr = "حدث خطأ في الخادم أثناء اعتماد فاتورة الشراء. برجاء التواصل مع الدعم.";
      const fallbackEn = "Server error while approving purchase invoice. Please contact support.";
      const msg =
        e instanceof ApiError
          ? (e.code === "server_error" || e.status >= 500
            ? (isRTL ? fallbackAr : fallbackEn)
            : e.message)
          : (isRTL ? fallbackAr : "Failed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && ApiError.isForbidden(error)) return <PermissionDeniedState lang={lang} />;
  if (!IS_MOCK_MODE && ApiError.isUnauthorized(error)) {
    return <ErrorState lang={lang} error={error} />;
  }
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
  const accountSourceType: "cashbox" | "bank" | "" =
    paymentMethod === "cash"
      ? "cashbox"
      : paymentMethod === "bank_transfer"
        ? "bank"
        : paymentMethod === "partial"
          ? partialSource
          : "";
  const eligibleAccounts =
    accountSourceType === "cashbox" ? activeCashboxes : accountSourceType === "bank" ? activeBanks : [];

  const accountOptionLabel = (acc: MoneyAccountRow): string => {
    const balance = `${acc.currentBalance.toFixed(2)} ${acc.currency}`;
    if (acc.accountType === "bank") {
      const bankInfo = [acc.bankName, acc.accountNumber].filter(Boolean).join(" ");
      return `${acc.name}${bankInfo ? ` — ${bankInfo}` : ""} (${balance})`;
    }
    return `${acc.name} (${balance})`;
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    setMoneyAccountId("");
    setPartialSource("");
    if (method === "credit") setAmountPaid("0");
  };

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
                        <PurchaseLinePriceCell
                          lang={lang}
                          supplierId={supplierId}
                          line={line}
                          isDraft={isDraft}
                          canEditPrice={canEditPrice}
                          onPriceChange={updateLine}
                        />
                      </div>
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
          <div className="bg-white rounded-2xl border p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-[#0F2C59] text-sm">
                {isRTL ? "خدمات مرتبطة بالفاتورة" : "Invoice-Linked Services"}
              </h3>
              {!IS_MOCK_MODE && (
                <button type="button" onClick={reloadServiceSuppliers} className="p-2 rounded-lg border text-slate-500 hover:bg-slate-50" title={isRTL ? "تحديث القائمة" : "Refresh lists"}>
                  <RefreshCw size={14} className={loadingServiceSuppliers ? "animate-spin" : ""} />
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/80">
                <div className="sm:col-span-2 text-xs font-black text-slate-600">{isRTL ? "المسلخ" : "Slaughterhouse"}</div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "اختر المسلخ" : "Select slaughterhouse"}</label>
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
                  {!loadingServiceSuppliers && slaughterSuppliers.length === 0 && (
                    <p className="text-[11px] font-bold text-amber-600 mt-1">
                      {isRTL ? "لا توجد حسابات مسالخ نشطة." : "No active slaughterhouse accounts."}{" "}
                      <button type="button" className="underline" onClick={() => onNavigate("suppliers-new")}>
                        {isRTL ? "إضافة مورد مسلخ" : "Add slaughterhouse supplier"}
                      </button>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "المبلغ" : "Amount"}</label>
                  <input type="number" min={0} step="0.01" disabled={!isDraft} value={slaughterAmount} onChange={(e) => setSlaughterAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-mono" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "طريقة التطبيق" : "Application mode"}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([["add", isRTL ? "إضافة على الفاتورة" : "Add to invoice"], ["deduct", isRTL ? "خصم من مستحق مورد الدجاج" : "Deduct from poultry supplier"]] as const).map(([mode, label]) => (
                      <button key={mode} type="button" disabled={!isDraft} onClick={() => setSlaughterMode(mode)} className={`py-2 rounded-xl text-xs font-bold border-2 ${slaughterMode === mode ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/80">
                <div className="sm:col-span-2 text-xs font-black text-slate-600">{isRTL ? "النقل / السائق" : "Transport / Driver"}</div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "اختر النقل" : "Select transport"}</label>
                  <select value={transportSupplierId} disabled={!isDraft} onChange={(e) => setTransportSupplierId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
                    <option value="">{isRTL ? "— اختر النقل —" : "— Select transport —"}</option>
                    {transportSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {!loadingServiceSuppliers && transportSuppliers.length === 0 && (
                    <p className="text-[11px] font-bold text-amber-600 mt-1">
                      {isRTL ? "لا توجد حسابات نقل نشطة." : "No active transport accounts."}{" "}
                      <button type="button" className="underline" onClick={() => onNavigate("suppliers-new")}>
                        {isRTL ? "إضافة مورد نقل" : "Add transport supplier"}
                      </button>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "المبلغ" : "Amount"}</label>
                  <input type="number" min={0} step="0.01" disabled={!isDraft} value={transportAmount} onChange={(e) => setTransportAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-mono" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "طريقة التطبيق" : "Application mode"}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([["add", isRTL ? "إضافة على الفاتورة" : "Add to invoice"], ["deduct", isRTL ? "خصم من مستحق مورد الدجاج" : "Deduct from poultry supplier"]] as const).map(([mode, label]) => (
                      <button key={mode} type="button" disabled={!isDraft} onClick={() => setTransportMode(mode)} className={`py-2 rounded-xl text-xs font-bold border-2 ${transportMode === mode ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <textarea value={serviceNotes} disabled={!isDraft} onChange={(e) => setServiceNotes(e.target.value)} rows={2} placeholder={isRTL ? "ملاحظات الخدمات (اختياري)" : "Service notes (optional)"} className="w-full rounded-xl border px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 space-y-2 text-sm">
          <div className="flex justify-between font-bold">
            <span>{isRTL ? "الإجمالي قبل الضريبة" : "Subtotal before VAT"}</span>
            <span className="font-mono">AED {totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>{isRTL ? "ضريبة القيمة المضافة" : "VAT"}</span>
            <span className="font-mono">AED {totals.vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-700 border-t border-slate-100 pt-2">
            <span>{isRTL ? "إجمالي الدجاج" : "Gross Poultry Total"}</span>
            <span className="font-mono">AED {totals.gross.toFixed(2)}</span>
          </div>
          {totals.serviceAdditions > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>{isRTL ? "إضافات المسلخ والنقل" : "Added Service Costs"}</span>
              <span className="font-mono">+ AED {totals.serviceAdditions.toFixed(2)}</span>
            </div>
          )}
          {totals.serviceDeductions > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>{isRTL ? "خصومات من مستحق مورد الدجاج" : "Deductions from Poultry Supplier"}</span>
              <span className="font-mono">- AED {totals.serviceDeductions.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-[#0F2C59]">
            <span>{isRTL ? "إجمالي تكلفة الفاتورة" : "Final Invoice Cost"}</span>
            <span className="font-mono">AED {totals.finalTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-black text-[#0F2C59] pt-1 border-t">
            <span>{isRTL ? "صافي المستحق لمورد الدجاج" : "Net Poultry Supplier Payable"}</span>
            <span className="font-mono">AED {totals.total.toFixed(2)}</span>
          </div>
          {isDraft && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <span className="text-[10px] font-bold text-slate-400">{isRTL ? "تفعيل الضريبة" : "VAT toggle"}</span>
              <button type="button" aria-label={isRTL ? "تبديل الضريبة" : "Toggle VAT"} onClick={() => handleVatToggle(!vatEnabled)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${vatEnabled ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${vatEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          )}
          <select value={paymentMethod} disabled={!isDraft} onChange={(e) => handlePaymentMethodChange(e.target.value)} className="w-full border rounded-xl px-2 py-2 text-sm">
            <option value="cash">{isRTL ? "طريقة الدفع: كاش" : "Payment method: Cash"}</option>
            <option value="bank_transfer">{isRTL ? "طريقة الدفع: بنك" : "Payment method: Bank"}</option>
            <option value="credit">{isRTL ? "طريقة الدفع: آجل" : "Payment method: Credit"}</option>
            <option value="partial">{isRTL ? "طريقة الدفع: جزئي" : "Payment method: Partial"}</option>
          </select>
          {paymentMethod === "partial" && (
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                {isRTL ? "مصدر الدفع" : "Payment source"}
              </label>
              <select
                value={partialSource}
                disabled={!isDraft}
                onChange={(e) => {
                  setPartialSource(e.target.value as "cashbox" | "bank" | "");
                  setMoneyAccountId("");
                }}
                className="w-full border rounded-xl px-2 py-2 text-sm"
              >
                <option value="">{isRTL ? "— اختر المصدر —" : "— Select source —"}</option>
                <option value="cashbox">{isRTL ? "الخزنة" : "Cashbox"}</option>
                <option value="bank">{isRTL ? "الحساب البنكي" : "Bank Account"}</option>
              </select>
            </div>
          )}
          {accountSourceType === "cashbox" && (
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                {isRTL ? "الخزنة" : "Cashbox"}
              </label>
              {activeCashboxes.length === 0 ? (
                <p className="text-xs font-bold text-amber-600">
                  {isRTL ? "لا توجد خزنة نشطة" : "No active cashbox found"}
                </p>
              ) : (
                <select value={moneyAccountId} disabled={!isDraft} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full border rounded-xl px-2 py-2 text-sm">
                  <option value="">{isRTL ? "— اختر الخزنة —" : "— Select cashbox —"}</option>
                  {eligibleAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{accountOptionLabel(acc)}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {accountSourceType === "bank" && (
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                {isRTL ? "الحساب البنكي" : "Bank Account"}
              </label>
              {activeBanks.length === 0 ? (
                <p className="text-xs font-bold text-amber-600">
                  {isRTL ? "لا توجد حسابات بنكية نشطة" : "No active bank account found"}
                </p>
              ) : (
                <select value={moneyAccountId} disabled={!isDraft} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full border rounded-xl px-2 py-2 text-sm">
                  <option value="">{isRTL ? "— اختر الحساب البنكي —" : "— Select bank account —"}</option>
                  {eligibleAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{accountOptionLabel(acc)}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {paymentMethod !== "credit" && (
            <input value={amountPaid} disabled={!isDraft} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border rounded-xl px-2 py-2 font-mono" placeholder={isRTL ? "المدفوع" : "Paid"} />
          )}
          {paymentMethod === "credit" && (
            <p className="text-xs text-slate-500">
              {isRTL
                ? "شراء آجل — يُسجّل المبلغ كاملاً على رصيد المورد"
                : "Credit purchase — the full amount goes to the supplier balance"}
            </p>
          )}
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
