// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — CUSTOMER PHASE: CUSTOMERS & ACCOUNTS WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Plus, Search, Eye, Pencil, X, Check, ChevronRight, ChevronLeft,
  ChevronDown, Phone, Mail, AlertTriangle, AlertCircle, Info, CheckCircle,
  XCircle, Download, Printer, TrendingUp, Users, DollarSign, FileText,
  Clock, Calendar, Settings, Shield, Lock, Wallet, Tag, Star, BarChart2
} from "lucide-react";
import { toast } from "sonner";
import { useCustomers, useCustomerDetail } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { toModuleCustomer } from "./moduleMappers";
import { IS_MOCK_MODE } from "@/services/config";
import {
  buildCustomerCreatePayload,
  buildCustomerUpdatePayload,
  createCustomer,
  getCustomerDetail,
  listCustomerCategories,
  updateCustomer,
  updateCustomerOpeningBalance,
} from "@/services/customerService";
import { ApiError } from "@/services/api/errors";
import { FormErrors } from "@/shared/components/FormErrors";
import { canCreateCustomer, canEditCustomer, canEditCustomerOpeningBalance } from "@/shared/utils/permissions";
import { useCustomerProfileTabs, type CustomerProfileTabKey } from "@/features/profiles/useCustomerProfileTabs";
import { ProfileTabBody } from "@/features/profiles/ProfileTabState";
import { LiveCustomerCollectionModal } from "@/features/payments/LivePaymentModals";
import { ApiUnavailableState } from "@/shared/components/ApiStates";
import { getCustomerStatementReport } from "@/services/reportsService";
import { getDefaultStatementDateRange } from "@/shared/utils/dateRanges";
import { parseAmount } from "@/services/crud/parse";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "sales-preview" | "sales-detail"
  | "purchases" | "purchases-list" | "purchases-new" | "purchases-preview" | "purchases-detail"
  | "inventory" | "inventory-product" | "inventory-stocktaking" | "inventory-alerts" | "inventory-movement" | "inventory-valuation"
  | "customers" | "customers-create" | "customers-edit" | "customers-profile" | "customers-statement"
  | "quotations" | "suppliers" | "payments" | "expenses" | "accounts" | "tax" | "reports" | "users" | "settings";
