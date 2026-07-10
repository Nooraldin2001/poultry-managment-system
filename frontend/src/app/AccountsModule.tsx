// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — ACCOUNTS MODULE (Cashboxes & Bank Accounts)
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Plus, Search, Eye, Pencil, ChevronRight, ChevronLeft, Wallet, Building2,
  ArrowDownLeft, ArrowUpRight, RefreshCw, Download, SlidersHorizontal,
  ArrowLeftRight, Banknote, X, TrendingUp, TrendingDown, LayoutGrid, List,
} from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import { LoadingState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";
import {
  listMoneyAccounts,
  getMoneyAccount,
  createMoneyAccount,
  updateMoneyAccount,
  getTreasurySummary,
  getAccountStatement,
  createMoneyAdjustment,
  transferBetweenAccounts,
  listMoneyAccountMovements,
  MOVEMENT_TYPE_LABELS,
  type MoneyAccountRow,
  type TreasurySummary,
  type MoneyMovementRow,
} from "@/services/treasuryService";

type TenantScreen = string;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmtMoney(amount: number, currency = "AED", lang: Lang = "ar"): string {
  const n = amount.toLocaleString(lang === "ar" ? "ar-AE" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${n}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasPerm(permissions: string[], code: string): boolean {
  if (permissions.includes(code)) return true;
  const [group] = code.split(".");
  return permissions.includes(`${group}.manage`);
}

function movementLabel(type: string, lang: Lang): string {
  const row = MOVEMENT_TYPE_LABELS[type];
  if (!row) return type;
  return lang === "ar" ? row.ar : row.en;
}

function exportStatementCsv(
  account: MoneyAccountRow,
  movements: MoneyMovementRow[],
  opening: number,
  closing: number,
  lang: Lang,
) {
  const headers =
    lang === "ar"
      ? ["التاريخ", "النوع", "الاتجاه", "المبلغ", "الوصف", "السبب", "المرجع"]
      : ["Date", "Type", "Direction", "Amount", "Description", "Reason", "Reference"];
  const rows = movements.map((m) => [
    m.movementDate,
    movementLabel(m.movementType, lang),
    m.direction === "in" ? (lang === "ar" ? "وارد" : "In") : (lang === "ar" ? "صادر" : "Out"),
    String(m.amount),
    m.description,
    m.reason,
    m.referenceId ? `${m.referenceType}:${m.referenceId}` : "",
  ]);
  const summary = [
    [],
    [lang === "ar" ? "الرصيد الافتتاحي" : "Opening", String(opening)],
    [lang === "ar" ? "الرصيد الختامي" : "Closing", String(closing)],
  ];
  const csv = [headers, ...rows, ...summary]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement-${account.name}-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── UI PRIMITIVES ───────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false, type = "button" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "green";
  size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2C59]/30";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-[#0F2C59] text-white border-[#0F2C59] hover:bg-[#162f5f]",
    secondary: "bg-white text-[#0F2C59] border-[#0F2C59]/20 hover:bg-[#0F2C59]/5",
    danger: "bg-[#EF4444] text-white border-[#EF4444] hover:bg-red-600",
    ghost: "bg-transparent text-slate-500 border-transparent hover:bg-slate-100",
    outline: "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
    green: "bg-[#22C55E] text-white border-[#22C55E] hover:bg-emerald-600 shadow-sm",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>;
}

function FInput({ label, value, onChange, type = "text", placeholder, required, error, mono }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; required?: boolean; error?: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">
        {label}{required && <span className="text-red-500 ms-1">*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59] focus:ring-2 focus:ring-[#0F2C59]/10 ${mono ? "font-mono" : ""}`} />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

function FSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#22C55E]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 start-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5 rtl:-translate-x-5" : ""}`} />
      </button>
      <div>
        <div className="text-sm font-bold text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function ScreenHeader({ lang, title, subtitle, onBack, actions }: {
  lang: Lang; title: string; subtitle?: string; onBack?: () => void; actions?: ReactNode;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="flex flex-wrap items-start gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0">
          {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl lg:text-2xl font-black text-[#0F2C59] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, tone = "neutral" }: {
  label: string; value: string; icon: typeof Wallet;
  tone?: "cash" | "bank" | "total" | "in" | "out" | "count" | "neutral";
}) {
  const tones = {
    cash: "bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/60 text-emerald-800",
    bank: "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60 text-blue-900",
    total: "bg-gradient-to-br from-[#0F2C59]/5 to-[#0F2C59]/10 border-[#0F2C59]/15 text-[#0F2C59]",
    in: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50 text-green-800",
    out: "bg-gradient-to-br from-red-50 to-orange-50 border-red-200/50 text-red-800",
    count: "bg-slate-50 border-slate-200 text-slate-700",
    neutral: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold opacity-80">{label}</span>
        <Icon size={16} className="opacity-60 shrink-0" />
      </div>
      <div className="text-lg lg:text-xl font-black font-mono tracking-tight">{value}</div>
    </div>
  );
}

function AccountTypeBadge({ type, lang }: { type: "cashbox" | "bank"; lang: Lang }) {
  const isCash = type === "cashbox";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full ${isCash ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
      {isCash ? <Wallet size={11} /> : <Building2 size={11} />}
      {isCash ? (lang === "ar" ? "خزنة" : "Cashbox") : (lang === "ar" ? "حساب بنكي" : "Bank")}
    </span>
  );
}

function StatusBadge({ active, lang }: { active: boolean; lang: Lang }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {active ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "موقوف" : "Inactive")}
    </span>
  );
}

// ── ACCOUNT CARD ────────────────────────────────────────────────────────────────
function AccountCard({ account, lang, onView, onStatement, onAdjust, onTransfer, onEdit, canAdjust, canTransfer, canEdit }: {
  account: MoneyAccountRow; lang: Lang;
  onView: () => void; onStatement: () => void; onAdjust: () => void; onTransfer: () => void; onEdit: () => void;
  canAdjust: boolean; canTransfer: boolean; canEdit: boolean;
}) {
  const isRTL = lang === "ar";
  const isCash = account.accountType === "cashbox";
  return (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${!account.isActive ? "opacity-70" : ""}`}>
      <div className={`h-1.5 ${isCash ? "bg-gradient-to-r from-emerald-400 to-[#22C55E]" : "bg-gradient-to-r from-blue-400 to-[#0F2C59]"}`} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-black text-slate-900 truncate">{account.name}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <AccountTypeBadge type={account.accountType} lang={lang} />
              <StatusBadge active={account.isActive} lang={lang} />
            </div>
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${isCash ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
            {isCash ? <Wallet size={20} /> : <Building2 size={20} />}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-1">{isRTL ? "الرصيد الحالي" : "Current balance"}</div>
          <div className={`text-2xl font-black font-mono ${account.currentBalance < 0 ? "text-red-600" : "text-[#0F2C59]"}`}>
            {fmtMoney(account.currentBalance, account.currency, lang)}
          </div>
        </div>

        {account.accountType === "bank" && (account.bankName || account.accountNumber) && (
          <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-100 pt-3">
            {account.bankName && <div>{account.bankName}</div>}
            {account.accountNumber && <div className="font-mono">{account.accountNumber}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Btn size="sm" variant="outline" onClick={onStatement}><Eye size={13} />{isRTL ? "كشف" : "Statement"}</Btn>
          <Btn size="sm" variant="outline" onClick={onView}><Banknote size={13} />{isRTL ? "تفاصيل" : "Details"}</Btn>
          {canAdjust ? (
            <Btn size="sm" variant="secondary" onClick={onAdjust}><SlidersHorizontal size={13} />{isRTL ? "تعديل" : "Adjust"}</Btn>
          ) : (
            <Btn size="sm" variant="outline" disabled><SlidersHorizontal size={13} />{isRTL ? "تعديل" : "Adjust"}</Btn>
          )}
          {canTransfer ? (
            <Btn size="sm" variant="secondary" onClick={onTransfer}><ArrowLeftRight size={13} />{isRTL ? "تحويل" : "Transfer"}</Btn>
          ) : (
            <Btn size="sm" variant="outline" disabled><ArrowLeftRight size={13} />{isRTL ? "تحويل" : "Transfer"}</Btn>
          )}
        </div>
        {canEdit && (
          <button type="button" onClick={onEdit} className="w-full text-xs font-bold text-[#0F2C59] hover:underline flex items-center justify-center gap-1">
            <Pencil size={12} />{isRTL ? "تعديل الحساب" : "Edit account"}
          </button>
        )}
      </div>
    </Card>
  );
}

// ── MODALS ──────────────────────────────────────────────────────────────────────
function ModalShell({ title, lang, onClose, children, footer }: {
  title: string; lang: Lang; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-[#0F2C59]">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function AdjustmentModal({ lang, account, onClose, onDone }: {
  lang: Lang; account: MoneyAccountRow; onClose: () => void; onDone: () => void;
}) {
  const isRTL = lang === "ar";
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error(isRTL ? "السبب مطلوب" : "Reason is required"); return; }
    const n = Number(amount);
    if (!n || n <= 0) { toast.error(isRTL ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    setSaving(true);
    try {
      await createMoneyAdjustment(account.id, { direction, amount: n, reason: reason.trim(), description: description.trim() });
      toast.success(isRTL ? "تم تسجيل التعديل" : "Adjustment posted");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (isRTL ? "فشل التعديل" : "Adjustment failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isRTL ? "تعديل يدوي على الرصيد" : "Manual balance adjustment"}
      lang={lang}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn onClick={() => void submit()} disabled={saving}>{isRTL ? "تسجيل" : "Post"}</Btn>
        </>
      }
    >
      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <span className="text-slate-500">{isRTL ? "الحساب:" : "Account:"}</span>{" "}
        <span className="font-bold">{account.name}</span>
        <div className="font-mono font-black text-[#0F2C59] mt-1">{fmtMoney(account.currentBalance, account.currency, lang)}</div>
      </div>
      <FSelect label={isRTL ? "نوع الحركة" : "Direction"} value={direction} onChange={(v) => setDirection(v as "in" | "out")}
        options={[
          { value: "in", label: isRTL ? "إضافة رصيد (وارد)" : "Add funds (inflow)" },
          { value: "out", label: isRTL ? "سحب رصيد (صادر)" : "Withdraw funds (outflow)" },
        ]} />
      <FInput label={isRTL ? "المبلغ" : "Amount"} value={amount} onChange={setAmount} type="number" mono required />
      <FInput label={isRTL ? "السبب" : "Reason"} value={reason} onChange={setReason} required />
      <FInput label={isRTL ? "وصف إضافي" : "Description"} value={description} onChange={setDescription} />
    </ModalShell>
  );
}

export function TransferModal({ lang, accounts, defaultFromId, onClose, onDone }: {
  lang: Lang; accounts: MoneyAccountRow[]; defaultFromId?: string; onClose: () => void; onDone: () => void;
}) {
  const isRTL = lang === "ar";
  const active = accounts.filter((a) => a.isActive);
  const [fromId, setFromId] = useState(defaultFromId ?? active[0]?.id ?? "");
  const [toId, setToId] = useState(active.find((a) => a.id !== fromId)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!fromId || !toId || fromId === toId) {
      toast.error(isRTL ? "اختر حسابين مختلفين" : "Select two different accounts");
      return;
    }
    if (!reason.trim()) { toast.error(isRTL ? "السبب مطلوب" : "Reason is required"); return; }
    const n = Number(amount);
    if (!n || n <= 0) { toast.error(isRTL ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    setSaving(true);
    try {
      await transferBetweenAccounts({ fromAccountId: fromId, toAccountId: toId, amount: n, reason: reason.trim(), description: description.trim() });
      toast.success(isRTL ? "تم التحويل بنجاح" : "Transfer completed");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (isRTL ? "فشل التحويل" : "Transfer failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isRTL ? "تحويل بين الحسابات" : "Transfer between accounts"}
      lang={lang}
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn onClick={() => void submit()} disabled={saving}>{isRTL ? "تحويل" : "Transfer"}</Btn>
        </>
      }
    >
      <FSelect label={isRTL ? "من حساب" : "From account"} value={fromId} onChange={setFromId}
        options={active.map((a) => ({ value: a.id, label: `${a.name} (${fmtMoney(a.currentBalance, a.currency, lang)})` }))} />
      <FSelect label={isRTL ? "إلى حساب" : "To account"} value={toId} onChange={setToId}
        options={active.filter((a) => a.id !== fromId).map((a) => ({ value: a.id, label: a.name }))} />
      <FInput label={isRTL ? "المبلغ" : "Amount"} value={amount} onChange={setAmount} type="number" mono required />
      <FInput label={isRTL ? "السبب" : "Reason"} value={reason} onChange={setReason} required />
      <FInput label={isRTL ? "وصف" : "Description"} value={description} onChange={setDescription} />
    </ModalShell>
  );
}

// ── SHARED DATA HOOK ────────────────────────────────────────────────────────────
function useAccountsData() {
  const [accounts, setAccounts] = useState<MoneyAccountRow[]>([]);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [forbidden, setForbidden] = useState(false);

  const reload = useCallback(async () => {
    if (IS_MOCK_MODE) { setLoading(false); return; }
    setLoading(true);
    setForbidden(false);
    try {
      const [accs, sum] = await Promise.all([listMoneyAccounts(), getTreasurySummary()]);
      setAccounts(accs);
      setSummary(sum);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || ApiError.isForbidden(e))) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { accounts, summary, loading, forbidden, reload };
}

// ── SCREEN 1: DASHBOARD ─────────────────────────────────────────────────────────
export function AccountsDashboardScreen({ lang, permissions, onNavigate, setSelectedAccountId }: {
  lang: Lang; permissions: string[]; onNavigate: (s: TenantScreen) => void;
  setSelectedAccountId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const { accounts, summary, loading, forbidden, reload } = useAccountsData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "cashbox" | "bank">("");
  const [adjustAccount, setAdjustAccount] = useState<MoneyAccountRow | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string | undefined>();

  const canCreate = hasPerm(permissions, "treasury.create");
  const canAdjust = hasPerm(permissions, "treasury.adjust");
  const canTransfer = hasPerm(permissions, "treasury.transfer");
  const canEdit = hasPerm(permissions, "treasury.update");

  const filtered = useMemo(() => {
    let rows = accounts;
    if (typeFilter) rows = rows.filter((a) => a.accountType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.bankName ?? "").toLowerCase().includes(q) ||
        (a.accountNumber ?? "").includes(q),
      );
    }
    return rows;
  }, [accounts, typeFilter, search]);

  const openAccount = (id: string) => {
    setSelectedAccountId?.(id);
    onNavigate("accounts-detail");
  };

  if (IS_MOCK_MODE) {
    return (
      <div className="p-4 lg:p-8 max-w-screen-xl mx-auto">
        <EmptyState lang={lang} messageAr="وحدة الحسابات متاحة في الوضع الحي فقط" messageEn="Accounts module is available in live mode only" />
      </div>
    );
  }
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading && !summary) return <LoadingState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      <ScreenHeader
        lang={lang}
        title={isRTL ? "الحسابات" : "Accounts"}
        subtitle={isRTL ? "إدارة الخزائن والحسابات البنكية" : "Manage cashboxes and bank accounts"}
        actions={
          <>
            <Btn variant="outline" size="sm" onClick={() => void reload()}><RefreshCw size={14} /></Btn>
            <Btn variant="outline" size="sm" onClick={() => onNavigate("accounts-list")}><List size={14} />{isRTL ? "قائمة" : "List"}</Btn>
            {canCreate && <Btn size="sm" onClick={() => onNavigate("accounts-new")}><Plus size={14} />{isRTL ? "حساب جديد" : "New account"}</Btn>}
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label={isRTL ? "إجمالي الخزائن" : "Cashbox balance"} value={fmtMoney(summary.cashboxTotal, "AED", lang)} icon={Wallet} tone="cash" />
          <KpiTile label={isRTL ? "إجمالي البنوك" : "Bank balance"} value={fmtMoney(summary.bankTotal, "AED", lang)} icon={Building2} tone="bank" />
          <KpiTile label={isRTL ? "الإجمالي المتاح" : "Available total"} value={fmtMoney(summary.availableTotal, "AED", lang)} icon={TrendingUp} tone="total" />
          <KpiTile label={isRTL ? "خزائن نشطة" : "Active cashboxes"} value={String(summary.activeCashboxes)} icon={LayoutGrid} tone="count" />
          <KpiTile label={isRTL ? "بنوك نشطة" : "Active banks"} value={String(summary.activeBanks)} icon={Building2} tone="count" />
          <KpiTile label={isRTL ? "وارد اليوم" : "Today inflows"} value={fmtMoney(summary.todayInflows, "AED", lang)} icon={ArrowDownLeft} tone="in" />
          <KpiTile label={isRTL ? "صادر اليوم" : "Today outflows"} value={fmtMoney(summary.todayOutflows, "AED", lang)} icon={ArrowUpRight} tone="out" />
          <KpiTile label={isRTL ? "عدد الحسابات" : "Total accounts"} value={String(summary.accountsCount)} icon={Banknote} tone="neutral" />
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isRTL ? "بحث بالاسم أو البنك..." : "Search name or bank..."}
              className="w-full ps-10 pe-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm min-w-[140px]">
            <option value="">{isRTL ? "كل الأنواع" : "All types"}</option>
            <option value="cashbox">{isRTL ? "خزائن" : "Cashboxes"}</option>
            <option value="bank">{isRTL ? "بنوك" : "Banks"}</option>
          </select>
          {canTransfer && (
            <Btn variant="secondary" onClick={() => { setTransferFrom(undefined); setShowTransfer(true); }}>
              <ArrowLeftRight size={14} />{isRTL ? "تحويل" : "Transfer"}
            </Btn>
          )}
        </div>
      </Card>

      {loading ? (
        <LoadingState lang={lang} />
      ) : filtered.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            lang={lang}
            messageAr={accounts.length === 0 ? "لا توجد حسابات بعد. أنشئ خزنة أو حساباً بنكياً للبدء." : "لا توجد نتائج مطابقة للبحث"}
            messageEn={accounts.length === 0 ? "No accounts yet. Create a cashbox or bank account to get started." : "No accounts match your search"}
          />
          {canCreate && accounts.length === 0 && (
            <div className="flex justify-center mt-4">
              <Btn onClick={() => onNavigate("accounts-new")}><Plus size={14} />{isRTL ? "إضافة حساب" : "Add account"}</Btn>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              lang={lang}
              onView={() => openAccount(acc.id)}
              onStatement={() => { setSelectedAccountId?.(acc.id); onNavigate("accounts-statement"); }}
              onAdjust={() => setAdjustAccount(acc)}
              onTransfer={() => { setTransferFrom(acc.id); setShowTransfer(true); }}
              onEdit={() => { setSelectedAccountId?.(acc.id); onNavigate("accounts-edit"); }}
              canAdjust={canAdjust}
              canTransfer={canTransfer}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {adjustAccount && (
        <AdjustmentModal lang={lang} account={adjustAccount} onClose={() => setAdjustAccount(null)} onDone={() => void reload()} />
      )}
      {showTransfer && (
        <TransferModal lang={lang} accounts={accounts} defaultFromId={transferFrom} onClose={() => setShowTransfer(false)} onDone={() => void reload()} />
      )}
    </div>
  );
}

// ── SCREEN 2: LIST ──────────────────────────────────────────────────────────────
export function AccountsListScreen({ lang, permissions, onNavigate, setSelectedAccountId }: {
  lang: Lang; permissions: string[]; onNavigate: (s: TenantScreen) => void;
  setSelectedAccountId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const { accounts, loading, forbidden, reload } = useAccountsData();
  const [search, setSearch] = useState("");
  const canCreate = hasPerm(permissions, "treasury.create");

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || (a.bankName ?? "").toLowerCase().includes(q));
  }, [accounts, search]);

  if (IS_MOCK_MODE) return <EmptyState lang={lang} messageAr="الوضع الحي فقط" messageEn="Live mode only" />;
  if (forbidden) return <PermissionDeniedState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <ScreenHeader
        lang={lang}
        title={isRTL ? "قائمة الحسابات" : "Account list"}
        onBack={() => onNavigate("accounts")}
        actions={
          <>
            <Btn variant="outline" size="sm" onClick={() => onNavigate("accounts")}><LayoutGrid size={14} />{isRTL ? "لوحة" : "Dashboard"}</Btn>
            {canCreate && <Btn size="sm" onClick={() => onNavigate("accounts-new")}><Plus size={14} />{isRTL ? "جديد" : "New"}</Btn>}
          </>
        }
      />

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isRTL ? "بحث..." : "Search..."}
          className="w-full ps-10 pe-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
      </div>

      {loading ? <LoadingState lang={lang} /> : filtered.length === 0 ? (
        <EmptyState lang={lang} messageAr="لا توجد حسابات" messageEn="No accounts" />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-start p-3 font-bold">{isRTL ? "الاسم" : "Name"}</th>
                  <th className="text-start p-3 font-bold">{isRTL ? "النوع" : "Type"}</th>
                  <th className="text-start p-3 font-bold">{isRTL ? "الرصيد" : "Balance"}</th>
                  <th className="text-start p-3 font-bold">{isRTL ? "البنك" : "Bank"}</th>
                  <th className="text-start p-3 font-bold">{isRTL ? "الحالة" : "Status"}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-800">{a.name}</td>
                    <td className="p-3"><AccountTypeBadge type={a.accountType} lang={lang} /></td>
                    <td className="p-3 font-mono font-black text-[#0F2C59]">{fmtMoney(a.currentBalance, a.currency, lang)}</td>
                    <td className="p-3 text-slate-500 text-xs">{a.bankName || "—"}</td>
                    <td className="p-3"><StatusBadge active={a.isActive} lang={lang} /></td>
                    <td className="p-3 text-end">
                      <Btn size="sm" variant="ghost" onClick={() => { setSelectedAccountId?.(a.id); onNavigate("accounts-detail"); }}>
                        <Eye size={14} />
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((a) => (
              <button key={a.id} type="button" onClick={() => { setSelectedAccountId?.(a.id); onNavigate("accounts-detail"); }}
                className="w-full text-start">
                <Card className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{a.name}</div>
                    <div className="flex gap-2 mt-1"><AccountTypeBadge type={a.accountType} lang={lang} /><StatusBadge active={a.isActive} lang={lang} /></div>
                  </div>
                  <div className="font-mono font-black text-[#0F2C59] text-sm">{fmtMoney(a.currentBalance, a.currency, lang)}</div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── SCREEN 3 & 4: ADD / EDIT FORM ───────────────────────────────────────────────
export function AccountFormScreen({ lang, permissions, onNavigate, accountId, setSelectedAccountId }: {
  lang: Lang; permissions: string[]; onNavigate: (s: TenantScreen) => void; accountId?: string;
  setSelectedAccountId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const isEdit = Boolean(accountId);
  const canSave = hasPerm(permissions, isEdit ? "treasury.update" : "treasury.create");

  const [loading, setLoading] = useState(isEdit && !IS_MOCK_MODE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"cashbox" | "bank">("cashbox");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [currency, setCurrency] = useState("AED");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!accountId || IS_MOCK_MODE) return;
    setLoading(true);
    void getMoneyAccount(accountId)
      .then((a) => {
        setName(a.name);
        setAccountType(a.accountType);
        setOpeningBalance(String(a.openingBalance));
        setCurrency(a.currency);
        setBankName(a.bankName ?? "");
        setAccountNumber(a.accountNumber ?? "");
        setIban(a.iban ?? "");
        setAllowNegative(a.allowNegative);
        setIsActive(a.isActive);
        setNotes(a.notes ?? "");
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [accountId]);

  const submit = async () => {
    if (!canSave) return;
    if (!name.trim()) { toast.error(isRTL ? "اسم الحساب مطلوب" : "Account name is required"); return; }
    setSaving(true);
    setFieldErrors({});
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        account_type: accountType,
        currency,
        bank_name: accountType === "bank" ? bankName.trim() : "",
        account_number: accountType === "bank" ? accountNumber.trim() : "",
        iban: accountType === "bank" ? iban.trim() : "",
        allow_negative: allowNegative,
        notes: notes.trim(),
      };
      if (isEdit) {
        body.is_active = isActive;
        await updateMoneyAccount(accountId!, body);
        toast.success(isRTL ? "تم تحديث الحساب" : "Account updated");
        onNavigate("accounts-detail");
      } else {
        body.opening_balance = openingBalance || "0";
        const created = await createMoneyAccount(body);
        setSelectedAccountId?.(created.id);
        toast.success(isRTL ? "تم إنشاء الحساب" : "Account created");
        onNavigate("accounts-detail");
      }
    } catch (e) {
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      setError(e);
      toast.error(e instanceof ApiError ? e.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (!canSave) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <ScreenHeader
        lang={lang}
        title={isEdit ? (isRTL ? "تعديل الحساب" : "Edit account") : (isRTL ? "إضافة حساب" : "Add account")}
        onBack={() => onNavigate(isEdit ? "accounts-detail" : "accounts")}
      />
      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />
      <Card className="p-5 lg:p-6 space-y-4">
        <FInput label={isRTL ? "اسم الحساب" : "Account name"} value={name} onChange={setName} required />
        <FSelect label={isRTL ? "نوع الحساب" : "Account type"} value={accountType} onChange={(v) => setAccountType(v as "cashbox" | "bank")}
          options={[
            { value: "cashbox", label: isRTL ? "خزنة" : "Cashbox" },
            { value: "bank", label: isRTL ? "حساب بنكي" : "Bank account" },
          ]} />
        {!isEdit && (
          <FInput label={isRTL ? "الرصيد الافتتاحي" : "Opening balance"} value={openingBalance} onChange={setOpeningBalance} type="number" mono />
        )}
        <FSelect label={isRTL ? "العملة" : "Currency"} value={currency} onChange={setCurrency}
          options={[{ value: "AED", label: "AED" }, { value: "USD", label: "USD" }, { value: "SAR", label: "SAR" }]} />
        {accountType === "bank" && (
          <>
            <FInput label={isRTL ? "اسم البنك" : "Bank name"} value={bankName} onChange={setBankName} />
            <FInput label={isRTL ? "رقم الحساب" : "Account number"} value={accountNumber} onChange={setAccountNumber} mono />
            <FInput label="IBAN" value={iban} onChange={setIban} mono />
          </>
        )}
        <Toggle
          label={isRTL ? "السماح بالرصيد السالب" : "Allow negative balance"}
          checked={allowNegative}
          onChange={setAllowNegative}
          hint={isRTL ? "عند التفعيل، يمكن أن يصبح الرصيد أقل من صفر" : "When enabled, balance may go below zero"}
        />
        {isEdit && (
          <Toggle label={isRTL ? "حساب نشط" : "Active account"} checked={isActive} onChange={setIsActive} />
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">{isRTL ? "ملاحظات" : "Notes"}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59] resize-y" />
        </div>
        <div className="flex gap-2 pt-2">
          <Btn variant="outline" onClick={() => onNavigate("accounts")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn onClick={() => void submit()} disabled={saving}>{isRTL ? "حفظ" : "Save"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN 5: DETAIL ────────────────────────────────────────────────────────────
export function AccountDetailScreen({ lang, permissions, onNavigate, accountId, setSelectedAccountId }: {
  lang: Lang; permissions: string[]; onNavigate: (s: TenantScreen) => void;
  accountId?: string; setSelectedAccountId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [account, setAccount] = useState<MoneyAccountRow | null>(null);
  const [recent, setRecent] = useState<MoneyMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MoneyAccountRow[]>([]);

  const canEdit = hasPerm(permissions, "treasury.update");
  const canAdjust = hasPerm(permissions, "treasury.adjust");
  const canTransfer = hasPerm(permissions, "treasury.transfer");

  const load = useCallback(async () => {
    if (!accountId || IS_MOCK_MODE) return;
    setLoading(true);
    try {
      const [acc, movs, accs] = await Promise.all([
        getMoneyAccount(accountId),
        listMoneyAccountMovements(accountId),
        listMoneyAccounts(),
      ]);
      setAccount(acc);
      setRecent(movs.slice(0, 8));
      setAllAccounts(accs);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  if (!accountId) return <EmptyState lang={lang} messageAr="اختر حساباً من القائمة" messageEn="Select an account from the list" />;
  if (loading) return <LoadingState lang={lang} />;
  if (!account) return <EmptyState lang={lang} messageAr="الحساب غير موجود" messageEn="Account not found" />;

  const isCash = account.accountType === "cashbox";

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      <ScreenHeader
        lang={lang}
        title={account.name}
        onBack={() => onNavigate("accounts")}
        actions={
          <>
            {canEdit && <Btn variant="outline" size="sm" onClick={() => onNavigate("accounts-edit")}><Pencil size={14} />{isRTL ? "تعديل" : "Edit"}</Btn>}
            <Btn variant="outline" size="sm" onClick={() => onNavigate("accounts-statement")}><Eye size={14} />{isRTL ? "كشف الحساب" : "Statement"}</Btn>
          </>
        }
      />

      <div className={`rounded-2xl p-6 text-white ${isCash ? "bg-gradient-to-br from-emerald-600 to-[#22C55E]" : "bg-gradient-to-br from-[#0F2C59] to-blue-700"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <AccountTypeBadge type={account.accountType} lang={lang} />
            <div className="text-white/80 text-sm mt-3">{isRTL ? "الرصيد الحالي" : "Current balance"}</div>
            <div className="text-3xl lg:text-4xl font-black font-mono mt-1">{fmtMoney(account.currentBalance, account.currency, lang)}</div>
          </div>
          <StatusBadge active={account.isActive} lang={lang} />
        </div>
        {account.accountType === "bank" && (
          <div className="mt-4 pt-4 border-t border-white/20 text-sm text-white/90 space-y-1">
            {account.bankName && <div>{account.bankName}</div>}
            {account.accountNumber && <div className="font-mono">{account.accountNumber}</div>}
            {account.iban && <div className="font-mono text-xs opacity-80">IBAN: {account.iban}</div>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-slate-500">{isRTL ? "افتتاحي" : "Opening"}</div><div className="font-mono font-bold">{fmtMoney(account.openingBalance, account.currency, lang)}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">{isRTL ? "العملة" : "Currency"}</div><div className="font-bold">{account.currency}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">{isRTL ? "رصيد سالب" : "Negative OK"}</div><div className="font-bold">{account.allowNegative ? (isRTL ? "نعم" : "Yes") : (isRTL ? "لا" : "No")}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">{isRTL ? "الحالة" : "Status"}</div><StatusBadge active={account.isActive} lang={lang} /></Card>
      </div>

      {account.notes && (
        <Card className="p-4"><div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "ملاحظات" : "Notes"}</div><p className="text-sm text-slate-700">{account.notes}</p></Card>
      )}

      <div className="flex flex-wrap gap-2">
        {canAdjust && <Btn variant="secondary" onClick={() => setAdjustOpen(true)}><SlidersHorizontal size={14} />{isRTL ? "تعديل يدوي" : "Adjust"}</Btn>}
        {canTransfer && <Btn variant="secondary" onClick={() => setTransferOpen(true)}><ArrowLeftRight size={14} />{isRTL ? "تحويل" : "Transfer"}</Btn>}
      </div>

      <Card className="p-4">
        <h3 className="font-black text-[#0F2C59] mb-4">{isRTL ? "آخر الحركات" : "Recent movements"}</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">{isRTL ? "لا توجد حركات بعد" : "No movements yet"}</p>
        ) : (
          <div className="space-y-3">
            {recent.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-3 last:border-0">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{m.description || movementLabel(m.movementType, lang)}</div>
                  <div className="text-xs text-slate-500">{m.movementDate}</div>
                </div>
                <div className={`font-mono font-bold shrink-0 ${m.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>
                  {m.direction === "in" ? "+" : "−"}{fmtMoney(m.amount, account.currency, lang)}
                </div>
              </div>
            ))}
          </div>
        )}
        <Btn variant="ghost" size="sm" className="mt-3" onClick={() => onNavigate("accounts-statement")}>
          {isRTL ? "عرض الكشف الكامل" : "View full statement"}
        </Btn>
      </Card>

      {adjustOpen && <AdjustmentModal lang={lang} account={account} onClose={() => setAdjustOpen(false)} onDone={() => void load()} />}
      {transferOpen && <TransferModal lang={lang} accounts={allAccounts} defaultFromId={account.id} onClose={() => setTransferOpen(false)} onDone={() => void load()} />}
    </div>
  );
}

// ── SCREEN 6: STATEMENT ─────────────────────────────────────────────────────────
export function AccountStatementScreen({ lang, permissions, onNavigate, accountId, onOpenReference }: {
  lang: Lang; permissions: string[]; onNavigate: (s: TenantScreen) => void;
  accountId?: string;
  onOpenReference?: (referenceType: string, referenceId: string) => void;
}) {
  const isRTL = lang === "ar";
  const canView = hasPerm(permissions, "treasury.movements.view");

  const [account, setAccount] = useState<MoneyAccountRow | null>(null);
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState(0);
  const [movements, setMovements] = useState<MoneyMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayIso());
  const [movementType, setMovementType] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!accountId || IS_MOCK_MODE) return;
    setLoading(true);
    try {
      const acc = await getMoneyAccount(accountId);
      setAccount(acc);
      const stmt = await getAccountStatement(accountId, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        movementType: movementType || undefined,
        search: search.trim() || undefined,
      });
      setOpening(stmt.openingBalance);
      setClosing(stmt.closingBalance);
      setMovements(stmt.movements);
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo, movementType, search]);

  useEffect(() => { void load(); }, [load]);

  if (!canView) return <PermissionDeniedState lang={lang} />;
  if (!accountId) return <EmptyState lang={lang} messageAr="اختر حساباً" messageEn="Select an account" />;

  const movementOptions = [
    { value: "", label: isRTL ? "كل الأنواع" : "All types" },
    ...Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: isRTL ? v.ar : v.en })),
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <ScreenHeader
        lang={lang}
        title={isRTL ? "كشف حساب" : "Account statement"}
        subtitle={account?.name}
        onBack={() => onNavigate("accounts-detail")}
        actions={
          account && (
            <Btn variant="outline" size="sm" onClick={() => exportStatementCsv(account, movements, opening, closing, lang)}>
              <Download size={14} />{isRTL ? "تصدير" : "Export"}
            </Btn>
          )
        }
      />

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FInput label={isRTL ? "من تاريخ" : "From date"} value={dateFrom} onChange={setDateFrom} type="date" />
        <FInput label={isRTL ? "إلى تاريخ" : "To date"} value={dateTo} onChange={setDateTo} type="date" />
        <FSelect label={isRTL ? "نوع الحركة" : "Movement type"} value={movementType} onChange={setMovementType} options={movementOptions} />
        <FInput label={isRTL ? "بحث" : "Search"} value={search} onChange={setSearch} placeholder={isRTL ? "وصف أو مرجع..." : "Description or ref..."} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-4 border-emerald-200/60 bg-emerald-50/50">
          <div className="text-xs text-emerald-800 font-bold">{isRTL ? "الرصيد الافتتاحي" : "Opening balance"}</div>
          <div className="text-xl font-black font-mono text-emerald-900 mt-1">{account ? fmtMoney(opening, account.currency, lang) : "—"}</div>
        </Card>
        <Card className="p-4 border-[#0F2C59]/20 bg-[#0F2C59]/5">
          <div className="text-xs text-[#0F2C59] font-bold">{isRTL ? "الرصيد الختامي" : "Closing balance"}</div>
          <div className="text-xl font-black font-mono text-[#0F2C59] mt-1">{account ? fmtMoney(closing, account.currency, lang) : "—"}</div>
        </Card>
      </div>

      {loading ? <LoadingState lang={lang} /> : movements.length === 0 ? (
        <EmptyState lang={lang} messageAr="لا توجد حركات في هذه الفترة" messageEn="No movements in this period" />
      ) : (
        <>
          <Card className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-start p-3">{isRTL ? "التاريخ" : "Date"}</th>
                  <th className="text-start p-3">{isRTL ? "النوع" : "Type"}</th>
                  <th className="text-start p-3">{isRTL ? "الوصف" : "Description"}</th>
                  <th className="text-start p-3">{isRTL ? "المرجع" : "Reference"}</th>
                  <th className="text-end p-3">{isRTL ? "وارد" : "In"}</th>
                  <th className="text-end p-3">{isRTL ? "صادر" : "Out"}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono text-xs">{m.movementDate}</td>
                    <td className="p-3">{movementLabel(m.movementType, lang)}</td>
                    <td className="p-3 max-w-xs truncate">{m.description || m.reason}</td>
                    <td className="p-3">
                      {m.referenceId ? (
                        <button type="button" className="text-[#0F2C59] font-bold text-xs hover:underline"
                          onClick={() => onOpenReference?.(m.referenceType, m.referenceId)}>
                          {m.referenceType}:{m.referenceId}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-end font-mono text-emerald-600">{m.direction === "in" ? fmtMoney(m.amount, account?.currency, lang) : ""}</td>
                    <td className="p-3 text-end font-mono text-red-600">{m.direction === "out" ? fmtMoney(m.amount, account?.currency, lang) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="lg:hidden space-y-3">
            {movements.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-sm">{movementLabel(m.movementType, lang)}</div>
                    <div className="text-xs text-slate-500 mt-1">{m.movementDate}</div>
                    {(m.description || m.reason) && <div className="text-xs text-slate-600 mt-2">{m.description || m.reason}</div>}
                    {m.referenceId && (
                      <button type="button" className="text-xs text-[#0F2C59] font-bold mt-2 hover:underline"
                        onClick={() => onOpenReference?.(m.referenceType, m.referenceId)}>
                        {m.referenceType}:{m.referenceId}
                      </button>
                    )}
                  </div>
                  <div className={`font-mono font-black text-sm ${m.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>
                    {m.direction === "in" ? "+" : "−"}{fmtMoney(m.amount, account?.currency, lang)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
