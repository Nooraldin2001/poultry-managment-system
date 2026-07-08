import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, Send, FileCheck } from "lucide-react";
import type { Lang } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import type { TenantScreen } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { useCustomers, useProducts } from "@/hooks/api/useTenantResources";
import {
  getQuotationDetail,
  sendQuotation,
  acceptQuotation,
  rejectQuotation,
  cancelQuotation,
  convertQuotationToSales,
} from "@/services/quotationService";
import { request } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import type { InvoiceLineDraft } from "./types";
import { addDraftLine, createDraftHeader, patchDraftHeader, removeDraftLine, updateDraftLine } from "./invoiceApi";
import { ReasonModal } from "./ReasonModal";
import { parseAmount } from "@/services/crud/parse";
import { canDeleteQuotationLine } from "@/shared/utils/permissions";

type Props = {
  lang: Lang;
  role: TenantRole;
  permissions?: string[];
  onNavigate: (s: TenantScreen) => void;
  quotationId?: string | null;
  onSaved?: (id: string) => void;
  onConvertedToSales?: (salesId: string) => void;
};

export function LiveQuotationScreen({ lang, role, permissions = [], onNavigate, quotationId, onSaved, onConvertedToSales }: Props) {
  const isRTL = lang === "ar";
  const canManage = role === "owner" || role === "accountant";
  const canDeleteLine = canDeleteQuotationLine(role, permissions);
  const [docId, setDocId] = useState(quotationId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [status, setStatus] = useState("draft");
  const [quotNumber, setQuotNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(!!quotationId && !IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const { items: customers, loading: loadingCustomers } = useCustomers();
  const { items: products, loading: loadingProducts } = useProducts();

  const loadDoc = useCallback(async () => {
    if (!quotationId || IS_MOCK_MODE) return;
    setLoadingDoc(true);
    try {
      const detail = await getQuotationDetail(quotationId);
      if (!detail) throw new ApiError("Not found", { status: 404 });
      setDocId(detail.quotation.id);
      setCustomerId(detail.quotation.customerId);
      setQuotNumber(detail.quotation.number);
      setStatus(detail.quotation.status);
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
          priceType: (l.unit as "kg") || "kg",
          vatRate: 5,
          lineSubtotal: l.total,
          lineTotal: l.total,
        })),
      );
      try {
        const warn = await request(`${ENDPOINTS.tenant.quotation(quotationId)}stock-warning/`);
        const issues = (warn as { warnings?: string[] }).warnings;
        setStockWarning(issues?.length ? issues.join("; ") : null);
      } catch {
        setStockWarning(null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoadingDoc(false);
    }
  }, [quotationId]);

  useEffect(() => {
    void loadDoc();
  }, [loadDoc]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const vat = Math.round(subtotal * 5) / 100;
    return { subtotal, vat, total: subtotal + vat };
  }, [lines]);

  const ensureDraft = async (): Promise<string> => {
    if (docId) return docId;
    if (!customerId) throw new ApiError(isRTL ? "اختر العميل" : "Select customer", { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    const created = await createDraftHeader("quotation", {
      customer: Number(customerId),
      quotation_date: today,
      notes,
    });
    setDocId(created.id);
    setQuotNumber(created.number ?? "");
    onSaved?.(created.id);
    return created.id;
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
        unitPrice: prod.saleP,
        priceType: prod.salePT,
        vatRate: 5,
        lineSubtotal: 0,
        lineTotal: 0,
      };
      draft.lineSubtotal = draft.kg * draft.unitPrice;
      draft.lineTotal = draft.lineSubtotal;
      try {
        const preview = await request(ENDPOINTS.tenant.quotationsPricePreview, {
          method: "POST",
          body: { customer: Number(customerId), product: Number(productId), price_type: draft.priceType },
        });
        const price = parseAmount((preview as { unit_price?: string }).unit_price);
        if (price > 0) {
          draft.unitPrice = price;
          draft.lineSubtotal = draft.kg * price;
          draft.lineTotal = draft.lineSubtotal;
        }
      } catch {
        /* default price */
      }
      const serverId = await addDraftLine("quotation", id, draft);
      setLines((prev) => [...prev, { ...draft, serverId }]);
      await patchDraftHeader("quotation", id, { notes });
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
      if (line.serverId && docId) await removeDraftLine("quotation", docId, line.serverId);
      setLines((prev) => prev.filter((l) => l.id !== line.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "تعذر حذف البند" : "Unable to delete line"));
    }
  };

  const persistLine = async (line: InvoiceLineDraft) => {
    if (!docId || !line.serverId || status !== "draft") return;
    await updateDraftLine("quotation", docId, line.serverId, line);
  };

  if (!IS_MOCK_MODE && ApiError.isForbidden(error)) return <PermissionDeniedState lang={lang} />;
  if (loadingDoc || loadingCustomers || loadingProducts) return <LoadingState lang={lang} />;
  if (error && !docId && quotationId) return <ErrorState lang={lang} error={error} onRetry={() => void loadDoc()} />;

  const isDraft = status === "draft";

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto space-y-4 pb-24">
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={() => onNavigate("quotations")} className="px-3 py-2 rounded-xl border text-sm font-bold">
          {isRTL ? "رجوع" : "Back"}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59] flex-1">
          {quotationId ? (isRTL ? "عرض سعر" : "Quotation") : isRTL ? "عرض سعر جديد" : "New Quotation"}
        </h2>
        {quotNumber && <span className="font-mono text-sm">{quotNumber}</span>}
      </div>
      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />
      {stockWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{stockWarning}</div>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <select value={customerId} disabled={!isDraft} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="">{isRTL ? "— العميل —" : "— Customer —"}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr ?? c.name}</option>
            ))}
          </select>
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="bg-slate-50 border-b"><th className="p-2">{isRTL ? "المنتج" : "Product"}</th><th className="p-2">KG</th><th className="p-2">{isRTL ? "السعر" : "Price"}</th><th className="p-2" /></tr></thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="p-2 font-semibold">{line.productName}</td>
                    <td className="p-2">
                      <input type="number" disabled={!isDraft} className="w-20 border rounded px-1" value={line.kg}
                        onChange={(e) => {
                          const kg = Number(e.target.value);
                          const next = { ...line, kg, lineSubtotal: kg * line.unitPrice, lineTotal: kg * line.unitPrice };
                          setLines((p) => p.map((l) => (l.id === line.id ? next : l)));
                          void persistLine(next);
                        }} />
                    </td>
                    <td className="p-2 font-mono">{line.unitPrice.toFixed(2)}</td>
                    <td className="p-2">{isDraft && canDeleteLine && <button type="button" onClick={() => void removeLine(line)}><Trash2 size={14} className="text-red-500" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length === 0 && <EmptyState lang={lang} messageAr="أضف بنود العرض" messageEn="Add quotation lines" compact />}
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
          {canManage && isDraft && docId && (
            <button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await sendQuotation(docId); setStatus("sent"); toast.success(isRTL ? "تم الإرسال" : "Sent"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }}
              className="w-full py-2 rounded-xl bg-blue-500 text-white font-bold flex items-center justify-center gap-2"><Send size={14} />{isRTL ? "إرسال" : "Send"}</button>
          )}
          {canManage && status === "sent" && docId && (
            <button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await acceptQuotation(docId); setStatus("accepted"); toast.success(isRTL ? "تم القبول" : "Accepted"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }}
              className="w-full py-2 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"><Check size={14} />{isRTL ? "قبول" : "Accept"}</button>
          )}
          {canManage && docId && status !== "cancelled" && (
            <>
              <button type="button" onClick={() => setShowReject(true)} className="w-full py-2 border rounded-xl font-bold">{isRTL ? "رفض" : "Reject"}</button>
              <button type="button" onClick={() => setShowCancel(true)} className="w-full py-2 border border-red-200 text-red-600 rounded-xl font-bold">{isRTL ? "إلغاء" : "Cancel"}</button>
            </>
          )}
          {canManage && (status === "accepted" || status === "sent") && docId && (
            <button type="button" disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                const res = await convertQuotationToSales(docId);
                const salesId = String((res as { sales_invoice_id?: number; id?: number }).sales_invoice_id ?? (res as { id?: number }).id ?? "");
                if (salesId) onConvertedToSales?.(salesId);
                toast.success(isRTL ? "تم التحويل لفاتورة بيع" : "Converted to sales draft");
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Convert failed");
              } finally {
                setSaving(false);
              }
            }} className="w-full py-3 rounded-xl bg-[#0F2C59] text-white font-bold flex items-center justify-center gap-2">
              <FileCheck size={14} />{isRTL ? "تحويل لفاتورة بيع" : "Convert to sales"}
            </button>
          )}
          {docId && (
            <button type="button" onClick={() => onNavigate("quotation-preview")} className="w-full py-2 border rounded-xl font-bold">
              {isRTL ? "معاينة الطباعة" : "Print preview"}
            </button>
          )}
        </div>
      </div>
      {showReject && <ReasonModal lang={lang} titleAr="رفض العرض" titleEn="Reject quotation" confirmLabelAr="رفض" confirmLabelEn="Reject" loading={saving} onClose={() => setShowReject(false)} onConfirm={async (r) => { if (!docId) return; setSaving(true); try { await rejectQuotation(docId, r); setStatus("rejected"); setShowReject(false); toast.success(isRTL ? "تم الرفض" : "Rejected"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }} />}
      {showCancel && <ReasonModal lang={lang} titleAr="إلغاء العرض" titleEn="Cancel quotation" confirmLabelAr="إلغاء" confirmLabelEn="Cancel" loading={saving} onClose={() => setShowCancel(false)} onConfirm={async (r) => { if (!docId) return; setSaving(true); try { await cancelQuotation(docId, r); setStatus("cancelled"); setShowCancel(false); toast.success(isRTL ? "تم الإلغاء" : "Cancelled"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); } finally { setSaving(false); } }} />}
    </div>
  );
}
