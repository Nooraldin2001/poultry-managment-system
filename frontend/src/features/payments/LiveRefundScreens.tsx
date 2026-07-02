import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle, ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types";
import { listCustomerRows } from "@/services/customerService";
import { listSupplierRows } from "@/services/supplierService";
import {
  cancelPaymentMovement,
  createCustomerRefund,
  createSupplierRefund,
  getPaymentMovementPrintPreviewRaw,
  listPaymentMovementRows,
} from "@/services/paymentService";
import { ApiError } from "@/services/api/errors";
import { LoadingState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { LivePrintPreviewScreen } from "@/features/print/LivePrintPreviewScreen";

type PayMethod = "cash" | "bank" | "cheque" | "other";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type MiniParty = { id: string; name: string; balance: number };

export function LiveCustomerRefundScreen({
  lang,
  onNavigate,
  Card,
  Btn,
  FSelect,
  FInput,
}: {
  lang: Lang;
  onNavigate: (s: TenantScreen) => void;
  Card: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  Btn: React.ComponentType<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    disabled?: boolean;
    className?: string;
  }>;
  FSelect: React.ComponentType<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    required?: boolean;
  }>;
  FInput: React.ComponentType<{
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
  }>;
}) {
  const isRTL = lang === "ar";
  const [customers, setCustomers] = useState<MiniParty[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [custId, setCustId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [date, setDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    void listCustomerRows()
      .then((rows) => setCustomers(rows.map((c) => ({ id: c.id, name: c.nameAr ?? c.name, balance: c.balance }))))
      .finally(() => setLoadingParties(false));
  }, []);

  const cust = customers.find((c) => c.id === custId);

  if (successId) {
    return (
      <LivePrintPreviewScreen
        lang={lang}
        onNavigate={onNavigate}
        backScreen="payments"
        titleAr="إيصال استرجاع عميل"
        titleEn="Customer Refund Voucher"
        loadPreview={() => getPaymentMovementPrintPreviewRaw(successId)}
      />
    );
  }

  const submit = async () => {
    const amtNum = parseFloat(amount) || 0;
    if (!custId || amtNum <= 0 || !reason) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const row = await createCustomerRefund({
        customer: Number(custId),
        amount: String(amtNum),
        payment_method: method,
        movement_date: date,
        reason,
        notes: reason,
      });
      setSuccessId(row.id);
      toast.success(isRTL ? "تم تسجيل الاسترجاع" : "Refund recorded");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : isRTL ? "فشل التسجيل" : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={isRTL ? "رجوع" : "Back"} onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          {isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "استرجاع مبلغ للعميل" : "Customer Refund"}</h2>
      </div>
      {loadingParties ? (
        <LoadingState lang={lang} compact />
      ) : (
        <>
          <FormErrors lang={lang} fieldErrors={fieldErrors} />
          <Card className="p-5 space-y-4">
            <FSelect label={isRTL ? "العميل *" : "Customer *"} value={custId} onChange={setCustId} required options={[{ value: "", label: isRTL ? "اختر العميل" : "Select Customer" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} />
            {cust && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? "رصيد العميل" : "Customer Balance"}</span>
                  <span className="font-mono font-black text-red-500">AED {cust.balance.toLocaleString()}</span>
                </div>
              </div>
            )}
            <FInput label={isRTL ? "مبلغ الاسترجاع (AED) *" : "Refund Amount (AED) *"} type="number" value={amount} onChange={setAmount} required />
            <FSelect label={isRTL ? "سبب الاسترجاع *" : "Refund Reason *"} value={reason} onChange={setReason} required options={[
              { value: "", label: isRTL ? "اختر السبب" : "Select Reason" },
              { value: "overpaid", label: isRTL ? "العميل دفع أكثر" : "Customer overpaid" },
              { value: "cancelled", label: isRTL ? "إلغاء فاتورة مدفوعة" : "Cancelled paid invoice" },
              { value: "manual", label: isRTL ? "استرجاع يدوي" : "Manual refund" },
            ]} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={(v) => setMethod(v as PayMethod)} required options={[
                { value: "cash", label: isRTL ? "كاش" : "Cash" },
                { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank" },
                { value: "cheque", label: isRTL ? "شيك" : "Cheque" },
                { value: "other", label: isRTL ? "أخرى" : "Other" },
              ]} />
              <FInput label={isRTL ? "التاريخ" : "Date"} type="date" value={date} onChange={setDate} />
            </div>
          </Card>
          <div className="flex gap-3 justify-between flex-wrap">
            <Btn variant="outline" onClick={() => onNavigate("payments")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
            <Btn variant="amber" disabled={!custId || !amount || !reason || submitting} onClick={() => void submit()}>
              <Check size={15} />
              {isRTL ? "تسجيل الاسترجاع" : "Record Refund"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

export function LiveSupplierRefundScreen({
  lang,
  onNavigate,
  Card,
  Btn,
  FSelect,
  FInput,
}: {
  lang: Lang;
  onNavigate: (s: TenantScreen) => void;
  Card: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  Btn: React.ComponentType<{ children: React.ReactNode; onClick?: () => void; variant?: string; disabled?: boolean }>;
  FSelect: React.ComponentType<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean }>;
  FInput: React.ComponentType<{ label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }>;
}) {
  const isRTL = lang === "ar";
  const [suppliers, setSuppliers] = useState<MiniParty[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [suppId, setSuppId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PayMethod>("bank");
  const [date, setDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    void listSupplierRows()
      .then((rows) => setSuppliers(rows.map((s) => ({ id: s.id, name: s.name, balance: s.balance }))))
      .finally(() => setLoadingParties(false));
  }, []);

  if (successId) {
    return (
      <LivePrintPreviewScreen
        lang={lang}
        onNavigate={onNavigate}
        backScreen="payments"
        titleAr="إيصال استرجاع مورد"
        titleEn="Supplier Refund Voucher"
        loadPreview={() => getPaymentMovementPrintPreviewRaw(successId)}
      />
    );
  }

  const submit = async () => {
    const amtNum = parseFloat(amount) || 0;
    if (!suppId || amtNum <= 0 || !reason) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const row = await createSupplierRefund({
        supplier: Number(suppId),
        amount: String(amtNum),
        payment_method: method,
        movement_date: date,
        reason,
        notes: reason,
      });
      setSuccessId(row.id);
      toast.success(isRTL ? "تم تسجيل الاسترجاع" : "Refund recorded");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : isRTL ? "فشل التسجيل" : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={isRTL ? "رجوع" : "Back"} onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          {isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "استرجاع مبلغ من مورد" : "Supplier Refund"}</h2>
      </div>
      {loadingParties ? (
        <LoadingState lang={lang} compact />
      ) : (
        <>
          <FormErrors lang={lang} fieldErrors={fieldErrors} />
          <Card className="p-5 space-y-4">
            <FSelect label={isRTL ? "المورد *" : "Supplier *"} value={suppId} onChange={setSuppId} required options={[{ value: "", label: isRTL ? "اختر المورد" : "Select Supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            <FInput label={isRTL ? "مبلغ الاسترجاع (AED) *" : "Refund Amount (AED) *"} type="number" value={amount} onChange={setAmount} required />
            <FInput label={isRTL ? "سبب الاسترجاع *" : "Refund Reason *"} value={reason} onChange={setReason} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={(v) => setMethod(v as PayMethod)} required options={[
                { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank" },
                { value: "cash", label: isRTL ? "كاش" : "Cash" },
                { value: "cheque", label: isRTL ? "شيك" : "Cheque" },
              ]} />
              <FInput label={isRTL ? "التاريخ" : "Date"} type="date" value={date} onChange={setDate} />
            </div>
          </Card>
          <div className="flex gap-3 justify-between flex-wrap">
            <Btn variant="outline" onClick={() => onNavigate("payments")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
            <Btn variant="amber" disabled={!suppId || !amount || !reason || submitting} onClick={() => void submit()}>
              <Check size={15} />
              {isRTL ? "تسجيل الاسترجاع" : "Record Refund"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

export function LiveCancelPaymentModal({
  lang,
  movementId,
  onClose,
  onCancelled,
  Btn,
}: {
  lang: Lang;
  movementId: string;
  onClose: () => void;
  onCancelled?: () => void;
  Btn: React.ComponentType<{ children: React.ReactNode; onClick?: () => void; variant?: string; disabled?: boolean; className?: string }>;
}) {
  const isRTL = lang === "ar";
  const [movement, setMovement] = useState<{ type: string; party: string; amount: number; reference?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listPaymentMovementRows()
      .then((rows) => {
        const m = rows.find((r) => r.id === movementId);
        if (m) setMovement({ type: m.type, party: m.party, amount: m.amount, reference: m.reference });
      })
      .finally(() => setLoading(false));
  }, [movementId]);

  const submit = async () => {
    if (!reason.trim() || !confirmed) return;
    setSubmitting(true);
    try {
      await cancelPaymentMovement(movementId, reason.trim());
      toast.success(isRTL ? "تم إلغاء الحركة المالية" : "Movement cancelled");
      onCancelled?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : isRTL ? "فشل الإلغاء" : "Cancel failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-payment-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 id="cancel-payment-title" className="text-lg font-black text-red-600">{isRTL ? "إلغاء حركة مالية" : "Cancel Payment Movement"}</h3>
          <button type="button" aria-label={isRTL ? "إغلاق" : "Close"} onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {loading ? <LoadingState lang={lang} compact /> : movement ? (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
              {[[isRTL ? "النوع" : "Type", movement.type], [isRTL ? "الطرف" : "Party", movement.party], [isRTL ? "المبلغ" : "Amount", `AED ${movement.amount.toLocaleString()}`]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-800">{v}</span></div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{isRTL ? "الحركة غير موجودة" : "Movement not found"}</p>
          )}
          <div>
            <label htmlFor="cancel-reason" className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "سبب الإلغاء *" : "Cancellation Reason *"}</label>
            <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400" />
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 shrink-0 accent-red-500" />
            <span className="text-xs font-bold text-slate-700">{isRTL ? "أفهم أن إلغاء هذه الحركة سيعدل الرصيد." : "I understand this will affect balances."}</span>
          </label>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
          <Btn variant="danger" disabled={!reason.trim() || !confirmed || submitting || !movement} onClick={() => void submit()} className="flex-1 justify-center">
            <X size={14} />
            {isRTL ? "تأكيد الإلغاء" : "Confirm Cancel"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