type CustType = "credit" | "cash";
type CreditStatus = "clear" | "active" | "near" | "exceeded";

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
function FInput({ label, placeholder, type = "text", value, onChange, helper, error, required = false }: {
  label: string; placeholder?: string; type?: string; value: string; onChange: (v: string) => void; helper?: string; error?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white focus:border-[#0F2C59] focus:ring-2 focus:ring-[#0F2C59]/10"}`} />
      {helper && !error && <p className="text-xs text-slate-400">{helper}</p>}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}
    </div>
  );
}
function FSelect({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59] appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function PermBtn({ children, lang }: { children: ReactNode; lang: Lang }) {
  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed select-none bg-slate-50 text-slate-400 border-slate-200 opacity-60">{children}</div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl whitespace-nowrap`}>
        {lang === "ar" ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission"}
      </div>
    </div>
  );
}
function PremiumBtn({ children, lang, size = "sm" }: { children: ReactNode; lang: Lang; size?: "sm" | "md" }) {
  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-2 font-bold rounded-xl border cursor-not-allowed select-none bg-slate-50 text-slate-400 border-slate-200 ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}>
        <Lock size={11} className="text-amber-500" />{children}
        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{lang === "ar" ? "ميزة متقدمة" : "Premium"}</span>
      </div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl max-w-52 text-center leading-snug`}>
        {lang === "ar" ? "إرسال واتساب متاح في الباقات الأعلى." : "WhatsApp sending available in higher plans."}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface Customer {
  id: string; nameAr: string; nameEn: string; type: CustType; category: string;
  phone: string; whatsapp: string; email: string; trn: string; emirate: string;
  balance: number; creditLimit: number; creditStatus: CreditStatus;
  lastInvoice: string; lastCollection: string; active: boolean; openingBalance: number;
}
const MOCK_CUSTOMERS: Customer[] = [
  { id: "cu1", nameAr: "مطعم الخليج",         nameEn: "Al Khalij Restaurant",  type: "credit", category: "restaurant", phone: "+971 50 123 4567", whatsapp: "+971 50 123 4567", email: "info@khalij.ae",   trn: "",                 emirate: "دبي",       balance: 12450,  creditLimit: 15000, creditStatus: "near",     lastInvoice: "2025-01-28", lastCollection: "2025-01-15", active: true,  openingBalance: 2000 },
  { id: "cu2", nameAr: "سوبر ماركت المدينة", nameEn: "Al Madina Supermarket",  type: "credit", category: "supermarket", phone: "+971 55 987 6543", whatsapp: "+971 55 987 6543", email: "orders@madina.ae", trn: "100123456700003",   emirate: "الشارقة",  balance: 18700,  creditLimit: 15000, creditStatus: "exceeded", lastInvoice: "2025-01-28", lastCollection: "2025-01-10", active: true,  openingBalance: 5000 },
  { id: "cu3", nameAr: "مطبخ الإمارات",       nameEn: "Emirates Kitchen",       type: "cash",   category: "kitchen",    phone: "+971 50 654 3210", whatsapp: "+971 50 654 3210", email: "",                trn: "",                 emirate: "أبوظبي",   balance: 0,      creditLimit: 0,     creditStatus: "clear",    lastInvoice: "2025-01-27", lastCollection: "2025-01-27", active: true,  openingBalance: 0 },
  { id: "cu4", nameAr: "Prime Fresh Meat LLC", nameEn: "Prime Fresh Meat LLC",   type: "credit", category: "butcher",    phone: "+971 54 321 6789", whatsapp: "+971 54 321 6789", email: "hello@pfm.ae",    trn: "100987654300001",  emirate: "دبي",       balance: 4250,   creditLimit: 20000, creditStatus: "active",   lastInvoice: "2025-01-26", lastCollection: "2025-01-20", active: true,  openingBalance: 0 },
];
const CUST_INVOICES = [
  { id: "INV-2025-0086", date: "2025-01-28", cartons: 10, kg: 126, total: 2001.56, paid: 2001.56, remaining: 0,       method: "cash",   status: "paid"    },
  { id: "INV-2025-0083", date: "2025-01-27", cartons: 20, kg: 200, total: 3097.50, paid: 0,       remaining: 3097.50, method: "credit", status: "approved" },
  { id: "INV-2025-0081", date: "2025-01-25", cartons: 15, kg: 135, total: 1856.25, paid: 1000,    remaining: 856.25,  method: "credit", status: "partial"  },
  { id: "INV-2025-0070", date: "2025-01-20", cartons: 30, kg: 280, total: 4194.25, paid: 4194.25, remaining: 0,       method: "bank",   status: "paid"     },
];
const CUST_COLLECTIONS = [
  { id: "REC-001", date: "2025-01-28", amount: 2001.56, method: "cash",     linkedInv: "INV-2025-0086", ref: "",           by: "محمد (كاشير)" },
  { id: "REC-002", date: "2025-01-15", amount: 1000,    method: "bank",     linkedInv: "INV-2025-0081", ref: "TRF-001",    by: "أحمد (مالك)" },
  { id: "REC-003", date: "2025-01-10", amount: 4194.25, method: "cheque",   linkedInv: "INV-2025-0070", ref: "CHQ-12345",  by: "أحمد (مالك)" },
];
const STMT_MOVEMENTS = [
  { id: "s1", date: "2025-01-01", type: "opening",    ref: "—",              desc: "رصيد افتتاحي",        debit: 2000,      credit: 0,       balance: 2000 },
  { id: "s2", date: "2025-01-20", type: "invoice",    ref: "INV-2025-0070",  desc: "فاتورة بيع",          debit: 4194.25,   credit: 0,       balance: 6194.25 },
  { id: "s3", date: "2025-01-20", type: "collection", ref: "REC-003",        desc: "تحصيل",               debit: 0,         credit: 4194.25, balance: 2000 },
  { id: "s4", date: "2025-01-25", type: "invoice",    ref: "INV-2025-0081",  desc: "فاتورة بيع",          debit: 1856.25,   credit: 0,       balance: 3856.25 },
  { id: "s5", date: "2025-01-15", type: "collection", ref: "REC-002",        desc: "تحصيل",               debit: 0,         credit: 1000,    balance: 2856.25 },
  { id: "s6", date: "2025-01-27", type: "invoice",    ref: "INV-2025-0083",  desc: "فاتورة بيع",          debit: 3097.50,   credit: 0,       balance: 5953.75 },
  { id: "s7", date: "2025-01-27", type: "discount",   ref: "ADJ-2026-00004", desc: "خصم عند التحصيل",     debit: 0,         credit: 150,     balance: 5803.75 },
  { id: "s8", date: "2025-01-28", type: "invoice",    ref: "INV-2025-0086",  desc: "فاتورة بيع",          debit: 2001.56,   credit: 0,       balance: 7805.31 },
  { id: "s9", date: "2025-01-28", type: "collection", ref: "REC-001",        desc: "تحصيل",               debit: 0,         credit: 2001.56, balance: 5803.75 },
];
const SPECIAL_PRICES = [
  { product: "900 GRAM", productAr: "900 جرام", defaultPrice: 13.75, specialPrice: 14.75, priceType: "kg", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "1000 GRAM",productAr: "1000 جرام",defaultPrice: 14.00, specialPrice: 14.50, priceType: "kg", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "1100 GRAM",productAr: "1100 جرام",defaultPrice: 14.50, specialPrice: 14.75, priceType: "kg", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "Liver",    productAr: "كبدة",      defaultPrice: 4.00,  specialPrice: 4.00,  priceType: "kg", lastEdit: "2025-01-10", editedBy: "أحمد (مالك)", active: true },
];
const FREE_PRODUCTS = [
  { product: "Liver",   productAr: "كبدة",   agreement: "مجاني عند الاختيار في الفاتورة", condition: "",           active: true  },
  { product: "Bone",    productAr: "عظام",   agreement: "دائماً مجاني لهذا العميل",         condition: "",           active: true  },
  { product: "Gizzard", productAr: "قانصة",  agreement: "مجاني إذا تجاوزت الفاتورة مبلغاً", condition: "AED 5,000", active: true  },
];
const DISCOUNTS = [
  { date: "2025-01-27", type: "خصم عند التحصيل", ref: "ADJ-2026-00004", amount: 150, reason: "فرق وزن", approvedBy: "أحمد (مالك)", note: "" },
];

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────
function CustTypeBadge({ type, lang }: { type: CustType; lang: Lang }) {
  return type === "credit"
    ? <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{lang === "ar" ? "آجل" : "Credit"}</span>
    : <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{lang === "ar" ? "نقدي" : "Cash"}</span>;
}
function CreditStatusBadge({ status, lang }: { status: CreditStatus; lang: Lang }) {
  const cfg = {
    clear:    { bg: "bg-emerald-50", t: "text-emerald-700", ar: "لا توجد مديونية", en: "Clear" },
    active:   { bg: "bg-blue-50",    t: "text-blue-700",    ar: "نشط",             en: "Active" },
    near:     { bg: "bg-amber-50",   t: "text-amber-700",   ar: "قريب من الحد",   en: "Near Limit" },
    exceeded: { bg: "bg-red-50",     t: "text-red-700",     ar: "تجاوز الحد",     en: "Exceeded" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}
function CreditBar({ balance, limit }: { balance: number; limit: number }) {
  if (!limit) return null;
  const pct = Math.min(150, Math.round((balance / limit) * 100));
  const color = pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-500">
        <span>AED {balance.toLocaleString()}</span><span>{pct}%</span><span>AED {limit.toLocaleString()}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}
function InvStatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; t: string; ar: string; en: string }> = {
    paid:     { bg: "bg-emerald-50", t: "text-emerald-700", ar: "مدفوعة",          en: "Paid" },
    approved: { bg: "bg-blue-50",    t: "text-blue-700",    ar: "معتمدة",           en: "Approved" },
    partial:  { bg: "bg-amber-50",   t: "text-amber-700",   ar: "مدفوعة جزئياً",  en: "Partial" },
    cancelled:{ bg: "bg-red-50",     t: "text-red-700",     ar: "ملغاة",           en: "Cancelled" },
    draft:    { bg: "bg-slate-100",  t: "text-slate-600",   ar: "مسودة",           en: "Draft" },
  };
  const c = cfg[status] || cfg.draft;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.t}`}>{lang === "ar" ? c.ar : c.en}</span>;
}
function StmtTypeBadge({ type, lang }: { type: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; t: string; ar: string; en: string }> = {
    opening:    { bg: "bg-slate-100", t: "text-slate-600", ar: "رصيد افتتاحي", en: "Opening Balance" },
    invoice:    { bg: "bg-red-50",    t: "text-red-700",   ar: "فاتورة بيع",    en: "Sales Invoice" },
    collection: { bg: "bg-emerald-50",t: "text-emerald-700",ar: "تحصيل",        en: "Collection" },
    discount:   { bg: "bg-amber-50",  t: "text-amber-700", ar: "خصم تحصيل",    en: "Collection Discount" },
    return:     { bg: "bg-blue-50",   t: "text-blue-700",  ar: "مرتجع",         en: "Return" },
  };
  const c = cfg[type] || cfg.opening;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.t}`}>{lang === "ar" ? c.ar : c.en}</span>;
}

// ── SCREEN: CUSTOMERS LIST ─────────────────────────────────────────────────────
export function CustomersListScreen({ lang, role, permissions = [], onNavigate, setSelectedCustomer }: {
  lang: Lang; role: TenantRole; permissions?: string[]; onNavigate: (s: TenantScreen) => void; setSelectedCustomer: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const canCreate = canCreateCustomer(role, permissions);
  const canEdit = canEditCustomer(role, permissions);
  const canCollect = role === "owner" || role === "accountant";

  const { items: customerRows, loading, error, forbidden, reload } = useCustomers(
    search ? { search } : undefined,
    async () =>
      MOCK_CUSTOMERS.map((c) => ({
        id: c.id,
        name: c.nameAr,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        phone: c.phone,
        balance: c.balance,
        creditLimit: c.creditLimit,
        overdue: c.creditStatus === "exceeded",
        customerType: c.type,
        isActive: c.active,
        trn: c.trn,
      })),
  );
  const CUSTOMERS = customerRows.map(toModuleCustomer);

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const filtered = CUSTOMERS.filter(c => {
    const s = search.toLowerCase();
    return (!s || c.nameAr.includes(search) || c.nameEn.toLowerCase().includes(s) || c.phone.includes(s)) &&
      (filterType === "all" || c.type === filterType) &&
      (filterStatus === "all" || (filterStatus === "exceeded" && c.creditStatus === "exceeded") || (filterStatus === "balance" && c.balance > 0));
  });

  const totalReceivables = CUSTOMERS.reduce((s, c) => s + c.balance, 0);
  const kpis = [
    { v: CUSTOMERS.length.toString(),                          ar: "إجمالي العملاء",         en: "Total Customers",      bg: "bg-[#0F2C59]" },
    { v: CUSTOMERS.filter(c => c.active).length.toString(),   ar: "العملاء النشطين",         en: "Active Customers",     bg: "bg-emerald-500" },
    { v: CUSTOMERS.filter(c => c.balance > 0).length.toString(), ar: "عملاء عليهم مديونية", en: "With Balance",          bg: "bg-red-500" },
    { v: `AED ${totalReceivables.toLocaleString()}`,           ar: "إجمالي مستحقات العملاء", en: "Total Receivables",    bg: "bg-[#0F2C59]" },
    { v: CUSTOMERS.filter(c => c.creditStatus === "exceeded").length.toString(), ar: "تجاوزوا الحد الائتماني", en: "Credit Exceeded", bg: "bg-red-600" },
    { v: CUSTOMERS.filter(c => c.type === "cash").length.toString(),   ar: "عملاء نقدي",    en: "Cash Customers",       bg: "bg-emerald-600" },
    { v: CUSTOMERS.filter(c => c.type === "credit").length.toString(), ar: "عملاء آجل",     en: "Credit Customers",     bg: "bg-blue-500" },
    { v: IS_MOCK_MODE ? "AED 5,000" : "AED 0",                                          ar: "تحصيلات اليوم",          en: "Today's Collections",  bg: "bg-violet-500" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "العملاء" : "Customers"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{CUSTOMERS.length} {isRTL ? "عميل مسجل" : "registered customers"}</p>
        </div>
        {canCreate
          ? <Btn variant="primary" onClick={() => onNavigate("customers-create")}><Plus size={15} />{isRTL ? "إضافة عميل جديد" : "Add New Customer"}</Btn>
          : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "إضافة عميل جديد" : "Add New Customer"}</PermBtn>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><Users size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
              className={`w-full py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الأنواع" : "All Types"}</option>
            <option value="credit">{isRTL ? "آجل" : "Credit"}</option>
            <option value="cash">{isRTL ? "نقدي" : "Cash"}</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="balance">{isRTL ? "عليهم مديونية" : "Has Balance"}</option>
            <option value="exceeded">{isRTL ? "تجاوزوا الحد" : "Exceeded Limit"}</option>
          </select>
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
        </div>
      </Card>

      {/* Desktop table */}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "اسم العميل" : "Customer", isRTL ? "النوع" : "Type", isRTL ? "التصنيف" : "Category", isRTL ? "الهاتف" : "Phone", isRTL ? "الرصيد الحالي" : "Balance", isRTL ? "الحد الائتماني" : "Credit Limit", isRTL ? "حالة الحد" : "Credit Status", isRTL ? "آخر فاتورة" : "Last Invoice", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50/60 transition-colors ${c.creditStatus === "exceeded" ? "bg-red-50/20" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div>
                      {!c.active && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{isRTL ? "موقوف" : "Inactive"}</span>}
                    </td>
                    <td className="px-4 py-3"><CustTypeBadge type={c.type} lang={lang} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-semibold capitalize">{c.category}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.phone}</td>
                    <td className="px-4 py-3 font-mono font-black text-sm">{c.balance > 0 ? <span className="text-red-500">AED {c.balance.toLocaleString()}</span> : <span className="text-emerald-500">صفر</span>}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{c.creditLimit > 0 ? `AED ${c.creditLimit.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3"><CreditStatusBadge status={c.creditStatus} lang={lang} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.lastInvoice}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedCustomer(c.id); onNavigate("customers-profile"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all" title={isRTL ? "عرض الملف" : "View Profile"}><Eye size={13} /></button>
                        {canEdit && <button onClick={() => { setSelectedCustomer(c.id); onNavigate("customers-edit"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all" title={isRTL ? "تعديل" : "Edit"}><Pencil size={13} /></button>}
                        <button onClick={() => onNavigate("sales-new")} className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all" title={isRTL ? "إنشاء فاتورة بيع" : "New Invoice"}><FileText size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className={`p-4 ${c.creditStatus === "exceeded" ? "border-red-200" : c.creditStatus === "near" ? "border-amber-200" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div>
                  <div className="flex items-center gap-1.5 mt-0.5"><CustTypeBadge type={c.type} lang={lang} /><CreditStatusBadge status={c.creditStatus} lang={lang} /></div>
                </div>
                <div className="text-end"><div className={`font-mono font-black ${c.balance > 0 ? "text-red-500" : "text-emerald-500"}`}>{c.balance > 0 ? `AED ${c.balance.toLocaleString()}` : (isRTL ? "صفر" : "Zero")}</div><div className="text-[10px] text-slate-400">{isRTL ? "الرصيد" : "Balance"}</div></div>
              </div>
              {c.type === "credit" && c.creditLimit > 0 && <div className="mb-3"><CreditBar balance={c.balance} limit={c.creditLimit} /></div>}
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" variant="secondary" onClick={() => { setSelectedCustomer(c.id); onNavigate("customers-profile"); }}><Eye size={13} />{isRTL ? "الملف" : "Profile"}</Btn>
                {canCollect && c.balance > 0 && <Btn size="sm" variant="green"><Wallet size={13} />{isRTL ? "تحصيل" : "Collect"}</Btn>}
                {canEdit && <Btn size="sm" variant="outline" onClick={() => { setSelectedCustomer(c.id); onNavigate("customers-edit"); }}><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
                <Btn size="sm" variant="outline" onClick={() => onNavigate("sales-new")}><FileText size={13} />{isRTL ? "فاتورة" : "Invoice"}</Btn>
                <a href={`tel:${c.phone}`} className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Phone size={14} /></a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="p-14 text-center"><Users size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا يوجد عملاء حالياً" : "No customers yet"}</h3>{canCreate && <Btn onClick={() => onNavigate("customers-create")}><Plus size={15} />{isRTL ? "إضافة أول عميل" : "Add First Customer"}</Btn>}</Card>
      )}
    </div>
  );
}

