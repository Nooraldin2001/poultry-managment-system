// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — EXPENSES MANAGEMENT MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Plus, X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, CheckCircle, Download, Printer,
  TrendingDown, TrendingUp, Calendar, Clock, Settings,
  Receipt, RefreshCw, BarChart2, FileText, Eye, Pencil,
  DollarSign, Tag, Layers, Lock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { toast } from "sonner";
import { useExpenses } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { toModuleExpense } from "./moduleMappers";
import { IS_MOCK_MODE } from "@/services/config";
import { LivePrintPreviewScreen } from "@/features/print/LivePrintPreviewScreen";
import { getExpenseVoucherPreview, getExpensesSummary, listRecurringExpenses, listExpenseCategories, createExpense, createExpenseCategory } from "@/services/expenseService";
import { getDefaultTaxDateRange, getDefaultStatementDateRange, lastNDaysIso, todayIsoDate } from "@/shared/utils/dateRanges";
import { LiveExpenseDetailScreen } from "@/features/documents/LiveExpenseDetailScreen";
import { ApiError } from "@/services/api/errors";
import { FormErrors } from "@/shared/components/FormErrors";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "purchases" | "purchases-new"
  | "inventory" | "customers" | "suppliers" | "payments"
  | "expenses" | "expenses-list" | "expenses-recurring" | "expenses-report" | "expense-detail" | "expense-voucher"
  | "accounts" | "tax" | "reports" | "users" | "settings";
type ExpType = "daily" | "monthly" | "purchase" | "recurring" | "adjustment";
type ExpStatus = "paid" | "unpaid" | "partial" | "cancelled";

