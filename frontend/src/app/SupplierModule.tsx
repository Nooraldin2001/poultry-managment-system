// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — SUPPLIER PHASE: SUPPLIERS & ACCOUNTS WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Plus, Search, Eye, Pencil, X, Check, ChevronRight, ChevronLeft,
  ChevronDown, Phone, AlertTriangle, Info, CheckCircle, Download, Printer,
  TrendingUp, TrendingDown, DollarSign, FileText, Clock, Settings, Lock,
  Wallet, Tag, Star, BarChart2, Shield, Truck
} from "lucide-react";
import { toast } from "sonner";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "sales-preview" | "sales-detail"
  | "purchases" | "purchases-list" | "purchases-new" | "purchases-preview" | "purchases-detail"
  | "inventory" | "inventory-product" | "inventory-stocktaking" | "inventory-alerts" | "inventory-movement" | "inventory-valuation"
  | "customers" | "customers-create" | "customers-profile" | "customers-statement"
  | "suppliers" | "suppliers-new" | "supplier-profile" | "supplier-statement"
  | "quotations" | "payments" | "expenses" | "accounts" | "tax" | "reports" | "users" | "settings";
type SuppType = "credit" | "cash" | "bank";
type SuppStatus = "has_payable" | "active" | "clear" | "inactive";

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
function FInput({ label, placeholder, type = "text", value, onChange, helper, required = false }: {
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; helper?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59] focus:ring-2 focus:ring-[#0F2C59]/10" />
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
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
        {lang === "ar" ? "إرسال واتساب متاح في باقة Pro أو Enterprise." : "WhatsApp sending available in Pro or Enterprise plans."}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface Supplier {
  id: string; nameAr: string; nameEn: string; type: SuppType; category: string;
  phone: string; whatsapp: string; email: string; trn: string; emirate: string;
  balance: number; paymentTerms: string; status: SuppStatus; active: boolean; openingBalance: number;
  lastInvoice: string; lastPayment: string;
}
const SUPPLIERS: Supplier[] = [
  { id: "sp1", nameAr: "WESTLAND FOODSTUFF",     nameEn: "WESTLAND FOODSTUFF TRADING LLC", type: "credit", category: "food_company", phone: "+971 4 123 4567",  whatsapp: "+971 4 123 4567",  email: "orders@westland.ae", trn: "100765432100003", emirate: "دبي",      balance: 18500,    paymentTerms: "15", status: "has_payable", active: true, openingBalance: 5000,  lastInvoice: "2025-01-28", lastPayment: "2025-01-28" },
  { id: "sp2", nameAr: "MNM Foodstuff Trading",  nameEn: "MNM Foodstuff Trading LLC",      type: "credit", category: "food_company", phone: "+971 50 987 6543", whatsapp: "+971 50 987 6543", email: "",                   trn: "",                emirate: "الشارقة", balance: 6942.86,  paymentTerms: "7",  status: "active",     active: true, openingBalance: 0,     lastInvoice: "2025-01-26", lastPayment: "2025-01-20" },
  { id: "sp3", nameAr: "مزرعة العين للدواجن",   nameEn: "Al Ain Poultry Farm",            type: "credit", category: "farm",         phone: "+971 3 765 4321",  whatsapp: "+971 3 765 4321",  email: "",                   trn: "",                emirate: "أبوظبي",  balance: 25000,    paymentTerms: "30", status: "has_payable", active: true, openingBalance: 0,     lastInvoice: "2025-01-25", lastPayment: "2025-01-15" },
  { id: "sp4", nameAr: "نقل الإمارات",          nameEn: "Emirates Transport",             type: "cash",   category: "transport",    phone: "+971 55 000 1234", whatsapp: "+971 55 000 1234", email: "",                   trn: "",                emirate: "دبي",      balance: 0,        paymentTerms: "0",  status: "clear",      active: true, openingBalance: 0,     lastInvoice: "2025-01-22", lastPayment: "2025-01-22" },
];

const SUPP_INVOICES = [
  { id: "PUR-2025-0042", supplierInvNo: "WST-2025-1234", date: "2025-01-28", cartons: 146, pcs: 1460, kg: 1310, goodsTotal: 3305.55, deductions: 0,    netPayable: 3470.83, paid: 3470.83, remaining: 0,      method: "bank",   status: "paid"    },
  { id: "PUR-2025-0041", supplierInvNo: "WST-2025-1198", date: "2025-01-25", cartons: 220, pcs: 2200, kg: 2800, goodsTotal: 8400,    deductions: 1000, netPayable: 8085,    paid: 5000,    remaining: 3085,   method: "credit", status: "partial" },
  { id: "PUR-2025-0035", supplierInvNo: "WST-2025-1100", date: "2025-01-20", cartons: 180, pcs: 1800, kg: 1900, goodsTotal: 5700,    deductions: 300,  netPayable: 5670,    paid: 5670,    remaining: 0,      method: "bank",   status: "paid"    },
  { id: "PUR-2025-0030", supplierInvNo: "WST-2025-1050", date: "2025-01-15", cartons: 300, pcs: 3000, kg: 3200, goodsTotal: 9600,    deductions: 0,    netPayable: 9600,    paid: 9600,    remaining: 0,      method: "bank",   status: "paid"    },
];

const SUPP_PAYMENTS = [
  { id: "PAY-001", date: "2025-01-28", amount: 3470.83, method: "bank",   linkedInv: "PUR-2025-0042", ref: "TRF-2025-001", by: "أحمد (مالك)" },
  { id: "PAY-002", date: "2025-01-20", amount: 5000,    method: "bank",   linkedInv: "PUR-2025-0041", ref: "TRF-2025-002", by: "أحمد (مالك)" },
  { id: "PAY-003", date: "2025-01-15", amount: 5670,    method: "cheque", linkedInv: "PUR-2025-0035", ref: "CHQ-54321",    by: "أحمد (مالك)" },
  { id: "PAY-004", date: "2025-01-10", amount: 9600,    method: "bank",   linkedInv: "PUR-2025-0030", ref: "TRF-2025-003", by: "أحمد (مالك)" },
];

const SUPP_STMT = [
  { id: "ss1", date: "2025-01-01", type: "opening",   ref: "—",               desc: "رصيد افتتاحي",            debit: 5000,   credit: 0,       balance: 5000 },
  { id: "ss2", date: "2025-01-15", type: "purchase",  ref: "PUR-2025-0030",  desc: "فاتورة شراء",             debit: 9600,   credit: 0,       balance: 14600 },
  { id: "ss3", date: "2025-01-10", type: "payment",   ref: "PAY-004",         desc: "دفعة للمورد",             debit: 0,      credit: 9600,    balance: 5000 },
  { id: "ss4", date: "2025-01-20", type: "purchase",  ref: "PUR-2025-0035",  desc: "فاتورة شراء",             debit: 5670,   credit: 0,       balance: 10670 },
  { id: "ss5", date: "2025-01-15", type: "payment",   ref: "PAY-003",         desc: "دفعة للمورد",             debit: 0,      credit: 5670,    balance: 5000 },
  { id: "ss6", date: "2025-01-25", type: "purchase",  ref: "PUR-2025-0041",  desc: "فاتورة شراء",             debit: 8085,   credit: 0,       balance: 13085 },
  { id: "ss7", date: "2025-01-25", type: "deduction", ref: "DED-2025-001",   desc: "خصم من المستحق — نقل",   debit: 0,      credit: 300,     balance: 12785 },
  { id: "ss8", date: "2025-01-20", type: "payment",   ref: "PAY-002",         desc: "دفعة للمورد",             debit: 0,      credit: 5000,    balance: 7785 },
  { id: "ss9", date: "2025-01-28", type: "purchase",  ref: "PUR-2025-0042",  desc: "فاتورة شراء",             debit: 3470.83,credit: 0,       balance: 11255.83 },
  { id: "ss10",date: "2025-01-28", type: "payment",   ref: "PAY-001",         desc: "دفعة للمورد",             debit: 0,      credit: 3470.83, balance: 7785 },
];

const SUPP_PRICES = [
  { product: "900 GRAM",     productAr: "900 جرام",      defaultPrice: 12.25, specialPrice: 1.15,  priceType: "piece", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "1000 GRAM",    productAr: "1000 جرام",     defaultPrice: 12.50, specialPrice: 1.20,  priceType: "piece", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "1100 GRAM",    productAr: "1100 جرام",     defaultPrice: 13.00, specialPrice: 1.15,  priceType: "piece", lastEdit: "2025-01-15", editedBy: "أحمد (مالك)", active: true },
  { product: "Liver 500G",   productAr: "كبدة 500 جرام", defaultPrice: 3.50,  specialPrice: 0.70,  priceType: "tray",  lastEdit: "2025-01-10", editedBy: "أحمد (مالك)", active: true },
  { product: "Gizzard 500G", productAr: "قانصة 500 جرام",defaultPrice: 3.80,  specialPrice: 1.00,  priceType: "tray",  lastEdit: "2025-01-10", editedBy: "أحمد (مالك)", active: true },
];

const SUPP_AGREEMENTS = [
  { title: "خصم الذبح الافتراضي",              type: "slaughter",        value: "AED 700",           active: true, lastUpdated: "2025-01-01", note: "يطبق تلقائياً على كل فاتورة شراء" },
  { title: "خصم النقل الافتراضي",              type: "transport",        value: "AED 300",           active: true, lastUpdated: "2025-01-01", note: "حسب الكمية" },
  { title: "شروط الدفع",                       type: "payment_terms",    value: "15 يوم",            active: true, lastUpdated: "2025-01-01", note: "" },
  { title: "طريقة الضريبة الافتراضية",         type: "vat",              value: "اسأل عند كل فاتورة",active: true, lastUpdated: "2025-01-01", note: "" },
  { title: "الحبات الافتراضية في الكرتونة",    type: "pieces_per_carton",value: "10 حبات",           active: true, lastUpdated: "2025-01-01", note: "" },
  { title: "طريقة الشراء الافتراضية",          type: "purchase_method",  value: "بالحبة",            active: true, lastUpdated: "2025-01-01", note: "" },
];

const SUPP_DEDUCTIONS = [
  { date: "2025-01-25", type: "خصم من المستحق", ref: "DED-2025-001", amount: 300, reason: "تكلفة النقل", approvedBy: "أحمد (مالك)", note: "" },
  { date: "2025-01-20", type: "خصم من المستحق", ref: "DED-2025-002", amount: 700, reason: "تكلفة الذبح", approvedBy: "أحمد (مالك)", note: "" },
];

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────
function SuppTypeBadge({ type, lang }: { type: SuppType; lang: Lang }) {
  const cfg = {
    credit: { bg: "bg-blue-50",   t: "text-blue-700",   ar: "آجل",  en: "Credit" },
    cash:   { bg: "bg-slate-100", t: "text-slate-600",  ar: "كاش",  en: "Cash" },
    bank:   { bg: "bg-violet-50", t: "text-violet-700", ar: "بنكي", en: "Bank" },
  }[type];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}
function SuppStatusBadge({ status, lang }: { status: SuppStatus; lang: Lang }) {
  const cfg = {
    has_payable: { bg: "bg-amber-50",  t: "text-amber-700",   ar: "له مستحقات",    en: "Has Payable" },
    active:      { bg: "bg-emerald-50",t: "text-emerald-700", ar: "نشط",            en: "Active" },
    clear:       { bg: "bg-emerald-50",t: "text-emerald-700", ar: "لا توجد مستحقات",en: "Clear" },
    inactive:    { bg: "bg-red-50",    t: "text-red-600",     ar: "موقوف",          en: "Inactive" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}
function PurchInvStatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; t: string; ar: string; en: string }> = {
    paid:     { bg: "bg-emerald-50", t: "text-emerald-700", ar: "مدفوعة",          en: "Paid" },
    partial:  { bg: "bg-amber-50",   t: "text-amber-700",   ar: "مدفوعة جزئياً",  en: "Partial" },
    credit:   { bg: "bg-blue-50",    t: "text-blue-700",    ar: "على الحساب",      en: "Credit" },
    approved: { bg: "bg-blue-50",    t: "text-blue-700",    ar: "معتمدة",           en: "Approved" },
    cancelled:{ bg: "bg-red-50",     t: "text-red-700",     ar: "ملغاة",            en: "Cancelled" },
    draft:    { bg: "bg-slate-100",  t: "text-slate-600",   ar: "مسودة",            en: "Draft" },
  };
  const c = cfg[status] || cfg.draft;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.t}`}>{lang === "ar" ? c.ar : c.en}</span>;
}
function StmtTypeBadge({ type, lang }: { type: string; lang: Lang }) {
  const cfg: Record<string, { bg: string; t: string; ar: string; en: string }> = {
    opening:   { bg: "bg-slate-100", t: "text-slate-600",  ar: "رصيد افتتاحي", en: "Opening" },
    purchase:  { bg: "bg-amber-50",  t: "text-amber-700",  ar: "فاتورة شراء",   en: "Purchase Invoice" },
    payment:   { bg: "bg-emerald-50",t: "text-emerald-700",ar: "دفعة للمورد",   en: "Payment" },
    deduction: { bg: "bg-blue-50",   t: "text-blue-700",   ar: "خصم من المستحق",en: "Deduction" },
    cancellation:{ bg: "bg-red-50",  t: "text-red-700",    ar: "إلغاء شراء",   en: "Cancellation" },
  };
  const c = cfg[type] || cfg.opening;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.t}`}>{lang === "ar" ? c.ar : c.en}</span>;
}

