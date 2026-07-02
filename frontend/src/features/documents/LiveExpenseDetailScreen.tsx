import { useCallback, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import { getExpenseRow, cancelExpense } from "@/services/expenseService";
import { ApiError } from "@/services/api/errors";
import { LiveDocumentReadOnly } from "./LiveDocumentReadOnly";
import { ReasonModal } from "@/features/invoices/ReasonModal";
import { DocumentAttachmentsPanel } from "@/features/attachments/DocumentAttachmentsPanel";

export function LiveExpenseDetailScreen({
  lang,
  role,
  onNavigate,
  expenseId,
}: {
  lang: Lang;
  role: TenantRole;
  onNavigate: (s: TenantScreen) => void;
  expenseId: string;
}) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner" || role === "accountant";
  const [tab, setTab] = useState<"details" | "attachments">("details");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadDetail = useCallback(async () => {
    const row = await getExpenseRow(expenseId);
    if (!row) return null;
    return {
      id: row.id,
      number: row.id,
      status: row.status ?? "approved",
      date: row.date ?? "",
      partyName: row.category,
      total: row.amount,
      notes: row.note,
      lines: [{ id: "1", label: row.note ?? row.category ?? "", total: row.amount }],
    };
  }, [expenseId]);

  if (tab === "attachments") {
    return (
      <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" aria-label={isRTL ? "رجوع" : "Back"} onClick={() => setTab("details")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            {isRTL ? "→" : "←"}
          </button>
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "مرفقات المصروف" : "Expense Attachments"}</h2>
        </div>
        <DocumentAttachmentsPanel lang={lang} docKind="expense" docId={expenseId} />
      </div>
    );
  }

  return (
    <>
      <LiveDocumentReadOnly
        lang={lang}
        onNavigate={onNavigate}
        backScreen="expenses-list"
        titleAr="مصروف"
        titleEn="Expense"
        printScreen="expense-voucher"
        canCancel={canEdit}
        loadDetail={loadDetail}
        onCancel={async (reason) => {
          setCancelling(true);
          try {
            await cancelExpense(expenseId, reason);
            toast.success(isRTL ? "تم إلغاء المصروف" : "Expense cancelled");
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Failed");
            throw e;
          } finally {
            setCancelling(false);
          }
        }}
      />
      <div className="px-4 lg:px-8 max-w-screen-xl mx-auto -mt-2 pb-8 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("attachments")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
          {isRTL ? "المرفقات" : "Attachments"}
        </button>
        <button type="button" onClick={() => onNavigate("expense-voucher")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Printer size={14} aria-hidden />
          {isRTL ? "طباعة السند" : "Print Voucher"}
        </button>
      </div>
      {showCancel && (
        <ReasonModal
          lang={lang}
          titleAr="إلغاء المصروف"
          titleEn="Cancel expense"
          confirmLabelAr="إلغاء"
          confirmLabelEn="Cancel"
          loading={cancelling}
          onClose={() => setShowCancel(false)}
          onConfirm={async (r) => {
            await cancelExpense(expenseId, r);
            setShowCancel(false);
          }}
        />
      )}
    </>
  );
}