// ── LOCAL UI ───────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "green" | "amber";
  size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean;
}) {
  const s = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const v = {
    primary:   "bg-[#0F2C59] text-white border-[#0F2C59] hover:bg-[#162f5f]",
    secondary: "bg-white text-[#0F2C59] border-[#0F2C59]/20 hover:bg-[#0F2C59]/5",
    danger:    "bg-[#EF4444] text-white border-[#EF4444] hover:bg-red-600",
    ghost:     "bg-transparent text-slate-500 border-transparent hover:bg-slate-100",
    outline:   "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
    green:     "bg-[#22C55E] text-white border-[#22C55E] hover:bg-emerald-600",
    amber:     "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
  };
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 font-bold rounded-xl transition-all cursor-pointer border active:scale-[0.98] focus:outline-none ${s[size]} ${v[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>{children}</button>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>;
}
function FInput({ label, placeholder, type = "text", value, onChange, required = false }: {
  label: string; placeholder?: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59] focus:ring-2 focus:ring-[#0F2C59]/10" />
    </div>
  );
}
function FSelect({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59] appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function PermBtn({ children, lang }: { children: ReactNode; lang: Lang }) {
  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200 opacity-60">{children}</div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl whitespace-nowrap`}>
        {lang === "ar" ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission"}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface Expense {
  id: string; date: string; type: ExpType; category: string; categoryAr: string;
  description: string; amount: number; method: string; status: ExpStatus;
  user: string; purchaseInv?: string; treatment?: string;
}
const MOCK_EXPENSES: Expense[] = [
  { id: "EXP-001", date: "2025-01-28", type: "daily",    category: "Fuel",           categoryAr: "وقود",              description: "وقود لسيارة التوصيل",         amount: 120,   method: "cash",  status: "paid",   user: "محمد (كاشير)" },
  { id: "EXP-002", date: "2025-01-28", type: "daily",    category: "Labor",          categoryAr: "مصاريف عمال",       description: "بدل يومي للعمال",              amount: 80,    method: "cash",  status: "paid",   user: "محمد (كاشير)" },
  { id: "EXP-003", date: "2025-01-28", type: "daily",    category: "Loading",        categoryAr: "تحميل وتنزيل",      description: "تحميل وتنزيل بضاعة",          amount: 150,   method: "cash",  status: "paid",   user: "محمد (كاشير)" },
  { id: "EXP-004", date: "2025-01-27", type: "daily",    category: "Maintenance",    categoryAr: "صيانة",             description: "صيانة سيارة التوصيل",         amount: 450,   method: "bank",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-005", date: "2025-01-27", type: "daily",    category: "Misc",           categoryAr: "مصروفات متنوعة",    description: "مصاريف تشغيل عامة",           amount: 60,    method: "cash",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-M01", date: "2025-01-01", type: "monthly",  category: "Rent",           categoryAr: "إيجار السكن",       description: "إيجار مقر الشركة",            amount: 4500,  method: "bank",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-M02", date: "2025-01-05", type: "monthly",  category: "Vehicle",        categoryAr: "إيجار السيارات",    description: "إيجار السيارة الرئيسية",       amount: 2300,  method: "bank",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-M03", date: "2025-01-30", type: "monthly",  category: "Salaries",       categoryAr: "الرواتب",           description: "رواتب الموظفين يناير",         amount: 18000, method: "bank",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-M04", date: "2025-01-15", type: "monthly",  category: "Internet",       categoryAr: "إنترنت واتصالات",   description: "فاتورة الإنترنت والهاتف",      amount: 650,   method: "bank",  status: "paid",   user: "أحمد (مالك)"  },
  { id: "EXP-M05", date: "2025-01-20", type: "monthly",  category: "Utilities",      categoryAr: "كهرباء ومياه",      description: "فواتير الكهرباء والماء",       amount: 1200,  method: "bank",  status: "unpaid", user: "أحمد (مالك)"  },
  { id: "EXP-P01", date: "2025-01-28", type: "purchase", category: "Slaughter",      categoryAr: "تكلفة الذبح",       description: "تكلفة ذبح — PUR-2025-0042",   amount: 700,   method: "cash",  status: "paid",   user: "أحمد (مالك)", purchaseInv: "PUR-2025-0042", treatment: "add-cost" },
  { id: "EXP-P02", date: "2025-01-28", type: "purchase", category: "Transport",      categoryAr: "تكلفة النقل",       description: "نقل من المزرعة",               amount: 300,   method: "cash",  status: "paid",   user: "أحمد (مالك)", purchaseInv: "PUR-2025-0042", treatment: "deduct-supplier" },
  { id: "EXP-P03", date: "2025-01-25", type: "purchase", category: "Loading",        categoryAr: "تحميل وتنزيل",      description: "تحميل وتنزيل",                 amount: 150,   method: "cash",  status: "paid",   user: "أحمد (مالك)", purchaseInv: "PUR-2025-0041", treatment: "expense-only" },
];

const RECURRING = [
  { id: "REC-01", name: "إيجار السكن",        category: "إيجار السكن",        amount: 4500,  freq: "شهري",  dueDay: 1,  lastPaid: "2025-01-01", nextDue: "2025-02-01", active: true  },
  { id: "REC-02", name: "إيجار السيارات",     category: "إيجار السيارات",     amount: 2300,  freq: "شهري",  dueDay: 5,  lastPaid: "2025-01-05", nextDue: "2025-02-05", active: true  },
  { id: "REC-03", name: "الرواتب",            category: "الرواتب",            amount: 18000, freq: "شهري",  dueDay: 30, lastPaid: "2025-01-30", nextDue: "2025-02-28", active: true  },
  { id: "REC-04", name: "إنترنت واتصالات",   category: "إنترنت واتصالات",   amount: 650,   freq: "شهري",  dueDay: 15, lastPaid: "2025-01-15", nextDue: "2025-02-15", active: true  },
  { id: "REC-05", name: "اشتراك نظام",       category: "اشتراكات",          amount: 350,   freq: "شهري",  dueDay: 1,  lastPaid: "2025-01-01", nextDue: "2025-02-01", active: true  },
];

const EXPENSE_TREND = [
  { day: "الأحد",    dayEn: "Sun", total: 620  },
  { day: "الاثنين",  dayEn: "Mon", total: 850  },
  { day: "الثلاثاء", dayEn: "Tue", total: 430  },
  { day: "الأربعاء", dayEn: "Wed", total: 1150 },
  { day: "الخميس",   dayEn: "Thu", total: 780  },
  { day: "الجمعة",   dayEn: "Fri", total: 290  },
  { day: "اليوم",    dayEn: "Today", total: 850 },
];

const CAT_DIST = [
  { name: "الرواتب",        nameEn: "Salaries",      value: 18000, color: "#0F2C59" },
  { name: "إيجارات",        nameEn: "Rent",          value: 6800,  color: "#22C55E" },
  { name: "مصاريف يومية",  nameEn: "Daily Ops",     value: 12400, color: "#F59E0B" },
  { name: "مشتريات مرتبطة",nameEn: "Purchase",      value: 1150,  color: "#8B5CF6" },
  { name: "خدمات ومرافق",  nameEn: "Utilities",     value: 1850,  color: "#06B6D4" },
];

const DAILY_CATS_AR = ["وقود","مصاريف عمال","مصاريف تشغيل","مصروفات متنوعة","صيانة","تحميل وتنزيل","وجبات","رسوم حكومية","أخرى"];
const MONTHLY_CATS_AR = ["إيجار السكن","إيجار السيارات","أقساط السيارات","الرواتب","اشتراكات","كهرباء ومياه","إنترنت واتصالات","تأمين","مصاريف شهرية ثابتة","أخرى"];
const PURCHASE_CATS_AR = ["تكلفة النقل","تكلفة الذبح","تحميل وتنزيل","تعبئة وتغليف","رسوم مسلخ","فرق وزن","أخرى"];

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────
function ExpTypeBadge({ type, lang }: { type: ExpType; lang: Lang }) {
  const cfg = {
    daily:      { bg: "bg-blue-50",    t: "text-blue-700",    ar: "يومي",        en: "Daily" },
    monthly:    { bg: "bg-violet-50",  t: "text-violet-700",  ar: "شهري",        en: "Monthly" },
    purchase:   { bg: "bg-amber-50",   t: "text-amber-700",   ar: "مرتبط بشراء", en: "Purchase-Linked" },
    recurring:  { bg: "bg-emerald-50", t: "text-emerald-700", ar: "متكرر",        en: "Recurring" },
    adjustment: { bg: "bg-slate-100",  t: "text-slate-600",   ar: "تسوية",        en: "Adjustment" },
  }[type];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}
function ExpStatusBadge({ status, lang }: { status: ExpStatus; lang: Lang }) {
  const cfg = {
    paid:      { bg: "bg-emerald-50", t: "text-emerald-700", ar: "مدفوع",          en: "Paid" },
    unpaid:    { bg: "bg-red-50",     t: "text-red-700",     ar: "غير مدفوع",      en: "Unpaid" },
    partial:   { bg: "bg-amber-50",   t: "text-amber-700",   ar: "مدفوع جزئياً",  en: "Partial" },
    cancelled: { bg: "bg-slate-100",  t: "text-slate-500",   ar: "ملغي",           en: "Cancelled" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

function expenseRowFromMock(e: Expense) {
  return { id: e.id, category: e.category, categoryEn: e.category, amount: e.amount, date: e.date, method: e.method, note: e.description, status: e.status };
}

function enrichExpense(row: import("@/shared/types/entities").ExpenseRow, mock?: Expense): Expense {
  const m = toModuleExpense(row);
  if (IS_MOCK_MODE && mock) {
    return {
      id: m.id,
      date: m.date,
      type: mock.type,
      category: m.category,
      categoryAr: mock.categoryAr,
      description: mock.description,
      amount: m.amount,
      method: m.method,
      status: mock.status as ExpStatus,
      user: mock.user,
      purchaseInv: mock.purchaseInv,
      treatment: mock.treatment,
    };
  }
  return {
    id: m.id,
    date: m.date ?? "",
    type: "daily",
    category: m.category ?? "",
    categoryAr: m.category ?? "",
    description: m.note ?? "",
    amount: m.amount,
    method: m.method ?? "",
    status: (m.status ?? "paid") as ExpStatus,
    user: "",
  };
}

const CHART_COLORS = ["#0F2C59", "#22C55E", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444"];

function buildCategoryDist(
  expenses: Expense[],
  isRTL: boolean,
): { name: string; nameEn: string; value: number; color: string }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const key = e.categoryAr || e.category || "Other";
    totals.set(key, (totals.get(key) ?? 0) + e.amount);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({
      name,
      nameEn: name,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}

function buildExpenseTrend(expenses: Expense[], isRTL: boolean) {
  const days = lastNDaysIso(7);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Today"];
  const arLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "اليوم"];
  return days.map((iso, i) => ({
    day: arLabels[i] ?? iso,
    dayEn: dayLabels[i] ?? iso,
    total: expenses.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0),
  }));
}

// ── SCREEN: EXPENSES OVERVIEW ──────────────────────────────────────────────────
export function ExpensesOverviewScreen({ lang, role, onNavigate }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
}) {
  const isRTL = lang === "ar";
  const [showAddModal, setShowAddModal] = useState<"daily" | "monthly" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfitPanel, setShowProfitPanel] = useState(false);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [recurringRows, setRecurringRows] = useState<typeof RECURRING>([]);
  const [recurringLoading, setRecurringLoading] = useState(!IS_MOCK_MODE);

  const { items: expenseRows, loading, error, forbidden, reload } = useExpenses(undefined, async () => MOCK_EXPENSES.map(expenseRowFromMock));
  const EXPENSES = expenseRows.map((row) =>
    enrichExpense(row, IS_MOCK_MODE ? MOCK_EXPENSES.find((m) => m.id === row.id) : undefined),
  );

  const monthRange = getDefaultTaxDateRange();
  const today = todayIsoDate();

  useEffect(() => {
    if (IS_MOCK_MODE) {
      setRecurringRows(RECURRING);
      setRecurringLoading(false);
      return;
    }
    setRecurringLoading(true);
    void getExpensesSummary({ date_from: monthRange.date_from, date_to: monthRange.date_to })
      .then(setSummary)
      .catch(() => setSummary({}));
    void listRecurringExpenses()
      .then((rows) => {
        setRecurringRows(rows.map((r) => ({
          id: r.id,
          name: r.title ?? r.category,
          category: r.category,
          amount: r.amount,
          freq: r.frequency,
          dueDay: 1,
          lastPaid: "",
          nextDue: r.nextDate ?? "",
          active: r.active,
        })));
      })
      .catch(() => setRecurringRows([]))
      .finally(() => setRecurringLoading(false));
  }, [IS_MOCK_MODE, monthRange.date_from, monthRange.date_to]);

  const catDist = useMemo(
    () => (IS_MOCK_MODE ? CAT_DIST : buildCategoryDist(EXPENSES, isRTL)),
    [EXPENSES, isRTL],
  );
  const expenseTrend = useMemo(
    () => (IS_MOCK_MODE ? EXPENSE_TREND : buildExpenseTrend(EXPENSES, isRTL)),
    [EXPENSES, isRTL],
  );
  const upcomingRecurring = IS_MOCK_MODE ? RECURRING : recurringRows;

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const canAdd = role === "owner" || role === "accountant";
  const todayExp = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.date === "2025-01-28" && e.type === "daily").reduce((s, e) => s + e.amount, 0)
    : (summary.daily_expenses ?? EXPENSES.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0));
  const monthlyFixed = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "monthly").reduce((s, e) => s + e.amount, 0)
    : (summary.monthly_expenses ?? 0);
  const monthlyDaily = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "daily").reduce((s, e) => s + e.amount, 0)
    : (summary.total_expenses ?? EXPENSES.reduce((s, e) => s + e.amount, 0));
  const purchaseExp = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "purchase").reduce((s, e) => s + e.amount, 0)
    : (summary.purchase_linked_expenses ?? 0);
  const upcomingRecurringTotal = upcomingRecurring
    .filter((r) => r.active)
    .reduce((s, r) => s + r.amount, 0);
  const topCategory = catDist[0]?.name ?? "—";

  const kpis = [
    { v: `AED ${todayExp.toLocaleString()}`,                ar: "مصروفات اليوم",                 en: "Today's Expenses",       bg: "bg-red-500",     click: () => onNavigate("expenses-list") },
    { v: `AED ${(monthlyDaily + (IS_MOCK_MODE ? monthlyFixed : 0)).toLocaleString()}`, ar: "مصروفات هذا الشهر",      en: "This Month's Expenses",  bg: "bg-amber-500",   click: undefined },
    { v: `AED ${monthlyDaily.toLocaleString()}`,            ar: "مصروفات يومية",                 en: "Daily Expenses",         bg: "bg-blue-500",    click: undefined },
    { v: `AED ${monthlyFixed.toLocaleString()}`,            ar: "مصروفات شهرية",                 en: "Monthly Expenses",       bg: "bg-violet-500",  click: undefined },
    { v: `AED ${purchaseExp.toLocaleString()}`,             ar: "مرتبطة بالمشتريات",             en: "Purchase-Linked",        bg: "bg-[#0F2C59]",   click: undefined },
    { v: `AED ${upcomingRecurringTotal.toLocaleString()}`,  ar: "متكررة قادمة هذا الشهر",        en: "Upcoming Recurring",     bg: "bg-emerald-500", click: () => onNavigate("expenses-recurring") },
    { v: topCategory,                                       ar: "أكبر تصنيف مصروف",             en: "Top Category",           bg: "bg-slate-500",   click: undefined },
    { v: `AED ${todayExp.toLocaleString()}`,                ar: "تأثير على صافي الربح اليوم",    en: "Today Profit Impact",    bg: "bg-emerald-600", click: () => setShowProfitPanel(true) },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "المصروفات" : "Expenses"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{isRTL ? "إدارة المصروفات اليومية والشهرية والمتكررة" : "Manage daily, monthly and recurring expenses"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="outline" size="sm" onClick={() => onNavigate("expenses-recurring")}><RefreshCw size={13} />{isRTL ? "المتكررة" : "Recurring"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => onNavigate("expenses-report")}><BarChart2 size={13} />{isRTL ? "تقرير" : "Report"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowSettings(true)}><Settings size={14} /></Btn>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} onClick={k.click} className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 transition-all hover:shadow-md ${k.click ? "cursor-pointer hover:border-slate-300" : ""}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><Receipt size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
          </div>
        ))}
      </div>

      {/* Explanation banner */}
      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl px-4 py-3 flex gap-2">
        <Info size={14} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-slate-500 leading-relaxed">{isRTL ? "المصروفات اليومية تخص يوم العمل، والمصروفات الشهرية تخص الشهر بالكامل، والمصروفات المرتبطة بالمشتريات يمكن ربطها بفاتورة شراء." : "Daily expenses apply to the work day, monthly expenses apply to the full month, and purchase-linked expenses can be linked to a purchase invoice."}</p>
      </div>

      {/* Quick Actions */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "إجراءات سريعة" : "Quick Actions"}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {canAdd
            ? <Btn variant="primary" className="justify-center" onClick={() => setShowAddModal("daily")}><Plus size={15} />{isRTL ? "مصروف يومي" : "Daily Expense"}</Btn>
            : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "مصروف يومي" : "Daily Expense"}</PermBtn>}
          {canAdd
            ? <Btn variant="secondary" className="justify-center" onClick={() => setShowAddModal("monthly")}><Plus size={15} />{isRTL ? "مصروف شهري" : "Monthly Expense"}</Btn>
            : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "مصروف شهري" : "Monthly Expense"}</PermBtn>}
          <Btn variant="outline" className="justify-center" onClick={() => onNavigate("expenses-recurring")}><RefreshCw size={15} />{isRTL ? "مصروف متكرر" : "Recurring"}</Btn>
          <Btn variant="outline" className="justify-center" onClick={() => onNavigate("expenses-report")}><BarChart2 size={15} />{isRTL ? "تقرير المصروفات" : "Expense Report"}</Btn>
        </div>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend Line */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "مصروفات آخر 7 أيام (AED)" : "Last 7 Days Expenses (AED)"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={expenseTrend}>
              <CartesianGrid key="exp-trend-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="exp-trend-x" dataKey={isRTL ? "day" : "dayEn"} tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="exp-trend-y" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="exp-trend-tip" contentStyle={{ borderRadius: 12, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Line key="exp-line" type="monotone" dataKey="total" stroke="#EF4444" strokeWidth={2.5} dot={false} name={isRTL ? "المصروفات" : "Expenses"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Donut */}
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "توزيع التصنيفات" : "Category Distribution"}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie key="exp-cat-pie" data={catDist.length ? catDist : [{ name: isRTL ? "لا بيانات" : "No data", nameEn: "No data", value: 1, color: "#e2e8f0" }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                {(catDist.length ? catDist : [{ name: "—", nameEn: "—", value: 1, color: "#e2e8f0" }]).map((e, i) => <Cell key={`ec-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="exp-cat-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [`AED ${v.toLocaleString()}`, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {(catDist.length ? catDist : []).map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} /><span className="font-semibold text-slate-600">{isRTL ? c.name : c.nameEn}</span></div>
                <span className="font-mono font-bold text-slate-700">AED {c.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Latest Expenses + Upcoming Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "آخر المصروفات" : "Latest Expenses"}</h3>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate("expenses-list")}><Eye size={13} />{isRTL ? "عرض الكل" : "All"}</Btn>
          </div>
          <div className="divide-y divide-slate-50">
            {EXPENSES.length === 0 && !IS_MOCK_MODE && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{isRTL ? "لا توجد مصروفات بعد" : "No expenses yet"}</div>
            )}
            {EXPENSES.slice(0, 5).map(e => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><span className="font-bold text-sm text-slate-800">{e.categoryAr}</span><ExpTypeBadge type={e.type} lang={lang} /></div>
                  <div className="text-xs text-slate-400">{e.date} · {e.user}</div>
                </div>
                <div className="text-end"><div className="font-mono font-black text-red-500">AED {e.amount.toLocaleString()}</div><div className="text-xs text-slate-400">{e.method}</div></div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "المصروفات المتكررة القادمة" : "Upcoming Recurring"}</h3>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate("expenses-recurring")}><Eye size={13} />{isRTL ? "عرض الكل" : "All"}</Btn>
          </div>
          <div className="divide-y divide-slate-50">
            {recurringLoading ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
            ) : upcomingRecurring.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{isRTL ? "لا توجد مصروفات متكررة" : "No recurring expenses"}</div>
            ) : upcomingRecurring.slice(0, 4).map(r => {
              const daysLeft = Math.ceil((new Date(r.nextDue).getTime() - Date.now()) / 86400000);
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                  <div><div className="font-bold text-sm text-slate-800">{r.name}</div><div className="text-xs text-slate-400">{isRTL ? `يوم ${r.dueDay} شهرياً` : `Day ${r.dueDay} monthly`}</div></div>
                  <div className="text-end">
                    <div className="font-mono font-black text-violet-600">AED {r.amount.toLocaleString()}</div>
                    <div className={`text-xs font-bold ${daysLeft <= 3 ? "text-amber-500" : "text-slate-400"}`}>{daysLeft <= 0 ? (isRTL ? "متأخر!" : "Overdue!") : isRTL ? `خلال ${daysLeft} يوم` : `in ${daysLeft} days`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {showAddModal && <AddExpenseModal lang={lang} defaultType={showAddModal} onClose={() => setShowAddModal(null)} onSuccess={() => void reload()} />}
      {showSettings && <ExpenseSettingsPanel lang={lang} role={role} onClose={() => setShowSettings(false)} />}
      {showProfitPanel && <ProfitImpactPanel lang={lang} onClose={() => setShowProfitPanel(false)} />}
    </div>
  );
}

// ── SCREEN: EXPENSES LIST ──────────────────────────────────────────────────────
export function ExpensesListScreen({ lang, role, onNavigate, setSelectedExpense }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedExpense: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showAddModal, setShowAddModal] = useState<"daily" | "monthly" | null>(null);
  const canAdd = role === "owner" || role === "accountant";
  const canEdit = role === "owner" || role === "accountant";

  const { items: expenseRows, loading, error, forbidden, reload } = useExpenses(
    search ? { search } : undefined,
    async () => MOCK_EXPENSES.map(expenseRowFromMock),
  );
  const EXPENSES = expenseRows.map((row) =>
    enrichExpense(row, IS_MOCK_MODE ? MOCK_EXPENSES.find((m) => m.id === row.id) : undefined),
  );

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const filtered = EXPENSES.filter(e => {
    const q = search.toLowerCase();
    return (!q || e.description.toLowerCase().includes(q) || e.categoryAr.includes(search)) &&
      (filterType === "all" || e.type === filterType);
  });

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "قائمة المصروفات" : "Expenses List"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{EXPENSES.length} {isRTL ? "مصروف مسجل" : "expenses recorded"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAdd && <Btn variant="primary" size="sm" onClick={() => setShowAddModal("daily")}><Plus size={14} />{isRTL ? "مصروف يومي" : "Daily"}</Btn>}
          {canAdd && <Btn variant="secondary" size="sm" onClick={() => setShowAddModal("monthly")}><Plus size={14} />{isRTL ? "مصروف شهري" : "Monthly"}</Btn>}
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "بحث بالوصف أو التصنيف..." : "Search description or category..."}
              className={`w-full py-2 ps-4 pe-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59]`} />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الأنواع" : "All Types"}</option>
            <option value="daily">{isRTL ? "يومي" : "Daily"}</option>
            <option value="monthly">{isRTL ? "شهري" : "Monthly"}</option>
            <option value="purchase">{isRTL ? "مرتبط بشراء" : "Purchase-Linked"}</option>
            <option value="recurring">{isRTL ? "متكرر" : "Recurring"}</option>
          </select>
        </div>
      </Card>

      {/* Desktop Table */}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "رقم المصروف" : "Exp #", isRTL ? "التاريخ" : "Date", isRTL ? "نوع المصروف" : "Type", isRTL ? "التصنيف" : "Category", isRTL ? "الوصف" : "Description", isRTL ? "المبلغ" : "Amount", isRTL ? "طريقة الدفع" : "Method", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#0F2C59] font-bold">{e.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.date}</td>
                    <td className="px-4 py-3"><ExpTypeBadge type={e.type} lang={lang} /></td>
                    <td className="px-4 py-3 font-bold text-slate-700 text-sm">{e.categoryAr}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{e.description}</td>
                    <td className="px-4 py-3 font-mono font-black text-red-500">AED {e.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{e.method}</td>
                    <td className="px-4 py-3"><ExpStatusBadge status={e.status} lang={lang} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedExpense(e.id); onNavigate("expense-detail"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all"><Eye size={13} /></button>
                        {canEdit && e.status !== "cancelled" && <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Pencil size={13} /></button>}
                        <button onClick={() => { setSelectedExpense(e.id); onNavigate("expense-voucher"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Printer size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map(e => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5"><span className="font-black text-slate-800 text-sm">{e.categoryAr}</span><ExpTypeBadge type={e.type} lang={lang} /></div>
                <div className="text-xs text-slate-400">{e.date} · {e.user}</div>
              </div>
              <div className="text-end"><div className="font-mono font-black text-red-500">AED {e.amount.toLocaleString()}</div><ExpStatusBadge status={e.status} lang={lang} /></div>
            </div>
            <p className="text-xs text-slate-500 mb-2">{e.description}</p>
            <div className="flex gap-2">
              <Btn size="sm" variant="secondary" onClick={() => { setSelectedExpense(e.id); onNavigate("expense-detail"); }}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
              <Btn size="sm" variant="outline" onClick={() => { setSelectedExpense(e.id); onNavigate("expense-voucher"); }}><Printer size={13} /></Btn>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState lang={lang} messageAr="لا توجد مصروفات بعد" messageEn="No expenses yet" />
      )}

      {showAddModal && <AddExpenseModal lang={lang} defaultType={showAddModal} onClose={() => setShowAddModal(null)} onSuccess={() => void reload()} />}
    </div>
  );
}

// ── MODAL: ADD EXPENSE ─────────────────────────────────────────────────────────
export function AddExpenseModal({ lang, defaultType = "daily", onClose, onSuccess }: {
  lang: Lang; defaultType?: "daily" | "monthly"; onClose: () => void; onSuccess?: () => void;
}) {
  const isRTL = lang === "ar";
  const [expType, setExpType] = useState<"daily" | "monthly" | "purchase">(defaultType);
  const [date, setDate] = useState(todayIsoDate());
  const [month, setMonth] = useState(todayIsoDate().slice(0, 7));
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paidFrom, setPaidFrom] = useState("خزنة");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [monthlyStatus, setMonthlyStatus] = useState("paid");
  const [purchaseInv, setPurchaseInv] = useState("");
  const [treatment, setTreatment] = useState("expense-only");
  const [saving, setSaving] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(!IS_MOCK_MODE);
  const [apiCategories, setApiCategories] = useState<{ id: number; nameAr: string; nameEn: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const reloadCategories = () => {
    if (IS_MOCK_MODE) {
      setCategoriesLoading(false);
      return;
    }
    setCategoriesLoading(true);
    listExpenseCategories()
      .then((rows) => setApiCategories(rows.filter((c) => c.active)))
      .catch(() => setApiCategories([]))
      .finally(() => setCategoriesLoading(false));
  };

  useEffect(() => {
    reloadCategories();
  }, []);

  const mockCategories = expType === "daily" ? DAILY_CATS_AR : expType === "monthly" ? MONTHLY_CATS_AR : PURCHASE_CATS_AR;
  const categoryOptions = IS_MOCK_MODE
    ? mockCategories.map((c) => ({ value: c, label: c }))
    : apiCategories.map((c) => ({
        value: String(c.id),
        label: isRTL ? c.nameAr : (c.nameEn || c.nameAr),
      }));

  const mapPaymentMethod = (m: string) => (m === "bank" ? "bank_transfer" : m);
  const mapPurchaseBehavior = (t: string) => {
    if (t === "add-cost") return "increase_inventory_cost";
    if (t === "deduct-supplier") return "reduce_supplier_payable";
    return "expense_only";
  };
  const resolveExpenseDate = () => (expType === "monthly" ? `${month}-01` : date);

  const submitExpense = async (andAddAnother: boolean) => {
    if (!amount || !category || !description.trim()) {
      toast.error(isRTL ? "يرجى إكمال الحقول المطلوبة" : "Fill required fields");
      return;
    }
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ المصروف ✓" : "Expense saved ✓");
      if (!andAddAnother) onClose();
      return;
    }
    if (!apiCategories.length && !category) {
      toast.error(isRTL ? "أنشئ تصنيف مصروف أولاً" : "Create an expense category first");
      return;
    }
    setSaving(true);
    setFieldErrors({});
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        category: Number(category),
        title: description.trim(),
        description: notes.trim(),
        expense_date: resolveExpenseDate(),
        amount,
        expense_scope: expType === "purchase" ? "purchase_linked" : expType,
        payment_method: mapPaymentMethod(method),
        reference_number: ref.trim(),
        notes: notes.trim(),
        vendor_name: paidFrom.trim(),
      };
      if (expType === "purchase") {
        payload.purchase_link_behavior = mapPurchaseBehavior(treatment);
        if (purchaseInv) payload.linked_purchase_invoice = Number(purchaseInv);
      }
      await createExpense(payload);
      toast.success(
        expType === "daily"
          ? (isRTL ? "تم تسجيل المصروف اليومي بنجاح" : "Daily expense recorded")
          : expType === "monthly"
            ? (isRTL ? "تم تسجيل المصروف الشهري بنجاح" : "Monthly expense recorded")
            : (isRTL ? "تم تسجيل المصروف المرتبط بنجاح" : "Purchase-linked expense recorded"),
      );
      onSuccess?.();
      if (andAddAnother) {
        setDescription("");
        setAmount("");
        setCategory("");
        setNotes("");
        setRef("");
      } else {
        onClose();
      }
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل حفظ المصروف" : "Failed to save expense"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const created = await createExpenseCategory({ name_ar: name, name_en: name });
      setApiCategories((prev) => [...prev, { id: created.id, nameAr: created.nameAr, nameEn: created.nameEn }]);
      setCategory(String(created.id));
      setShowNewCategory(false);
      setNewCategoryName("");
      toast.success(isRTL ? "تم إنشاء التصنيف" : "Category created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل إنشاء التصنيف" : "Failed to create category"));
    } finally {
      setSaving(false);
    }
  };

  const TREATMENT_INFO = {
    "add-cost":          { color: "blue",    ar: "سيؤثر على تكلفة البضاعة وحساب الربح.",         en: "Affects goods cost and profit calculation." },
    "expense-only":      { color: "slate",   ar: "يظهر في تقرير المصروفات دون تغيير تكلفة المخزون.", en: "Appears in expenses report without affecting inventory cost." },
    "deduct-supplier":   { color: "amber",   ar: "سيقلل المبلغ المستحق للمورد.",                 en: "Will reduce the amount payable to supplier." },
  };
  const ti = TREATMENT_INFO[treatment as keyof typeof TREATMENT_INFO];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "إضافة مصروف" : "Add Expense"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type tabs */}
          <div className="grid grid-cols-3 gap-2">
            {([["daily", isRTL ? "مصروف يومي" : "Daily"], ["monthly", isRTL ? "مصروف شهري" : "Monthly"], ["purchase", isRTL ? "مرتبط بشراء" : "Purchase"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setExpType(v); setCategory(""); }} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${expType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
            ))}
          </div>

          {/* Helper text */}
          <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2">
            <Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-slate-500">
              {expType === "daily" ? (isRTL ? "هذا المصروف سيتم احتسابه ضمن مصروفات اليوم ويؤثر على صافي ربح اليوم." : "This expense will be counted in today's expenses and affects daily net profit.") : expType === "monthly" ? (isRTL ? "هذا المصروف سيتم احتسابه ضمن مصروفات الشهر ويؤثر على صافي ربح الشهر." : "This expense will be counted in monthly expenses and affects monthly net profit.") : (isRTL ? "يمكن ربط هذا المصروف بفاتورة شراء وتحديد طريقة المعالجة المحاسبية." : "This expense can be linked to a purchase invoice with specific accounting treatment.")}
            </p>
          </div>

          {expType === "daily" && <FInput label={isRTL ? "التاريخ *" : "Date *"} type="date" value={date} onChange={setDate} required />}
          {expType === "monthly" && <FInput label={isRTL ? "الشهر *" : "Month *"} type="month" value={month} onChange={setMonth} required />}

          {expType === "purchase" && (
            <>
              <FSelect label={isRTL ? "فاتورة الشراء *" : "Purchase Invoice *"} value={purchaseInv} onChange={setPurchaseInv} required
                options={[{ value: "", label: isRTL ? "اختر الفاتورة" : "Select Invoice" }, { value: "PUR-2025-0042", label: "PUR-2025-0042 — WESTLAND" }, { value: "PUR-2025-0041", label: "PUR-2025-0041 — WESTLAND" }]} />
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "طريقة المعالجة *" : "Treatment *"}</label>
                <div className="space-y-2">
                  {[["add-cost", isRTL ? "يضاف على تكلفة المخزون" : "Add to inventory cost"], ["expense-only", isRTL ? "مصروف مرتبط بالشراء فقط" : "Purchase-linked expense only"], ["deduct-supplier", isRTL ? "يخصم من مستحق المورد" : "Deduct from supplier payable"]].map(([v, l]) => (
                    <label key={v} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${treatment === v ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100"}`}>
                      <input type="radio" value={v} checked={treatment === v} onChange={() => setTreatment(v)} className="accent-[#0F2C59]" />
                      <span className="text-xs font-bold text-slate-700">{l}</span>
                    </label>
                  ))}
                </div>
                {ti && <div className={`mt-2 bg-${ti.color}-50 border border-${ti.color}-200 rounded-xl p-2.5 flex gap-1.5`}><Info size={12} className="text-slate-400 shrink-0 mt-0.5" /><p className="text-[10px] font-bold text-slate-600">{isRTL ? ti.ar : ti.en}</p></div>}
              </div>
            </>
          )}

          {!IS_MOCK_MODE && categoriesLoading && (
            <p className="text-xs text-slate-400">{isRTL ? "جاري تحميل التصنيفات..." : "Loading categories..."}</p>
          )}
          {!IS_MOCK_MODE && !categoriesLoading && apiCategories.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-amber-700">{isRTL ? "لا توجد تصنيفات مصروفات. أنشئ تصنيفاً أولاً." : "No expense categories yet. Create one first."}</p>
              {!showNewCategory ? (
                <Btn size="sm" variant="primary" onClick={() => setShowNewCategory(true)}>{isRTL ? "إنشاء تصنيف" : "Create category"}</Btn>
              ) : (
                <div className="flex gap-2">
                  <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-1 rounded-xl border px-3 py-2 text-sm" placeholder={isRTL ? "اسم التصنيف" : "Category name"} />
                  <Btn size="sm" disabled={saving} onClick={() => void handleCreateCategory()}>{isRTL ? "حفظ" : "Save"}</Btn>
                </div>
              )}
            </div>
          )}
          <FSelect label={isRTL ? "التصنيف *" : "Category *"} value={category} onChange={setCategory} required
            options={[{ value: "", label: isRTL ? "اختر التصنيف" : "Select Category" }, ...categoryOptions]} />
          <FormErrors lang={lang} error={saveError} fieldErrors={fieldErrors} />
          <FInput label={isRTL ? "الوصف *" : "Description *"} value={description} onChange={setDescription} placeholder={isRTL ? "وصف المصروف..." : "Expense description..."} required />
          <FInput label={isRTL ? "المبلغ (AED) *" : "Amount (AED) *"} type="number" value={amount} onChange={setAmount} required />

          <div className="grid grid-cols-2 gap-3">
            <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={setMethod}
              options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "حساب بنكي" : "Bank" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
            <FSelect label={isRTL ? "مدفوع من" : "Paid From"} value={paidFrom} onChange={setPaidFrom}
              options={[{ value: "خزنة", label: isRTL ? "خزنة" : "Safe" }, { value: "بنك", label: isRTL ? "حساب بنكي" : "Bank Account" }, { value: "موظف", label: isRTL ? "موظف" : "Employee" }, { value: "أخرى", label: isRTL ? "أخرى" : "Other" }]} />
          </div>

          {expType === "monthly" && (
            <FSelect label={isRTL ? "الحالة" : "Status"} value={monthlyStatus} onChange={setMonthlyStatus}
              options={[{ value: "paid", label: isRTL ? "مدفوع" : "Paid" }, { value: "unpaid", label: isRTL ? "غير مدفوع" : "Unpaid" }, { value: "partial", label: isRTL ? "مدفوع جزئياً" : "Partial" }]} />
          )}
          {monthlyStatus === "unpaid" && expType === "monthly" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2"><AlertTriangle size={13} className="text-amber-500 shrink-0" /><span className="text-xs font-bold text-amber-700">{isRTL ? "سيظهر هذا المصروف كمستحق غير مدفوع." : "This expense will appear as an unpaid liability."}</span></div>
          )}

          <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference (Optional)"} value={ref} onChange={setRef} />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all"><Download size={15} className="text-slate-300 mx-auto mb-1" /><p className="text-[10px] font-bold text-slate-400">{isRTL ? "رفع إيصال / مرفق (اختياري)" : "Upload receipt / attachment (optional)"}</p></div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 flex-wrap justify-end">
          <Btn variant="outline" onClick={onClose} disabled={saving}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="secondary" disabled={saving} onClick={() => void submitExpense(true)}>{isRTL ? "حفظ وإضافة آخر" : "Save & Add Another"}</Btn>
          <Btn disabled={saving} onClick={() => void submitExpense(false)}><Check size={15} />{saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ المصروف" : "Save Expense")}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: RECURRING EXPENSES ─────────────────────────────────────────────────
export function RecurringExpensesScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [rows, setRows] = useState<typeof RECURRING>([]);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canManage = role === "owner" || role === "accountant";

  const reload = () => {
    if (IS_MOCK_MODE) {
      setRows(RECURRING);
      setLoading(false);
      return;
    }
    setLoading(true);
    listRecurringExpenses()
      .then((apiRows) => {
        setRows(apiRows.map((r) => ({
          id: r.id,
          name: r.title ?? r.category,
          category: r.category,
          amount: r.amount,
          freq: r.frequency,
          dueDay: 1,
          lastPaid: "",
          nextDue: r.nextDate ?? "",
          active: r.active,
        })));
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={reload} />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("expenses")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "المصروفات المتكررة" : "Recurring Expenses"}</h2>
          <p className="text-xs text-slate-400">{isRTL ? "المصروفات الثابتة المتوقعة كل شهر" : "Fixed expected expenses each month"}</p>
        </div>
        {canManage
          ? <Btn variant="primary" onClick={() => setShowAddRecurring(true)}><Plus size={15} />{isRTL ? "إضافة مصروف متكرر" : "Add Recurring"}</Btn>
          : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "إضافة مصروف متكرر" : "Add Recurring"}</PermBtn>}
      </div>

      {/* Upcoming alert */}
      {rows.some(r => r.nextDue && Math.ceil((new Date(r.nextDue).getTime() - Date.now()) / 86400000) <= 5) && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <div className="font-black text-amber-700 text-sm">{isRTL ? "تنبيه: مصروفات متكررة مستحقة قريباً" : "Alert: Recurring expenses due soon"}</div>
            <p className="text-xs font-bold text-amber-600">{rows.filter(r => r.nextDue && Math.ceil((new Date(r.nextDue).getTime() - Date.now()) / 86400000) <= 5).map(r => r.name).join(" · ")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(r => {
          const daysLeft = Math.ceil((new Date(r.nextDue).getTime() - Date.now()) / 86400000);
          const isUrgent = daysLeft <= 3;
          return (
            <Card key={r.id} className={`p-5 ${isUrgent ? "border-amber-300" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div><div className="font-black text-slate-800">{r.name}</div><div className="text-xs text-slate-400 font-semibold">{r.category} · {r.freq}</div></div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{r.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span>
              </div>
              <div className="text-2xl font-black font-mono text-[#0F2C59] mb-3">AED {r.amount.toLocaleString()}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="bg-slate-50 rounded-lg p-2"><div className="text-slate-400 font-bold">{isRTL ? "آخر دفع" : "Last Paid"}</div><div className="font-mono font-bold text-slate-700">{r.lastPaid}</div></div>
                <div className={`rounded-lg p-2 ${isUrgent ? "bg-amber-50" : "bg-slate-50"}`}><div className={`font-bold ${isUrgent ? "text-amber-500" : "text-slate-400"}`}>{isRTL ? "القادم" : "Next Due"}</div><div className={`font-mono font-bold ${isUrgent ? "text-amber-700" : "text-slate-700"}`}>{daysLeft <= 0 ? (isRTL ? "متأخر!" : "Overdue!") : isRTL ? `${daysLeft} يوم` : `${daysLeft}d`}</div></div>
              </div>
              <div className="flex gap-2">
                {canManage && <Btn size="sm" variant="amber" className="flex-1 justify-center"><Plus size={13} />{isRTL ? "إنشاء لهذا الشهر" : "Create This Month"}</Btn>}
                {canManage && <button className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"><Pencil size={14} /></button>}
              </div>
            </Card>
          );
        })}
      </div>

      {rows.length === 0 && (
        <Card className="p-14 text-center"><RefreshCw size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا توجد مصروفات متكررة" : "No recurring expenses"}</h3>{canManage && <Btn onClick={() => setShowAddRecurring(true)}><Plus size={15} />{isRTL ? "إضافة مصروف متكرر" : "Add Recurring Expense"}</Btn>}</Card>
      )}

      {/* Add recurring modal */}
      {showAddRecurring && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "إضافة مصروف متكرر" : "Add Recurring Expense"}</h3>
              <button onClick={() => setShowAddRecurring(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="p-6 space-y-4">
              <FInput label={isRTL ? "اسم المصروف *" : "Expense Name *"} value="" onChange={() => {}} required />
              <FSelect label={isRTL ? "التصنيف *" : "Category *"} value="" onChange={() => {}} options={[{ value: "", label: isRTL ? "اختر التصنيف" : "Select" }, ...MONTHLY_CATS_AR.map(c => ({ value: c, label: c }))]} />
              <FInput label={isRTL ? "المبلغ المتوقع (AED) *" : "Expected Amount (AED) *"} type="number" value="" onChange={() => {}} required />
              <div className="grid grid-cols-2 gap-3">
                <FSelect label={isRTL ? "تكرار" : "Frequency"} value="monthly" onChange={() => {}} options={[{ value: "monthly", label: isRTL ? "شهري" : "Monthly" }, { value: "weekly", label: isRTL ? "أسبوعي" : "Weekly" }, { value: "yearly", label: isRTL ? "سنوي" : "Yearly" }]} />
                <FInput label={isRTL ? "يوم الاستحقاق" : "Due Day"} type="number" value="" onChange={() => {}} placeholder="1–31" />
              </div>
              <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
                <div><div className="text-sm font-bold text-slate-700">{isRTL ? "إنشاء تلقائي كل شهر" : "Auto-create monthly"}</div></div>
                <div className="w-10 h-[22px] rounded-full flex items-center bg-[#0F2C59]"><span className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-5 mx-0.5" /></div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <Btn variant="outline" onClick={() => setShowAddRecurring(false)}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
              <Btn onClick={() => { toast.success(isRTL ? "تم إضافة المصروف المتكرر" : "Recurring expense added"); setShowAddRecurring(false); }}><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN: EXPENSE DETAIL ─────────────────────────────────────────────────────
export function ExpenseDetailScreen({ lang, role, onNavigate, expenseId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; expenseId: string;
}) {
  if (!IS_MOCK_MODE && expenseId) {
    return <LiveExpenseDetailScreen lang={lang} role={role} onNavigate={onNavigate} expenseId={expenseId} />;
  }
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("details");
  const e = MOCK_EXPENSES.find(x => x.id === expenseId) || MOCK_EXPENSES[0];
  const canEdit = role === "owner" || role === "accountant";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("expenses-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{e.id}</h2>
            <ExpTypeBadge type={e.type} lang={lang} />
            <ExpStatusBadge status={e.status} lang={lang} />
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{e.date} · {e.user}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ ar: "المبلغ", en: "Amount", v: `AED ${e.amount.toLocaleString()}`, cls: "text-red-500" }, { ar: "التصنيف", en: "Category", v: e.categoryAr, cls: "text-[#0F2C59]" }, { ar: "طريقة الدفع", en: "Method", v: e.method, cls: "text-slate-700" }, { ar: "التاريخ", en: "Date", v: e.date, cls: "text-slate-700" }].map(f => (
          <Card key={f.ar} className="p-4 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>
        ))}
      </div>

      {/* Actions */}
      <Card className="p-4 flex flex-wrap gap-2">
        {canEdit && e.status !== "cancelled" && <Btn size="sm" variant="secondary"><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
        <Btn size="sm" variant="outline" onClick={() => onNavigate("expense-voucher")}><Printer size={13} />{isRTL ? "طباعة سند" : "Print Voucher"}</Btn>
        <Btn size="sm" variant="outline"><Download size={13} />{isRTL ? "رفع إيصال" : "Upload Receipt"}</Btn>
        <Btn size="sm" variant="outline"><FileText size={13} />{isRTL ? "تكرار المصروف" : "Duplicate"}</Btn>
        {canEdit && e.status !== "cancelled" && <Btn size="sm" variant="danger"><X size={13} />{isRTL ? "إلغاء المصروف" : "Cancel Expense"}</Btn>}
      </Card>

      {/* Tabs */}
      <Card>
        <div className="border-b border-slate-100 px-2">
          <div className="flex gap-0">
            {[["details", isRTL ? "التفاصيل" : "Details"], ["attachments", isRTL ? "المرفقات" : "Attachments"], ["audit", isRTL ? "سجل العمليات" : "Audit Log"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${tab === k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {tab === "details" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { ar: "رقم المصروف", en: "Expense #", v: e.id },
                { ar: "التاريخ", en: "Date", v: e.date },
                { ar: "النوع", en: "Type", v: e.type === "daily" ? (isRTL ? "يومي" : "Daily") : e.type === "monthly" ? (isRTL ? "شهري" : "Monthly") : (isRTL ? "مرتبط بشراء" : "Purchase-Linked") },
                { ar: "التصنيف", en: "Category", v: e.categoryAr },
                { ar: "الوصف", en: "Description", v: e.description },
                { ar: "المبلغ", en: "Amount", v: `AED ${e.amount.toLocaleString()}` },
                { ar: "طريقة الدفع", en: "Payment Method", v: e.method },
                { ar: "المستخدم", en: "Created By", v: e.user },
                ...(e.purchaseInv ? [{ ar: "فاتورة الشراء المرتبطة", en: "Linked Invoice", v: e.purchaseInv }] : []),
              ].map(f => <div key={f.ar} className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>)}
            </div>
          )}
          {tab === "attachments" && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-[#0F2C59]/30"><Download size={24} className="text-slate-300 mx-auto mb-2" /><p className="font-bold text-slate-400">{isRTL ? "رفع إيصال أو مرفق" : "Upload receipt or attachment"}</p></div>
              <div className="text-center text-slate-400 font-semibold text-sm">{isRTL ? "لا توجد مرفقات" : "No attachments"}</div>
            </div>
          )}
          {tab === "audit" && (
            <div className="space-y-2">
              {[
                { t: `${e.date} 10:00`, a: isRTL ? "إنشاء المصروف" : "Expense Created",   u: e.user, dot: "bg-emerald-500" },
                { t: `${e.date} 10:00`, a: isRTL ? "تعيين التصنيف" : "Category Set",       u: e.user, dot: "bg-blue-500" },
              ].map((entry, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${entry.dot}`} />
                  <div className="flex-1"><div className="text-sm font-bold text-slate-700">{entry.a}</div><div className="text-xs text-slate-400">{entry.u}</div></div>
                  <div className="font-mono text-xs text-slate-400 shrink-0">{entry.t}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: EXPENSE VOUCHER ────────────────────────────────────────────────────
export function ExpenseVoucherScreen({ lang, onNavigate, expenseId }: {
  lang: Lang; onNavigate: (s: TenantScreen) => void; expenseId: string;
}) {
  if (!IS_MOCK_MODE && expenseId) {
    return (
      <LivePrintPreviewScreen
        lang={lang}
        onNavigate={onNavigate}
        backScreen="expenses-list"
        titleAr="سند مصروف"
        titleEn="Expense Voucher"
        loadPreview={() => getExpenseVoucherPreview(expenseId)}
      />
    );
  }
  const isRTL = lang === "ar";
  const e = MOCK_EXPENSES.find(x => x.id === expenseId) || MOCK_EXPENSES[0];

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("expenses-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1" />
        <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn variant="secondary"><Download size={15} />PDF</Btn>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F2C59] text-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div><div className="text-2xl font-black">شركة الوطنية للدواجن</div><div className="text-sm font-bold text-white/70">Al Wataniyah Poultry Company LLC</div></div>
            <div className="text-end">
              <div className="text-xl font-black text-amber-300">{isRTL ? "سند مصروف" : "EXPENSE VOUCHER"}</div>
              <div className="text-sm font-bold text-white/70 mt-1">{e.id}</div>
              <div className="text-sm font-bold text-white/60">{e.date}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
            {[
              [isRTL ? "نوع المصروف" : "Expense Type",    e.type === "daily" ? (isRTL ? "يومي" : "Daily") : isRTL ? "شهري" : "Monthly"],
              [isRTL ? "التصنيف" : "Category",             e.categoryAr],
              [isRTL ? "الوصف" : "Description",            e.description],
              [isRTL ? "المبلغ" : "Amount",                `AED ${e.amount.toLocaleString()}`],
              [isRTL ? "طريقة الدفع" : "Payment Method",  e.method],
              [isRTL ? "المستخدم" : "Created By",          e.user],
            ].map(([l, v]) => (
              <div key={l}><div className="text-xs font-bold text-slate-400 mb-0.5">{l}</div><div className="font-bold text-slate-800">{v}</div></div>
            ))}
          </div>

          {/* Amount box */}
          <div className="bg-[#0F2C59] rounded-2xl p-4 flex items-center justify-between">
            <span className="font-black text-white">{isRTL ? "إجمالي المبلغ / Total Amount" : "Total Amount / إجمالي المبلغ"}</span>
            <span className="font-mono font-black text-amber-300 text-2xl">AED {e.amount.toLocaleString()}</span>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 mt-6">
            {[isRTL ? "أعدّه / Prepared by" : "Prepared by", isRTL ? "اعتمده / Approved by" : "Approved by", isRTL ? "المستلم / Receiver" : "Receiver"].map(l => (
              <div key={l} className="border-t-2 border-slate-300 pt-3 text-center"><div className="text-xs font-black text-slate-400 uppercase tracking-wide">{l}</div><div className="h-10" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: EXPENSES REPORT ────────────────────────────────────────────────────
export function ExpensesReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const defaultRange = getDefaultTaxDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const { items: expenseRows, loading, error, reload } = useExpenses(
    { date_from: dateFrom, date_to: dateTo },
    async () => MOCK_EXPENSES.map(expenseRowFromMock),
  );
  const EXPENSES = expenseRows.map((row) =>
    enrichExpense(row, IS_MOCK_MODE ? MOCK_EXPENSES.find((m) => m.id === row.id) : undefined),
  );

  const totalAll = EXPENSES.reduce((s, e) => s + e.amount, 0);
  const totalDaily = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "daily").reduce((s, e) => s + e.amount, 0)
    : totalAll;
  const totalMonthly = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "monthly").reduce((s, e) => s + e.amount, 0)
    : 0;
  const totalPurchase = IS_MOCK_MODE
    ? EXPENSES.filter(e => e.type === "purchase").reduce((s, e) => s + e.amount, 0)
    : 0;
  const catDist = IS_MOCK_MODE ? CAT_DIST : buildCategoryDist(EXPENSES, isRTL);

  const BAR_DATA = [
    { name: isRTL ? "يومي" : "Daily",    daily: totalDaily, monthly: 0 },
    { name: isRTL ? "شهري" : "Monthly",  daily: 0, monthly: totalMonthly },
    { name: isRTL ? "شراء" : "Purchase", daily: totalPurchase, monthly: 0 },
  ];

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("expenses")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير المصروفات" : "Expenses Report"}</h2>
        </div>
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          <span className="text-slate-400 font-bold self-center">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          <Btn variant="primary" size="sm"><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
          <Btn variant="secondary" size="sm"><Download size={13} />{isRTL ? "Excel" : "Excel"}</Btn>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[[`AED ${totalAll.toLocaleString()}`, isRTL ? "إجمالي المصروفات" : "Total Expenses", "text-red-500", "bg-red-50"], [`AED ${totalDaily.toLocaleString()}`, isRTL ? "المصروفات اليومية" : "Daily Expenses", "text-blue-600", "bg-blue-50"], [`AED ${totalMonthly.toLocaleString()}`, isRTL ? "المصروفات الشهرية" : "Monthly Expenses", "text-violet-600", "bg-violet-50"], [`AED ${totalPurchase.toLocaleString()}`, isRTL ? "مرتبطة بالمشتريات" : "Purchase-Linked", "text-amber-600", "bg-amber-50"]].map(([v, l, cls, bg]) => (
          <Card key={l} className={`p-4 text-center ${bg} border-none`}><div className={`text-xl font-black font-mono ${cls}`}>{v}</div><div className="text-xs font-bold text-slate-500 mt-1">{l}</div></Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "توزيع التصنيفات" : "Category Distribution"}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie key="rpt-cat-pie" data={catDist.length ? catDist : [{ name: "—", nameEn: "—", value: 1, color: "#e2e8f0" }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {(catDist.length ? catDist : [{ name: "—", nameEn: "—", value: 1, color: "#e2e8f0" }]).map((e, i) => <Cell key={`rpc-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="rpt-cat-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [`AED ${v.toLocaleString()}`, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "يومي مقابل شهري" : "Daily vs Monthly"}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={BAR_DATA} barSize={28}>
              <CartesianGrid key="rpt-bar-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="rpt-bar-x" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="rpt-bar-y" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="rpt-bar-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Bar key="rpt-daily-bar" dataKey="daily" fill="#3B82F6" radius={[4,4,0,0]} name={isRTL ? "يومي" : "Daily"} />
              <Bar key="rpt-monthly-bar" dataKey="monthly" fill="#8B5CF6" radius={[4,4,0,0]} name={isRTL ? "شهري" : "Monthly"} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL ? "رقم المصروف" : "Exp #", isRTL ? "التاريخ" : "Date", isRTL ? "النوع" : "Type", isRTL ? "التصنيف" : "Category", isRTL ? "الوصف" : "Description", isRTL ? "المبلغ" : "Amount", isRTL ? "الطريقة" : "Method", isRTL ? "المستخدم" : "User"].map((h, i) => <th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {EXPENSES.length === 0 && !IS_MOCK_MODE ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">{isRTL ? "لا توجد مصروفات في هذه الفترة" : "No expenses in this period"}</td></tr>
              ) : EXPENSES.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-[#0F2C59] font-bold">{e.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.date}</td>
                  <td className="px-4 py-3"><ExpTypeBadge type={e.type} lang={lang} /></td>
                  <td className="px-4 py-3 font-bold text-slate-700">{e.categoryAr}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.description}</td>
                  <td className="px-4 py-3 font-mono font-black text-red-500">AED {e.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{e.method}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{e.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── PANEL: PROFIT IMPACT ───────────────────────────────────────────────────────
function ProfitImpactPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const isRTL = lang === "ar";
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const salesDay = 18450; const purchasesDay = 11200; const expDay = 850;
  const profitDay = salesDay - purchasesDay - expDay;
  const salesMonth = 425000; const purchasesMonth = 298000; const expMonthDaily = 12400; const expMonthFixed = 26650;
  const profitMonth = salesMonth - purchasesMonth - expMonthDaily - expMonthFixed;
  const expRatio = Math.round((expDay / salesDay) * 100);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "تأثير المصروفات على الربح" : "Expenses Impact on Profit"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* View toggle */}
          <div className="grid grid-cols-2 gap-2">
            {([["daily", isRTL ? "اليوم" : "Today"], ["monthly", isRTL ? "الشهر" : "Month"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${view === v ? "border-[#0F2C59] bg-[#0F2C59] text-white" : "border-slate-200 text-slate-600"}`}>{l}</button>
            ))}
          </div>

          {view === "daily" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  [isRTL ? "مبيعات اليوم" : "Today's Sales", `AED ${salesDay.toLocaleString()}`, "text-emerald-600 bg-emerald-50"],
                  [isRTL ? "مشتريات اليوم" : "Today's Purchases", `−AED ${purchasesDay.toLocaleString()}`, "text-[#0F2C59] bg-[#0F2C59]/5"],
                  [isRTL ? "مصروفات اليوم" : "Today's Expenses", `−AED ${expDay.toLocaleString()}`, "text-red-500 bg-red-50"],
                ].map(([l, v, c]) => (
                  <div key={l} className={`flex justify-between p-3 rounded-xl ${c.split(" ")[1]}`}><span className="font-bold text-sm text-slate-700">{l}</span><span className={`font-mono font-black ${c.split(" ")[0]}`}>{v}</span></div>
                ))}
                <div className="flex justify-between p-3.5 rounded-xl bg-[#0F2C59] items-center">
                  <span className="font-black text-white text-sm">{isRTL ? "صافي ربح اليوم" : "Today's Net Profit"}</span>
                  <span className="font-mono font-black text-[#22C55E] text-xl">AED {profitDay.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-xs font-black text-slate-400 mb-1">{isRTL ? "المعادلة" : "Formula"}</div>
                <div className="text-sm font-bold text-slate-600 font-mono">{isRTL ? "المبيعات − المشتريات − المصروفات" : "Sales − Purchases − Expenses"}</div>
              </div>
              {expRatio > 25 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500 shrink-0" /><span className="text-xs font-bold text-amber-700">{isRTL ? `تنبيه: المصروفات مرتفعة (${expRatio}% من المبيعات).` : `Alert: Expenses are high (${expRatio}% of sales).`}</span></div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                [isRTL ? "مبيعات الشهر" : "Monthly Sales", `AED ${salesMonth.toLocaleString()}`, "text-emerald-600 bg-emerald-50"],
                [isRTL ? "مشتريات الشهر" : "Monthly Purchases", `−AED ${purchasesMonth.toLocaleString()}`, "text-[#0F2C59] bg-[#0F2C59]/5"],
                [isRTL ? "مصروفات يومية (الشهر)" : "Daily Expenses (month)", `−AED ${expMonthDaily.toLocaleString()}`, "text-blue-600 bg-blue-50"],
                [isRTL ? "مصروفات شهرية ثابتة" : "Fixed Monthly Expenses", `−AED ${expMonthFixed.toLocaleString()}`, "text-violet-600 bg-violet-50"],
              ].map(([l, v, c]) => (
                <div key={l} className={`flex justify-between p-3 rounded-xl ${c.split(" ")[1]}`}><span className="font-bold text-sm text-slate-700">{l}</span><span className={`font-mono font-black ${c.split(" ")[0]}`}>{v}</span></div>
              ))}
              <div className="flex justify-between p-3.5 rounded-xl bg-[#0F2C59] items-center">
                <span className="font-black text-white text-sm">{isRTL ? "صافي ربح الشهر" : "Monthly Net Profit"}</span>
                <span className="font-mono font-black text-[#22C55E] text-xl">AED {profitMonth.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-4 shrink-0">
          <Btn variant="outline" className="w-full justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── PANEL: EXPENSE SETTINGS ────────────────────────────────────────────────────
function ExpenseSettingsPanel({ lang, role, onClose }: { lang: Lang; role: TenantRole; onClose: () => void }) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner";
  const [cashierAdd, setCashierAdd] = useState(false);
  const [cashierEdit, setCashierEdit] = useState(false);
  const [reqAttach, setReqAttach] = useState(true);
  const [autoRecurring, setAutoRecurring] = useState(true);

  const toggles: [boolean, (v: boolean) => void, string, string][] = [
    [cashierAdd, setCashierAdd, isRTL ? "السماح للكاشير بإضافة مصروفات يومية" : "Allow cashier to add daily expenses", ""],
    [cashierEdit, setCashierEdit, isRTL ? "السماح للكاشير بتعديل المصروفات" : "Allow cashier to edit expenses", ""],
    [reqAttach, setReqAttach, isRTL ? "إلزامية المرفق للمصاريف فوق AED 500" : "Require attachment for expenses over AED 500", ""],
    [autoRecurring, setAutoRecurring, isRTL ? "إنشاء المصروفات المتكررة تلقائياً كل شهر" : "Auto-create recurring expenses monthly", ""],
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات المصروفات" : "Expense Settings"}</h3>
            {!canEdit && <p className="text-[10px] text-amber-600 font-bold">{isRTL ? "للعرض فقط" : "View only"}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "يمكن التحكم في من يستطيع إضافة أو تعديل أو إلغاء المصروفات من هذه الإعدادات." : "Control who can add, edit or cancel expenses from these settings."}</p></div>
          <div className="space-y-1">
            {toggles.map(([val, setter, label]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <button onClick={() => canEdit && setter(!val)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${val ? "bg-[#0F2C59]" : "bg-slate-300"} ${!canEdit ? "cursor-not-allowed" : ""}`}>
                  <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${val ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
          <FInput label={isRTL ? "بادئة ترقيم المصروفات" : "Expense Numbering Prefix"} value="EXP" onChange={() => {}} />
        </div>
        <div className="border-t border-slate-100 px-5 py-4 flex gap-3 shrink-0">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
          {canEdit && <Btn className="flex-1 justify-center" onClick={() => { toast.success(isRTL ? "تم حفظ الإعدادات" : "Settings saved"); onClose(); }}><Check size={14} />{isRTL ? "حفظ" : "Save"}</Btn>}
        </div>
      </div>
    </div>
  );
}