// ── SCREEN: SUPPLIERS LIST ─────────────────────────────────────────────────────
export function SuppliersListScreen({ lang, role, onNavigate, setSelectedSupplier }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedSupplier: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const canCreate = role === "owner" || role === "accountant";
  const canPay = role === "owner" || role === "accountant";

  const filtered = SUPPLIERS.filter(s => {
    const q = search.toLowerCase();
    return (!q || s.nameAr.includes(search) || s.nameEn.toLowerCase().includes(q) || s.phone.includes(q)) &&
      (filterType === "all" || s.type === filterType) &&
      (filterStatus === "all" || (filterStatus === "has_payable" && s.balance > 0) || (filterStatus === "clear" && s.balance === 0));
  });

  const totalPayable = SUPPLIERS.reduce((sum, s) => sum + s.balance, 0);
  const kpis = [
    { v: SUPPLIERS.length.toString(),                            ar: "إجمالي الموردين",           en: "Total Suppliers",        bg: "bg-[#0F2C59]" },
    { v: SUPPLIERS.filter(s => s.active).length.toString(),     ar: "الموردين النشطين",          en: "Active Suppliers",       bg: "bg-emerald-500" },
    { v: SUPPLIERS.filter(s => s.balance > 0).length.toString(),ar: "موردين لهم مستحقات",       en: "With Payable",           bg: "bg-amber-500" },
    { v: `AED ${totalPayable.toLocaleString()}`,                 ar: "إجمالي مستحقات الموردين",  en: "Total Payables",         bg: "bg-red-500" },
    { v: SUPPLIERS.filter(s => s.type === "cash").length.toString(),   ar: "موردين كاش",         en: "Cash Suppliers",         bg: "bg-slate-500" },
    { v: SUPPLIERS.filter(s => s.type !== "cash").length.toString(),   ar: "موردين آجل",         en: "Credit Suppliers",       bg: "bg-blue-500" },
    { v: "AED 9,600",                                            ar: "دفعات اليوم",               en: "Today's Payments",       bg: "bg-violet-500" },
    { v: "AED 25,000",                                           ar: "مشتريات هذا الشهر",         en: "Month's Purchases",      bg: "bg-emerald-600" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "الموردين" : "Suppliers"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{SUPPLIERS.length} {isRTL ? "مورد مسجل" : "registered suppliers"}</p>
        </div>
        {canCreate
          ? <Btn variant="primary" onClick={() => onNavigate("suppliers-new")}><Plus size={15} />{isRTL ? "إضافة مورد جديد" : "Add New Supplier"}</Btn>
          : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "إضافة مورد جديد" : "Add New Supplier"}</PermBtn>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><Truck size={16} className="text-white" /></div>
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
            <option value="cash">{isRTL ? "كاش" : "Cash"}</option>
            <option value="bank">{isRTL ? "بنكي" : "Bank"}</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="has_payable">{isRTL ? "لهم مستحقات" : "Has Payable"}</option>
            <option value="clear">{isRTL ? "لا توجد مستحقات" : "Clear"}</option>
          </select>
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
        </div>
      </Card>

      {/* Desktop Table */}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "اسم المورد" : "Supplier", isRTL ? "النوع" : "Type", isRTL ? "التصنيف" : "Category", isRTL ? "الهاتف" : "Phone", isRTL ? "الرصيد الحالي" : "Balance", isRTL ? "شروط الدفع" : "Terms", isRTL ? "آخر فاتورة شراء" : "Last Invoice", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => (
                  <tr key={s.id} className={`hover:bg-slate-50/60 transition-colors ${s.status === "has_payable" ? "bg-amber-50/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 text-sm">{isRTL ? s.nameAr : s.nameEn}</div>
                      {s.trn && <div className="text-[10px] text-slate-400 font-mono">{s.trn}</div>}
                    </td>
                    <td className="px-4 py-3"><SuppTypeBadge type={s.type} lang={lang} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-semibold capitalize">{s.category.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.phone}</td>
                    <td className="px-4 py-3 font-mono font-black text-sm">
                      {s.balance > 0 ? <span className="text-amber-600">AED {s.balance.toLocaleString()}</span> : <span className="text-emerald-500">صفر</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-semibold">
                      {s.paymentTerms === "0" ? (isRTL ? "فوري" : "Immediate") : `${s.paymentTerms} ${isRTL ? "يوم" : "days"}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.lastInvoice}</td>
                    <td className="px-4 py-3"><SuppStatusBadge status={s.status} lang={lang} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedSupplier(s.id); onNavigate("supplier-profile"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all" title={isRTL ? "عرض الملف" : "View Profile"}><Eye size={13} /></button>
                        {canCreate && <button onClick={() => { setSelectedSupplier(s.id); onNavigate("suppliers-new"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Pencil size={13} /></button>}
                        <button onClick={() => onNavigate("purchases-new")} className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all" title={isRTL ? "إنشاء فاتورة شراء" : "New Purchase"}><FileText size={13} /></button>
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
      {filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map(s => (
            <Card key={s.id} className={`p-4 ${s.status === "has_payable" ? "border-amber-200" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-slate-800">{isRTL ? s.nameAr : s.nameEn}</div>
                  <div className="flex items-center gap-1.5 mt-0.5"><SuppTypeBadge type={s.type} lang={lang} /><SuppStatusBadge status={s.status} lang={lang} /></div>
                </div>
                <div className="text-end">
                  <div className={`font-mono font-black ${s.balance > 0 ? "text-amber-600" : "text-emerald-500"}`}>{s.balance > 0 ? `AED ${s.balance.toLocaleString()}` : (isRTL ? "صفر" : "Zero")}</div>
                  <div className="text-[10px] text-slate-400">{isRTL ? "مستحق للمورد" : "Payable"}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" variant="secondary" onClick={() => { setSelectedSupplier(s.id); onNavigate("supplier-profile"); }}><Eye size={13} />{isRTL ? "الملف" : "Profile"}</Btn>
                {canPay && s.balance > 0 && <Btn size="sm" variant="amber"><Wallet size={13} />{isRTL ? "دفعة" : "Pay"}</Btn>}
                <Btn size="sm" variant="outline" onClick={() => onNavigate("purchases-new")}><FileText size={13} />{isRTL ? "فاتورة شراء" : "Purchase"}</Btn>
                <a href={`tel:${s.phone}`} className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Phone size={14} /></a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="p-14 text-center"><Truck size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا يوجد موردين حالياً" : "No suppliers yet"}</h3>{canCreate && <Btn onClick={() => onNavigate("suppliers-new")}><Plus size={15} />{isRTL ? "إضافة أول مورد" : "Add First Supplier"}</Btn>}</Card>
      )}
    </div>
  );
}

// ── SCREEN: CREATE / EDIT SUPPLIER ─────────────────────────────────────────────
export function CreateSupplierScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [nameAr, setNameAr] = useState(""); const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState(""); const [trn, setTrn] = useState("");
  const [address, setAddress] = useState(""); const [emirate, setEmirate] = useState("");
  const [suppType, setSuppType] = useState<SuppType>("credit");
  const [category, setCategory] = useState("food_company");
  const [active, setActive] = useState(true);
  const [openBal, setOpenBal] = useState("0"); const [openBalType, setOpenBalType] = useState("للمورد علينا");
  const [payTerms, setPayTerms] = useState("15"); const [payMethod, setPayMethod] = useState("bank");
  const [trackBalance, setTrackBalance] = useState(true);
  const [defSlaughter, setDefSlaughter] = useState("700"); const [defTransport, setDefTransport] = useState("300");
  const [defVat, setDefVat] = useState("ask"); const [defPpc, setDefPpc] = useState("10");
  const [defPurchaseMethod, setDefPurchaseMethod] = useState("piece");
  const [showAgreements, setShowAgreements] = useState(false);

  const canSetFinancials = role === "owner" || role === "accountant";
  const EMIRATES = ["دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "أم القيوين", "الفجيرة"].map(e => ({ value: e, label: e }));
  const CATEGORIES = [
    { value: "food_company", label: isRTL ? "شركة مواد غذائية" : "Food Company" },
    { value: "farm",         label: isRTL ? "مزرعة دواجن" : "Poultry Farm" },
    { value: "slaughterhouse",label: isRTL ? "مسلخ" : "Slaughterhouse" },
    { value: "transport",    label: isRTL ? "شركة نقل" : "Transport Company" },
    { value: "cash",         label: isRTL ? "مورد كاش" : "Cash Supplier" },
    { value: "credit",       label: isRTL ? "مورد آجل" : "Credit Supplier" },
    { value: "other",        label: isRTL ? "أخرى" : "Other" },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("suppliers")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "إضافة مورد جديد" : "Add New Supplier"}</h2>
      </div>

      {/* A. Basic Info */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "أ. المعلومات الأساسية" : "A. Basic Information"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "اسم المورد (عربي) *" : "Arabic Name *"} value={nameAr} onChange={setNameAr} placeholder="مزرعة العين" required />
          <FInput label={isRTL ? "اسم المورد (إنجليزي)" : "English Name"} value={nameEn} onChange={setNameEn} placeholder="Al Ain Farm" />
          <FInput label={isRTL ? "رقم الهاتف *" : "Phone *"} type="tel" value={phone} onChange={setPhone} placeholder="+971 50 XXX XXXX" required />
          <FInput label={isRTL ? "رقم الواتساب" : "WhatsApp"} type="tel" value={whatsapp} onChange={setWhatsapp} />
          <FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={email} onChange={setEmail} />
          <FInput label={isRTL ? "رقم الضريبة TRN" : "TRN"} value={trn} onChange={setTrn} placeholder="100XXXXXXXXXXX" />
          <FSelect label={isRTL ? "الإمارة" : "Emirate"} value={emirate} onChange={setEmirate} options={[{ value: "", label: isRTL ? "اختر الإمارة" : "Select Emirate" }, ...EMIRATES]} />
          <div className="sm:col-span-2"><FInput label={isRTL ? "العنوان" : "Address"} value={address} onChange={setAddress} /></div>
        </div>
      </Card>

      {/* B. Supplier Type */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ب. نوع المورد" : "B. Supplier Type"}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "نوع الحساب" : "Account Type"}</label>
            <div className="grid grid-cols-3 gap-2">
              {([["credit", isRTL ? "آجل / على الحساب" : "Credit / Account"], ["cash", isRTL ? "كاش" : "Cash"], ["bank", isRTL ? "حساب بنكي" : "Bank Account"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setSuppType(v)} className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${suppType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          <FSelect label={isRTL ? "التصنيف" : "Category"} value={category} onChange={setCategory} options={CATEGORIES} />
          <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-700">{isRTL ? "المورد نشط" : "Supplier Active"}</span>
            <button onClick={() => setActive(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${active ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
              <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${active ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* C. Financial Settings */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ج. الإعدادات المالية" : "C. Financial Settings"}</h3>
        {!canSetFinancials && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-4"><Info size={14} className="text-amber-500" /><span className="text-xs font-bold text-amber-700">{isRTL ? "ليس لديك صلاحية تعديل الإعدادات المالية" : "No permission to edit financial settings"}</span></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "نوع الرصيد الافتتاحي" : "Opening Balance Type"}</label>
            <div className="grid grid-cols-3 gap-2">
              {[["للمورد علينا", isRTL ? "للمورد علينا" : "We Owe"], ["لنا عند المورد", isRTL ? "لنا عند المورد" : "Supplier Owes"], ["صفر", isRTL ? "صفر" : "Zero"]].map(([v, l]) => (
                <button key={v} onClick={() => canSetFinancials && setOpenBalType(v)} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${openBalType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <FInput label={isRTL ? "مبلغ الرصيد الافتتاحي (AED)" : "Opening Balance (AED)"} type="number" value={openBal} onChange={v => canSetFinancials && setOpenBal(v)} />
          <FSelect label={isRTL ? "شروط الدفع الافتراضية" : "Default Payment Terms"} value={payTerms} onChange={v => canSetFinancials && setPayTerms(v)}
            options={[{ value: "0", label: isRTL ? "فوري" : "Immediate" }, { value: "7", label: isRTL ? "7 أيام" : "7 days" }, { value: "15", label: isRTL ? "15 يوم" : "15 days" }, { value: "30", label: isRTL ? "30 يوم" : "30 days" }]} />
          <FSelect label={isRTL ? "طريقة الدفع الافتراضية" : "Default Payment Method"} value={payMethod} onChange={v => canSetFinancials && setPayMethod(v)}
            options={[{ value: "bank", label: isRTL ? "حساب بنكي" : "Bank Transfer" }, { value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
        </div>
        <div className="mt-4 flex items-center justify-between py-2.5 border-t border-slate-100">
          <div><div className="text-sm font-bold text-slate-700">{isRTL ? "متابعة رصيد المورد" : "Track Supplier Balance"}</div><div className="text-xs text-slate-400 font-semibold">{isRTL ? "يمكن إيقافه لمورد الكاش إذا لم تكن هناك مستحقات" : "Can disable for cash suppliers with no payables"}</div></div>
          <button onClick={() => canSetFinancials && setTrackBalance(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${trackBalance ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
            <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${trackBalance ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        {suppType === "cash" && <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-slate-400 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "يمكن عدم متابعة رصيد مورد الكاش إذا لم تكن هناك مستحقات أو دفعات آجلة." : "Cash supplier balance tracking can be disabled if there are no payables or deferred payments."}</p></div>}
      </Card>

      {/* D. Supplier Agreement Defaults */}
      <Card className="overflow-hidden">
        <button onClick={() => setShowAgreements(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-slate-50 transition-all">
          <div><h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "د. اتفاقات المورد الافتراضية" : "D. Default Supplier Agreements"}</h3><p className="text-xs text-slate-400 mt-0.5">{isRTL ? "اختيارية — تظهر كمقترحات عند إنشاء فاتورة شراء" : "Optional — appear as suggestions when creating a purchase invoice"}</p></div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${showAgreements ? "rotate-180" : ""}`} />
        </button>
        {showAgreements && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "هذه القيم اختيارية وتظهر كمقترحات عند إنشاء فاتورة شراء جديدة لهذا المورد." : "These values are optional and appear as suggestions when creating a new purchase invoice."}</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FInput label={isRTL ? "خصم الذبح الافتراضي (AED)" : "Default Slaughter Deduction"} type="number" value={defSlaughter} onChange={setDefSlaughter} />
              <FInput label={isRTL ? "خصم النقل الافتراضي (AED)" : "Default Transport Deduction"} type="number" value={defTransport} onChange={setDefTransport} />
              <FSelect label={isRTL ? "طريقة الضريبة الافتراضية" : "Default VAT Behavior"} value={defVat} onChange={setDefVat}
                options={[{ value: "enabled", label: isRTL ? "ضريبة مفعّلة" : "VAT Enabled" }, { value: "disabled", label: isRTL ? "بدون ضريبة" : "VAT Disabled" }, { value: "ask", label: isRTL ? "اسأل عند كل فاتورة" : "Ask Every Invoice" }]} />
              <FInput label={isRTL ? "الحبات الافتراضية في الكرتونة" : "Default Pieces Per Carton"} type="number" value={defPpc} onChange={setDefPpc} placeholder="10" />
              <FSelect label={isRTL ? "طريقة الشراء الافتراضية" : "Default Purchase Method"} value={defPurchaseMethod} onChange={setDefPurchaseMethod}
                options={[{ value: "piece", label: isRTL ? "بالحبة" : "By Piece" }, { value: "kg", label: isRTL ? "بالكيلو" : "By KG" }, { value: "carton", label: isRTL ? "بالكرتون" : "By Carton" }]} />
            </div>
          </div>
        )}
      </Card>

      {/* E. Pricing */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "هـ. الأسعار والاتفاقيات" : "E. Prices & Agreements"}</h3>
        <div className="flex flex-wrap gap-3">
          <Btn variant="outline" size="sm"><Tag size={13} />{isRTL ? "إضافة أسعار شراء خاصة" : "Add Special Purchase Prices"}</Btn>
          <Btn variant="outline" size="sm"><Star size={13} />{isRTL ? "إضافة اتفاق مورد" : "Add Supplier Agreement"}</Btn>
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "رفع مستند اتفاق" : "Upload Agreement Doc"}</Btn>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate("suppliers")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => { toast.success(isRTL ? "تم حفظ المورد" : "Supplier saved"); onNavigate("suppliers"); }}><Check size={15} />{isRTL ? "حفظ المورد" : "Save Supplier"}</Btn>
          <Btn variant="green" onClick={() => { toast.success(isRTL ? "تم حفظ المورد وإنشاء فاتورة شراء" : "Saved & creating purchase invoice"); onNavigate("purchases-new"); }}><FileText size={15} />{isRTL ? "حفظ وإنشاء فاتورة شراء" : "Save & New Purchase"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: SUPPLIER PROFILE ───────────────────────────────────────────────────
export function SupplierProfileScreen({ lang, role, onNavigate, supplierId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; supplierId: string;
}) {
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("overview");
  const [showPay, setShowPay] = useState(false);
  const [showSpecialPrice, setShowSpecialPrice] = useState(false);

  const s = SUPPLIERS.find(x => x.id === supplierId) || SUPPLIERS[0];
  const canEdit = role === "owner" || role === "accountant";
  const canPay = role === "owner" || role === "accountant";
  const totalPurchases = SUPP_INVOICES.reduce((sum, i) => sum + i.netPayable, 0);
  const totalPaid = SUPP_PAYMENTS.reduce((sum, p) => sum + p.amount, 0);

  const TABS = [
    { k: "overview",   ar: "نظرة عامة",         en: "Overview" },
    { k: "invoices",   ar: "فواتير الشراء",      en: "Purchase Invoices" },
    { k: "payments",   ar: "المدفوعات",          en: "Payments" },
    { k: "statement",  ar: "كشف الحساب",         en: "Statement" },
    { k: "prices",     ar: "أسعار الشراء الخاصة",en: "Special Prices" },
    { k: "agreements", ar: "الاتفاقات",          en: "Agreements" },
    { k: "deductions", ar: "الخصومات والتسويات", en: "Deductions" },
    { k: "audit",      ar: "سجل العمليات",       en: "Audit Log" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("suppliers")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 mt-0.5">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? `ملف المورد: ${s.nameAr}` : `Supplier: ${s.nameEn}`}</h2>
            <SuppTypeBadge type={s.type} lang={lang} />
            <SuppStatusBadge status={s.status} lang={lang} />
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{s.phone}{s.trn && ` · TRN: ${s.trn}`}</div>
        </div>
      </div>

      {/* Balance card */}
      {s.balance > 0 ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-4">
          <AlertTriangle size={22} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <div className="font-black text-amber-800 text-base">{isRTL ? `مستحق للمورد: AED ${s.balance.toLocaleString()}` : `Payable to Supplier: AED ${s.balance.toLocaleString()}`}</div>
            <p className="text-xs font-bold text-amber-600 mt-0.5">{isRTL ? `شروط الدفع: ${s.paymentTerms === "0" ? "فوري" : s.paymentTerms + " يوم"}` : `Payment terms: ${s.paymentTerms === "0" ? "Immediate" : s.paymentTerms + " days"}`}</p>
          </div>
          {canPay && <Btn size="sm" variant="amber" onClick={() => setShowPay(true)}><Wallet size={13} />{isRTL ? "دفعة للمورد" : "Pay Supplier"}</Btn>}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-500 shrink-0" />
          <span className="font-black text-emerald-700">{isRTL ? "لا توجد مستحقات للمورد" : "No outstanding payables to this supplier"}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { v: `AED ${s.balance.toLocaleString()}`, ar: "الرصيد الحالي",     en: "Current Balance",    cls: s.balance > 0 ? "text-amber-600" : "text-emerald-600" },
          { v: `AED ${totalPurchases.toLocaleString()}`, ar: "إجمالي المشتريات",en: "Total Purchases",  cls: "text-[#0F2C59]" },
          { v: `AED ${totalPaid.toLocaleString()}`,  ar: "إجمالي المدفوع",    en: "Total Paid",         cls: "text-emerald-600" },
          { v: s.lastInvoice,                         ar: "آخر فاتورة شراء",  en: "Last Purchase",      cls: "text-slate-600" },
        ].map(f => <Card key={f.ar} className="p-4 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-[10px] font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>)}
      </div>

      {/* Action Bar */}
      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-new")}><FileText size={13} />{isRTL ? "إنشاء فاتورة شراء" : "New Purchase"}</Btn>
        {canPay ? <Btn size="sm" variant="amber" onClick={() => setShowPay(true)}><Wallet size={13} />{isRTL ? "تسجيل دفعة للمورد" : "Record Payment"}</Btn> : <PermBtn lang={lang}><Wallet size={13} />{isRTL ? "تسجيل دفعة للمورد" : "Record Payment"}</PermBtn>}
        <Btn size="sm" variant="secondary" onClick={() => setTab("statement")}><FileText size={13} />{isRTL ? "كشف حساب" : "Statement"}</Btn>
        {canEdit && <Btn size="sm" variant="outline" onClick={() => onNavigate("suppliers-new")}><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
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

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { v: `AED ${totalPurchases.toLocaleString()}`, ar: "إجمالي المشتريات",          en: "Total Purchases",    cls: "text-[#0F2C59]" },
                  { v: `AED ${totalPaid.toLocaleString()}`,      ar: "إجمالي المدفوع",            en: "Total Paid",          cls: "text-emerald-600" },
                  { v: `AED ${s.balance.toLocaleString()}`,      ar: "الرصيد المستحق للمورد",    en: "Outstanding Payable", cls: s.balance > 0 ? "text-amber-600" : "text-emerald-600" },
                  { v: "2",                                       ar: "فواتير غير مسددة بالكامل", en: "Partially Paid",      cls: "text-amber-600" },
                ].map(f => <Card key={f.ar} className="p-3 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? f.ar : f.en}</div></Card>)}
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">{isRTL ? "آخر النشاطات" : "Latest Activity"}</div>
                <div className="space-y-2">
                  {[
                    [isRTL ? "فاتورة شراء" : "Purchase Invoice", "PUR-2025-0042", "2025-01-28", "text-amber-600", "AED 3,470.83"],
                    [isRTL ? "دفعة للمورد" : "Supplier Payment", "PAY-001",        "2025-01-28", "text-emerald-600", "AED 3,470.83"],
                    [isRTL ? "خصم من المستحق" : "Deduction",     "DED-2025-001",   "2025-01-25", "text-blue-600", "AED 300"],
                  ].map(([type, ref, date, cls, amt]) => (
                    <div key={ref as string} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2"><span className={`font-bold ${cls}`}>{type}</span><span className="font-mono text-slate-400 text-xs">{ref}</span></div>
                      <div className="flex items-center gap-3"><span className="font-mono text-xs text-slate-400">{date}</span><span className={`font-mono font-black text-sm ${cls}`}>{amt}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-new")}><FileText size={13} />{isRTL ? "فاتورة شراء جديدة" : "New Purchase Invoice"}</Btn>
                <Btn size="sm" variant="outline" onClick={() => setTab("statement")}><FileText size={13} />{isRTL ? "كشف الحساب" : "Statement"}</Btn>
                <Btn size="sm" variant="outline" onClick={() => setShowSpecialPrice(true)}><Tag size={13} />{isRTL ? "أسعار الشراء الخاصة" : "Special Prices"}</Btn>
              </div>
            </div>
          )}

          {/* PURCHASE INVOICES */}
          {tab === "invoices" && (
            <div className="space-y-3">
              <div className="flex justify-end"><Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-new")}><Plus size={13} />{isRTL ? "إنشاء فاتورة شراء" : "New Purchase"}</Btn></div>
              {SUPP_INVOICES.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد فواتير شراء لهذا المورد" : "No purchase invoices for this supplier"}</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "رقم الفاتورة" : "Invoice #", isRTL ? "رقم فاتورة المورد" : "Supplier Inv#", isRTL ? "التاريخ" : "Date", isRTL ? "صافي المستحق" : "Net Payable", isRTL ? "المدفوع" : "Paid", isRTL ? "المتبقي" : "Remaining", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {SUPP_INVOICES.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{inv.id}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{inv.supplierInvNo}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{inv.date}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-amber-700">AED {inv.netPayable.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-emerald-600">AED {inv.paid.toLocaleString()}</td>
                          <td className="px-3 py-2.5">{inv.remaining > 0 ? <span className="font-mono font-black text-red-500 text-xs">AED {inv.remaining.toLocaleString()}</span> : <span className="text-emerald-500 text-xs font-bold">✓</span>}</td>
                          <td className="px-3 py-2.5"><PurchInvStatusBadge status={inv.status} lang={lang} /></td>
                          <td className="px-3 py-2.5"><div className="flex gap-1"><button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><Eye size={12} /></button><button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><Printer size={12} /></button>{inv.remaining > 0 && <button onClick={() => setShowPay(true)} className="p-1 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Wallet size={12} /></button>}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <div className="space-y-3">
              <div className="flex justify-end">{canPay ? <Btn size="sm" variant="amber" onClick={() => setShowPay(true)}><Plus size={13} />{isRTL ? "تسجيل دفعة للمورد" : "Record Payment"}</Btn> : <PermBtn lang={lang}><Plus size={13} />{isRTL ? "تسجيل دفعة للمورد" : "Record Payment"}</PermBtn>}</div>
              {SUPP_PAYMENTS.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد دفعات لهذا المورد" : "No payments for this supplier"}</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "رقم الإيصال" : "Receipt #", isRTL ? "التاريخ" : "Date", isRTL ? "المبلغ" : "Amount", isRTL ? "الطريقة" : "Method", isRTL ? "الفاتورة" : "Invoice", isRTL ? "المرجع" : "Ref", isRTL ? "بواسطة" : "By"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {SUPP_PAYMENTS.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{p.id}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{p.date}</td>
                          <td className="px-3 py-2.5 font-mono font-black text-emerald-600">AED {p.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs font-bold"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.method}</span></td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{p.linkedInv}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{p.ref || "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{p.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STATEMENT PREVIEW */}
          {tab === "statement" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-xs text-slate-400 font-semibold">{isRTL ? "معاينة الكشف — اضغط لفتح الكشف الكامل" : "Statement preview — click for full statement"}</p><Btn size="sm" variant="primary" onClick={() => onNavigate("supplier-statement")}><FileText size={13} />{isRTL ? "الكشف الكامل" : "Full Statement"}</Btn></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "التاريخ" : "Date", isRTL ? "النوع" : "Type", isRTL ? "المرجع" : "Ref", isRTL ? "مدين" : "Debit", isRTL ? "دائن" : "Credit", isRTL ? "الرصيد" : "Balance"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {SUPP_STMT.slice(0, 6).map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.date}</td>
                        <td className="px-3 py-2"><StmtTypeBadge type={m.type} lang={lang} /></td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{m.ref}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.debit > 0 ? <span className="text-amber-600 font-bold">AED {m.debit.toFixed(2)}</span> : "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{m.credit > 0 ? <span className="text-emerald-600 font-bold">AED {m.credit.toFixed(2)}</span> : "—"}</td>
                        <td className="px-3 py-2 font-mono font-black text-xs text-[#0F2C59]">AED {m.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SPECIAL PRICES */}
          {tab === "prices" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-semibold">{isRTL ? "سيتم اقتراح سعر المورد الخاص تلقائياً عند إنشاء فاتورة شراء لهذا المورد." : "Supplier special prices are automatically suggested when creating a purchase invoice."}</p>
                {canEdit ? <Btn size="sm" variant="primary" onClick={() => setShowSpecialPrice(true)}><Plus size={13} />{isRTL ? "إضافة سعر شراء خاص" : "Add Special Price"}</Btn> : <PermBtn lang={lang}><Plus size={13} />{isRTL ? "إضافة سعر" : "Add Price"}</PermBtn>}
              </div>
              {SUPP_PRICES.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد أسعار شراء خاصة. سيتم استخدام الأسعار الافتراضية." : "No special prices. Default prices will be used."}</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "المنتج" : "Product", isRTL ? "السعر الافتراضي" : "Default", isRTL ? "سعر المورد الخاص" : "Supplier Price", isRTL ? "نوع السعر" : "Type", isRTL ? "آخر تعديل" : "Last Edit", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {SUPP_PRICES.map((sp, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-800">{isRTL ? sp.productAr : sp.product}<span className="ms-2 text-[10px] font-black bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{isRTL ? "سعر خاص" : "Special"}</span></td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{sp.defaultPrice}</td>
                          <td className="px-3 py-2.5 font-mono font-black text-[#0F2C59]">{sp.specialPrice} {sp.priceType === "tray" ? (isRTL ? "/طبق" : "/tray") : sp.priceType === "piece" ? (isRTL ? "/حبة" : "/piece") : "/KG"}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{sp.priceType === "tray" ? (isRTL ? "سعر الطبق" : "Per Tray") : sp.priceType === "piece" ? (isRTL ? "سعر الحبة" : "Per Piece") : (isRTL ? "سعر الكيلو" : "Per KG")}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{sp.lastEdit}</td>
                          <td className="px-3 py-2.5"><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "نشط" : "Active"}</span></td>
                          <td className="px-3 py-2.5">{canEdit && <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={12} /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AGREEMENTS */}
          {tab === "agreements" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex-1 me-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "الاتفاقات هنا تساعد المستخدم عند إنشاء فاتورة شراء، ويمكن تعديلها داخل الفاتورة حسب الصلاحيات." : "These agreements help when creating a purchase invoice and can be modified inside the invoice based on permissions."}</p></div>
                {canEdit && <Btn size="sm" variant="primary"><Plus size={13} />{isRTL ? "إضافة اتفاق" : "Add Agreement"}</Btn>}
              </div>
              {SUPP_AGREEMENTS.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد اتفاقات محفوظة لهذا المورد." : "No agreements saved for this supplier."}</div> : (
                <div className="space-y-2">
                  {SUPP_AGREEMENTS.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{a.title}</div>
                        {a.note && <div className="text-xs text-slate-500">{a.note}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-[#0F2C59] text-sm">{a.value}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "نشط" : "Active"}</span>
                        {canEdit && <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={12} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEDUCTIONS */}
          {tab === "deductions" && (
            <div className="space-y-3">
              <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "خصم الشراء يقلل صافي المستحق للمورد. إلغاء الشراء قد يعكس المخزون والمستحقات." : "Purchase deductions reduce net payable. Cancellation may reverse inventory and payables."}</p></div>
              {SUPP_DEDUCTIONS.length === 0 ? <div className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد خصومات أو تسويات" : "No deductions or adjustments"}</div> : (
                <div className="space-y-2">
                  {SUPP_DEDUCTIONS.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                      <div><div className="font-bold text-blue-800 text-sm">{d.type}</div><div className="text-xs text-blue-600">{d.date} · {d.ref} · {isRTL ? "السبب:" : "Reason:"} {d.reason}</div></div>
                      <div className="text-end"><div className="font-mono font-black text-blue-700">−AED {d.amount}</div><div className="text-xs text-slate-400">{d.approvedBy}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AUDIT */}
          {tab === "audit" && (
            <div className="space-y-2">
              {[
                { t: "2025-01-28 14:30", a: isRTL ? "تسجيل دفعة للمورد" : "Payment Recorded",       u: "أحمد (مالك)",  d: "AED 3,470.83 — PAY-001",    dot: "bg-emerald-500" },
                { t: "2025-01-28 11:00", a: isRTL ? "اعتماد فاتورة شراء" : "Purchase Approved",     u: "أحمد (مالك)",  d: "PUR-2025-0042",              dot: "bg-[#0F2C59]" },
                { t: "2025-01-25 09:00", a: isRTL ? "خصم من المستحق" : "Deduction Applied",         u: "أحمد (مالك)",  d: "AED 300 — خصم نقل",          dot: "bg-blue-500" },
                { t: "2025-01-01 08:00", a: isRTL ? "إضافة المورد" : "Supplier Created",             u: "أحمد (مالك)",  d: "",                           dot: "bg-slate-400" },
              ].map((e, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${e.dot}`} />
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-700">{e.a}{e.d && <span className="ms-2 text-slate-400 font-normal text-xs">{e.d}</span>}</div><div className="text-xs text-slate-400">{e.u}</div></div>
                  <div className="font-mono text-xs text-slate-400 shrink-0">{e.t}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showPay && <SupplierPayModal lang={lang} supplierId={s.id} onClose={() => setShowPay(false)} />}
      {showSpecialPrice && <SupplierSpecialPriceModal lang={lang} onClose={() => setShowSpecialPrice(false)} />}
    </div>
  );
}

// ── MODAL: SUPPLIER PAYMENT ────────────────────────────────────────────────────
export function SupplierPayModal({ lang, supplierId, onClose }: { lang: Lang; supplierId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const s = SUPPLIERS.find(x => x.id === supplierId) || SUPPLIERS[0];
  const [mode, setMode] = useState<"invoice" | "account">("invoice");
  const [selectedInv, setSelectedInv] = useState(SUPP_INVOICES.find(i => i.remaining > 0)?.id || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState("2025-01-28");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [allocMethod, setAllocMethod] = useState("auto");
  const [success, setSuccess] = useState(false);

  const inv = SUPP_INVOICES.find(i => i.id === selectedInv);
  const amtNum = parseFloat(amount) || 0;
  const afterBalance = Math.max(0, (mode === "invoice" ? (inv?.remaining || 0) : s.balance) - amtNum);

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل الدفعة للمورد!" : "Supplier Payment Recorded!"}</h3>
        <p className="text-slate-400 font-semibold mb-2 font-mono">AED {amtNum.toLocaleString()}</p>
        <p className={`font-bold text-sm mb-6 ${afterBalance === 0 ? "text-emerald-600" : "text-amber-600"}`}>{afterBalance === 0 ? (isRTL ? "✓ تم تصفية الرصيد بالكامل" : "✓ Balance fully cleared") : (isRTL ? `المتبقي للمورد: AED ${afterBalance.toLocaleString()}` : `Remaining payable: AED ${afterBalance.toLocaleString()}`)}</p>
        <div className="flex gap-2"><Btn variant="primary" size="sm" className="flex-1 justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال" : "Print Receipt"}</Btn><Btn variant="outline" size="sm" className="flex-1 justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn></div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل دفعة للمورد" : "Record Supplier Payment"}</h3><p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? s.nameAr : s.nameEn}</p></div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([["invoice", isRTL ? "دفعة على فاتورة شراء محددة" : "Specific Invoice"], ["account", isRTL ? "دفعة على حساب المورد" : "Supplier Account"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${mode === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"}`}>{l}</button>
            ))}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "الرصيد المستحق للمورد" : "Supplier Balance"}</span><span className="font-mono font-black text-amber-600">AED {s.balance.toLocaleString()}</span></div>
            {mode === "invoice" && inv && <>
              <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "صافي المستحق على الفاتورة" : "Invoice Net Payable"}</span><span className="font-mono font-bold text-amber-700">AED {inv.netPayable.toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-black text-red-600">{isRTL ? "المتبقي على الفاتورة" : "Invoice Remaining"}</span><span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span></div>
            </>}
          </div>

          {mode === "invoice" && (
            <FSelect label={isRTL ? "اختر فاتورة الشراء" : "Select Purchase Invoice"} value={selectedInv} onChange={setSelectedInv}
              options={SUPP_INVOICES.filter(i => i.remaining > 0).map(i => ({ value: i.id, label: `${i.id} — AED ${i.remaining.toLocaleString()} ${isRTL ? "متبقي" : "remaining"}` }))} />
          )}

          {mode === "account" && (
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "طريقة التوزيع" : "Allocation Method"}</label>
              <div className="space-y-2">
                {[["auto", isRTL ? "توزيع تلقائي على أقدم فواتير غير مدفوعة" : "Auto-allocate to oldest invoices"], ["manual", isRTL ? "توزيع يدوي على الفواتير" : "Manual invoice allocation"], ["credit", isRTL ? "تسجيل كرصيد لنا عند المورد" : "Record as our credit with supplier"]].map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${allocMethod === v ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100"}`}>
                    <input type="radio" value={v} checked={allocMethod === v} onChange={() => setAllocMethod(v)} className="accent-[#0F2C59]" />
                    <span className="text-xs font-bold text-slate-700">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <FInput label={isRTL ? "المبلغ المدفوع (AED) *" : "Amount Paid (AED) *"} type="number" value={amount} onChange={setAmount} required />
          <FSelect label={isRTL ? "طريقة الدفع" : "Payment Method"} value={method} onChange={setMethod}
            options={[{ value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
          <FInput label={isRTL ? "تاريخ الدفع" : "Payment Date"} type="date" value={date} onChange={setDate} />
          <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference (Optional)"} value={ref} onChange={setRef} />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>

          {amtNum > 0 && (
            <div className={`rounded-xl p-3 border ${afterBalance === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${afterBalance === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `الرصيد بعد الدفع: AED ${afterBalance.toLocaleString()}` : `Balance after payment: AED ${afterBalance.toLocaleString()}`}
                {afterBalance === 0 && (isRTL ? " ✓ مسدّد بالكامل" : " ✓ Fully settled")}
              </div>
              {allocMethod === "credit" && amtNum > 0 && <p className="text-xs font-bold text-amber-600 mt-1">{isRTL ? "سيظهر رصيد لنا عند المورد" : "A credit balance will appear in your favor with this supplier"}</p>}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="amber" onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error(isRTL ? "أدخل المبلغ" : "Enter amount"); return; } setSuccess(true); }}><Check size={15} />{isRTL ? "تسجيل الدفعة" : "Record Payment"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: SUPPLIER STATEMENT ─────────────────────────────────────────────────
export function SupplierStatementScreen({ lang, supplierId, onNavigate }: { lang: Lang; supplierId: string; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const s = SUPPLIERS.find(x => x.id === supplierId) || SUPPLIERS[0];
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState("2025-01-31");
  const totalDebits = SUPP_STMT.reduce((sum, m) => sum + m.debit, 0);
  const totalCredits = SUPP_STMT.reduce((sum, m) => sum + m.credit, 0);
  const closingBalance = totalDebits - totalCredits;

  return (
    <div className="p-4 lg:p-8 max-w-screen-lg mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("supplier-profile")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          <span className="text-slate-400 font-bold text-sm">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة PDF" : "Print PDF"}</Btn>
          <Btn variant="secondary"><Download size={15} />{isRTL ? "تصدير Excel" : "Export Excel"}</Btn>
          <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
        </div>
      </div>

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
              <div className="text-xl font-black text-amber-300">{isRTL ? "كشف حساب مورد" : "Supplier Account Statement"}</div>
              <div className="text-sm font-bold text-white/70 mt-2">{isRTL ? "الفترة:" : "Period:"} {dateFrom} — {dateTo}</div>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">{isRTL ? "المورد / Supplier" : "Supplier / المورد"}</div>
            <div className="font-black text-slate-800 text-lg">{s.nameAr}</div>
            <div className="font-bold text-slate-500 text-sm">{s.nameEn}</div>
            <div className="text-sm text-slate-400">{s.phone}</div>
          </div>
          <div className={isRTL ? "" : "text-right"}>
            {s.trn && <><div className="text-xs font-black text-slate-400 uppercase mb-1">TRN</div><div className="font-mono text-slate-600 mb-2">{s.trn}</div></>}
            <div className="text-xs font-black text-slate-400 uppercase mb-1">{isRTL ? "الرصيد الافتتاحي" : "Opening Balance"}</div>
            <div className="font-mono font-black text-amber-600">AED {s.openingBalance.toLocaleString()}</div>
          </div>
        </div>

        {/* Note: debit/credit semantics for supplier */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex gap-2">
          <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-700">{isRTL ? "المدين = مبلغ مستحق للمورد علينا | الدائن = دفعة أو خصم يقلل المستحق" : "Debit = amount we owe supplier | Credit = payment or deduction that reduces payable"}</p>
        </div>

        {/* Statement Table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0F2C59]/8 border-b border-[#0F2C59]/20">
                {[isRTL ? "التاريخ" : "Date", isRTL ? "نوع الحركة" : "Type", isRTL ? "المرجع" : "Reference", isRTL ? "الوصف" : "Description", isRTL ? "مدين" : "Debit", isRTL ? "دائن" : "Credit", isRTL ? "الرصيد" : "Balance"].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 font-bold text-xs text-[#0F2C59] text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUPP_STMT.map((m, i) => (
                <tr key={m.id} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} border-b border-slate-100`}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.date}</td>
                  <td className="px-3 py-2"><StmtTypeBadge type={m.type} lang={lang} /></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{m.ref}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs font-semibold">{m.desc}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.debit > 0 ? <span className="text-amber-600 font-bold">AED {m.debit.toFixed(2)}</span> : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.credit > 0 ? <span className="text-emerald-600 font-bold">AED {m.credit.toFixed(2)}</span> : "—"}</td>
                  <td className="px-3 py-2 font-mono font-black text-xs text-[#0F2C59]">AED {m.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 pb-6">
          <div className="flex justify-end">
            <div className="w-80 border-2 border-[#0F2C59]/20 rounded-2xl overflow-hidden">
              {[[isRTL ? "إجمالي فواتير الشراء / Total Purchases" : "Total Purchases", `AED ${totalDebits.toFixed(2)}`, "text-amber-600 bg-amber-50/50"], [isRTL ? "إجمالي المدفوعات والخصومات" : "Total Payments & Deductions", `AED ${totalCredits.toFixed(2)}`, "text-emerald-600 bg-emerald-50/50"]].map(([l, v, c]) => (
                <div key={l} className={`flex justify-between px-4 py-2.5 border-b border-slate-200 ${c.split(" ")[1]}`}><span className="font-semibold text-slate-600 text-xs">{l}</span><span className={`font-mono font-black text-sm ${c.split(" ")[0]}`}>{v}</span></div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-[#0F2C59] items-center">
                <span className="font-black text-white text-sm">{isRTL ? "الرصيد الختامي المستحق للمورد" : "Closing Balance Payable"}</span>
                <span className="font-mono font-black text-amber-300 text-lg">AED {closingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: SUPPLIER SPECIAL PRICE ─────────────────────────────────────────────
function SupplierSpecialPriceModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const isRTL = lang === "ar";
  const [product, setProduct] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [priceType, setPriceType] = useState("piece");
  const [reason, setReason] = useState("");
  const PRODUCTS = ["900 GRAM","1000 GRAM","1100 GRAM","1200 GRAM","Liver 500G","Gizzard 500G","Heart 500G","Boneless Breast","Wings"];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "إضافة سعر شراء خاص" : "Add Special Purchase Price"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-[#0F2C59]/5 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "سيتم اقتراح هذا السعر تلقائياً عند إنشاء فاتورة شراء لهذا المورد." : "This price will be automatically suggested when creating a purchase invoice for this supplier."}</p></div>
          <FSelect label={isRTL ? "المنتج / الوزن *" : "Product / Weight *"} value={product} onChange={setProduct} required options={[{ value: "", label: isRTL ? "اختر المنتج" : "Select Product" }, ...PRODUCTS.map(p => ({ value: p, label: p }))]} />
          <FInput label={isRTL ? "سعر الشراء الخاص *" : "Special Purchase Price *"} type="number" value={specialPrice} onChange={setSpecialPrice} required />
          <FSelect label={isRTL ? "نوع السعر" : "Price Type"} value={priceType} onChange={setPriceType} options={[{ value: "kg", label: isRTL ? "سعر الكيلو" : "Per KG" }, { value: "piece", label: isRTL ? "سعر الحبة" : "Per Piece" }, { value: "carton", label: isRTL ? "سعر الكرتون" : "Per Carton" }, { value: "tray", label: isRTL ? "سعر الطبق" : "Per Tray" }]} />
          <FInput label={isRTL ? "السبب / الملاحظة" : "Reason / Note"} value={reason} onChange={setReason} />
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn onClick={() => { if (!product || !specialPrice) { toast.error(isRTL ? "يرجى اختيار المنتج والسعر" : "Select product and price"); return; } toast.success(isRTL ? "تم حفظ سعر الشراء الخاص" : "Special purchase price saved"); onClose(); }}><Check size={15} />{isRTL ? "حفظ السعر الخاص" : "Save Special Price"}</Btn>
        </div>
      </div>
    </div>
  );
}
