// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — PAYMENTS & RECEIPTS CENTER MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Plus, X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, CheckCircle, Download, Printer,
  Eye, Pencil, Lock, DollarSign, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, CreditCard, Wallet, BarChart2,
  RefreshCw, Calendar, Settings, FileText, Users, Truck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { toast } from "sonner";
import { usePaymentMovements } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { toModulePayment } from "./moduleMappers";
import { IS_MOCK_MODE } from "@/services/config";
import { LiveCustomerCollectionModal, LiveSupplierPaymentModal } from "@/features/payments/LivePaymentModals";
import { LiveCustomerRefundScreen, LiveSupplierRefundScreen, LiveCancelPaymentModal } from "@/features/payments/LiveRefundScreens";
import { LivePrintPreviewScreen } from "@/features/print/LivePrintPreviewScreen";
import { getPaymentMovementPrintPreviewRaw } from "@/services/paymentService";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "payments" | "payments-movements" | "payments-customer-collection"
  | "payments-supplier-payment" | "payments-customer-refund" | "payments-supplier-refund"
  | "payment-receipt-detail" | "payment-receipt-preview" | "payments-method-summary"
  | "payments-cash-bank" | "payments-report"
  | "customers-profile" | "supplier-profile" | string;
type MovType = "collection" | "supplier_payment" | "customer_refund" | "supplier_refund" | "collection_discount" | "purchase_deduction" | "linked_expense" | "account_adjustment";
type MovDir = "in" | "out" | "adjustment" | "non_cash";
type PayMethod = "cash" | "bank" | "cheque" | "other";

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
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
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
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-11 h-[24px] rounded-full flex items-center transition-all shrink-0 cursor-pointer ${on ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
      <span className={`w-5 h-5 bg-white rounded-full shadow-sm mx-0.5 transition-all ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
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
function PremiumBtn({ children, lang }: { children: ReactNode; lang: Lang }) {
  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200">
        <Lock size={11} className="text-amber-500" />{children}
        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{lang === "ar" ? "متقدمة" : "Premium"}</span>
      </div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl max-w-48 text-center`}>
        {lang === "ar" ? "إرسال الإيصالات عبر واتساب متاح في باقات Pro و Enterprise." : "WhatsApp receipt sending available in Pro or Enterprise plans."}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface PayMovement {
  id: string; date: string; type: MovType; typeAr: string; typeEn: string;
  party: string; amount: number; dir: MovDir; method: PayMethod | "";
  ref: string; receipt: string; invoice: string; user: string; status: "active" | "cancelled";
}
const MOCK_PAY_MOVEMENTS: PayMovement[] = [
  { id:"M001", date:"2026-01-28 14:30", type:"collection",          typeAr:"تحصيل من عميل",             typeEn:"Customer Collection",  party:"مطعم الخليج",           amount:1000,  dir:"in",         method:"cash",   ref:"",        receipt:"REC-2026-00019", invoice:"INV-2026-00046",  user:"محمد (كاشير)",  status:"active"    },
  { id:"M002", date:"2026-01-28 13:00", type:"collection",          typeAr:"تحصيل من عميل",             typeEn:"Customer Collection",  party:"سوبر ماركت المدينة",   amount:3500,  dir:"in",         method:"bank",   ref:"TRF-001", receipt:"REC-2026-00020", invoice:"",               user:"أحمد (مالك)",   status:"active"    },
  { id:"M003", date:"2026-01-28 12:00", type:"supplier_payment",   typeAr:"دفعة لمورد",                typeEn:"Supplier Payment",     party:"WESTLAND FOODSTUFF",   amount:2000,  dir:"out",        method:"bank",   ref:"TRF-002", receipt:"PAY-2026-00008", invoice:"PUR-2026-00034",  user:"أحمد (مالك)",   status:"active"    },
  { id:"M004", date:"2026-01-28 11:00", type:"supplier_payment",   typeAr:"دفعة لمورد",                typeEn:"Supplier Payment",     party:"MNM Foodstuff",        amount:3000,  dir:"out",        method:"cheque", ref:"CHQ-001", receipt:"PAY-2026-00009", invoice:"",               user:"أحمد (مالك)",   status:"active"    },
  { id:"M005", date:"2026-01-27 15:00", type:"customer_refund",    typeAr:"استرجاع مبلغ للعميل",       typeEn:"Customer Refund",      party:"Prime Fresh Meat LLC",  amount:250,   dir:"out",        method:"cash",   ref:"",        receipt:"REF-C-2026-00003",invoice:"",              user:"أحمد (مالك)",   status:"active"    },
  { id:"M006", date:"2026-01-27 10:00", type:"supplier_refund",    typeAr:"استرداد مبلغ من المورد",    typeEn:"Supplier Refund",      party:"WESTLAND FOODSTUFF",   amount:300,   dir:"in",         method:"bank",   ref:"TRF-003", receipt:"REF-S-2026-00002",invoice:"",              user:"أحمد (مالك)",   status:"active"    },
  { id:"M007", date:"2026-01-26 14:00", type:"collection",          typeAr:"تحصيل من عميل",            typeEn:"Customer Collection",  party:"مطبخ الإمارات",         amount:6090,  dir:"in",         method:"bank",   ref:"TRF-004", receipt:"REC-2026-00018", invoice:"INV-2025-0084",  user:"أحمد (مالك)",   status:"active"    },
  { id:"M008", date:"2026-01-25 09:00", type:"collection_discount", typeAr:"خصم عند التحصيل",          typeEn:"Collection Discount",  party:"مطعم الخليج",           amount:150,   dir:"adjustment", method:"",       ref:"ADJ-001", receipt:"",               invoice:"INV-2025-0083",  user:"أحمد (مالك)",   status:"active"    },
  { id:"M009", date:"2026-01-24 16:00", type:"collection",          typeAr:"تحصيل من عميل",            typeEn:"Customer Collection",  party:"مطعم الخليج",           amount:2001,  dir:"in",         method:"cash",   ref:"",        receipt:"REC-2026-00017", invoice:"INV-2025-0086",  user:"محمد (كاشير)",  status:"cancelled" },
];

const CASH_TREND = [
  { day: "الأحد",    dayEn: "Sun", in: 8200, out: 3100  },
  { day: "الاثنين",  dayEn: "Mon", in: 11500,out: 5200  },
  { day: "الثلاثاء", dayEn: "Tue", in: 7300, out: 2800  },
  { day: "الأربعاء", dayEn: "Wed", in: 14000,out: 7500  },
  { day: "الخميس",   dayEn: "Thu", in: 9800, out: 4300  },
  { day: "الجمعة",   dayEn: "Fri", in: 5200, out: 1900  },
  { day: "اليوم",    dayEn: "Today",in:10500,out: 7500  },
];
const MONTHLY_COMP = [
  { month:"أغسطس",  monthEn:"Aug",  collections:85000, payments:62000 },
  { month:"سبتمبر", monthEn:"Sep",  collections:92000, payments:71000 },
  { month:"أكتوبر", monthEn:"Oct",  collections:78000, payments:55000 },
  { month:"نوفمبر", monthEn:"Nov",  collections:110000,payments:84000 },
  { month:"ديسمبر", monthEn:"Dec",  collections:96000, payments:73000 },
  { month:"يناير",  monthEn:"Jan",  collections:89000, payments:67000 },
];
const PAY_METHOD_PIE = [
  { name:"كاش",    nameEn:"Cash",          value:42, color:"#22C55E" },
  { name:"بنكي",   nameEn:"Bank Transfer", value:38, color:"#0F2C59" },
  { name:"شيك",    nameEn:"Cheque",        value:14, color:"#F59E0B" },
  { name:"أخرى",   nameEn:"Other",         value:6,  color:"#94a3b8" },
];
const CUSTOMERS_MINI = [
  { id:"c1", name:"مطعم الخليج",         balance:12450, invoices:["INV-2026-00046","INV-2025-0083"] },
  { id:"c2", name:"سوبر ماركت المدينة", balance:18700, invoices:["INV-2025-0085"] },
  { id:"c3", name:"مطبخ الإمارات",       balance:0,     invoices:[] },
  { id:"c4", name:"Prime Fresh Meat LLC", balance:4250,  invoices:["INV-2025-0081"] },
];
const SUPPLIERS_MINI = [
  { id:"s1", name:"WESTLAND FOODSTUFF",   balance:18500, invoices:["PUR-2026-00034","PUR-2025-0041"] },
  { id:"s2", name:"MNM Foodstuff Trading",balance:6942,  invoices:["PUR-2025-0040"] },
  { id:"s3", name:"مزرعة العين للدواجن", balance:25000, invoices:["PUR-2025-0038"] },
  { id:"s4", name:"نقل الإمارات",         balance:0,     invoices:[] },
];

// ── HELPER BADGES ──────────────────────────────────────────────────────────────
function DirBadge({ dir, lang }: { dir: MovDir; lang: Lang }) {
  const isRTL = lang === "ar";
  const cfg = {
    in:        { bg: "bg-emerald-50", t: "text-emerald-700", ar: "↑ داخل",        en: "↑ In" },
    out:       { bg: "bg-red-50",     t: "text-red-700",     ar: "↓ خارج",         en: "↓ Out" },
    adjustment:{ bg: "bg-amber-50",   t: "text-amber-700",   ar: "~ تسوية",        en: "~ Adj." },
    non_cash:  { bg: "bg-slate-100",  t: "text-slate-600",   ar: "○ بدون حركة",  en: "○ Non-cash" },
  }[dir];
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{isRTL ? cfg.ar : cfg.en}</span>;
}
function MovTypeBadge({ type, lang }: { type: MovType; lang: Lang }) {
  const isRTL = lang === "ar";
  const labels: Record<MovType, [string, string, string, string]> = {
    collection:          ["تحصيل من عميل",           "Customer Collection",  "bg-emerald-50", "text-emerald-700"],
    supplier_payment:    ["دفعة لمورد",               "Supplier Payment",     "bg-red-50",     "text-red-700"],
    customer_refund:     ["استرجاع مبلغ للعميل",     "Customer Refund",      "bg-orange-50",  "text-orange-700"],
    supplier_refund:     ["استرداد مبلغ من المورد",  "Supplier Refund",      "bg-blue-50",    "text-blue-700"],
    collection_discount: ["خصم عند التحصيل",          "Collection Discount",  "bg-amber-50",   "text-amber-700"],
    purchase_deduction:  ["خصم من مستحق المورد",     "Purchase Deduction",   "bg-violet-50",  "text-violet-700"],
    linked_expense:      ["مصروف مرتبط",              "Linked Expense",       "bg-slate-100",  "text-slate-600"],
    account_adjustment:  ["تسوية حساب",               "Account Adjustment",   "bg-amber-50",   "text-amber-700"],
  };
  const [ar, en, bg, t] = labels[type];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${t}`}>{isRTL ? ar : en}</span>;
}
function MethodBadge({ method, lang }: { method: PayMethod | ""; lang: Lang }) {
  const isRTL = lang === "ar";
  if (!method) return null;
  const cfg: Record<PayMethod, [string, string, string, string]> = {
    cash:   ["كاش",          "Cash",          "bg-emerald-100", "text-emerald-700"],
    bank:   ["تحويل بنكي",   "Bank Transfer", "bg-blue-100",    "text-blue-700"],
    cheque: ["شيك",          "Cheque",        "bg-amber-100",   "text-amber-700"],
    other:  ["أخرى",         "Other",         "bg-slate-100",   "text-slate-600"],
  };
  const [ar, en, bg, t] = cfg[method];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${t}`}>{isRTL ? ar : en}</span>;
}

