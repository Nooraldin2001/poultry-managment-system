import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, Printer } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantScreen } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { useSuppliers, useProducts } from "@/hooks/api/useTenantResources";
import { getPurchaseDetail, approvePurchase, cancelPurchase } from "@/services/purchaseService";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import type { InvoiceLineDraft } from "./types";
import { addDraftLine, createDraftHeader, patchDraftHeader, removeDraftLine, updateDraftLine } from "./invoiceApi";
import { ReasonModal } from "./ReasonModal";
import { parseAmount } from "@/services/crud/parse";

type Props = {
  lang: Lang;
  role: TenantRole;
  onNavigate: (s: TenantScreen) => void;
  invoiceId?: string | null;
  onSaved?: (id: string) => void;
  onOpenPrint?: () => void;
};

export function LivePurchaseInvoiceScreen({ lang, role, onNavigate, invoiceId, onSaved, onOpenPrint }: Props) {
  const isRTL = lang === "ar";
  const canApprove = role === "owner" || role === "accountant";
  const [docId, setDocId] = useState(invoiceId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [status, setStatus] = useState("draft");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(!!invoiceId && !IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const { items: suppliers, loading: loadingSuppliers } = useSuppliers();
  const { items: products, loading: loadingProducts } = useProducts();

  const loadDoc = useCallback(async () => {
    if (!invoiceId || IS_MOCK_MODE) return;
    setLoadingDoc(true);
    try {
      const detail = await getPurchaseDetail(invoiceId);
      if (!detail) throw new ApiError("Not found", { status: 404 });
      setDocId(detail.invoice.id);
      setSupplierId(detail.invoice.supplierId);
      setInvoiceNumber(detail.invoice.number);
      setStatus(detail.invoice.status);
      setAmountPaid(String(detail.invoice.paid));
      setLines(
        detail.lines.map((l) => ({
          id: l.id,
          serverId: l.id,
          productId: l.productId,
          productName: l.productName,
          cartons: 0,
          pieces: l.qty,
          kg: l.qty,
          unitPrice: l.price,
          priceType: "piece",
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
    if (!supplierId) throw new ApiError(isRTL ? "اختر المورد" : "Select supplier", { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    const created = await createDraftHeader("purchase", {
      supplier: Number(supplierId),
      invoice_date: today,
      supplier_invoice_number: supplierInvNo,
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

  const handleSaveDraft = async () => {
    if (!supplierId) {
      toast.error(isRTL ? "اختر المورد أولاً" : "Select a supplier first");
      return;
    }
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      const id = await ensureDraft();
      await patchDraftHeader("purchase", id, {
        supplier: Number(supplierId),
        supplier_invoice_number: supplierInvNo,
        payment_method: paymentMethod,
        amount_paid: amountPaid || "0",
        notes,
      });
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
      const draft: InvoiceLineDraft = {
        id: `tmp-${Date.now()}`,
        productId,
        productName: prod.nameAr,
        cartons: 1,
        pieces: prod.ppc || 0,
        kg: prod.g ? (prod.ppc * prod.g) / 1000 : 0,
        unitPrice: prod.buyP || prod.saleP,
        priceType: "piece",
        vatRate: 5,
        lineSubtotal: 0,
        lineTotal: 0,
      };
      draft.lineSubtotal = draft.pieces * draft.unitPrice;
      draft.lineTotal = draft.lineSubtotal;
      const serverId = await addDraftLine("purchase", id, draft);
      setLines((prev) => [...prev, { ...draft, serverId }]);
      await patchDraftHeader("purchase", id, { supplier_invoice_number: supplierInvNo });
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (line: InvoiceLineDraft) => {
    if (line.serverId && docId) await removeDraftLine("purchase", docId, line.serverId);
    setLines((prev) => prev.filter((l) => l.id !== line.id));
  };

  const persistLine = async (line: InvoiceLineDraft) => {
    if (!docId || !line.serverId || status !== "draft") return;
    await updateDraftLine("purchase", docId, line.serverId, line);
  };

  if (!IS_MOCK_MODE && ApiError.isForbidden(error)) return <PermissionDeniedState lang={lang} />;
  if (loadingDoc || loadingSuppliers || loadingProducts) return <LoadingState lang={lang} />;
  if (error && !docId && invoiceId) return <ErrorState lang={lang} error={error} onRetry={() => void loadDoc()} />;

  const isDraft = status === "draft";

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto space-y-4 pb-24">
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={() => onNavigate("purchases-list")} className="px-3 py-2 rounded-xl border text-sm font-bold">
          {isRTL ? "رجوع" : "Back"}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59] flex-1">
          {invoiceId ? (isRTL ? "فاتورة شراء" : "Purchase Invoice") : isRTL ? "فاتورة شراء جديدة" : "New Purchase"}
        </h2>
        {invoiceNumber && <span className="font-mono text-sm">{invoiceNumber}</span>}
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
            <select value={supplierId} disabled={!isDraft} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
              <option value="">{isRTL ? "— المورد —" : "— Supplier —"}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input value={supplierInvNo} disabled={!isDraft} onChange={(e) => setSupplierInvNo(e.target.value)} placeholder={isRTL ? "رقم فاتورة المورد" : "Supplier invoice #"} className="w-full rounded-xl border px-3 py-2 text-sm" />
          </div>
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="bg-slate-50 border-b"><th className="p-2">{isRTL ? "المنتج" : "Product"}</th><th className="p-2">KG</th><th className="p-2">{isRTL ? "السعر" : "Price"}</th><th className="p-2" /></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="p-2 font-semibold">{line.productName}</td>
                    <td className="p-2"><input type="number" disabled={!isDraft} className="w-20 border rounded px-1" value={line.kg} onChange={(e) => { const kg = Number(e.target.value); const next = { ...line, kg, lineSubtotal: kg * line.unitPrice, lineTotal: kg * line.unitPrice }; setLines((p) => p.map((l) => l.id === line.id ? next : l)); void persistLine(next); }} /></td>
                    <td className="p-2 font-mono">{line.unitPrice.toFixed(2)}</td>
                    <td className="p-2">{isDraft && <button type="button" onClick={() => void removeLine(line)}><Trash2 size={14} className="text-red-500" /></button>}</td>
                  </tr>
                ))}
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
        </div>
        <div className="bg-white rounded-2xl border p-4 space-y-2 text-sm">
          <div className="flex justify-between font-black"><span>{isRTL ? "الإجمالي" : "Total"}</span><span className="font-mono">AED {totals.total.toFixed(2)}</span></div>
          <input value={amountPaid} disabled={!isDraft} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border rounded-xl px-2 py-2 font-mono" placeholder={isRTL ? "المدفوع" : "Paid"} />
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
      {showApprove && <ReasonModal lang={lang} titleAr="اعتماد الشراء" titleEn="Approve purchase" confirmLabelAr="اعتماد" confirmLabelEn="Approve" loading={saving} onClose={() => setShowApprove(false)} onConfirm={async (r) => { if (!docId) return; setSaving(true); try { await approvePurchase(docId, r); setStatus("approved"); toast.success(isRTL ? "تم الاعتماد" : "Approved"); setShowApprove(false); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }} />}
      {showCancel && <ReasonModal lang={lang} titleAr="إلغاء الشراء" titleEn="Cancel purchase" confirmLabelAr="إلغاء" confirmLabelEn="Cancel" loading={saving} onClose={() => setShowCancel(false)} onConfirm={async (r) => { if (!docId) return; setSaving(true); try { await cancelPurchase(docId, r); setStatus("cancelled"); toast.success(isRTL ? "تم الإلغاء" : "Cancelled"); setShowCancel(false); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }} />}
    </div>
  );
}