// ── SCREEN: CREATE / EDIT CUSTOMER ─────────────────────────────────────────────
export function CreateCustomerScreen({ lang, role, permissions = [], onNavigate, customerId, setSelectedCustomer, onSaved }: {
  lang: Lang; role: TenantRole; permissions?: string[]; onNavigate: (s: TenantScreen) => void;
  customerId?: string; setSelectedCustomer?: (id: string) => void; onSaved?: () => void;
}) {
  const isRTL = lang === "ar";
  const isEdit = Boolean(customerId);
  const [nameAr, setNameAr] = useState(""); const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState(""); const [trn, setTrn] = useState("");
  const [address, setAddress] = useState(""); const [emirate, setEmirate] = useState("");
  const [notes, setNotes] = useState("");
  const [custType, setCustType] = useState<CustType>("credit");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState(true);
  const [openBal, setOpenBal] = useState("0"); const [openBalType, setOpenBalType] = useState("على العميل");
  const [creditLimit, setCreditLimit] = useState("15000");
  const [payTerms, setPayTerms] = useState("30"); const [blockOnExceed, setBlockOnExceed] = useState(true); const [allowOverride, setAllowOverride] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(Boolean(customerId) && !IS_MOCK_MODE);

  const canCreate = canCreateCustomer(role, permissions);
  const canEdit = canEditCustomer(role, permissions);
  const canAccess = isEdit ? canEdit : canCreate;
  const canSetFinancials = canAccess;

  const EMIRATES = ["دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "أم القيوين", "الفجيرة"].map(e => ({ value: e, label: e }));
  const FALLBACK_CATEGORIES = [
    { value: "restaurant", label: isRTL ? "مطعم" : "Restaurant" },
    { value: "supermarket", label: isRTL ? "سوبر ماركت" : "Supermarket" },
    { value: "butcher", label: isRTL ? "ملحمة" : "Butcher" },
    { value: "hotel", label: isRTL ? "فندق" : "Hotel" },
    { value: "kitchen", label: isRTL ? "مطبخ" : "Kitchen" },
    { value: "other", label: isRTL ? "أخرى" : "Other" },
  ];
  const categorySelectOptions = categoryOptions.length > 0
    ? [{ value: "", label: isRTL ? "بدون تصنيف" : "No category" }, ...categoryOptions]
    : [{ value: "", label: isRTL ? "بدون تصنيف" : "No category" }, ...FALLBACK_CATEGORIES];

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    void listCustomerCategories().then((rows) => {
      const active = rows.filter((c) => c.active).map((c) => ({
        value: String(c.id),
        label: isRTL ? c.nameAr : c.nameEn,
      }));
      setCategoryOptions(active);
    });
  }, [isRTL]);

  useEffect(() => {
    if (!customerId || IS_MOCK_MODE) return;
    let cancelled = false;
    setLoadingCustomer(true);
    void getCustomerDetail(customerId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setNameAr(detail.nameAr);
        setNameEn(detail.nameEn);
        setPhone(detail.phone);
        setWhatsapp(detail.whatsapp);
        setEmail(detail.email);
        setTrn(detail.trn);
        setAddress(detail.address);
        setEmirate(detail.emirate);
        setNotes(detail.notes);
        setCustType((detail.customerType as CustType) || "cash");
        setCategory(detail.categoryId ? String(detail.categoryId) : "");
        setActive(detail.isActive);
        setOpenBal(String(detail.openingBalance));
        setOpenBalType(detail.openingBalanceType);
        setCreditLimit(String(detail.creditLimit));
        setPayTerms(String(detail.paymentTermsDays));
        setBlockOnExceed(detail.blockSalesWhenCreditExceeded);
        setAllowOverride(detail.allowAdminCreditOverride);
      })
      .catch((err) => {
        if (!cancelled) setSaveError(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomer(false);
      });
    return () => { cancelled = true; };
  }, [customerId]);

  const handleSave = async (andInvoice: boolean) => {
    if (!canAccess) {
      toast.error(isRTL ? "ليس لديك صلاحية" : "Permission denied");
      return;
    }
    if (!nameAr.trim() || !phone.trim()) {
      toast.error(isRTL ? "أدخل الاسم ورقم الهاتف" : "Name and phone are required");
      return;
    }
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ العميل" : "Customer saved");
      if (andInvoice) onNavigate("sales-new");
      else onNavigate(isEdit ? "customers-profile" : "customers");
      return;
    }
    setSaveError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const categoryId = category && /^\d+$/.test(category) ? Number(category) : null;
      if (isEdit && customerId) {
        const payload = buildCustomerUpdatePayload({
          nameAr,
          nameEn,
          phone,
          whatsapp,
          email,
          address,
          emirate,
          trn,
          customerType: custType,
          categoryId,
          creditLimit: custType === "credit" ? parseFloat(creditLimit) || 0 : 0,
          paymentTermsDays: parseInt(payTerms, 10) || 0,
          blockSalesWhenCreditExceeded: blockOnExceed,
          allowAdminCreditOverride: allowOverride,
          notes,
        });
        await updateCustomer(customerId, payload);
        toast.success(isRTL ? "تم تحديث بيانات العميل بنجاح" : "Customer updated successfully");
        onSaved?.();
        onNavigate("customers-profile");
      } else {
        const payload = buildCustomerCreatePayload({
          nameAr,
          nameEn,
          phone,
          whatsapp,
          email,
          address,
          emirate,
          trn,
          customerType: custType,
          categoryId: categoryId ?? undefined,
          openingBalance: parseFloat(openBal) || 0,
          openingBalanceType: openBalType,
          creditLimit: custType === "credit" ? parseFloat(creditLimit) || 0 : 0,
          paymentTermsDays: parseInt(payTerms, 10) || 0,
          blockSalesWhenCreditExceeded: blockOnExceed,
          allowAdminCreditOverride: allowOverride,
          includeFinancials: canSetFinancials,
        });
        const row = await createCustomer(payload);
        toast.success(isRTL ? "تم إنشاء العميل بنجاح" : "Customer created successfully");
        if (andInvoice) {
          setSelectedCustomer?.(row.id);
          onNavigate("sales-new");
        } else {
          onNavigate("customers");
        }
      }
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isEdit ? (isRTL ? "فشل تحديث العميل" : "Failed to update customer") : (isRTL ? "فشل إنشاء العميل" : "Failed to create customer")));
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) return <PermissionDeniedState lang={lang} />;
  if (loadingCustomer) return <LoadingState lang={lang} />;
  if (isEdit && saveError && !nameAr && customerId) {
    return <ErrorState lang={lang} error={saveError} onRetry={() => window.location.reload()} />;
  }

  const backScreen = isEdit ? "customers-profile" : "customers";

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate(backScreen)} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">
          {isEdit ? (isRTL ? "تعديل بيانات العميل" : "Edit Customer") : (isRTL ? "إضافة عميل جديد" : "Add New Customer")}
        </h2>
      </div>
      <FormErrors lang={lang} error={saveError} fieldErrors={fieldErrors} />

      {/* A. Basic Info */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "أ. المعلومات الأساسية" : "A. Basic Information"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "اسم العميل (عربي) *" : "Arabic Name *"} value={nameAr} onChange={setNameAr} placeholder={isRTL ? "مطعم الخليج" : "Al Khalij Restaurant"} required />
          <FInput label={isRTL ? "اسم العميل (إنجليزي)" : "English Name"} value={nameEn} onChange={setNameEn} placeholder="Al Khalij Restaurant" />
          <FInput label={isRTL ? "رقم الهاتف *" : "Phone *"} type="tel" value={phone} onChange={setPhone} placeholder="+971 50 XXX XXXX" required />
          <FInput label={isRTL ? "رقم الواتساب" : "WhatsApp"} type="tel" value={whatsapp} onChange={setWhatsapp} placeholder="+971 50 XXX XXXX" />
          <FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={email} onChange={setEmail} />
          <FInput label={isRTL ? "رقم الضريبة TRN" : "TRN"} value={trn} onChange={setTrn} placeholder="100XXXXXXXXXXX" />
          <FSelect label={isRTL ? "الإمارة" : "Emirate"} value={emirate} onChange={setEmirate} options={[{ value: "", label: isRTL ? "اختر الإمارة" : "Select Emirate" }, ...EMIRATES]} />
          <div className="sm:col-span-2"><FInput label={isRTL ? "العنوان" : "Address"} value={address} onChange={setAddress} /></div>
          <div className="sm:col-span-2"><FInput label={isRTL ? "ملاحظات" : "Notes"} value={notes} onChange={setNotes} /></div>
        </div>
      </Card>

      {/* B. Customer Type */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ب. نوع العميل" : "B. Customer Type"}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "نوع الحساب" : "Account Type"}</label>
            <div className="grid grid-cols-2 gap-3">
              {([["credit", isRTL ? "آجل / على الحساب" : "Credit / On Account"], ["cash", isRTL ? "نقدي" : "Cash"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setCustType(v)} className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${custType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          <FSelect label={isRTL ? "التصنيف" : "Category"} value={category} onChange={setCategory} options={categorySelectOptions} />
          <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-700">{isRTL ? "العميل نشط" : "Customer Active"}</span>
            {isEdit ? (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}
              </span>
            ) : (
              <button onClick={() => setActive(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${active ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${active ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* C. Financial Settings */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ج. الإعدادات المالية" : "C. Financial Settings"}</h3>
        {isEdit && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 mb-4">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              {isRTL
                ? "لا يمكن تعديل الرصيد الافتتاحي من هنا. استخدم إجراء تعديل الرصيد الافتتاحي من ملف العميل (يتطلب سبباً)."
                : "Opening balance cannot be changed here. Use the opening-balance action from the customer profile (requires a reason)."}
            </p>
          </div>
        )}
        {!canSetFinancials && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-4"><Info size={14} className="text-amber-500" /><span className="text-xs font-bold text-amber-700">{isRTL ? "ليس لديك صلاحية تعديل الإعدادات المالية" : "No permission to edit financial settings"}</span></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!isEdit && (
          <>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "نوع الرصيد الافتتاحي" : "Opening Balance Type"}</label>
            <div className="grid grid-cols-3 gap-2">
              {[["على العميل", isRTL ? "على العميل" : "Debit"], ["للعميل", isRTL ? "للعميل" : "Credit"], ["صفر", isRTL ? "صفر" : "Zero"]].map(([v, l]) => (
                <button key={v} onClick={() => canSetFinancials && setOpenBalType(v)} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${openBalType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <FInput label={isRTL ? "مبلغ الرصيد الافتتاحي (AED)" : "Opening Balance (AED)"} type="number" value={openBal} onChange={v => canSetFinancials && setOpenBal(v)} />
          </>
          )}
          {custType === "credit" && <FInput label={isRTL ? "الحد الائتماني (AED) *" : "Credit Limit (AED) *"} type="number" value={creditLimit} onChange={v => canSetFinancials && setCreditLimit(v)} required />}
          <FSelect label={isRTL ? "شروط الدفع الافتراضية" : "Default Payment Terms"} value={payTerms} onChange={v => canSetFinancials && setPayTerms(v)}
            options={[{ value: "0", label: isRTL ? "فوري" : "Immediate" }, { value: "7", label: isRTL ? "7 أيام" : "7 days" }, { value: "15", label: isRTL ? "15 يوم" : "15 days" }, { value: "30", label: isRTL ? "30 يوم" : "30 days" }]} />
        </div>
        {custType === "credit" && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-bold text-slate-700">{isRTL ? "منع فواتير البيع عند تجاوز الحد الائتماني" : "Block invoices when credit limit exceeded"}</div><div className="text-xs text-slate-400 font-semibold">{isRTL ? "افتراضي: مفعّل" : "Default: enabled"}</div></div>
              <button onClick={() => canSetFinancials && setBlockOnExceed(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${blockOnExceed ? "bg-[#0F2C59]" : "bg-slate-300"}`}><span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${blockOnExceed ? "translate-x-5" : "translate-x-0"}`} /></button>
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-bold text-slate-700">{isRTL ? "السماح للمدير برفع الحد الائتماني فوراً" : "Allow Admin to override credit limit instantly"}</div><div className="text-xs text-slate-400 font-semibold">{isRTL ? "افتراضي: مفعّل" : "Default: enabled"}</div></div>
              <button onClick={() => canSetFinancials && setAllowOverride(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${allowOverride ? "bg-[#0F2C59]" : "bg-slate-300"}`}><span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${allowOverride ? "translate-x-5" : "translate-x-0"}`} /></button>
            </div>
            <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500 leading-relaxed">{isRTL ? "إذا تجاوز العميل الحد الائتماني، سيتم منع اعتماد فاتورة البيع إلا إذا قام المدير برفع الحد." : "If the customer exceeds the credit limit, invoice approval will be blocked unless the Admin increases the limit."}</p></div>
          </div>
        )}
      </Card>

      {/* D. Pricing */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "د. الأسعار والاتفاقيات" : "D. Pricing & Agreements"}</h3>
        <div className="flex flex-wrap gap-3">
          <Btn variant="outline" size="sm"><Tag size={13} />{isRTL ? "إضافة أسعار خاصة" : "Add Special Prices"}</Btn>
          <Btn variant="outline" size="sm"><Star size={13} />{isRTL ? "إضافة منتجات مجانية" : "Add Free Products"}</Btn>
          <Btn variant="outline" size="sm"><FileText size={13} />{isRTL ? "حفظ اتفاق تجاري" : "Save Commercial Agreement"}</Btn>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate(backScreen)}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2">
          <Btn variant="secondary" disabled={saving || !nameAr.trim() || !phone.trim()} onClick={() => void handleSave(false)}>
            <Check size={15} />
            {isEdit ? (isRTL ? "حفظ التعديلات" : "Save Changes") : (isRTL ? "حفظ العميل" : "Save Customer")}
          </Btn>
          {!isEdit && (
            <Btn variant="green" disabled={saving || !nameAr.trim() || !phone.trim()} onClick={() => void handleSave(true)}>
              <FileText size={15} />{isRTL ? "حفظ وإنشاء فاتورة بيع" : "Save & New Invoice"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: CUSTOMER PROFILE ───────────────────────────────────────────────────
export function CustomerProfileScreen({ lang, role, permissions = [], onNavigate, customerId }: {
  lang: Lang; role: TenantRole; permissions?: string[]; onNavigate: (s: TenantScreen) => void; customerId: string;
}) {
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("overview");
  const [showCollect, setShowCollect] = useState(false);
  const [showCreditOverride, setShowCreditOverride] = useState(false);
  const [showSpecialPriceModal, setShowSpecialPriceModal] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [openingBalanceMode, setOpeningBalanceMode] = useState<"edit" | "adjustment">("edit");
  const [customerFinancials, setCustomerFinancials] = useState<{ openingBalance: number; openingBalanceType: string } | null>(null);
  const profileTabs = useCustomerProfileTabs(customerId, tab as CustomerProfileTabKey);

  useEffect(() => {
    if (IS_MOCK_MODE || !customerId) return;
    void getCustomerDetail(customerId).then((detail) => {
      if (detail) {
        setCustomerFinancials({
          openingBalance: detail.openingBalance,
          openingBalanceType: detail.openingBalanceType,
        });
      }
    });
  }, [customerId]);

  const { item: row, loading, error, forbidden, reload } = useCustomerDetail(
    customerId,
    async (id) => {
      const m = MOCK_CUSTOMERS.find((x) => x.id === id);
      if (!m) return null;
      return { id: m.id, name: m.nameAr, nameAr: m.nameAr, nameEn: m.nameEn, phone: m.phone, balance: m.balance, creditLimit: m.creditLimit, overdue: m.creditStatus === "exceeded", customerType: m.type, isActive: m.active, trn: m.trn };
    },
  );
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;
  const c = row ? toModuleCustomer(row) : null;
  if (!c) return <EmptyState lang={lang} messageAr="لا يوجد عملاء بعد" messageEn="No customers yet" />;
  const canEdit = canEditCustomer(role, permissions);
  const canEditOpeningBal = canEditCustomerOpeningBalance(role, permissions);
  const canCollect = role === "owner" || role === "accountant";
  const canOverrideCredit = role === "owner";
  const hasNonOpeningActivity =
    !IS_MOCK_MODE &&
    (profileTabs.invoices.data.length > 0 ||
      profileTabs.collections.data.length > 0 ||
      profileTabs.ledger.data.some((e) => e.entryType && e.entryType !== "opening_balance"));
  const creditPct = c.creditLimit > 0 ? Math.round((c.balance / c.creditLimit) * 100) : 0;

  const TABS = [
    { k: "overview", ar: "نظرة عامة", en: "Overview" },
    { k: "invoices", ar: "الفواتير", en: "Invoices" },
    { k: "collections", ar: "التحصيلات", en: "Collections" },
    { k: "statement", ar: "كشف الحساب", en: "Statement" },
    { k: "prices", ar: "الأسعار الخاصة", en: "Special Prices" },
    { k: "free", ar: "المنتجات المجانية", en: "Free Products" },
    { k: "discounts", ar: "الخصومات والتسويات", en: "Discounts" },
    { k: "audit", ar: "سجل العمليات", en: "Audit Log" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("customers")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 mt-0.5">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? `ملف العميل: ${c.nameAr}` : `Customer: ${c.nameEn}`}</h2>
            <CustTypeBadge type={c.type} lang={lang} />
            <CreditStatusBadge status={c.creditStatus} lang={lang} />
            {!c.active && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{isRTL ? "موقوف" : "Inactive"}</span>}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{c.phone} · {isRTL ? c.nameAr : c.nameEn}</div>
        </div>
      </div>

      {/* Credit exceeded banner */}
      {c.creditStatus === "exceeded" && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-black text-red-700 mb-1">{isRTL ? "تم تجاوز الحد الائتماني" : "Credit Limit Exceeded"}</div>
            <p className="text-xs font-bold text-red-600">{isRTL ? "لا يمكن اعتماد فواتير جديدة حتى يتم التحصيل أو رفع الحد." : "Cannot approve new invoices until collection or limit increase."}</p>
          </div>
          {canOverrideCredit && <Btn size="sm" variant="danger" onClick={() => setShowCreditOverride(true)}><TrendingUp size={13} />{isRTL ? "رفع الحد" : "Increase Limit"}</Btn>}
        </div>
      )}

      {/* Balance + credit bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center"><div className={`text-xl font-black font-mono ${c.balance > 0 ? "text-red-500" : "text-emerald-600"}`}>{c.balance > 0 ? `AED ${c.balance.toLocaleString()}` : (isRTL ? "صفر" : "Zero")}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? "الرصيد الحالي" : "Current Balance"}</div></Card>
        <Card className="p-4 text-center"><div className="text-xl font-black font-mono text-slate-700">{c.creditLimit > 0 ? `AED ${c.creditLimit.toLocaleString()}` : "—"}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? "الحد الائتماني" : "Credit Limit"}</div></Card>
        <Card className="p-4 text-center"><div className="text-xl font-black font-mono text-slate-700">{c.lastInvoice}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? "آخر فاتورة" : "Last Invoice"}</div></Card>
        <Card className="p-4 text-center"><div className="text-xl font-black font-mono text-slate-700">{c.lastCollection}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? "آخر تحصيل" : "Last Collection"}</div></Card>
      </div>

      {c.type === "credit" && c.creditLimit > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-slate-600">{isRTL ? "استخدام الحد الائتماني" : "Credit Usage"}</span><span className={`text-sm font-black ${creditPct >= 100 ? "text-red-500" : creditPct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{creditPct}%</span></div>
          <CreditBar balance={c.balance} limit={c.creditLimit} />
        </Card>
      )}

      {/* Action bar */}
      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Btn size="sm" variant="green" onClick={() => onNavigate("sales-new")}><FileText size={13} />{isRTL ? "إنشاء فاتورة بيع" : "New Invoice"}</Btn>
        {canCollect ? <Btn size="sm" variant="primary" onClick={() => setShowCollect(true)}><Wallet size={13} />{isRTL ? "تسجيل تحصيل" : "Collect"}</Btn> : <PermBtn lang={lang}><Wallet size={13} />{isRTL ? "تسجيل تحصيل" : "Collect"}</PermBtn>}
        <Btn size="sm" variant="secondary" onClick={() => { setTab("statement"); }}><FileText size={13} />{isRTL ? "كشف حساب" : "Statement"}</Btn>
        {canEdit && <Btn size="sm" variant="outline" onClick={() => onNavigate("customers-edit")}><Pencil size={13} />{isRTL ? "تعديل بيانات العميل" : "Edit Customer"}</Btn>}
        {canEditOpeningBal && !IS_MOCK_MODE && (
          <Btn
            size="sm"
            variant="outline"
            onClick={() => {
              setOpeningBalanceMode(hasNonOpeningActivity ? "adjustment" : "edit");
              setShowOpeningBalance(true);
            }}
          >
            <Wallet size={13} />
            {hasNonOpeningActivity
              ? (isRTL ? "إضافة تسوية رصيد" : "Add Balance Adjustment")
              : (isRTL ? "تعديل الرصيد الافتتاحي" : "Edit Opening Balance")}
          </Btn>
        )}
        {canOverrideCredit && c.type === "credit" && <Btn size="sm" variant="outline" onClick={() => setShowCreditOverride(true)}><TrendingUp size={13} />{isRTL ? "رفع الحد الائتماني" : "Raise Credit Limit"}</Btn>}
        <PremiumBtn lang={lang}>{isRTL ? "إرسال واتساب" : "Send WhatsApp"}</PremiumBtn>
      </Card>

      {/* Tabs */}
      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${tab === t.k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{isRTL ? t.ar : t.en}</button>)}
          </div>
        </div>
        <div className="p-5">
          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {IS_MOCK_MODE ? [
                  { v: "AED 11,149", ar: "إجمالي المبيعات", en: "Total Sales", cls: "text-[#0F2C59]" },
                  { v: "AED 7,195", ar: "إجمالي التحصيلات", en: "Total Collections", cls: "text-emerald-600" },
                  { v: `AED ${c.balance.toLocaleString()}`, ar: "الرصيد المستحق", en: "Outstanding", cls: c.balance > 0 ? "text-red-500" : "text-emerald-600" },
                  { v: "3", ar: "فواتير غير مسددة", en: "Unpaid Invoices", cls: "text-amber-600" },
                ].map(f => <Card key={f.ar} className="p-3 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? f.ar : f.en}</div></Card>) : (() => {
                  const totalSales = profileTabs.invoices.data.reduce((s, i) => s + i.total, 0);
                  const totalColl = profileTabs.collections.data.reduce((s, i) => s + i.amount, 0);
                  const unpaid = profileTabs.invoices.data.filter((i) => i.remaining > 0).length;
                  return [
                    { v: `AED ${totalSales.toLocaleString()}`, ar: "إجمالي المبيعات", en: "Total Sales", cls: "text-[#0F2C59]" },
                    { v: `AED ${totalColl.toLocaleString()}`, ar: "إجمالي التحصيلات", en: "Total Collections", cls: "text-emerald-600" },
                    { v: `AED ${c.balance.toLocaleString()}`, ar: "الرصيد المستحق", en: "Outstanding", cls: c.balance > 0 ? "text-red-500" : "text-emerald-600" },
                    { v: String(unpaid), ar: "فواتير غير مسددة", en: "Unpaid Invoices", cls: "text-amber-600" },
                  ].map(f => <Card key={f.ar} className="p-3 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? f.ar : f.en}</div></Card>);
                })()}
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">{isRTL ? "آخر النشاطات" : "Latest Activity"}</div>
                {IS_MOCK_MODE ? (
                <div className="space-y-2">
                  {[
                    [isRTL ? "فاتورة بيع" : "Sales Invoice", "INV-2025-0086", "2025-01-28", "text-red-500", "AED 2,001.56"],
                    [isRTL ? "تحصيل" : "Collection", "REC-001", "2025-01-28", "text-emerald-600", "AED 2,001.56"],
                    [isRTL ? "خصم تحصيل" : "Collection Discount", "ADJ-001", "2025-01-27", "text-amber-600", "AED 150"],
                  ].map(([type, ref, date, cls, amt]) => (
                    <div key={ref as string} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2"><span className={`font-bold ${cls}`}>{type}</span><span className="font-mono text-slate-400 text-xs">{ref}</span></div>
                      <div className="flex items-center gap-3"><span className="font-mono text-xs text-slate-400">{date}</span><span className={`font-mono font-black text-sm ${cls}`}>{amt}</span></div>
                    </div>
                  ))}
                </div>
                ) : (
                  <ProfileTabBody lang={lang} loading={profileTabs.invoices.loading || profileTabs.collections.loading} error={profileTabs.invoices.error ?? profileTabs.collections.error} forbidden={profileTabs.invoices.forbidden || profileTabs.collections.forbidden} unavailable={profileTabs.invoices.unavailable && profileTabs.collections.unavailable} empty={profileTabs.invoices.data.length === 0 && profileTabs.collections.data.length === 0} emptyAr="لا يوجد نشاط بعد" emptyEn="No activity yet">
                    <div className="space-y-2">
                      {[...profileTabs.invoices.data.slice(0, 3).map((inv) => [isRTL ? "فاتورة بيع" : "Sales Invoice", inv.number, inv.date, "text-red-500", `AED ${inv.total.toLocaleString()}`] as const), ...profileTabs.collections.data.slice(0, 3).map((col) => [isRTL ? "تحصيل" : "Collection", col.number, col.date, "text-emerald-600", `AED ${col.amount.toLocaleString()}`] as const)].map(([type, ref, date, cls, amt]) => (
                        <div key={`${type}-${ref}`} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><span className={`font-bold ${cls}`}>{type}</span><span className="font-mono text-slate-400 text-xs">{ref}</span></div>
                          <div className="flex items-center gap-3"><span className="font-mono text-xs text-slate-400">{date}</span><span className={`font-mono font-black text-sm ${cls}`}>{amt}</span></div>
                        </div>
                      ))}
                    </div>
                  </ProfileTabBody>
                )}
              </div>
              {!IS_MOCK_MODE && customerFinancials && (
                <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">
                        {isRTL ? "الرصيد الافتتاحي" : "Opening Balance"}
                      </div>
                      <div className="font-mono font-black text-[#0F2C59]">
                        AED {customerFinancials.openingBalance.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500 font-semibold mt-1">
                        {customerFinancials.openingBalanceType === "customer_owes_us"
                          ? (isRTL ? "على العميل" : "Customer owes us")
                          : customerFinancials.openingBalanceType === "we_owe_customer"
                            ? (isRTL ? "للعميل" : "We owe customer")
                            : (isRTL ? "صفر" : "Zero")}
                      </div>
                    </div>
                    {canEditOpeningBal && (
                      <Btn
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setOpeningBalanceMode(hasNonOpeningActivity ? "adjustment" : "edit");
                          setShowOpeningBalance(true);
                        }}
                      >
                        {hasNonOpeningActivity
                          ? (isRTL ? "إضافة تسوية رصيد" : "Add Balance Adjustment")
                          : (isRTL ? "تعديل" : "Edit")}
                      </Btn>
                    )}
                  </div>
                  {hasNonOpeningActivity && (
                    <p className="text-xs font-semibold text-slate-500 mt-3 flex gap-2">
                      <Info size={13} className="shrink-0 mt-0.5" />
                      {isRTL
                        ? "لا يمكن تعديل الرصيد الافتتاحي مباشرة بعد وجود حركات. يمكنك إضافة تسوية بدلاً من ذلك."
                        : "Opening balance cannot be directly edited after transactions exist. Add an adjustment instead."}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" variant="secondary" onClick={() => setShowSpecialPriceModal(true)}><Tag size={13} />{isRTL ? "الأسعار الخاصة" : "Special Prices"}</Btn>
                <Btn size="sm" variant="outline" onClick={() => { setTab("statement"); }}><FileText size={13} />{isRTL ? "كشف الحساب" : "Statement"}</Btn>
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {tab === "invoices" && (
            <div className="space-y-3">
              <div className="flex justify-end"><Btn size="sm" variant="green" onClick={() => onNavigate("sales-new")}><Plus size={13} />{isRTL ? "إنشاء فاتورة بيع" : "New Invoice"}</Btn></div>
              <ProfileTabBody lang={lang} loading={!IS_MOCK_MODE && profileTabs.invoices.loading} error={profileTabs.invoices.error} forbidden={profileTabs.invoices.forbidden} unavailable={profileTabs.invoices.unavailable} empty={!IS_MOCK_MODE && profileTabs.invoices.data.length === 0} onRetry={profileTabs.reloadInvoices} emptyAr="لا توجد فواتير لهذا العميل" emptyEn="No invoices for this customer">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "رقم الفاتورة" : "Invoice #", isRTL ? "التاريخ" : "Date", isRTL ? "الإجمالي" : "Total", isRTL ? "المدفوع" : "Paid", isRTL ? "المتبقي" : "Remaining", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(IS_MOCK_MODE ? CUST_INVOICES.map(inv => ({ id: inv.id, number: inv.id, date: inv.date, total: inv.total, paid: inv.paid, remaining: inv.remaining, status: inv.status })) : profileTabs.invoices.data).map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{inv.number}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{inv.date}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#0F2C59]">AED {inv.total.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono text-emerald-600">AED {inv.paid.toLocaleString()}</td>
                        <td className="px-3 py-2.5">{inv.remaining > 0 ? <span className="font-mono font-black text-red-500 text-xs">AED {inv.remaining.toLocaleString()}</span> : <span className="text-emerald-500 text-xs font-bold">✓</span>}</td>
                        <td className="px-3 py-2.5"><InvStatusBadge status={inv.status} lang={lang} /></td>
                        <td className="px-3 py-2.5"><div className="flex gap-1"><button type="button" aria-label={isRTL ? "عرض" : "View"} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => onNavigate("sales-detail")}><Eye size={12} /></button>{inv.remaining > 0 && <button type="button" aria-label={isRTL ? "تحصيل" : "Collect"} onClick={() => setShowCollect(true)} className="p-1 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Wallet size={12} /></button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </ProfileTabBody>
            </div>
          )}

          {/* COLLECTIONS TAB */}
          {tab === "collections" && (
            <div className="space-y-3">
              <div className="flex justify-end">{canCollect ? <Btn size="sm" variant="primary" onClick={() => setShowCollect(true)}><Plus size={13} />{isRTL ? "تسجيل تحصيل" : "Record Collection"}</Btn> : <PermBtn lang={lang}><Plus size={13} />{isRTL ? "تسجيل تحصيل" : "Record Collection"}</PermBtn>}</div>
              <ProfileTabBody lang={lang} loading={!IS_MOCK_MODE && profileTabs.collections.loading} error={profileTabs.collections.error} forbidden={profileTabs.collections.forbidden} unavailable={profileTabs.collections.unavailable} empty={IS_MOCK_MODE ? CUST_COLLECTIONS.length === 0 : profileTabs.collections.data.length === 0} onRetry={profileTabs.reloadCollections} emptyAr="لا توجد تحصيلات لهذا العميل" emptyEn="No collections for this customer">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "رقم الإيصال" : "Receipt #", isRTL ? "التاريخ" : "Date", isRTL ? "المبلغ" : "Amount", isRTL ? "الطريقة" : "Method", isRTL ? "المرجع" : "Ref"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(IS_MOCK_MODE ? CUST_COLLECTIONS.map(r => ({ id: r.id, number: r.id, date: r.date, amount: r.amount, method: r.method, reference: r.ref })) : profileTabs.collections.data).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.number}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                          <td className="px-3 py-2.5 font-mono font-black text-emerald-600">AED {r.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs font-bold"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.method}</span></td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ProfileTabBody>
            </div>
          )}

          {/* STATEMENT TAB (preview) */}
          {tab === "statement" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-xs text-slate-400 font-semibold">{isRTL ? "معاينة كشف الحساب — اضغط لفتح الكشف الكامل" : "Statement preview — click to open full statement"}</p><Btn size="sm" variant="primary" onClick={() => onNavigate("customers-statement")}><FileText size={13} />{isRTL ? "كشف الحساب الكامل" : "Full Statement"}</Btn></div>
              <ProfileTabBody lang={lang} loading={!IS_MOCK_MODE && profileTabs.ledger.loading} error={profileTabs.ledger.error} forbidden={profileTabs.ledger.forbidden} unavailable={profileTabs.ledger.unavailable} empty={IS_MOCK_MODE ? STMT_MOVEMENTS.length === 0 : profileTabs.ledger.data.length === 0} onRetry={profileTabs.reloadLedger} emptyAr="لا توجد حركات في كشف الحساب" emptyEn="No statement movements">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "التاريخ" : "Date", isRTL ? "الوصف" : "Description", isRTL ? "مدين" : "Debit", isRTL ? "دائن" : "Credit", isRTL ? "الرصيد" : "Balance"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(IS_MOCK_MODE ? STMT_MOVEMENTS.map(m => ({ id: m.id, date: m.date, description: m.desc, debit: m.debit, credit: m.credit, balance: m.balance })) : profileTabs.ledger.data).map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.date}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{m.description}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.debit > 0 ? <span className="text-red-500 font-bold">AED {m.debit.toFixed(2)}</span> : "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.credit > 0 ? <span className="text-emerald-600 font-bold">AED {m.credit.toFixed(2)}</span> : "—"}</td>
                        <td className="px-3 py-2 font-mono font-black text-xs text-[#0F2C59]">AED {m.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </ProfileTabBody>
            </div>
          )}

          {/* SPECIAL PRICES TAB */}
          {tab === "prices" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold">{isRTL ? "سيتم استخدام السعر الخاص تلقائياً عند إنشاء فاتورة بيع لهذا العميل." : "Special prices are automatically applied when creating a sales invoice for this customer."}</p>
                {canEdit ? <Btn size="sm" variant="primary" onClick={() => setShowSpecialPriceModal(true)}><Plus size={13} />{isRTL ? "إضافة سعر خاص" : "Add Special Price"}</Btn> : <PermBtn lang={lang}><Plus size={13} />{isRTL ? "إضافة سعر خاص" : "Add Special Price"}</PermBtn>}
              </div>
              <ProfileTabBody lang={lang} loading={!IS_MOCK_MODE && profileTabs.specialPrices.loading} error={profileTabs.specialPrices.error} forbidden={profileTabs.specialPrices.forbidden} unavailable={profileTabs.specialPrices.unavailable} empty={IS_MOCK_MODE ? SPECIAL_PRICES.length === 0 : profileTabs.specialPrices.data.length === 0} onRetry={profileTabs.reloadPrices} emptyAr="لا توجد أسعار خاصة" emptyEn="No special prices">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "المنتج" : "Product", isRTL ? "السعر الخاص" : "Special Price", isRTL ? "نوع السعر" : "Type", isRTL ? "آخر تعديل" : "Last Edit", isRTL ? "الحالة" : "Status"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(IS_MOCK_MODE ? SPECIAL_PRICES.map((sp, i) => ({ id: String(i), product: isRTL ? sp.productAr : sp.product, price: sp.specialPrice, pt: sp.priceType, updated: sp.lastEdit, active: sp.active })) : profileTabs.specialPrices.data).map((sp) => (
                        <tr key={sp.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-800">{sp.product}</td>
                          <td className="px-3 py-2.5 font-mono font-black text-[#0F2C59]">AED {sp.price}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{sp.pt}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{sp.updated}</td>
                          <td className="px-3 py-2.5"><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{sp.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ProfileTabBody>
            </div>
          )}

          {/* FREE PRODUCTS TAB */}
          {tab === "free" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-1 me-3 flex gap-2"><Info size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "المنتج المجاني يظهر بسعر صفر في فاتورة البيع ويحتاج صلاحية إذا تم تعديله يدوياً." : "Free products appear at zero price on sales invoice and require permission if manually edited."}</p></div>
                {canEdit && <Btn size="sm" variant="primary"><Plus size={13} />{isRTL ? "إضافة" : "Add"}</Btn>}
              </div>
              <ProfileTabBody lang={lang} loading={!IS_MOCK_MODE && profileTabs.freeProducts.loading} error={profileTabs.freeProducts.error} forbidden={profileTabs.freeProducts.forbidden} unavailable={profileTabs.freeProducts.unavailable} empty={IS_MOCK_MODE ? FREE_PRODUCTS.length === 0 : profileTabs.freeProducts.data.length === 0} onRetry={profileTabs.reloadFree} emptyAr="لا توجد منتجات مجانية" emptyEn="No free products">
                <div className="space-y-2">
                  {(IS_MOCK_MODE ? FREE_PRODUCTS.map((fp, i) => ({ id: String(i), product: isRTL ? fp.productAr : fp.product, active: fp.active, note: fp.agreement })) : profileTabs.freeProducts.data.map(fp => ({ ...fp, note: "" }))).map((fp) => (
                    <div key={fp.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{fp.product}</div>
                        {fp.note && <div className="text-xs text-slate-500 font-semibold">{fp.note}</div>}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fp.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{fp.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span>
                    </div>
                  ))}
                </div>
              </ProfileTabBody>
            </div>
          )}

          {tab === "discounts" && (
            IS_MOCK_MODE ? (
            <div className="space-y-3">
              <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "خصم التحصيل يؤثر على رصيد العميل فقط ولا يغير المخزون. مرتجع المبيعات يؤثر على المخزون." : "Collection discounts affect customer balance only. Sales returns affect inventory."}</p></div>
              {DISCOUNTS.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد خصومات أو تسويات" : "No discounts or adjustments"}</div> : (
                <div className="space-y-2">
                  {DISCOUNTS.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                      <div><div className="font-bold text-amber-800 text-sm">{d.type}</div><div className="text-xs text-amber-600">{d.date} · {d.ref} · {isRTL ? "السبب:" : "Reason:"} {d.reason}</div></div>
                      <div className="text-end"><div className="font-mono font-black text-amber-600">−AED {d.amount}</div><div className="text-xs text-slate-400">{d.approvedBy}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : <ApiUnavailableState lang={lang} compact />
          )}

          {tab === "audit" && (
            IS_MOCK_MODE ? (
            <div className="space-y-2">
              {[
                { t: "2025-01-28 14:30", a: isRTL ? "تسجيل تحصيل" : "Collection Recorded",    u: "محمد (كاشير)", detail: "AED 2,001.56 — REC-001", dot: "bg-emerald-500" },
                { t: "2025-01-27 10:00", a: isRTL ? "خصم عند التحصيل" : "Collection Discount",  u: "أحمد (مالك)",  detail: "AED 150 — فرق وزن",     dot: "bg-amber-500" },
                { t: "2025-01-25 09:00", a: isRTL ? "إنشاء فاتورة بيع" : "Invoice Created",     u: "محمد (كاشير)", detail: "INV-2025-0081",          dot: "bg-[#0F2C59]" },
                { t: "2025-01-15 11:00", a: isRTL ? "تعديل بيانات العميل" : "Customer Updated",  u: "أحمد (مالك)",  detail: "",                       dot: "bg-slate-400" },
              ].map((e, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${e.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-700">{e.a}{e.detail && <span className="ms-2 text-slate-400 font-normal text-xs">{e.detail}</span>}</div>
                    <div className="text-xs text-slate-400">{e.u}</div>
                  </div>
                  <div className="font-mono text-xs text-slate-400 shrink-0">{e.t}</div>
                </div>
              ))}
            </div>
            ) : <ApiUnavailableState lang={lang} compact />
          )}
        </div>
      </Card>

      {/* Modals */}
      {showCollect && !IS_MOCK_MODE && (
        <LiveCustomerCollectionModal lang={lang} customerId={c.id} onClose={() => setShowCollect(false)} onSuccess={() => { setShowCollect(false); void profileTabs.reloadCollections(); void profileTabs.reloadInvoices(); }} />
      )}
      {showCollect && IS_MOCK_MODE && <CustomerCollectModal lang={lang} customerId={c.id} onClose={() => setShowCollect(false)} />}
      {showCreditOverride && <CreditOverrideModal lang={lang} customerId={c.id} role={role} onClose={() => setShowCreditOverride(false)} />}
      {showOpeningBalance && customerFinancials && (
        <OpeningBalanceModal
          lang={lang}
          customerId={customerId}
          mode={openingBalanceMode}
          initialAmount={customerFinancials.openingBalance}
          initialType={customerFinancials.openingBalanceType}
          onClose={() => setShowOpeningBalance(false)}
          onSuccess={() => {
            void reload();
            void profileTabs.reloadLedger();
            void getCustomerDetail(customerId).then((detail) => {
              if (detail) {
                setCustomerFinancials({
                  openingBalance: detail.openingBalance,
                  openingBalanceType: detail.openingBalanceType,
                });
              }
            });
          }}
        />
      )}
      {showSpecialPriceModal && <SpecialPriceModal lang={lang} onClose={() => setShowSpecialPriceModal(false)} />}
    </div>
  );
}

// ── MODAL: CUSTOMER COLLECTION ─────────────────────────────────────────────────
export function CustomerCollectModal({ lang, customerId, onClose }: { lang: Lang; customerId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const { item: row } = useCustomerDetail(customerId, async (id) => {
    const m = MOCK_CUSTOMERS.find((x) => x.id === id);
    return m ? { id: m.id, name: m.nameAr, nameAr: m.nameAr, nameEn: m.nameEn, phone: m.phone, balance: m.balance, creditLimit: m.creditLimit, overdue: m.creditStatus === "exceeded", customerType: m.type, isActive: m.active, trn: m.trn } : null;
  });
  const c = row ? toModuleCustomer(row) : null;
  if (!c) return null;
  const [mode, setMode] = useState<"invoice" | "account">("invoice");
  const [selectedInv, setSelectedInv] = useState(CUST_INVOICES[0].id);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState("2025-01-28");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [allocMethod, setAllocMethod] = useState("auto");
  const [success, setSuccess] = useState(false);

  const inv = CUST_INVOICES.find(i => i.id === selectedInv);
  const amtNum = parseFloat(amount) || 0;
  const afterBalance = Math.max(0, (mode === "invoice" ? (inv?.remaining || 0) : c.balance) - amtNum);

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل التحصيل!" : "Collection Recorded!"}</h3>
        <p className="text-slate-400 font-semibold mb-2 font-mono">AED {amtNum.toLocaleString()}</p>
        {afterBalance === 0 ? <p className="text-emerald-600 font-bold text-sm mb-6">{isRTL ? "✓ تم تصفية الرصيد بالكامل" : "✓ Balance fully cleared"}</p> : <p className="text-amber-600 font-bold text-sm mb-6">{isRTL ? `المتبقي: AED ${afterBalance.toLocaleString()}` : `Remaining: AED ${afterBalance.toLocaleString()}`}</p>}
        <div className="flex gap-2"><Btn variant="primary" size="sm" className="flex-1 justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال" : "Print Receipt"}</Btn><Btn variant="outline" size="sm" className="flex-1 justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn></div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل تحصيل من عميل" : "Record Customer Collection"}</h3><p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? c.nameAr : c.nameEn}</p></div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            {([["invoice", isRTL ? "تحصيل على فاتورة محددة" : "Specific Invoice"], ["account", isRTL ? "تحصيل على حساب العميل" : "Customer Account"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${mode === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
            ))}
          </div>

          {/* Customer balance */}
          <div className="bg-slate-50 rounded-2xl p-4 text-sm">
            <div className="flex justify-between mb-1"><span className="text-slate-400 font-semibold">{isRTL ? "رصيد العميل" : "Customer Balance"}</span><span className="font-mono font-black text-red-500">AED {c.balance.toLocaleString()}</span></div>
            {mode === "invoice" && inv && (
              <>
                <div className="flex justify-between mb-1"><span className="text-slate-400 font-semibold">{isRTL ? "إجمالي الفاتورة" : "Invoice Total"}</span><span className="font-mono font-bold text-[#0F2C59]">AED {inv.total.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-black text-red-600">{isRTL ? "المتبقي على الفاتورة" : "Invoice Remaining"}</span><span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span></div>
              </>
            )}
          </div>

          {mode === "invoice" && (
            <FSelect label={isRTL ? "اختر الفاتورة" : "Select Invoice"} value={selectedInv} onChange={setSelectedInv}
              options={CUST_INVOICES.filter(i => i.remaining > 0).map(i => ({ value: i.id, label: `${i.id} — AED ${i.remaining.toLocaleString()} ${isRTL ? "متبقي" : "remaining"}` }))} />
          )}

          {mode === "account" && (
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "طريقة التوزيع" : "Allocation Method"}</label>
              <div className="space-y-2">
                {[
                  ["auto",   isRTL ? "توزيع تلقائي على أقدم فواتير غير مدفوعة" : "Auto-allocate to oldest unpaid invoices"],
                  ["manual", isRTL ? "توزيع يدوي على الفواتير" : "Manual allocation to invoices"],
                  ["credit", isRTL ? "تسجيل كرصيد دائن للعميل" : "Record as customer credit balance"],
                ].map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${allocMethod === v ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100 hover:border-slate-200"}`}>
                    <input type="radio" value={v} checked={allocMethod === v} onChange={() => setAllocMethod(v)} className="accent-[#0F2C59]" />
                    <span className="text-xs font-bold text-slate-700">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <FInput label={isRTL ? "المبلغ المُحصَّل (AED) *" : "Amount Collected (AED) *"} type="number" value={amount} onChange={setAmount} required />
          <FSelect label={isRTL ? "طريقة الدفع" : "Payment Method"} value={method} onChange={setMethod} options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
          <FInput label={isRTL ? "تاريخ التحصيل" : "Collection Date"} type="date" value={date} onChange={setDate} />
          <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference (Optional)"} value={ref} onChange={setRef} />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>

          {/* Preview */}
          {amtNum > 0 && (
            <div className={`rounded-xl p-3 border ${afterBalance === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${afterBalance === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `الرصيد بعد التحصيل: AED ${afterBalance.toLocaleString()}` : `Balance after collection: AED ${afterBalance.toLocaleString()}`}
                {afterBalance === 0 && (isRTL ? " ✓ مسدّد" : " ✓ Cleared")}
              </div>
              {allocMethod === "credit" && amtNum > 0 && <p className="text-xs font-bold text-amber-600 mt-1">{isRTL ? "سيظهر رصيد دائن للعميل" : "A credit balance will appear for this customer"}</p>}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="green" onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error(isRTL ? "أدخل المبلغ" : "Enter amount"); return; } setSuccess(true); }}><Check size={15} />{isRTL ? "تسجيل التحصيل" : "Record Collection"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: CUSTOMER STATEMENT ─────────────────────────────────────────────────
export function CustomerStatementScreen({ lang, customerId, onNavigate }: { lang: Lang; customerId: string; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const defaultRange = getDefaultStatementDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState<unknown>(null);
  const [stmtForbidden, setStmtForbidden] = useState(false);
  const [stmtUnavailable, setStmtUnavailable] = useState(false);
  const [movements, setMovements] = useState<typeof STMT_MOVEMENTS>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  const { item: row, loading, error, forbidden, reload } = useCustomerDetail(customerId, async (id) => {
    const m = MOCK_CUSTOMERS.find((x) => x.id === id);
    return m ? { id: m.id, name: m.nameAr, nameAr: m.nameAr, nameEn: m.nameEn, phone: m.phone, balance: m.balance, creditLimit: m.creditLimit, overdue: m.creditStatus === "exceeded", customerType: m.type, isActive: m.active, trn: m.trn } : null;
  });

  const loadStatement = useCallback(async () => {
    if (IS_MOCK_MODE) {
      setMovements(STMT_MOVEMENTS);
      setTotalDebit(STMT_MOVEMENTS.reduce((s, m) => s + m.debit, 0));
      setTotalCredit(STMT_MOVEMENTS.reduce((s, m) => s + m.credit, 0));
      setClosingBalance(STMT_MOVEMENTS.reduce((s, m) => s + m.debit, 0) - STMT_MOVEMENTS.reduce((s, m) => s + m.credit, 0));
      return;
    }
    if (!customerId) return;
    setStmtLoading(true);
    setStmtError(null);
    setStmtForbidden(false);
    setStmtUnavailable(false);
    try {
      const data = await getCustomerStatementReport(customerId, { date_from: dateFrom, date_to: dateTo });
      const entries = (data.ledger_entries as Record<string, unknown>[]) ?? [];
      setOpeningBalance(parseAmount(data.opening_balance as string));
      setTotalDebit(parseAmount(data.debit_total as string));
      setTotalCredit(parseAmount(data.credit_total as string));
      setClosingBalance(parseAmount(data.closing_balance as string));
      setMovements(
        entries.map((e, i) => ({
          id: String(e.id ?? i),
          date: String(e.entry_date ?? e.date ?? "").slice(0, 10),
          type: String(e.entry_type ?? "entry"),
          ref: String(e.reference_number ?? ""),
          desc: String(e.description ?? ""),
          debit: parseAmount(e.debit as string),
          credit: parseAmount(e.credit as string),
          balance: parseAmount((e.balance_after ?? e.balance) as string),
        })),
      );
    } catch (e) {
      setMovements([]);
      if (e instanceof ApiError && e.status === 403) setStmtForbidden(true);
      else if (e instanceof ApiError && (e.status === 404 || e.status === 501)) setStmtUnavailable(true);
      else setStmtError(e);
    } finally {
      setStmtLoading(false);
    }
  }, [customerId, dateFrom, dateTo]);

  useEffect(() => {
    void loadStatement();
  }, [loadStatement]);

  if (!customerId) {
    return (
      <EmptyState
        lang={lang}
        messageAr="اختر عميلاً من قائمة العملاء أو مركز كشوف الحساب لعرض كشف الحساب"
        messageEn="Select a customer from the customers list or statements center to view a statement"
      />
    );
  }
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;
  const c = row ? toModuleCustomer(row) : null;
  if (!c) return <EmptyState lang={lang} messageAr="لا يوجد عملاء بعد" messageEn="No customers yet" />;

  const displayMovements = IS_MOCK_MODE ? STMT_MOVEMENTS : movements;
  const displayOpening = IS_MOCK_MODE ? c.openingBalance : openingBalance;
  const displayDebit = IS_MOCK_MODE ? STMT_MOVEMENTS.reduce((s, m) => s + m.debit, 0) : totalDebit;
  const displayCredit = IS_MOCK_MODE ? STMT_MOVEMENTS.reduce((s, m) => s + m.credit, 0) : totalCredit;
  const displayClosing = IS_MOCK_MODE ? displayDebit - displayCredit : closingBalance;

  return (
    <div className="p-4 lg:p-8 max-w-screen-lg mx-auto">
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("customers-profile")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          <span className="text-slate-400 font-bold text-sm">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          {!IS_MOCK_MODE && (
            <Btn variant="outline" size="sm" onClick={() => void loadStatement()}>{isRTL ? "تحديث" : "Refresh"}</Btn>
          )}
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة PDF" : "Print PDF"}</Btn>
          <Btn variant="secondary"><Download size={15} />{isRTL ? "تصدير Excel" : "Export Excel"}</Btn>
          <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
        </div>
      </div>

      {!IS_MOCK_MODE && stmtLoading && <LoadingState lang={lang} compact />}
      {!IS_MOCK_MODE && stmtForbidden && <PermissionDeniedState lang={lang} compact />}
      {!IS_MOCK_MODE && stmtUnavailable && <ApiUnavailableState lang={lang} compact />}
      {!IS_MOCK_MODE && stmtError && !stmtLoading && (
        <ErrorState lang={lang} error={stmtError} onRetry={() => void loadStatement()} compact />
      )}

      {(!stmtLoading || IS_MOCK_MODE) && !stmtForbidden && !stmtUnavailable && !stmtError && (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0F2C59] text-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-2xl font-black">شركة الوطنية للدواجن</div>
              <div className="text-sm font-bold text-white/70">Al Wataniyah Poultry Company LLC</div>
              <div className="text-sm text-white/55 mt-1">TRN: 100345678901203</div>
            </div>
            <div className="text-end">
              <div className="text-xl font-black text-[#22C55E]">{isRTL ? "كشف حساب عميل" : "Customer Statement"}</div>
              <div className="text-sm font-bold text-white/70 mt-2">{isRTL ? "الفترة:" : "Period:"} {dateFrom} — {dateTo}</div>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">{isRTL ? "العميل / Customer" : "Customer / العميل"}</div>
            <div className="font-black text-slate-800 text-lg">{c.nameAr}</div>
            <div className="font-bold text-slate-500 text-sm">{c.nameEn}</div>
            <div className="text-sm text-slate-400">{c.phone}</div>
          </div>
          <div className={isRTL ? "" : "text-right"}>
            {c.trn && <><div className="text-xs font-black text-slate-400 uppercase mb-1">TRN</div><div className="font-mono text-slate-600">{c.trn}</div></>}
            <div className="text-xs font-black text-slate-400 uppercase mt-2 mb-1">{isRTL ? "الرصيد الافتتاحي" : "Opening Balance"}</div>
            <div className="font-mono font-black text-[#0F2C59]">AED {displayOpening.toLocaleString()}</div>
          </div>
        </div>

        {/* Statement table */}
        <div className="px-6 py-4 overflow-x-auto">
          {displayMovements.length === 0 ? (
            <EmptyState lang={lang} messageAr="لا توجد حركات في هذه الفترة" messageEn="No movements in this period" compact />
          ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0F2C59]/8 border-b border-[#0F2C59]/20">
                {[isRTL ? "التاريخ" : "Date", isRTL ? "نوع الحركة" : "Type", isRTL ? "المرجع" : "Reference", isRTL ? "الوصف" : "Description", isRTL ? "مدين" : "Debit", isRTL ? "دائن" : "Credit", isRTL ? "الرصيد" : "Balance"].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 font-bold text-xs text-[#0F2C59] text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayMovements.map((m, i) => (
                <tr key={m.id} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} border-b border-slate-100`}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.date}</td>
                  <td className="px-3 py-2"><StmtTypeBadge type={m.type} lang={lang} /></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{m.ref}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs font-semibold">{m.desc}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.debit > 0 ? <span className="text-red-500 font-bold">AED {m.debit.toFixed(2)}</span> : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.credit > 0 ? <span className="text-emerald-600 font-bold">AED {m.credit.toFixed(2)}</span> : "—"}</td>
                  <td className="px-3 py-2 font-mono font-black text-xs text-[#0F2C59]">AED {m.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Totals */}
        <div className="px-6 pb-6">
          <div className="flex justify-end">
            <div className="w-72 border-2 border-[#0F2C59]/20 rounded-2xl overflow-hidden">
              {[[isRTL ? "إجمالي المبيعات / Total Sales" : "Total Sales / إجمالي المبيعات", `AED ${displayDebit.toFixed(2)}`, "text-red-600 bg-red-50/50"], [isRTL ? "إجمالي التحصيلات / Collections" : "Collections / إجمالي التحصيلات", `AED ${displayCredit.toFixed(2)}`, "text-emerald-600 bg-emerald-50/50"]].map(([l, v, c]) => (
                <div key={l} className={`flex justify-between px-4 py-2.5 border-b border-slate-200 ${c.split(" ")[1]}`}><span className="font-semibold text-slate-600 text-xs">{l}</span><span className={`font-mono font-black text-sm ${c.split(" ")[0]}`}>{v}</span></div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-[#0F2C59]"><span className="font-black text-white text-sm">{isRTL ? "الرصيد الختامي / Closing Balance" : "Closing Balance / الرصيد الختامي"}</span><span className="font-mono font-black text-[#22C55E] text-lg">AED {displayClosing.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── MODAL: CREDIT LIMIT OVERRIDE ───────────────────────────────────────────────
export function CreditOverrideModal({ lang, customerId, role, onClose }: { lang: Lang; customerId: string; role: TenantRole; onClose: () => void }) {
  const isRTL = lang === "ar";
  const { item: row } = useCustomerDetail(customerId, async (id) => {
    const m = MOCK_CUSTOMERS.find((x) => x.id === id);
    return m ? { id: m.id, name: m.nameAr, nameAr: m.nameAr, nameEn: m.nameEn, phone: m.phone, balance: m.balance, creditLimit: m.creditLimit, overdue: m.creditStatus === "exceeded", customerType: m.type, isActive: m.active, trn: m.trn } : null;
  });
  const c = row ? toModuleCustomer(row) : null;
  if (!c) return null;
  const [newLimit, setNewLimit] = useState(String(Math.ceil(c.creditLimit * 1.5 / 1000) * 1000));
  const [reason, setReason] = useState("");
  const [limitType, setLimitType] = useState<"permanent" | "temp">("permanent");
  const [notes, setNotes] = useState("");
  const canApprove = role === "owner";
  const newInvoiceAmt = 3097.50;
  const balanceAfter = c.balance + newInvoiceAmt;
  const exceeded = balanceAfter - c.creditLimit;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "رفع الحد الائتماني للعميل" : "Increase Customer Credit Limit"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-700">{isRTL ? "رفع الحد الائتماني يسمح بإصدار فواتير إضافية لهذا العميل." : "Increasing the credit limit allows additional invoices for this customer."}</p>
          </div>

          {/* Current state */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
            {[
              [isRTL ? "الرصيد الحالي" : "Current Balance",          `AED ${c.balance.toLocaleString()}`,          "text-red-500"],
              [isRTL ? "الحد الائتماني الحالي" : "Current Credit Limit", `AED ${c.creditLimit.toLocaleString()}`,      "text-slate-700"],
              [isRTL ? "قيمة الفاتورة الجديدة" : "New Invoice Amount",  `AED ${newInvoiceAmt.toLocaleString()}`,      "text-[#0F2C59]"],
              [isRTL ? "الرصيد بعد الفاتورة" : "Balance After Invoice", `AED ${balanceAfter.toLocaleString()}`,       "text-red-600"],
              [isRTL ? "مقدار التجاوز" : "Exceeded By",               `AED ${exceeded.toLocaleString()}`,           "text-red-700 font-black"],
            ].map(([l, v, c]) => <div key={l} className="flex justify-between"><span className="text-slate-400 font-semibold">{l}</span><span className={`font-mono font-bold ${c}`}>{v}</span></div>)}
          </div>

          <FInput label={isRTL ? "الحد الائتماني الجديد (AED) *" : "New Credit Limit (AED) *"} type="number" value={newLimit} onChange={v => canApprove && setNewLimit(v)} required />

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "نوع الرفع" : "Increase Type"}</label>
            <div className="grid grid-cols-2 gap-2">
              {([["permanent", isRTL ? "دائم" : "Permanent"], ["temp", isRTL ? "مؤقت لهذه الفاتورة فقط" : "Temporary (this invoice only)"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => canApprove && setLimitType(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${limitType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>

          <FInput label={isRTL ? "سبب رفع الحد *" : "Reason *"} value={reason} onChange={v => canApprove && setReason(v)} required />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => canApprove && setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>

          {!canApprove && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2"><Shield size={14} className="text-red-500 shrink-0" /><span className="text-xs font-bold text-red-700">{isRTL ? "فقط المالك يمكنه رفع الحد الائتماني" : "Only the Owner can increase the credit limit"}</span></div>}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إلغاء" : "Cancel"}</Btn>
          {canApprove
            ? <Btn variant="green" disabled={!reason.trim() || !newLimit} onClick={() => { toast.success(isRTL ? "تم رفع الحد الائتماني بنجاح" : "Credit limit increased"); onClose(); }} className="flex-1 justify-center"><TrendingUp size={14} />{isRTL ? "رفع الحد واعتماد المتابعة" : "Increase & Continue"}</Btn>
            : <PermBtn lang={lang}><TrendingUp size={14} />{isRTL ? "رفع الحد" : "Increase Limit"}</PermBtn>}
        </div>
      </div>
    </div>
  );
}

// ── MODAL: OPENING BALANCE ─────────────────────────────────────────────────────
function OpeningBalanceModal({
  lang,
  customerId,
  mode,
  initialAmount,
  initialType,
  onClose,
  onSuccess,
}: {
  lang: Lang;
  customerId: string;
  mode: "edit" | "adjustment";
  initialAmount: number;
  initialType: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isRTL = lang === "ar";
  const [amount, setAmount] = useState(String(initialAmount));
  const [obType, setObType] = useState(initialType || "zero");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mapTypeToApi = (raw: string) => {
    if (raw === "debit" || raw === "customer_owes_us" || raw === "على العميل") return "customer_owes_us";
    if (raw === "credit" || raw === "we_owe_customer" || raw === "للعميل") return "we_owe_customer";
    return "zero";
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error(isRTL ? "السبب مطلوب" : "Reason is required");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      await updateCustomerOpeningBalance(customerId, {
        opening_balance: String(Math.max(0, parseFloat(amount) || 0)),
        opening_balance_type: mapTypeToApi(obType),
        reason: reason.trim(),
      });
      toast.success(
        mode === "adjustment"
          ? (isRTL ? "تمت تسوية الرصيد بنجاح" : "Balance adjustment saved")
          : (isRTL ? "تم تحديث الرصيد الافتتاحي" : "Opening balance updated"),
      );
      onSuccess();
      onClose();
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">
            {mode === "adjustment"
              ? (isRTL ? "إضافة تسوية رصيد" : "Add Balance Adjustment")
              : (isRTL ? "تعديل الرصيد الافتتاحي" : "Edit Opening Balance")}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <FormErrors lang={lang} error={saveError} fieldErrors={fieldErrors} />
          {mode === "adjustment" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-800">
                {isRTL
                  ? "أدخل الرصيد الافتتاحي الصحيح بعد المراجعة. سيتم تسجيل فرق التسوية في كشف الحساب."
                  : "Enter the corrected opening balance. The adjustment delta will appear on the customer statement."}
              </p>
            </div>
          )}
          {mode === "adjustment" && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? "الرصيد الافتتاحي الحالي" : "Current Opening Balance"}</div>
              <div className="font-mono font-black text-[#0F2C59]">AED {initialAmount.toLocaleString()}</div>
            </div>
          )}
          <FSelect
            label={isRTL ? "نوع الرصيد الافتتاحي" : "Opening Balance Type"}
            value={obType}
            onChange={setObType}
            options={[
              { value: "customer_owes_us", label: isRTL ? "على العميل (مدين)" : "Customer owes us (Debit)" },
              { value: "we_owe_customer", label: isRTL ? "للعميل (دائن)" : "We owe customer (Credit)" },
              { value: "zero", label: isRTL ? "صفر" : "Zero" },
            ]}
          />
          <FInput
            label={isRTL ? "مبلغ الرصيد الافتتاحي (AED)" : "Opening Balance Amount (AED)"}
            type="number"
            value={amount}
            onChange={setAmount}
            required
          />
          <FInput label={isRTL ? "السبب *" : "Reason *"} value={reason} onChange={setReason} required />
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center" disabled={saving}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="green" disabled={saving || !reason.trim()} onClick={() => void handleSave()} className="flex-1 justify-center">
            <Check size={14} />{isRTL ? "حفظ" : "Save"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: ADD SPECIAL PRICE ───────────────────────────────────────────────────
function SpecialPriceModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const isRTL = lang === "ar";
  const [product, setProduct] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [priceType, setPriceType] = useState("kg");
  const [reason, setReason] = useState("");
  const PRODUCTS = ["900 GRAM","1000 GRAM","1100 GRAM","1200 GRAM","Liver","Gizzard","Breast","Wings","Bone"];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "إضافة سعر خاص" : "Add Special Price"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-[#0F2C59]/5 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "سيتم استخدام السعر الخاص تلقائياً عند إنشاء فاتورة بيع لهذا العميل." : "Special prices are automatically applied when creating a sales invoice."}</p></div>
          <FSelect label={isRTL ? "المنتج / الوزن *" : "Product / Weight *"} value={product} onChange={setProduct} required options={[{ value: "", label: isRTL ? "اختر المنتج" : "Select Product" }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
          <FInput label={isRTL ? "السعر الخاص *" : "Special Price *"} type="number" value={specialPrice} onChange={setSpecialPrice} required />
          <FSelect label={isRTL ? "نوع السعر" : "Price Type"} value={priceType} onChange={setPriceType} options={[{ value: "kg", label: isRTL ? "سعر الكيلو" : "Per KG" }, { value: "piece", label: isRTL ? "سعر الحبة" : "Per Piece" }, { value: "carton", label: isRTL ? "سعر الكرتون" : "Per Carton" }]} />
          <FInput label={isRTL ? "السبب / الملاحظة" : "Reason / Note"} value={reason} onChange={setReason} />
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn onClick={() => { if (!product || !specialPrice) { toast.error(isRTL ? "يرجى اختيار المنتج والسعر" : "Select product and price"); return; } toast.success(isRTL ? "تم حفظ السعر الخاص" : "Special price saved"); onClose(); }}><Check size={15} />{isRTL ? "حفظ السعر الخاص" : "Save Special Price"}</Btn>
        </div>
      </div>
    </div>
  );
}