function paymentRowFromMock(m: PayMovement) {
  return { id: m.id, type: m.type, party: m.party, amount: m.amount, method: m.method || "cash", date: m.date.split(" ")[0], reference: m.ref, status: m.status === "active" ? "posted" : "cancelled" };
}

function enrichPayment(row: import("@/shared/types/entities").PaymentMovementRow, mock?: PayMovement): PayMovement {
  const m = toModulePayment(row);
  return {
    id: m.id,
    date: mock?.date ?? m.date,
    type: (mock?.type ?? m.type) as MovType,
    typeAr: mock?.typeAr ?? "",
    typeEn: mock?.typeEn ?? "",
    party: m.party,
    amount: m.amount,
    dir: mock?.dir ?? "in",
    method: (mock?.method ?? m.method) as PayMethod | "",
    ref: m.reference,
    receipt: mock?.receipt ?? "",
    invoice: mock?.invoice ?? "",
    user: mock?.user ?? "",
    status: (mock?.status ?? (m.status === "posted" ? "active" : "cancelled")) as "active" | "cancelled",
  };
}

// ── SCREEN: PAYMENTS OVERVIEW ──────────────────────────────────────────────────
export function PaymentsOverviewScreen({ lang, role, onNavigate }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
}) {
  const isRTL = lang === "ar";
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canRecord = role !== "cashier" || true; // cashier can collect if permitted
  const canPay = role === "owner" || role === "accountant";

  const { items: movementRows, loading, error, forbidden, reload } = usePaymentMovements(undefined, async () => MOCK_PAY_MOVEMENTS.map(paymentRowFromMock));
  const PAY_MOVEMENTS = movementRows.map((row) => enrichPayment(row, MOCK_PAY_MOVEMENTS.find((m) => m.id === row.id)));

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const primaryKpis = [
    { v: IS_MOCK_MODE ? "AED 4,500" : "AED 0",  ar: "تحصيلات اليوم",          en: "Today's Collections",      bg: "bg-emerald-500", icon: ArrowUpRight },
    { v: IS_MOCK_MODE ? "AED 5,000" : "AED 0",  ar: "دفعات الموردين اليوم",   en: "Supplier Payments Today",  bg: "bg-red-500",     icon: ArrowDownRight },
    { v: IS_MOCK_MODE ? "AED 5,500" : "AED 0",  ar: "صافي النقد اليوم",        en: "Net Cash Today",           bg: "bg-[#0F2C59]",  icon: DollarSign },
    { v: IS_MOCK_MODE ? "AED 8,000" : "AED 0",  ar: "كاش اليوم",               en: "Cash Today",               bg: "bg-emerald-600", icon: Wallet },
    { v: IS_MOCK_MODE ? "AED 9,500" : "AED 0",  ar: "تحويلات بنكية اليوم",    en: "Bank Transfers Today",     bg: "bg-blue-500",    icon: CreditCard },
    { v: IS_MOCK_MODE ? "AED 3,000" : "AED 0",  ar: "شيكات اليوم",             en: "Cheques Today",            bg: "bg-amber-500",   icon: FileText },
    { v: IS_MOCK_MODE ? "AED 35,400" : "AED 0", ar: "مستحقات العملاء",         en: "Customer Receivables",     bg: "bg-red-600",     icon: Users },
    { v: IS_MOCK_MODE ? "AED 50,443" : "AED 0", ar: "مستحقات الموردين",        en: "Supplier Payables",        bg: "bg-amber-600",   icon: Truck },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "المدفوعات والتحصيلات" : "Payments & Receipts"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{isRTL ? "مركز العمليات المالية اليومية" : "Daily financial operations center"}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => onNavigate("payments-movements")}><BarChart2 size={13} />{isRTL ? "كل الحركات" : "All Movements"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => onNavigate("payments-report")}><FileText size={13} />{isRTL ? "التقرير" : "Report"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowSettings(true)}><Settings size={13} /></Btn>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl px-4 py-2.5 flex gap-2">
        <Info size={14} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-slate-500">{isRTL ? "هذا المركز يعرض كل حركة مالية: تحصيل من عميل، دفعة لمورد، استرجاع مبلغ، واسترداد مبلغ." : "This center displays all financial movements: customer collections, supplier payments, and refunds."}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {primaryKpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><Icon size={16} className="text-white" /></div>
              <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "إجراءات سريعة" : "Quick Actions"}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            [isRTL?"تسجيل تحصيل من عميل":"Collect from Customer", "bg-emerald-500", () => setShowCollectModal(true), canRecord],
            [isRTL?"تسجيل دفعة لمورد":"Pay Supplier",           "bg-red-500",     () => setShowPayModal(true),    canPay],
            [isRTL?"استرجاع مبلغ للعميل":"Customer Refund",    "bg-orange-500",  () => onNavigate("payments-customer-refund"), canPay],
            [isRTL?"استرداد مبلغ من المورد":"Supplier Refund",  "bg-blue-500",    () => onNavigate("payments-supplier-refund"), canPay],
            [isRTL?"ملخص طرق الدفع":"Payment Methods",         "bg-violet-500",  () => onNavigate("payments-method-summary"), true],
            [isRTL?"تقرير المدفوعات":"Payment Report",          "bg-slate-500",   () => onNavigate("payments-report"), true],
          ].map(([label, bg, onClick, allowed], i) => (
            allowed ? (
              <button key={i} onClick={onClick as () => void} className={`${bg} text-white rounded-2xl py-3 px-2 flex flex-col items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-center`}>
                <DollarSign size={20} className="text-white" />
                <span className="text-[10px] font-black leading-tight">{label as string}</span>
              </button>
            ) : (
              <div key={i} className="bg-slate-100 rounded-2xl py-3 px-2 flex flex-col items-center gap-2 opacity-60 cursor-not-allowed text-center">
                <Lock size={16} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 leading-tight">{label as string}</span>
              </div>
            )
          ))}
        </div>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "تدفق النقد — آخر 7 أيام (AED)" : "Cash Flow — Last 7 Days (AED)"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={CASH_TREND}>
              <CartesianGrid key="pmov-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="pmov-x" dataKey={isRTL ? "day" : "dayEn"} tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="pmov-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="pmov-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Line key="pmov-in" type="monotone" dataKey="in" stroke="#22C55E" strokeWidth={2.5} dot={false} name={isRTL ? "داخل" : "In"} />
              <Line key="pmov-out" type="monotone" dataKey="out" stroke="#EF4444" strokeWidth={2.5} dot={false} strokeDasharray="5 5" name={isRTL ? "خارج" : "Out"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "توزيع طرق الدفع" : "Payment Methods"}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie key="pm-pie" data={PAY_METHOD_PIE} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={2}>
                {PAY_METHOD_PIE.map((e, i) => <Cell key={`pmc-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="pm-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [`${v}%`, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {PAY_METHOD_PIE.map(m => <div key={m.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} /><span className="font-semibold text-slate-600">{isRTL ? m.name : m.nameEn}</span></div><span className="font-bold">{m.value}%</span></div>)}
          </div>
        </Card>
      </div>

      {/* Monthly comparison */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "التحصيلات مقابل دفعات الموردين (شهري)" : "Collections vs Supplier Payments (Monthly)"}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={MONTHLY_COMP} barSize={18} barGap={4}>
            <CartesianGrid key="pmc-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis key="pmc-x" dataKey={isRTL ? "month" : "monthEn"} tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
            <YAxis key="pmc-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip key="pmc-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
            <Bar key="pmc-col" dataKey="collections" fill="#22C55E" radius={[4,4,0,0]} name={isRTL ? "التحصيلات" : "Collections"} />
            <Bar key="pmc-pay" dataKey="payments"    fill="#EF4444" radius={[4,4,0,0]} name={isRTL ? "دفعات الموردين" : "Supplier Payments"} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Latest movements */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "آخر الحركات المالية" : "Latest Financial Movements"}</h3>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate("payments-movements")}><Eye size={13} />{isRTL ? "عرض الكل" : "View All"}</Btn>
        </div>
        <div className="divide-y divide-slate-50">
          {PAY_MOVEMENTS.slice(0, 6).map(m => (
            <div key={m.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${m.dir === "in" ? "bg-emerald-100" : m.dir === "out" ? "bg-red-100" : "bg-amber-100"}`}>
                  {m.dir === "in" ? <ArrowUpRight size={14} className="text-emerald-600" /> : m.dir === "out" ? <ArrowDownRight size={14} className="text-red-600" /> : <RefreshCw size={14} className="text-amber-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5"><MovTypeBadge type={m.type} lang={lang} /><span className="font-bold text-slate-800 text-xs">{m.party}</span></div>
                  <div className="text-[10px] text-slate-400">{m.date.split(" ")[1]} · {m.receipt || m.id} {m.invoice && `· ${m.invoice}`}</div>
                </div>
              </div>
              <div className="text-end">
                <div className={`font-mono font-black text-sm ${m.dir === "in" ? "text-emerald-600" : m.dir === "out" ? "text-red-500" : "text-amber-600"}`}>{m.dir === "out" ? "−" : m.dir === "in" ? "+" : "~"}AED {m.amount.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">{m.method ? (m.method === "cash" ? (isRTL ? "كاش" : "Cash") : m.method === "bank" ? (isRTL ? "بنكي" : "Bank") : m.method === "cheque" ? (isRTL ? "شيك" : "Cheque") : (isRTL ? "أخرى" : "Other")) : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Mobile sticky buttons */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-2 shadow-lg z-10">
        {canRecord && <Btn variant="green" size="sm" className="flex-1 justify-center" onClick={() => setShowCollectModal(true)}><ArrowUpRight size={14} />{isRTL ? "تحصيل" : "Collect"}</Btn>}
        {canPay && <Btn variant="danger" size="sm" className="flex-1 justify-center" onClick={() => setShowPayModal(true)}><ArrowDownRight size={14} />{isRTL ? "دفع مورد" : "Pay Supplier"}</Btn>}
        <Btn variant="outline" size="sm" className="flex-1 justify-center" onClick={() => onNavigate("payments-movements")}><BarChart2 size={14} />{isRTL ? "إيصالات" : "Receipts"}</Btn>
      </div>

      {showCollectModal && <CustomerCollectionModal lang={lang} onClose={() => setShowCollectModal(false)} />}
      {showPayModal && <SupplierPaymentModal lang={lang} onClose={() => setShowPayModal(false)} />}
      {showSettings && <PaymentsSettingsPanel lang={lang} role={role} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── SCREEN: PAYMENT MOVEMENTS ──────────────────────────────────────────────────
export function PaymentMovementsScreen({ lang, role, onNavigate, setSelectedReceiptId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedReceiptId: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [filterType, setFilterType] = useState("all");
  const [filterDir, setFilterDir] = useState("all");
  const [showCancel, setShowCancel] = useState<string | null>(null);
  const canCancel = role === "owner" || role === "accountant";

  const { items: movementRows, loading, error, forbidden, reload } = usePaymentMovements(undefined, async () => MOCK_PAY_MOVEMENTS.map(paymentRowFromMock));
  const PAY_MOVEMENTS = movementRows.map((row) => enrichPayment(row, MOCK_PAY_MOVEMENTS.find((m) => m.id === row.id)));

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const filtered = PAY_MOVEMENTS.filter(m =>
    (filterType === "all" || m.type === filterType) &&
    (filterDir === "all" || m.dir === filterDir)
  );

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "كل الحركات المالية" : "All Financial Movements"}</h2></div>
        <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الأنواع" : "All Types"}</option>
            <option value="collection">{isRTL ? "تحصيل من عميل" : "Customer Collection"}</option>
            <option value="supplier_payment">{isRTL ? "دفعة لمورد" : "Supplier Payment"}</option>
            <option value="customer_refund">{isRTL ? "استرجاع للعميل" : "Customer Refund"}</option>
            <option value="supplier_refund">{isRTL ? "استرداد من المورد" : "Supplier Refund"}</option>
            <option value="collection_discount">{isRTL ? "خصم تحصيل" : "Collection Discount"}</option>
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الاتجاهات" : "All Directions"}</option>
            <option value="in">{isRTL ? "داخل" : "Money In"}</option>
            <option value="out">{isRTL ? "خارج" : "Money Out"}</option>
            <option value="adjustment">{isRTL ? "تسوية" : "Adjustment"}</option>
          </select>
        </div>
      </Card>

      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {[isRTL?"رقم الحركة":"Movement #",isRTL?"التاريخ":"Date",isRTL?"النوع":"Type",isRTL?"الطرف":"Party",isRTL?"المبلغ":"Amount",isRTL?"الاتجاه":"Direction",isRTL?"الطريقة":"Method",isRTL?"الإيصال":"Receipt",isRTL?"الفاتورة":"Invoice",isRTL?"الحالة":"Status",isRTL?"إجراءات":"Actions"].map((h,i)=>(
                  <th key={i} className={`px-3 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(m => (
                <tr key={m.id} className={`hover:bg-slate-50/60 transition-colors ${m.status === "cancelled" ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{m.id}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m.date}</td>
                  <td className="px-3 py-2.5"><MovTypeBadge type={m.type} lang={lang} /></td>
                  <td className="px-3 py-2.5 font-bold text-slate-800 text-xs">{m.party}</td>
                  <td className="px-3 py-2.5 font-mono font-black text-xs">
                    <span className={m.dir === "in" ? "text-emerald-600" : m.dir === "out" ? "text-red-500" : "text-amber-600"}>
                      {m.dir === "out" ? "−" : m.dir === "in" ? "+" : "~"}AED {m.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5"><DirBadge dir={m.dir} lang={lang} /></td>
                  <td className="px-3 py-2.5"><MethodBadge method={m.method} lang={lang} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs text-violet-600 font-bold">{m.receipt || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{m.invoice || "—"}</td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.status === "active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "ملغي" : "Cancelled")}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {m.receipt && <button onClick={() => { setSelectedReceiptId(m.id); onNavigate("payment-receipt-preview"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Printer size={13} /></button>}
                      <button onClick={() => { setSelectedReceiptId(m.id); onNavigate("payment-receipt-detail"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all"><Eye size={13} /></button>
                      {canCancel && m.status === "active" && <button onClick={() => setShowCancel(m.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map(m => (
          <Card key={m.id} className={`p-4 ${m.status === "cancelled" ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <MovTypeBadge type={m.type} lang={lang} />
                <div className="font-bold text-slate-800 text-sm mt-1">{m.party}</div>
                <div className="text-[10px] text-slate-400 font-mono">{m.date}</div>
              </div>
              <div className="text-end">
                <div className={`font-mono font-black text-sm ${m.dir === "in" ? "text-emerald-600" : m.dir === "out" ? "text-red-500" : "text-amber-600"}`}>
                  {m.dir === "out" ? "−" : m.dir === "in" ? "+" : "~"}AED {m.amount.toLocaleString()}
                </div>
                <DirBadge dir={m.dir} lang={lang} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
              <MethodBadge method={m.method} lang={lang} />
              {m.receipt && <span className="font-mono text-violet-600">{m.receipt}</span>}
              {m.invoice && <span className="font-mono">{m.invoice}</span>}
            </div>
            <div className="flex gap-2">
              <Btn size="sm" variant="secondary" onClick={() => { setSelectedReceiptId(m.id); onNavigate("payment-receipt-detail"); }}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
              {m.receipt && <Btn size="sm" variant="outline" onClick={() => { setSelectedReceiptId(m.id); onNavigate("payment-receipt-preview"); }}><Printer size={13} /></Btn>}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState lang={lang} messageAr="لا توجد مدفوعات أو تحصيلات بعد" messageEn="No payments or collections yet" />
      )}

      {showCancel && <CancelPaymentModal lang={lang} movementId={showCancel} onClose={() => setShowCancel(null)} />}
    </div>
  );
}

// ── MODAL: CUSTOMER COLLECTION ─────────────────────────────────────────────────
export function CustomerCollectionModal({ lang, customerId = "", invoiceId = "", onClose }: {
  lang: Lang; customerId?: string; invoiceId?: string; onClose: () => void;
}) {
  if (!IS_MOCK_MODE) {
    return <LiveCustomerCollectionModal lang={lang} customerId={customerId} invoiceId={invoiceId} onClose={onClose} />;
  }
  const isRTL = lang === "ar";
  const [mode, setMode] = useState<"invoice" | "account">(invoiceId ? "invoice" : "invoice");
  const [custId, setCustId] = useState(customerId || "");
  const [selInv, setSelInv] = useState(invoiceId || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [date, setDate] = useState("2026-01-28");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [allocMethod, setAllocMethod] = useState("auto");
  const [success, setSuccess] = useState(false);

  const cust = CUSTOMERS_MINI.find(c => c.id === custId);
  const amtNum = parseFloat(amount) || 0;
  const outstanding = cust?.balance || 0;
  const afterBalance = Math.max(0, outstanding - amtNum);

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل التحصيل بنجاح" : "Collection Recorded!"}</h3>
        <p className="font-mono text-slate-400 mb-1">REC-2026-00021</p>
        <p className={`text-sm font-bold mb-6 ${afterBalance === 0 ? "text-emerald-600" : "text-amber-600"}`}>{afterBalance === 0 ? (isRTL ? "✓ تم تصفية الرصيد" : "✓ Balance cleared") : `${isRTL ? "المتبقي:" : "Remaining:"} AED ${afterBalance.toLocaleString()}`}</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" variant="primary" className="justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال قبض" : "Print Receipt"}</Btn>
          <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
          <Btn size="sm" variant="secondary" onClick={() => { setSuccess(false); setAmount(""); setCustId(""); }} className="justify-center">{isRTL ? "تحصيل آخر" : "New Collection"}</Btn>
          <Btn size="sm" variant="outline" onClick={onClose} className="justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل تحصيل من عميل" : "Record Customer Collection"}</h3></div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Mode */}
          <div className="grid grid-cols-2 gap-2">
            {([["invoice", isRTL ? "تحصيل على فاتورة محددة" : "Specific Invoice"], ["account", isRTL ? "تحصيل على حساب العميل" : "Account Payment"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${mode === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
            ))}
          </div>

          <FSelect label={isRTL ? "العميل *" : "Customer *"} value={custId} onChange={setCustId} required
            options={[{ value: "", label: isRTL ? "اختر العميل" : "Select Customer" }, ...CUSTOMERS_MINI.map(c => ({ value: c.id, label: c.name }))]} />

          {cust && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "الرصيد المستحق" : "Outstanding Balance"}</span><span className="font-mono font-black text-red-500">AED {cust.balance.toLocaleString()}</span></div>
            </div>
          )}

          {mode === "invoice" && cust && (
            <FSelect label={isRTL ? "اختر الفاتورة" : "Select Invoice"} value={selInv} onChange={setSelInv}
              options={[{ value: "", label: isRTL ? "اختر الفاتورة" : "Select Invoice" }, ...cust.invoices.map(i => ({ value: i, label: i }))]} />
          )}

          {mode === "account" && (
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "طريقة التوزيع" : "Allocation Method"}</label>
              <div className="space-y-1.5">
                {[["auto", isRTL ? "توزيع تلقائي على أقدم فواتير غير مدفوعة" : "Auto-allocate to oldest invoices"], ["manual", isRTL ? "توزيع يدوي على الفواتير" : "Manual allocation"], ["credit", isRTL ? "تسجيل كرصيد دائن للعميل" : "Record as customer credit"]].map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${allocMethod === v ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100"}`}>
                    <input type="radio" value={v} checked={allocMethod === v} onChange={() => setAllocMethod(v)} className="accent-[#0F2C59]" />
                    <span className="text-xs font-bold text-slate-700">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <FInput label={isRTL ? "المبلغ المُحصَّل (AED) *" : "Amount Collected (AED) *"} type="number" value={amount} onChange={setAmount} required />
          <div className="grid grid-cols-2 gap-3">
            <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={v => setMethod(v as PayMethod)} required
              options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
            <FInput label={isRTL ? "التاريخ" : "Date"} type="date" value={date} onChange={setDate} />
          </div>
          {method === "bank" && <FInput label={isRTL ? "رقم المرجع *" : "Reference Number *"} value={ref} onChange={setRef} required />}
          <FInput label={isRTL ? "من (خزنة / حساب بنكي)" : "Paid Into (Cash Box / Bank)"} value="الخزنة الرئيسية" onChange={() => {}} />

          {amtNum > 0 && cust && (
            <div className={`rounded-xl p-3 border ${afterBalance === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${afterBalance === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `الرصيد بعد التحصيل: AED ${afterBalance.toLocaleString()}` : `Balance after collection: AED ${afterBalance.toLocaleString()}`}
                {afterBalance === 0 && (isRTL ? " ✓ مسدّد" : " ✓ Cleared")}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="green" disabled={!custId || !amount || parseFloat(amount) <= 0}
            onClick={() => { toast.success(isRTL ? "تم تسجيل التحصيل بنجاح" : "Collection recorded"); setSuccess(true); }}>
            <Check size={15} />{isRTL ? "تسجيل التحصيل" : "Record Collection"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: SUPPLIER PAYMENT ────────────────────────────────────────────────────
export function SupplierPaymentModal({ lang, supplierId = "", invoiceId = "", onClose }: {
  lang: Lang; supplierId?: string; invoiceId?: string; onClose: () => void;
}) {
  if (!IS_MOCK_MODE) {
    return <LiveSupplierPaymentModal lang={lang} supplierId={supplierId} onClose={onClose} />;
  }
  const isRTL = lang === "ar";
  const [mode, setMode] = useState<"invoice" | "account">("invoice");
  const [suppId, setSuppId] = useState(supplierId || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("bank");
  const [date, setDate] = useState("2026-01-28");
  const [ref, setRef] = useState("");
  const [success, setSuccess] = useState(false);

  const supp = SUPPLIERS_MINI.find(s => s.id === suppId);
  const amtNum = parseFloat(amount) || 0;
  const afterBalance = Math.max(0, (supp?.balance || 0) - amtNum);

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-[#0F2C59]/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-[#0F2C59]" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل دفعة المورد بنجاح" : "Supplier Payment Recorded!"}</h3>
        <p className="font-mono text-slate-400 mb-6">PAY-2026-00010</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" variant="primary" className="justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال دفع" : "Print Receipt"}</Btn>
          <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
          <Btn size="sm" variant="secondary" onClick={() => { setSuccess(false); setAmount(""); setSuppId(""); }} className="justify-center">{isRTL ? "دفعة أخرى" : "New Payment"}</Btn>
          <Btn size="sm" variant="outline" onClick={onClose} className="justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل دفعة لمورد" : "Record Supplier Payment"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([["invoice", isRTL ? "دفعة على فاتورة محددة" : "Specific Invoice"], ["account", isRTL ? "دفعة على حساب المورد" : "Account Payment"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${mode === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
            ))}
          </div>
          <FSelect label={isRTL ? "المورد *" : "Supplier *"} value={suppId} onChange={setSuppId} required
            options={[{ value: "", label: isRTL ? "اختر المورد" : "Select Supplier" }, ...SUPPLIERS_MINI.map(s => ({ value: s.id, label: s.name }))]} />
          {supp && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm"><div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "المستحق للمورد" : "Supplier Balance"}</span><span className="font-mono font-black text-amber-600">AED {supp.balance.toLocaleString()}</span></div></div>
          )}
          {mode === "invoice" && supp && (
            <FSelect label={isRTL ? "اختر فاتورة الشراء" : "Select Purchase Invoice"} value="" onChange={() => {}}
              options={[{ value: "", label: isRTL ? "اختر الفاتورة" : "Select Invoice" }, ...supp.invoices.map(i => ({ value: i, label: i }))]} />
          )}
          <FInput label={isRTL ? "المبلغ المدفوع (AED) *" : "Amount Paid (AED) *"} type="number" value={amount} onChange={setAmount} required />
          <div className="grid grid-cols-2 gap-3">
            <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={v => setMethod(v as PayMethod)} required
              options={[{ value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
            <FInput label={isRTL ? "التاريخ" : "Date"} type="date" value={date} onChange={setDate} />
          </div>
          {(method === "bank" || method === "cheque") && <FInput label={isRTL ? "رقم المرجع *" : "Reference Number *"} value={ref} onChange={setRef} required />}
          {amtNum > 0 && supp && (
            <div className={`rounded-xl p-3 border ${afterBalance === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${afterBalance === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `رصيد المورد بعد الدفع: AED ${afterBalance.toLocaleString()}` : `Supplier balance after payment: AED ${afterBalance.toLocaleString()}`}
                {afterBalance === 0 && (isRTL ? " ✓ مسدّد" : " ✓ Settled")}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="amber" disabled={!suppId || !amount || parseFloat(amount) <= 0}
            onClick={() => { toast.success(isRTL ? "تم تسجيل الدفعة بنجاح" : "Payment recorded"); setSuccess(true); }}>
            <Check size={15} />{isRTL ? "تسجيل الدفعة" : "Record Payment"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: CUSTOMER REFUND ────────────────────────────────────────────────────
export function CustomerRefundScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  if (!IS_MOCK_MODE) {
    return <LiveCustomerRefundScreen lang={lang} onNavigate={onNavigate} Card={Card} Btn={Btn} FSelect={FSelect} FInput={FInput} />;
  }
  const isRTL = lang === "ar";
  const [custId, setCustId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [date, setDate] = useState("2026-01-28");
  const [success, setSuccess] = useState(false);
  const cust = CUSTOMERS_MINI.find(c => c.id === custId);

  if (success) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-orange-500" /></div>
        <h2 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم استرجاع المبلغ للعميل بنجاح" : "Customer Refund Recorded!"}</h2>
        <p className="font-mono text-slate-400 mb-6">REF-C-2026-00004</p>
        <div className="flex gap-2 justify-center">
          <Btn variant="primary"><Printer size={15} />{isRTL ? "طباعة إيصال استرجاع" : "Print Refund Receipt"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("payments")}>{isRTL ? "العودة" : "Back"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "استرجاع مبلغ للعميل" : "Customer Refund"}</h2>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
        <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
        <p className="text-sm font-bold text-orange-700 leading-relaxed">{isRTL ? "استرجاع المبلغ سيقلل الرصيد الدائن أو يزيد المبلغ المستحق حسب حالة حساب العميل." : "Refund will reduce customer credit or increase their outstanding balance depending on account state."}</p>
      </div>
      <Card className="p-5 space-y-4">
        <FSelect label={isRTL ? "العميل *" : "Customer *"} value={custId} onChange={setCustId} required
          options={[{ value: "", label: isRTL ? "اختر العميل" : "Select Customer" }, ...CUSTOMERS_MINI.map(c => ({ value: c.id, label: c.name }))]} />
        {cust && <div className="bg-slate-50 rounded-xl p-3 text-sm"><div className="flex justify-between"><span className="text-slate-400">{isRTL ? "رصيد العميل" : "Customer Balance"}</span><span className="font-mono font-black text-red-500">AED {cust.balance.toLocaleString()}</span></div></div>}
        <FInput label={isRTL ? "مبلغ الاسترجاع (AED) *" : "Refund Amount (AED) *"} type="number" value={amount} onChange={setAmount} required />
        <FSelect label={isRTL ? "سبب الاسترجاع *" : "Refund Reason *"} value={reason} onChange={setReason} required
          options={[{ value: "", label: isRTL ? "اختر السبب" : "Select Reason" }, { value: "overpaid", label: isRTL ? "العميل دفع أكثر" : "Customer overpaid" }, { value: "cancelled", label: isRTL ? "إلغاء فاتورة مدفوعة" : "Cancelled paid invoice" }, { value: "goods", label: isRTL ? "تسوية مشكلة بضاعة" : "Goods issue settlement" }, { value: "credit", label: isRTL ? "إعادة رصيد دائن" : "Credit balance returned" }, { value: "manual", label: isRTL ? "استرجاع يدوي" : "Manual refund" }]} />
        <div className="grid grid-cols-2 gap-3">
          <FSelect label={isRTL ? "طريقة الدفع *" : "Payment Method *"} value={method} onChange={v => setMethod(v as PayMethod)} required
            options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
          <FInput label={isRTL ? "التاريخ" : "Date"} type="date" value={date} onChange={setDate} />
        </div>
        {/* Before/after preview */}
        {parseFloat(amount) > 0 && cust && (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-black text-slate-500 uppercase">{isRTL ? "قبل وبعد" : "Before & After"}</div>
            {[[isRTL?"رصيد العميل قبل":"Balance Before", `AED ${cust.balance.toLocaleString()}`, "text-slate-700"], [isRTL?"مبلغ الاسترجاع":"Refund Amount", `-AED ${parseFloat(amount).toLocaleString()}`, "text-red-500"], [isRTL?"الرصيد بعد الاسترجاع":"Balance After", `AED ${(cust.balance - parseFloat(amount)).toLocaleString()}`, "text-[#0F2C59] font-black"]].map(([l,v,c])=>(
              <div key={l} className="flex justify-between text-sm"><span className="text-slate-400 font-semibold">{l}</span><span className={`font-mono font-bold ${c}`}>{v}</span></div>
            ))}
          </div>
        )}
      </Card>
      <div className="flex gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate("payments")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <Btn variant="amber" disabled={!custId || !amount || !reason}
          onClick={() => { toast.success(isRTL ? "تم استرجاع المبلغ بنجاح" : "Refund recorded"); setSuccess(true); }}>
          <Check size={15} />{isRTL ? "تسجيل الاسترجاع" : "Record Refund"}
        </Btn>
      </div>
    </div>
  );
}

export function SupplierRefundScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: TenantScreen) => void }) {
  if (!IS_MOCK_MODE) {
    return <LiveSupplierRefundScreen lang={lang} onNavigate={onNavigate} Card={Card} Btn={Btn} FSelect={FSelect} FInput={FInput} />;
  }
  const isRTL = lang === "ar";
  return (
    <div className="p-8 text-center">
      <p className="text-slate-500 font-bold">{isRTL ? "استرجاع المورد متاح في وضع API الحي" : "Supplier refund available in live API mode"}</p>
      <Btn variant="outline" className="mt-4" onClick={() => onNavigate("payments")}>{isRTL ? "رجوع" : "Back"}</Btn>
    </div>
  );
}

// ── SCREEN: RECEIPT PREVIEW ────────────────────────────────────────────────────
export function ReceiptPreviewScreen({ lang, onNavigate, receiptId }: { lang: Lang; onNavigate: (s: TenantScreen) => void; receiptId: string }) {
  if (!IS_MOCK_MODE && receiptId) {
    return (
      <LivePrintPreviewScreen
        lang={lang}
        onNavigate={onNavigate}
        backScreen="payments-movements"
        titleAr="إيصال قبض / دفع"
        titleEn="Payment Receipt"
        loadPreview={() => getPaymentMovementPrintPreviewRaw(receiptId)}
      />
    );
  }
  const isRTL = lang === "ar";
  const m = MOCK_PAY_MOVEMENTS.find(x => x.id === receiptId) || MOCK_PAY_MOVEMENTS[0];
  const isCollection = m.type === "collection";
  const isSupplierPay = m.type === "supplier_payment";
  const isRefund = m.type === "customer_refund" || m.type === "supplier_refund";

  const titleAr = isCollection ? "إيصال قبض" : isSupplierPay ? "إيصال دفع" : "إيصال استرجاع";
  const titleEn = isCollection ? "Receipt Voucher" : isSupplierPay ? "Payment Voucher" : "Refund Receipt";
  const accentColor = isCollection ? "bg-emerald-600" : isSupplierPay ? "bg-amber-600" : "bg-blue-600";

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("payments-movements")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1" />
        <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn variant="secondary"><Download size={15} />PDF</Btn>
        <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={`${accentColor} text-white p-6`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-xl font-black">شركة الوطنية للدواجن</div>
              <div className="text-sm font-bold text-white/70">Al Wataniyah Poultry Company LLC</div>
              <div className="text-sm text-white/55 mt-1">+971 50 123 4567 | TRN: 100345678901203</div>
            </div>
            <div className="text-end">
              <div className="text-xl font-black">{isRTL ? titleAr : titleEn}</div>
              <div className="text-sm font-bold text-white/70 mt-0.5">{titleEn} / {titleAr}</div>
              <div className="text-sm font-bold text-white/70 mt-1">{m.receipt || m.id}</div>
              <div className="text-xs text-white/60">{m.date.split(" ")[0]}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
            {[
              [isCollection ? (isRTL ? "استُلم من" : "Received From") : isSupplierPay ? (isRTL ? "دُفع إلى" : "Paid To") : (isRTL ? "استُرجع إلى" : "Refunded To"), m.party],
              [isRTL ? "المبلغ" : "Amount", `AED ${m.amount.toLocaleString()}`],
              [isRTL ? "طريقة الدفع" : "Payment Method", m.method === "cash" ? (isRTL ? "كاش" : "Cash") : m.method === "bank" ? (isRTL ? "تحويل بنكي" : "Bank Transfer") : m.method === "cheque" ? (isRTL ? "شيك" : "Cheque") : "—"],
              [isRTL ? "المرجع" : "Reference", m.ref || "—"],
              ...(m.invoice ? [[isRTL ? "مرتبط بفاتورة" : "Linked Invoice", m.invoice]] : []),
              [isRTL ? "أُنشئ بواسطة" : "Created By", m.user],
            ].map(([l, v]) => (
              <div key={l}><div className="text-xs font-bold text-slate-400 mb-0.5">{l}</div><div className="font-bold text-slate-800">{v}</div></div>
            ))}
          </div>
          {/* Amount box */}
          <div className={`${accentColor} rounded-2xl p-4 flex items-center justify-between`}>
            <span className="font-black text-white text-sm">{isRTL ? "إجمالي المبلغ / Total Amount" : "Total Amount / إجمالي المبلغ"}</span>
            <span className="font-mono font-black text-white text-2xl">AED {m.amount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-slate-400 font-semibold text-center">{isRTL ? "المبلغ كتابةً: ..." : "Amount in words: ..."}</div>
          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 mt-4">
            {[isRTL ? "أعدّه" : "Prepared By", isRTL ? "استلمه" : "Received By", isRTL ? "اعتمده" : "Approved By"].map(l => (
              <div key={l} className="border-t-2 border-slate-300 pt-3 text-center"><div className="text-xs font-black text-slate-400 uppercase tracking-wide">{l}</div><div className="h-10" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: PAYMENT METHOD SUMMARY ────────────────────────────────────────────
export function PaymentMethodSummaryScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const kpis = [
    { v: "AED 8,000", ar: "إجمالي الكاش الداخل",          en: "Total Cash In",      cls: "text-emerald-600 bg-emerald-50" },
    { v: "AED 2,500", ar: "إجمالي الكاش الخارج",          en: "Total Cash Out",     cls: "text-red-500 bg-red-50" },
    { v: "AED 5,500", ar: "صافي الكاش",                   en: "Net Cash",           cls: "text-[#0F2C59] bg-[#0F2C59]/5" },
    { v: "AED 6,000", ar: "التحويلات البنكية الداخلة",    en: "Bank In",            cls: "text-blue-600 bg-blue-50" },
    { v: "AED 5,000", ar: "التحويلات البنكية الخارجة",    en: "Bank Out",           cls: "text-red-500 bg-red-50" },
    { v: "AED 3,000", ar: "الشيكات",                      en: "Cheques",            cls: "text-amber-600 bg-amber-50" },
  ];
  const sections: [string, string, string, PayMovement[]][] = [
    ["كاش", "Cash", "bg-emerald-500", MOCK_PAY_MOVEMENTS.filter(m => m.method === "cash")],
    ["تحويل بنكي", "Bank Transfer", "bg-blue-500", MOCK_PAY_MOVEMENTS.filter(m => m.method === "bank")],
    ["شيك", "Cheque", "bg-amber-500", MOCK_PAY_MOVEMENTS.filter(m => m.method === "cheque")],
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "ملخص طرق الدفع" : "Payment Method Summary"}</h2></div>
        <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k, i) => <Card key={i} className={`p-4 text-center ${k.cls.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${k.cls.split(" ")[0]}`}>{k.v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? k.ar : k.en}</div></Card>)}
      </div>
      {sections.map(([ar, en, bg, movs]) => (
        movs.length > 0 && (
          <Card key={ar}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${bg}`} />
              <h3 className="font-black text-slate-800 text-sm">{isRTL ? ar : en}</h3>
              <span className="text-xs text-slate-400">({movs.length} {isRTL ? "حركة" : "movements"})</span>
            </div>
            <div className="divide-y divide-slate-50">
              {movs.map(m => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div><div className="font-bold text-slate-800 text-xs">{m.party}</div><div className="text-[10px] text-slate-400">{m.date} · <MovTypeBadge type={m.type} lang={lang} /></div></div>
                  <div className="text-end"><div className={`font-mono font-black text-sm ${m.dir === "in" ? "text-emerald-600" : "text-red-500"}`}>{m.dir === "out" ? "−" : "+"}AED {m.amount.toLocaleString()}</div></div>
                </div>
              ))}
            </div>
          </Card>
        )
      ))}
    </div>
  );
}

// ── SCREEN: PAYMENTS REPORT ────────────────────────────────────────────────────
export function PaymentsReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const totalIn = MOCK_PAY_MOVEMENTS.filter(m => m.dir === "in").reduce((s, m) => s + m.amount, 0);
  const totalOut = MOCK_PAY_MOVEMENTS.filter(m => m.dir === "out" && m.type === "supplier_payment").reduce((s, m) => s + m.amount, 0);
  const totalColl = MOCK_PAY_MOVEMENTS.filter(m => m.type === "collection").reduce((s, m) => s + m.amount, 0);
  const totalRefCust = MOCK_PAY_MOVEMENTS.filter(m => m.type === "customer_refund").reduce((s, m) => s + m.amount, 0);
  const totalRefSupp = MOCK_PAY_MOVEMENTS.filter(m => m.type === "supplier_refund").reduce((s, m) => s + m.amount, 0);

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير المدفوعات والتحصيلات" : "Payments & Collections Report"}</h2></div>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" onClick={() => window.print()}><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
          <Btn variant="secondary" size="sm"><Download size={13} />Excel</Btn>
        </div>
      </div>
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[[`AED ${totalColl.toLocaleString()}`,isRTL?"إجمالي التحصيلات":"Total Collections","text-emerald-600 bg-emerald-50"],[`AED ${totalOut.toLocaleString()}`,isRTL?"إجمالي الدفعات للموردين":"Supplier Payments","text-red-500 bg-red-50"],[`AED ${totalRefCust.toLocaleString()}`,isRTL?"مرتجعات للعملاء":"Customer Refunds","text-orange-600 bg-orange-50"],[`AED ${totalRefSupp.toLocaleString()}`,isRTL?"مستردات من الموردين":"Supplier Refunds","text-blue-600 bg-blue-50"]].map(([v,l,c],i)=>(
          <Card key={i} className={`p-4 text-center ${c.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${c.split(" ")[0]}`}>{v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{l}</div></Card>
        ))}
      </div>
      {/* Movements table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"التاريخ":"Date",isRTL?"رقم الحركة":"#",isRTL?"النوع":"Type",isRTL?"الطرف":"Party",isRTL?"المبلغ":"Amount",isRTL?"الاتجاه":"Direction",isRTL?"الطريقة":"Method",isRTL?"الإيصال":"Receipt",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_PAY_MOVEMENTS.map(m=>(
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.date.split(" ")[0]}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{m.id}</td>
                  <td className="px-4 py-2.5"><MovTypeBadge type={m.type} lang={lang} /></td>
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{m.party}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-xs"><span className={m.dir==="in"?"text-emerald-600":m.dir==="out"?"text-red-500":"text-amber-600"}>{m.dir==="out"?"−":m.dir==="in"?"+":"~"}AED {m.amount.toLocaleString()}</span></td>
                  <td className="px-4 py-2.5"><DirBadge dir={m.dir} lang={lang} /></td>
                  <td className="px-4 py-2.5"><MethodBadge method={m.method} lang={lang} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-violet-600">{m.receipt||"—"}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status==="active"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{m.status==="active"?(isRTL?"نشط":"Active"):(isRTL?"ملغي":"Cancelled")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── MODAL: CANCEL PAYMENT ──────────────────────────────────────────────────────
function CancelPaymentModal({ lang, movementId, onClose, onCancelled }: { lang: Lang; movementId: string; onClose: () => void; onCancelled?: () => void }) {
  if (!IS_MOCK_MODE) {
    return <LiveCancelPaymentModal lang={lang} movementId={movementId} onClose={onClose} onCancelled={onCancelled} Btn={Btn} />;
  }
  const isRTL = lang === "ar";
  const m = MOCK_PAY_MOVEMENTS.find(x => x.id === movementId)!;
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-red-600">{isRTL ? "إلغاء حركة مالية" : "Cancel Payment Movement"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
            {[[isRTL?"النوع":"Type",isRTL?m.typeAr:m.typeEn],[isRTL?"الطرف":"Party",m.party],[isRTL?"المبلغ":"Amount",`AED ${m.amount.toLocaleString()}`],[isRTL?"الإيصال":"Receipt",m.receipt||m.id]].map(([l,v])=>(
              <div key={l} className="flex justify-between"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-800">{v}</span></div>
            ))}
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1.5">
            {[isRTL?"إلغاء التحصيل سيعيد المبلغ المستحق على العميل":"Cancelling will restore customer outstanding balance",isRTL?"الإيصال سيظهر كملغي للتدقيق":"Receipt remains visible as cancelled for audit"].map((w,i)=>(
              <div key={i} className="flex items-center gap-2 text-xs font-bold text-red-700"><AlertTriangle size={11} className="shrink-0" />{w}</div>
            ))}
          </div>
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "سبب الإلغاء *" : "Cancellation Reason *"}</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400" /></div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 shrink-0 accent-red-500" />
            <span className="text-xs font-bold text-slate-700">{isRTL ? "أفهم أن إلغاء هذه الحركة سيعدل رصيد العميل أو المورد." : "I understand this will affect customer or supplier balance."}</span>
          </label>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
          <Btn variant="danger" disabled={!reason.trim() || !confirmed} onClick={() => { toast.success(isRTL ? "تم إلغاء الحركة المالية" : "Movement cancelled"); onClose(); }} className="flex-1 justify-center"><X size={14} />{isRTL ? "تأكيد الإلغاء" : "Confirm Cancel"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── PANEL: PAYMENTS SETTINGS ───────────────────────────────────────────────────
function PaymentsSettingsPanel({ lang, role, onClose }: { lang: Lang; role: TenantRole; onClose: () => void }) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner";
  const [cashierCollect, setCashierCollect] = useState(true);
  const [cashierPay, setCashierPay] = useState(false);
  const [cashierRefund, setCashierRefund] = useState(false);
  const [reqRefBank, setReqRefBank] = useState(true);
  const [autoAlloc, setAutoAlloc] = useState(true);
  const [allowCredit, setAllowCredit] = useState(true);
  const [reqCancelReason, setReqCancelReason] = useState(true);

  const toggles: [boolean, (v: boolean) => void, string, string][] = [
    [cashierCollect, setCashierCollect, isRTL ? "السماح للكاشير بتسجيل تحصيل من العميل" : "Allow cashier to record customer collection", ""],
    [cashierPay, setCashierPay, isRTL ? "السماح للكاشير بتسجيل دفعة لمورد" : "Allow cashier to record supplier payment", ""],
    [cashierRefund, setCashierRefund, isRTL ? "السماح للكاشير بإصدار مرتجعات" : "Allow cashier to issue refunds", ""],
    [reqRefBank, setReqRefBank, isRTL ? "إلزامية رقم المرجع للتحويل البنكي" : "Require reference for bank transfers", ""],
    [autoAlloc, setAutoAlloc, isRTL ? "التوزيع التلقائي على أقدم الفواتير" : "Auto-allocate to oldest invoices", ""],
    [allowCredit, setAllowCredit, isRTL ? "السماح برصيد دائن للعميل" : "Allow customer credit balance", ""],
    [reqCancelReason, setReqCancelReason, isRTL ? "طلب سبب عند إلغاء الإيصال" : "Require reason when cancelling receipt", ""],
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات المدفوعات والإيصالات" : "Payments & Receipts Settings"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-[#0F2C59]/5 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "يمكن التحكم في صلاحيات التحصيل والدفع حسب كل مستخدم من إعدادات الصلاحيات." : "Payment permissions can be controlled per user from the permissions settings."}</p></div>
          <div className="space-y-1">
            {toggles.map(([val, setter, label]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <Toggle on={val} onChange={v => canEdit && setter(v)} />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4 flex gap-3 shrink-0">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
          {canEdit && <Btn className="flex-1 justify-center" onClick={() => { toast.success(isRTL ? "تم حفظ الإعدادات" : "Settings saved"); onClose(); }}><Check size={14} />{isRTL ? "حفظ" : "Save"}</Btn>}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: CASH & BANK ACCOUNTS (Placeholder) ─────────────────────────────────
export function CashBankAccountsScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const bankAccounts = [
    { bank: "Emirates NBD",  nick: "الحساب الرئيسي",     active: true,  lastMov: "2026-01-28" },
    { bank: "Mashreq Bank",  nick: "حساب العمليات",     active: true,  lastMov: "2026-01-25" },
    { bank: "ADCB",          nick: "حساب الادخار",       active: false, lastMov: "2025-12-10" },
  ];
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("payments")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "الخزنة والحسابات البنكية" : "Cash Box & Bank Accounts"}</h2></div>
        <Btn variant="outline" size="sm"><Plus size={13} />{isRTL ? "إضافة حساب" : "Add Account"}</Btn>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "إدارة الخزنة والحسابات البنكية سيتم ربطها لاحقاً بالقيود المالية." : "Cash box and bank account management will be linked to accounting journals in a future release."}</p></div>
      {/* Cash box */}
      <Card className="p-5 bg-emerald-50 border-emerald-200">
        <div className="flex items-center justify-between">
          <div><div className="font-black text-slate-800 text-lg">{isRTL ? "الخزنة الرئيسية" : "Main Cash Box"}</div><div className="text-xs text-slate-500 font-semibold mt-0.5">{isRTL ? "نقد متاح" : "Available Cash"}</div></div>
          <div className="text-end"><div className="text-3xl font-black font-mono text-emerald-700">AED 5,500</div><div className="text-xs text-slate-400">{isRTL ? "صافي اليوم" : "Today's net"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-xl p-3 text-center"><div className="font-mono font-black text-emerald-600">+AED 8,000</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "كاش داخل" : "Cash In"}</div></div>
          <div className="bg-white rounded-xl p-3 text-center"><div className="font-mono font-black text-red-500">−AED 2,500</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "كاش خارج" : "Cash Out"}</div></div>
        </div>
      </Card>
      {/* Bank accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.map(acc => (
          <Card key={acc.bank} className={`p-5 ${!acc.active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div><div className="font-black text-slate-800">{acc.nick}</div><div className="text-xs text-slate-400">{acc.bank}</div></div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{acc.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span>
            </div>
            <div className="text-2xl font-black font-mono text-[#0F2C59] mb-1">{isRTL ? "رصيد غير محدد" : "Balance N/A"}</div>
            <div className="text-[10px] text-slate-400">{isRTL ? "آخر حركة:" : "Last movement:"} {acc.lastMov}</div>
            <Btn size="sm" variant="outline" className="w-full justify-center mt-3" onClick={() => onNavigate("payments-movements")}><Eye size={13} />{isRTL ? "عرض الحركات" : "View Movements"}</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
