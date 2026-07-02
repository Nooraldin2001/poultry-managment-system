import { useEffect, useMemo, useState } from "react";
import { CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import { IS_MOCK_MODE } from "@/services/config";
import { listCustomerRows, listCustomerSalesInvoices } from "@/services/customerService";
import { listSupplierRows, listSupplierPurchases } from "@/services/supplierService";
import { createCustomerCollection, createSupplierPayment } from "@/services/paymentService";
import { ApiError } from "@/services/api/errors";
import { LoadingState } from "@/shared/components/ApiStates";

type PayMethod = "cash" | "bank" | "cheque" | "other";

type OpenInvoice = { id: string; number: string; remaining: number };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LiveCustomerCollectionModal({
  lang,
  customerId = "",
  invoiceId = "",
  onClose,
  onSuccess,
}: {
  lang: Lang;
  customerId?: string;
  invoiceId?: string;
  onClose: () => void;
  onSuccess?: (movementId: string) => void;
}) {
  const isRTL = lang === "ar";
  const [customers, setCustomers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [custId, setCustId] = useState(customerId);
  const [selInv, setSelInv] = useState(invoiceId);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [date, setDate] = useState(todayIso());
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    void listCustomerRows()
      .then((rows) => setCustomers(rows.map((c) => ({ id: c.id, name: c.nameAr ?? c.name, balance: c.balance }))))
      .finally(() => setLoadingParties(false));
  }, []);

  useEffect(() => {
    if (!custId) {
      setOpenInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    void listCustomerSalesInvoices(custId)
      .then((rows) => setOpenInvoices(rows.filter((r) => r.remaining > 0).map((r) => ({ id: r.id, number: r.number, remaining: r.remaining }))))
      .finally(() => setLoadingInvoices(false));
  }, [custId]);

  const cust = useMemo(() => customers.find((c) => c.id === custId), [customers, custId]);
  const amtNum = parseFloat(amount) || 0;
  const selectedInvoice = openInvoices.find((i) => i.id === selInv);
  const allocTotal = selectedInvoice ? Math.min(amtNum, selectedInvoice.remaining) : 0;
  const unallocated = Math.max(0, amtNum - allocTotal);

  const submit = async () => {
    if (!custId || amtNum <= 0) return;
    setSubmitting(true);
    try {
      const allocations = selInv && selectedInvoice
        ? [{ sales_invoice: Number(selInv), allocated_amount: String(Math.min(amtNum, selectedInvoice.remaining)) }]
        : [];
      const row = await createCustomerCollection({
        customer: Number(custId),
        amount: String(amtNum),
        payment_method: method,
        movement_date: date,
        reference_number: ref,
        notes,
        allocations,
      });
      setSuccessId(row.id);
      onSuccess?.(row.id);
      toast.success(isRTL ? "تم تسجيل التحصيل" : "Collection recorded");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingParties) return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><LoadingState lang={lang} /></div>;

  if (successId) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
          <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل التحصيل" : "Collection recorded"}</h3>
          <p className="font-mono text-slate-400 mb-6">#{successId}</p>
          <button type="button" onClick={onClose} className="w-full py-2 rounded-xl border font-bold">{isRTL ? "إغلاق" : "Close"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="collect-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 id="collect-title" className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل تحصيل من عميل" : "Record Customer Collection"}</h3>
          <button type="button" aria-label={isRTL ? "إغلاق" : "Close"} onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="text-sm font-bold text-slate-700 block">{isRTL ? "العميل" : "Customer"}</label>
          <select value={custId} onChange={(e) => { setCustId(e.target.value); setSelInv(""); }} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="">{isRTL ? "اختر العميل" : "Select customer"}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {cust && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-slate-400 font-semibold">{isRTL ? "الرصيد المستحق" : "Outstanding"}</span>
              <span className="font-mono font-black text-red-500">AED {cust.balance.toLocaleString()}</span>
            </div>
          )}
          {custId && (
            <>
              <label className="text-sm font-bold text-slate-700 block">{isRTL ? "فاتورة (اختياري)" : "Invoice (optional)"}</label>
              <select value={selInv} onChange={(e) => setSelInv(e.target.value)} disabled={loadingInvoices} className="w-full rounded-xl border px-3 py-2 text-sm">
                <option value="">{isRTL ? "تحصيل على الحساب" : "Account-level collection"}</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.number} — AED {i.remaining.toLocaleString()}</option>
                ))}
              </select>
            </>
          )}
          <label className="text-sm font-bold text-slate-700 block">{isRTL ? "المبلغ (AED)" : "Amount (AED)"}</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono" />
          {amtNum > 0 && unallocated > 0 && (
            <p className="text-xs font-bold text-amber-700">{isRTL ? `غير مخصص: AED ${unallocated.toFixed(2)}` : `Unallocated: AED ${unallocated.toFixed(2)}`}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">{isRTL ? "طريقة الدفع" : "Method"}</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className="w-full rounded-xl border px-2 py-2 text-sm">
                <option value="cash">{isRTL ? "كاش" : "Cash"}</option>
                <option value="bank">{isRTL ? "تحويل بنكي" : "Bank"}</option>
                <option value="cheque">{isRTL ? "شيك" : "Cheque"}</option>
                <option value="other">{isRTL ? "أخرى" : "Other"}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">{isRTL ? "التاريخ" : "Date"}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-sm" />
            </div>
          </div>
          {(method === "bank" || method === "cheque") && (
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={isRTL ? "رقم المرجع" : "Reference"} className="w-full rounded-xl border px-3 py-2 text-sm" />
          )}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isRTL ? "ملاحظات" : "Notes"} className="w-full rounded-xl border p-3 text-sm min-h-[60px]" />
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border font-bold">{isRTL ? "إلغاء" : "Cancel"}</button>
          <button type="button" disabled={!custId || amtNum <= 0 || submitting} onClick={() => void submit()} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
            {isRTL ? "تسجيل التحصيل" : "Record collection"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveSupplierPaymentModal({
  lang,
  supplierId = "",
  onClose,
  onSuccess,
}: {
  lang: Lang;
  supplierId?: string;
  onClose: () => void;
  onSuccess?: (movementId: string) => void;
}) {
  const isRTL = lang === "ar";
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [suppId, setSuppId] = useState(supplierId);
  const [selInv, setSelInv] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("bank");
  const [date, setDate] = useState(todayIso());
  const [ref, setRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    void listSupplierRows()
      .then((rows) => setSuppliers(rows.map((s) => ({ id: s.id, name: s.name, balance: s.balance }))))
      .finally(() => setLoadingParties(false));
  }, []);

  useEffect(() => {
    if (!suppId) { setOpenInvoices([]); return; }
    void listSupplierPurchases(suppId)
      .then((rows) => setOpenInvoices(rows.filter((r) => r.remaining > 0).map((r) => ({ id: r.id, number: r.number, remaining: r.remaining }))));
  }, [suppId]);

  const supp = suppliers.find((s) => s.id === suppId);
  const amtNum = parseFloat(amount) || 0;
  const selectedInvoice = openInvoices.find((i) => i.id === selInv);

  const submit = async () => {
    if (!suppId || amtNum <= 0) return;
    setSubmitting(true);
    try {
      const allocations = selInv && selectedInvoice
        ? [{ purchase_invoice: Number(selInv), allocated_amount: String(Math.min(amtNum, selectedInvoice.remaining)) }]
        : [];
      const row = await createSupplierPayment({
        supplier: Number(suppId),
        amount: String(amtNum),
        payment_method: method,
        movement_date: date,
        reference_number: ref,
        allocations,
      });
      setSuccessId(row.id);
      onSuccess?.(row.id);
      toast.success(isRTL ? "تم تسجيل الدفعة" : "Payment recorded");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingParties) return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><LoadingState lang={lang} /></div>;
  if (successId) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <CheckCircle size={32} className="text-[#0F2C59] mx-auto mb-4" />
          <h3 className="text-xl font-black text-[#0F2C59] mb-6">{isRTL ? "تم تسجيل الدفعة" : "Payment recorded"}</h3>
          <button type="button" onClick={onClose} className="w-full py-2 rounded-xl border font-bold">{isRTL ? "إغلاق" : "Close"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 id="pay-title" className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل دفعة لمورد" : "Record Supplier Payment"}</h3>
          <button type="button" aria-label={isRTL ? "إغلاق" : "Close"} onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <select value={suppId} onChange={(e) => { setSuppId(e.target.value); setSelInv(""); }} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="">{isRTL ? "اختر المورد" : "Select supplier"}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {supp && <div className="text-sm font-mono text-amber-600">AED {supp.balance.toLocaleString()}</div>}
          {suppId && (
            <select value={selInv} onChange={(e) => setSelInv(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
              <option value="">{isRTL ? "دفعة على الحساب" : "Account payment"}</option>
              {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.number} — AED {i.remaining.toLocaleString()}</option>)}
            </select>
          )}
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono" placeholder={isRTL ? "المبلغ" : "Amount"} />
          <div className="grid grid-cols-2 gap-3">
            <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className="rounded-xl border px-2 py-2 text-sm">
              <option value="bank">{isRTL ? "تحويل بنكي" : "Bank"}</option>
              <option value="cash">{isRTL ? "كاش" : "Cash"}</option>
              <option value="cheque">{isRTL ? "شيك" : "Cheque"}</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-2 py-2 text-sm" />
          </div>
          {(method === "bank" || method === "cheque") && (
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder={isRTL ? "المرجع" : "Reference"} />
          )}
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border font-bold">{isRTL ? "إلغاء" : "Cancel"}</button>
          <button type="button" disabled={!suppId || amtNum <= 0 || submitting} onClick={() => void submit()} className="px-4 py-2 rounded-xl bg-[#0F2C59] text-white font-bold disabled:opacity-50">
            {isRTL ? "تسجيل الدفعة" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
