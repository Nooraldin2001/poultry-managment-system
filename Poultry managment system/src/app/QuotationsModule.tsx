// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — QUOTATIONS WORKFLOW MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Plus, X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, CheckCircle, Download, Printer, Eye,
  Pencil, FileText, Tag, Lock, RefreshCw, Calendar, Clock,
  TrendingUp, BarChart2, Users, Star, Zap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "quotations" | "quotations-new" | "quotation-detail" | "quotation-preview"
  | "quotation-convert" | "quotation-analytics" | "sales-new" | "sales-detail" | string;
type QuotStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted" | "cancelled";

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
        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{lang === "ar" ? "ميزة متقدمة" : "Premium"}</span>
      </div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl max-w-48 text-center`}>
        {lang === "ar" ? "إرسال واتساب متاح في باقة Pro أو Enterprise." : "WhatsApp sending available in Pro or Enterprise."}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface Quotation {
  id: string; date: string; customer: string; expiry: string;
  ct: number; kg: number; sub: number; vat: number; total: number;
  status: QuotStatus; user: string; convertedInv: string | null;
}
const QUOTATIONS: Quotation[] = [
  { id: "QUO-2026-00016", date: "2026-01-28", customer: "مطعم الخليج",         expiry: "2026-02-04", ct: 8,  kg: 83,  sub: 1244.25, vat: 59.71, total: 1253.96, status: "sent",      user: "محمد (كاشير)", convertedInv: null },
  { id: "QUO-2026-00015", date: "2026-01-25", customer: "سوبر ماركت المدينة", expiry: "2026-02-01", ct: 15, kg: 145, sub: 2150,    vat: 107.5, total: 2257.5,  status: "accepted",  user: "أحمد (مالك)",  convertedInv: null },
  { id: "QUO-2026-00014", date: "2026-01-20", customer: "مطبخ الإمارات",       expiry: "2026-01-27", ct: 6,  kg: 72,  sub: 1050,    vat: 0,     total: 1050,    status: "expired",   user: "محمد (كاشير)", convertedInv: null },
  { id: "QUO-2026-00013", date: "2026-01-18", customer: "Prime Fresh Meat LLC", expiry: "2026-01-25", ct: 20, kg: 210, sub: 3200,    vat: 160,   total: 3360,    status: "converted", user: "أحمد (مالك)",  convertedInv: "INV-2026-00051" },
  { id: "QUO-2026-00012", date: "2026-01-15", customer: "مطعم الخليج",         expiry: "2026-01-22", ct: 12, kg: 120, sub: 1740,    vat: 87,    total: 1827,    status: "rejected",  user: "أحمد (مالك)",  convertedInv: null },
  { id: "QUO-2026-00011", date: "2026-01-28", customer: "سوبر ماركت المدينة", expiry: "2026-02-04", ct: 0,  kg: 0,   sub: 0,       vat: 0,     total: 0,       status: "draft",     user: "محمد (كاشير)", convertedInv: null },
];

const Q_PRODUCTS = [
  { id: "qw900",  name: "900 GRAM",  nameAr: "900 جرام",  g: 900,  ppc: 10, price: 13.75, stock: 450, low: false, out: false },
  { id: "qw1000", name: "1000 GRAM", nameAr: "1000 جرام", g: 1000, ppc: 10, price: 14.00, stock: 180, low: true,  out: false },
  { id: "qw1100", name: "1100 GRAM", nameAr: "1100 جرام", g: 1100, ppc: 10, price: 14.50, stock: 350, low: false, out: false },
  { id: "qw1200", name: "1200 GRAM", nameAr: "1200 جرام", g: 1200, ppc: 10, price: 14.75, stock: 0,   low: false, out: true  },
  { id: "qw1300", name: "1300 GRAM", nameAr: "1300 جرام", g: 1300, ppc: 10, price: 15.00, stock: 180, low: false, out: false },
  { id: "qliver", name: "Liver",     nameAr: "كبدة",      g: 0,    ppc: 0,  price: 4.00,  stock: 85,  low: false, out: false },
  { id: "qgizz",  name: "Gizzard",   nameAr: "قانصة",     g: 0,    ppc: 0,  price: 4.00,  stock: 40,  low: false, out: false },
  { id: "qheart", name: "Heart",     nameAr: "قلب",       g: 0,    ppc: 0,  price: 5.00,  stock: 30,  low: false, out: false },
  { id: "qwings", name: "Wings",     nameAr: "أجنحة",     g: 0,    ppc: 0,  price: 14.00, stock: 90,  low: false, out: false },
  { id: "qbone",  name: "Bone",      nameAr: "عظام",      g: 0,    ppc: 0,  price: 0.00,  stock: 200, low: false, out: false, free: true },
];

const Q_CUSTOMERS = [
  { id: "qc1", name: "مطعم الخليج",         nameEn: "Al Khalij Restaurant",  type: "credit", balance: 12450, limit: 15000, specialPrice: true, freeProduct: true  },
  { id: "qc2", name: "سوبر ماركت المدينة", nameEn: "Al Madina Supermarket",  type: "credit", balance: 18700, limit: 15000, specialPrice: false, freeProduct: false },
  { id: "qc3", name: "مطبخ الإمارات",       nameEn: "Emirates Kitchen",       type: "cash",   balance: 0,     limit: 0,     specialPrice: false, freeProduct: false },
  { id: "qc4", name: "Prime Fresh Meat LLC", nameEn: "Prime Fresh Meat LLC",  type: "credit", balance: 4250,  limit: 20000, specialPrice: false, freeProduct: false },
];

const Q_SAMPLE_LINES = [
  { product: "1000 GRAM", productAr: "1000 جرام", ct: 5,  pcs: 50,  kg: 50, price: 14.75, discount: 0, amount: 737.50, free: false, priceChanged: false },
  { product: "1100 GRAM", productAr: "1100 جرام", ct: 3,  pcs: 30,  kg: 33, price: 14.75, discount: 0, amount: 486.75, free: false, priceChanged: true  },
  { product: "Liver",     productAr: "كبدة",      ct: 0,  pcs: 0,   kg: 5,  price: 4.00,  discount: 0, amount: 20.00,  free: false, priceChanged: false },
  { product: "Bone",      productAr: "عظام",      ct: 0,  pcs: 0,   kg: 3,  price: 0.00,  discount: 0, amount: 0.00,   free: true,  priceChanged: false },
];

const Q_STATUS_DIST = [
  { name: "مسودة",  nameEn: "Draft",     value: 2,  color: "#94a3b8" },
  { name: "مرسل",   nameEn: "Sent",      value: 3,  color: "#0F2C59" },
  { name: "مقبول",  nameEn: "Accepted",  value: 4,  color: "#22C55E" },
  { name: "مرفوض",  nameEn: "Rejected",  value: 2,  color: "#EF4444" },
  { name: "محول",   nameEn: "Converted", value: 5,  color: "#8B5CF6" },
  { name: "منتهي",  nameEn: "Expired",   value: 2,  color: "#F59E0B" },
];

const Q_BY_CUSTOMER = [
  { customer: "مطعم الخليج",  count: 8, value: 12400 },
  { customer: "سوبر ماركت",   count: 6, value: 9800  },
  { customer: "مطبخ الإمارات",count: 4, value: 5200  },
  { customer: "Prime Fresh",  count: 5, value: 14500 },
];

// ── HELPER COMPONENTS ──────────────────────────────────────────────────────────
function QuotStatusBadge({ status, lang }: { status: QuotStatus; lang: Lang }) {
  const cfg = {
    draft:     { bg: "bg-slate-100",  t: "text-slate-600",   ar: "مسودة",           en: "Draft" },
    sent:      { bg: "bg-blue-50",    t: "text-blue-700",    ar: "مرسل",            en: "Sent" },
    accepted:  { bg: "bg-emerald-50", t: "text-emerald-700", ar: "مقبول",           en: "Accepted" },
    rejected:  { bg: "bg-red-50",     t: "text-red-700",     ar: "مرفوض",           en: "Rejected" },
    expired:   { bg: "bg-amber-50",   t: "text-amber-700",   ar: "منتهي",           en: "Expired" },
    converted: { bg: "bg-violet-50",  t: "text-violet-700",  ar: "محول لفاتورة",   en: "Converted" },
    cancelled: { bg: "bg-slate-100",  t: "text-slate-500",   ar: "ملغي",            en: "Cancelled" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

function StockBadge({ stock, low, out, lang }: { stock: number; low: boolean; out: boolean; lang: Lang }) {
  if (out || stock === 0) return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{lang === "ar" ? "غير متوفر" : "Out of Stock"}</span>;
  if (low || stock < 50) return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{lang === "ar" ? "منخفض" : "Low"}</span>;
  return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{lang === "ar" ? "متوفر" : "Available"}</span>;
}

function ExpiryBadge({ expiry, lang }: { expiry: string; lang: Lang }) {
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{lang === "ar" ? "منتهي الصلاحية" : "Expired"}</span>;
  if (days <= 3) return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{lang === "ar" ? `ينتهي خلال ${days} أيام` : `Expires in ${days}d`}</span>;
  return <span className="text-[10px] font-semibold text-slate-400">{expiry}</span>;
}

// ── SCREEN: QUOTATIONS LIST ────────────────────────────────────────────────────
export function QuotationsListScreen({ lang, role, onNavigate, setSelectedQuotId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedQuotId: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const canCreate = true;

  const filtered = QUOTATIONS.filter(q => {
    const s = search.toLowerCase();
    return (!s || q.id.toLowerCase().includes(s) || q.customer.includes(search)) &&
      (filterStatus === "all" || q.status === filterStatus);
  });

  const openValue = QUOTATIONS.filter(q => q.status === "sent" || q.status === "accepted").reduce((s, q) => s + q.total, 0);
  const converted = QUOTATIONS.filter(q => q.status === "converted").length;
  const total = QUOTATIONS.length;
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const kpis = [
    { v: total.toString(),           ar: "إجمالي عروض الأسعار",      en: "Total Quotations",    bg: "bg-[#0F2C59]" },
    { v: QUOTATIONS.filter(q => q.status === "sent").length.toString(), ar: "عروض مفتوحة", en: "Open Quotes", bg: "bg-blue-500" },
    { v: QUOTATIONS.filter(q => q.status === "accepted").length.toString(), ar: "عروض مقبولة", en: "Accepted", bg: "bg-emerald-500" },
    { v: converted.toString(),        ar: "محولة لفواتير",             en: "Converted",           bg: "bg-violet-500" },
    { v: QUOTATIONS.filter(q => q.status === "expired").length.toString(), ar: "عروض منتهية", en: "Expired", bg: "bg-amber-500" },
    { v: `AED ${openValue.toLocaleString()}`, ar: "قيمة العروض المفتوحة", en: "Open Value",  bg: "bg-[#0F2C59]" },
    { v: QUOTATIONS.filter(q => new Date(q.date).getMonth() === new Date().getMonth()).length.toString(), ar: "عروض هذا الشهر", en: "This Month", bg: "bg-slate-500" },
    { v: `${convRate}%`,             ar: "معدل التحويل",               en: "Conversion Rate",     bg: "bg-emerald-600" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "عروض الأسعار" : "Quotations"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{isRTL ? "عروض الأسعار لا تؤثر على المخزون أو رصيد العميل" : "Quotations do not affect stock or customer balance"}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => onNavigate("quotation-analytics")}><BarChart2 size={13} />{isRTL ? "التحليلات" : "Analytics"}</Btn>
          <Btn variant="primary" onClick={() => onNavigate("quotations-new")}><Plus size={15} />{isRTL ? "عرض سعر جديد" : "New Quotation"}</Btn>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><FileText size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "بحث برقم العرض أو العميل..." : "Search by number or customer..."}
              className={`w-full py-2 ps-4 pe-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59]`} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="draft">{isRTL ? "مسودة" : "Draft"}</option>
            <option value="sent">{isRTL ? "مرسل" : "Sent"}</option>
            <option value="accepted">{isRTL ? "مقبول" : "Accepted"}</option>
            <option value="rejected">{isRTL ? "مرفوض" : "Rejected"}</option>
            <option value="expired">{isRTL ? "منتهي" : "Expired"}</option>
            <option value="converted">{isRTL ? "محول" : "Converted"}</option>
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
                  {[isRTL?"رقم العرض":"Quotation #",isRTL?"التاريخ":"Date",isRTL?"العميل":"Customer",isRTL?"تاريخ الانتهاء":"Expiry","KG",isRTL?"الإجمالي":"Total","VAT",isRTL?"النهائي":"Grand Total",isRTL?"الحالة":"Status",isRTL?"إجراءات":"Actions"].map((h,i)=>(
                    <th key={i} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-[#0F2C59] text-xs">{q.id}</div>
                      {q.convertedInv && <div className="text-[10px] text-violet-600 font-bold">→ {q.convertedInv}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{q.date}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 text-sm">{q.customer}</td>
                    <td className="px-4 py-3"><ExpiryBadge expiry={q.expiry} lang={lang} /></td>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs">{q.kg > 0 ? `${q.kg}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-700 text-xs">{q.sub > 0 ? `AED ${q.sub.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{q.vat > 0 ? `AED ${q.vat.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-3 font-mono font-black text-[#0F2C59] text-xs">{q.total > 0 ? `AED ${q.total.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3"><QuotStatusBadge status={q.status} lang={lang} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedQuotId(q.id); onNavigate("quotation-detail"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all"><Eye size={13} /></button>
                        {(q.status === "draft" || q.status === "sent") && <button onClick={() => onNavigate("quotations-new")} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Pencil size={13} /></button>}
                        <button onClick={() => { setSelectedQuotId(q.id); onNavigate("quotation-preview"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Printer size={13} /></button>
                        {(q.status === "sent" || q.status === "accepted") && q.status !== "converted" && (
                          <button onClick={() => { setSelectedQuotId(q.id); onNavigate("quotation-convert"); }} className="text-xs px-2 py-1 bg-violet-500 text-white rounded-lg font-bold hover:bg-violet-600">{isRTL ? "تحويل" : "Convert"}</button>
                        )}
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
          {filtered.map(q => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono font-bold text-[#0F2C59] text-sm">{q.id}</div>
                  <div className="font-bold text-slate-800 text-sm">{q.customer}</div>
                  {q.convertedInv && <div className="text-[10px] text-violet-600 font-bold">→ {q.convertedInv}</div>}
                </div>
                <QuotStatusBadge status={q.status} lang={lang} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-sm">{q.total > 0 ? `${q.total.toLocaleString()}` : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "الإجمالي" : "Total"}</div></div>
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-slate-600 text-sm">{q.kg > 0 ? `${q.kg}` : "—"}</div><div className="text-[10px] text-slate-400 font-bold">KG</div></div>
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono text-slate-500 text-xs mt-1"><ExpiryBadge expiry={q.expiry} lang={lang} /></div></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" variant="secondary" onClick={() => { setSelectedQuotId(q.id); onNavigate("quotation-detail"); }}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
                {(q.status === "sent" || q.status === "accepted") && q.status !== "converted" && <Btn size="sm" variant="amber" onClick={() => { setSelectedQuotId(q.id); onNavigate("quotation-convert"); }}><FileText size={13} />{isRTL ? "تحويل لفاتورة" : "Convert"}</Btn>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="p-14 text-center"><FileText size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا توجد عروض أسعار حالياً" : "No quotations yet"}</h3><Btn onClick={() => onNavigate("quotations-new")}><Plus size={15} />{isRTL ? "إنشاء أول عرض سعر" : "Create First Quotation"}</Btn></Card>
      )}
    </div>
  );
}

// ── SCREEN: NEW QUOTATION ──────────────────────────────────────────────────────
export function NewQuotationScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canEditPrice = role === "owner";
  const canApplyDiscount = role === "owner" || role === "accountant";

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<{ id: string; productId: string; cartons: number; pcs: number; kg: number; price: number; discount: number; amount: number; free: boolean; priceChanged: boolean; kgOverride: boolean }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [expiry, setExpiry] = useState("2026-02-04");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(isRTL ? "فوري" : "Immediate");
  const [notes, setNotes] = useState("");
  const [vatEnabled, setVatEnabled] = useState(true);
  const [discountType, setDiscountType] = useState<"none" | "pct" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [flowState, setFlowState] = useState<"form" | "success">("form");
  const [showSendModal, setShowSendModal] = useState(false);

  const customer = Q_CUSTOMERS.find(c => c.id === customerId);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountAmt = discountType === "pct" ? subtotal * (parseFloat(discountValue) || 0) / 100 : discountType === "fixed" ? parseFloat(discountValue) || 0 : 0;
  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const vatAmt = vatEnabled ? Math.round(afterDiscount * 5) / 100 : 0;
  const grandTotal = afterDiscount + vatAmt;
  const totalCartons = lines.reduce((s, l) => s + l.cartons, 0);
  const totalKg = lines.reduce((s, l) => s + l.kg, 0);

  const addLine = (productId: string) => {
    const prod = Q_PRODUCTS.find(p => p.id === productId);
    if (!prod) return;
    setLines(prev => [...prev, { id: Date.now().toString(), productId, cartons: 0, pcs: 0, kg: 0, price: prod.price, discount: 0, amount: 0, free: prod.free || false, priceChanged: false, kgOverride: false }]);
    setSelectedProduct("");
  };

  const updateLine = (id: string, field: string, value: number | boolean) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [field]: value };
      const prod = Q_PRODUCTS.find(p => p.id === l.productId);
      if (field === "cartons" && prod && !u.kgOverride) { u.pcs = u.cartons * prod.ppc; u.kg = Math.round(u.pcs * prod.g / 100) / 10; }
      u.amount = u.free ? 0 : Math.round(u.kg * u.price * 100) / 100 - u.discount;
      return u;
    }));
  };

  if (flowState === "success") return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div>
        <h2 className="text-2xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم حفظ عرض السعر!" : "Quotation Saved!"}</h2>
        <div className="font-mono text-slate-400 mb-6">QUO-2026-00017</div>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" variant="primary" onClick={() => onNavigate("quotation-preview")} className="justify-center"><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
          <PremiumBtn lang={lang}>{isRTL ? "إرسال واتساب" : "WhatsApp"}</PremiumBtn>
          <Btn size="sm" variant="amber" onClick={() => onNavigate("quotation-convert")} className="justify-center"><FileText size={13} />{isRTL ? "تحويل لفاتورة" : "Convert"}</Btn>
          <Btn size="sm" variant="outline" onClick={() => onNavigate("quotations")} className="justify-center">{isRTL ? "قائمة العروض" : "List"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("quotations")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "عرض سعر جديد" : "New Quotation"}</h2>
          <div className="flex items-center gap-2 mt-0.5"><span className="font-mono text-xs text-slate-400">QUO-2026-00017</span><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{isRTL ? "مسودة" : "Draft"}</span></div>
        </div>
      </div>

      {/* Important info banner */}
      <div className="mb-5 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm font-bold text-blue-700 leading-relaxed">{isRTL ? "عرض السعر لا يخصم من المخزون ولا يضيف رصيد على العميل. يتم خصم المخزون فقط عند تحويله إلى فاتورة بيع واعتماد الفاتورة." : "Quotation does not deduct stock or update customer balance. Stock is only deducted when converted to a sales invoice and approved."}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* LEFT */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* A. Customer */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "أ. العميل" : "A. Customer"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "اختر العميل *" : "Select Customer *"}</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#0F2C59] outline-none font-semibold text-slate-700">
                  <option value="">{isRTL ? "— اختر العميل —" : "— Select Customer —"}</option>
                  {Q_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name : c.nameEn}</option>)}
                </select>
              </div>
              {customer && (
                <div className="space-y-2">
                  {customer.specialPrice && <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2"><Star size={13} className="text-violet-500 shrink-0" /><span className="text-xs font-bold text-violet-700">{isRTL ? "يوجد سعر خاص لهذا العميل — سيتم تطبيقه تلقائياً" : "Customer has a special price agreement — auto-applied"}</span></div>}
                  {customer.freeProduct && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"><Star size={13} className="text-emerald-500 shrink-0" /><span className="text-xs font-bold text-emerald-700">{isRTL ? "يوجد اتفاق منتجات مجانية لهذا العميل" : "Customer has a free product agreement"}</span></div>}
                  {customer.type === "credit" && customer.balance > customer.limit && <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><AlertTriangle size={13} className="text-amber-500 shrink-0" /><span className="text-xs font-bold text-amber-700">{isRTL ? "العميل تجاوز الحد الائتماني. يمكن إنشاء عرض السعر، ولكن قد يتم منع اعتماد الفاتورة لاحقاً." : "Customer exceeded credit limit. Quotation can be created, but invoice approval may be blocked later."}</span></div>}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3">
                    <div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "النوع" : "Type"}</div><div className="text-xs font-bold text-slate-700">{customer.type === "credit" ? (isRTL ? "آجل" : "Credit") : (isRTL ? "كاش" : "Cash")}</div></div>
                    <div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "الرصيد" : "Balance"}</div><div className="text-xs font-mono font-bold text-slate-700">AED {customer.balance.toLocaleString()}</div></div>
                    {customer.limit > 0 && <div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "الحد" : "Limit"}</div><div className="text-xs font-mono font-bold text-slate-700">AED {customer.limit.toLocaleString()}</div></div>}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* B. Products */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "ب. المنتجات" : "B. Products"}</h3>
              <select value={selectedProduct} onChange={e => { if (e.target.value) addLine(e.target.value); }}
                className="px-3 py-1.5 rounded-xl border border-[#0F2C59]/20 text-sm bg-white font-bold text-[#0F2C59] focus:border-[#0F2C59] outline-none cursor-pointer">
                <option value="">{isRTL ? "+ إضافة منتج" : "+ Add Product"}</option>
                <optgroup label={isRTL ? "أوزان الدجاج" : "Chicken Weights"}>
                  {Q_PRODUCTS.filter(p => p.g > 0).map(p => <option key={p.id} value={p.id}>{p.name} — AED {p.price}/KG</option>)}
                </optgroup>
                <optgroup label={isRTL ? "الأجزاء" : "Parts"}>
                  {Q_PRODUCTS.filter(p => p.g === 0).map(p => <option key={p.id} value={p.id}>{isRTL ? p.nameAr : p.name}</option>)}
                </optgroup>
              </select>
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                <FileText size={26} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">{isRTL ? "أضف المنتجات لعرض السعر" : "Add products to the quotation"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden lg:grid gap-2 px-2 pb-2 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wide" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                  <span>{isRTL ? "المنتج" : "Product"}</span>
                  <span className="text-center">{isRTL ? "كرتون" : "Ct"}</span>
                  <span className="text-center">{isRTL ? "حبة" : "Pcs"}</span>
                  <span className="text-center">KG</span>
                  <span className="text-center">{isRTL ? "السعر" : "Price"}</span>
                  <span className="text-center">{isRTL ? "خصم" : "Disc."}</span>
                  <span className="text-center">{isRTL ? "المبلغ" : "Amount"}</span>
                  <span />
                </div>
                {lines.map(line => {
                  const prod = Q_PRODUCTS.find(p => p.id === line.productId)!;
                  return (
                    <div key={line.id} className={`rounded-2xl border-2 p-3 transition-all ${line.free ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 bg-slate-50/50"}`}>
                      <div className="hidden lg:grid gap-2 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                        <div>
                          <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <StockBadge stock={prod.stock} low={prod.low} out={prod.out} lang={lang} />
                            {line.free && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{isRTL ? "منتج مجاني" : "Free Product"}</span>}
                            {line.priceChanged && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{isRTL ? "تم تعديل السعر" : "Price modified"}</span>}
                          </div>
                        </div>
                        <input type="number" min="0" value={line.cartons || ""} onChange={e => updateLine(line.id, "cartons", parseFloat(e.target.value)||0)} disabled={prod.g === 0} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white disabled:bg-slate-100" />
                        <input type="number" min="0" value={line.pcs || ""} onChange={e => updateLine(line.id, "pcs", parseFloat(e.target.value)||0)} disabled={prod.g === 0} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white disabled:bg-slate-100" />
                        <input type="number" min="0" step="0.1" value={line.kg || ""} onChange={e => { updateLine(line.id, "kgOverride", true); updateLine(line.id, "kg", parseFloat(e.target.value)||0); }} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white" />
                        <input type="number" min="0" step="0.01" value={line.price || ""} onChange={e => { updateLine(line.id, "priceChanged", true); updateLine(line.id, "price", parseFloat(e.target.value)||0); }} disabled={!canEditPrice || line.free} className={`w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none ${!canEditPrice || line.free ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`} />
                        <input type="number" min="0" value={line.discount || ""} onChange={e => updateLine(line.id, "discount", parseFloat(e.target.value)||0)} disabled={!canApplyDiscount} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white disabled:bg-slate-100" />
                        <div className={`text-center font-mono font-black text-sm ${line.free ? "text-emerald-600" : "text-[#0F2C59]"}`}>{line.free ? (isRTL ? "مجاني" : "Free") : line.amount > 0 ? line.amount.toFixed(2) : "—"}</div>
                        <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><X size={14} /></button>
                      </div>
                      {/* Mobile */}
                      <div className="lg:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                          <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500"><X size={14} /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {!prod.g && <><div><label className="text-[10px] text-slate-400">KG</label><input type="number" value={line.kg||""} onChange={e => updateLine(line.id,"kg",parseFloat(e.target.value)||0)} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div></>}
                          {prod.g > 0 && <><div><label className="text-[10px] text-slate-400">{isRTL?"كرتون":"Ct"}</label><input type="number" value={line.cartons||""} onChange={e => updateLine(line.id,"cartons",parseFloat(e.target.value)||0)} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div><div><label className="text-[10px] text-slate-400">KG</label><input type="number" value={line.kg||""} onChange={e => updateLine(line.id,"kg",parseFloat(e.target.value)||0)} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div></>}
                          <div><label className="text-[10px] text-slate-400">{isRTL?"السعر":"Price"}</label><input type="number" value={line.price||""} onChange={e => updateLine(line.id,"price",parseFloat(e.target.value)||0)} disabled={!canEditPrice||line.free} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white disabled:bg-slate-100" /></div>
                        </div>
                        <div className={`text-end font-mono font-black text-[#0F2C59] text-sm`}>{line.free ? (isRTL ? "مجاني" : "Free") : line.amount > 0 ? `AED ${line.amount.toFixed(2)}` : "—"}</div>
                      </div>
                      {/* Out of stock warning */}
                      {prod.out && <div className="mt-2 flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5"><AlertTriangle size={11} className="text-amber-500 shrink-0" /><span className="text-[10px] font-bold text-amber-700">{isRTL ? "المخزون الحالي غير كافٍ، لكن يمكن حفظ عرض السعر. سيتم التحقق عند التحويل للفاتورة." : "Current stock insufficient, but quotation can be saved. Stock will be checked on conversion."}</span></div>}
                    </div>
                  );
                })}
                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3">
                  {[[totalCartons, isRTL?"كرتون":"Cartons"], [lines.reduce((s,l)=>s+l.pcs,0), isRTL?"حبة":"Pieces"], [`${totalKg.toFixed(1)} KG`, isRTL?"إجمالي الكيلو":"Total KG"]].map(([v,l])=>(
                    <div key={l as string} className="text-center"><div className="text-xl font-black font-mono text-[#0F2C59]">{v}</div><div className="text-xs text-slate-400 font-bold">{l}</div></div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* E. Discount */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "هـ. الخصم" : "E. Discount"}</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([["none", isRTL?"لا يوجد":"None"], ["pct", isRTL?"نسبة %":"Percentage"], ["fixed", isRTL?"مبلغ ثابت":"Fixed AED"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => canApplyDiscount ? setDiscountType(v) : null} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${discountType === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500"} ${!canApplyDiscount ? "cursor-not-allowed opacity-60" : ""}`}>{l}</button>
              ))}
            </div>
            {discountType !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <FInput label={discountType === "pct" ? (isRTL ? "نسبة الخصم %" : "Discount %") : (isRTL ? "مبلغ الخصم AED" : "Discount Amount AED")} type="number" value={discountValue} onChange={setDiscountValue} />
                <div className="bg-slate-50 rounded-xl p-3 flex flex-col justify-center">
                  <div className="text-xs text-slate-400 font-bold mb-0.5">{isRTL ? "قيمة الخصم" : "Discount Value"}</div>
                  <div className="font-mono font-black text-amber-600">−AED {discountAmt.toFixed(2)}</div>
                </div>
              </div>
            )}
          </Card>

          {/* G. Terms */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "و. الشروط والأحكام" : "F. Terms & Conditions"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FInput label={isRTL ? "تاريخ الانتهاء *" : "Expiry Date *"} type="date" value={expiry} onChange={setExpiry} required />
              <FInput label={isRTL ? "شروط التسليم" : "Delivery Terms"} value={deliveryTerms} onChange={setDeliveryTerms} placeholder={isRTL ? "تسليم من المخزن" : "Ex-warehouse"} />
              <FInput label={isRTL ? "شروط الدفع" : "Payment Terms"} value={paymentTerms} onChange={setPaymentTerms} />
              <div className="sm:col-span-2"><FInput label={isRTL ? "ملاحظات ظاهرة للعميل" : "Customer-Visible Notes"} value={notes} onChange={setNotes} /></div>
            </div>
            <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-0.5">
              <p className="font-bold text-slate-600">{isRTL ? "الشروط الافتراضية:" : "Default Terms:"}</p>
              {[
                isRTL ? "الأسعار صالحة حتى تاريخ الانتهاء الموضح." : "Prices valid until stated expiry date.",
                isRTL ? "الكميات حسب توفر المخزون وقت إصدار الفاتورة." : "Quantities subject to stock availability at invoice time.",
                isRTL ? "الأسعار لا تشمل أي مصاريف إضافية إلا إذا تم ذكرها." : "Prices do not include additional charges unless stated.",
              ].map((t, i) => <p key={i}>• {t}</p>)}
            </div>
          </Card>
        </div>

        {/* RIGHT — Summary */}
        <div className="lg:w-80 xl:w-96 space-y-4 shrink-0">
          <Card className="p-5 lg:sticky lg:top-20">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص عرض السعر" : "Quotation Summary"}</h3>
            <div className="space-y-2 mb-4">
              {[
                [isRTL ? "الإجمالي قبل الخصم" : "Subtotal", `AED ${subtotal.toFixed(2)}`, "text-slate-700"],
                ...(discountAmt > 0 ? [[isRTL ? "الخصم" : "Discount", `−AED ${discountAmt.toFixed(2)}`, "text-amber-600"]] : []),
                ...(discountAmt > 0 ? [[isRTL ? "بعد الخصم" : "After Discount", `AED ${afterDiscount.toFixed(2)}`, "text-slate-700"]] : []),
              ].map(([l, v, c]) => <div key={l} className="flex items-center justify-between text-sm"><span className="text-slate-500 font-semibold">{l}</span><span className={`font-mono font-bold ${c}`}>{v}</span></div>)}
            </div>
            {/* VAT */}
            <div className="border-t border-slate-100 pt-3 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">{isRTL ? "ضريبة القيمة المضافة 5%" : "VAT 5%"}</span>
                <button onClick={() => setVatEnabled(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${vatEnabled ? "bg-[#0F2C59]" : "bg-slate-300"}`}><span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${vatEnabled ? "translate-x-5" : "translate-x-0"}`} /></button>
              </div>
              {vatEnabled && <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-semibold">{isRTL ? "الضريبة 5%" : "VAT 5%"}</span><span className="font-mono font-bold text-slate-700">AED {vatAmt.toFixed(2)}</span></div>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 mb-4">
              <span className="font-black text-[#0F2C59]">{isRTL ? "الإجمالي النهائي" : "Grand Total"}</span>
              <span className="font-mono font-black text-[#0F2C59] text-xl">AED {grandTotal.toFixed(2)}</span>
            </div>
            {/* VAT note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-1.5 mb-3">
              <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[10px] font-bold text-amber-700">{isRTL ? "عرض سعر وليس فاتورة ضريبية" : "This is a quotation, NOT a tax invoice"}</span>
            </div>
            <div className="text-xs text-slate-400 font-semibold">{isRTL ? `ينتهي في: ${expiry}` : `Expires: ${expiry}`}</div>
          </Card>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap gap-3 justify-between shadow-lg z-10">
        <Btn variant="outline" onClick={() => onNavigate("quotations")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => toast.success(isRTL ? "تم حفظ المسودة ✓" : "Draft saved ✓")}>{isRTL ? "حفظ كمسودة" : "Save Draft"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("quotation-preview")}><Eye size={14} />{isRTL ? "معاينة" : "Preview"}</Btn>
          <Btn variant="amber" onClick={() => setShowSendModal(true)}>{isRTL ? "إرسال للعميل" : "Send to Customer"}</Btn>
          <Btn variant="green" disabled={!customerId || lines.length === 0} onClick={() => { toast.success(isRTL ? "تم حفظ عرض السعر!" : "Quotation saved!"); setFlowState("success"); }}><Check size={14} />{isRTL ? "حفظ وإرسال" : "Save & Send"}</Btn>
        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-black text-[#0F2C59] text-lg mb-3">{isRTL ? "إرسال عرض السعر للعميل" : "Send Quotation to Customer"}</h3>
            <p className="text-sm text-slate-500 mb-4">{isRTL ? "اختر طريقة الإرسال:" : "Choose sending method:"}</p>
            <div className="space-y-2 mb-4">
              <Btn variant="primary" className="w-full justify-center" onClick={() => { toast.success(isRTL ? "تم الإرسال" : "Sent"); setShowSendModal(false); }}><Printer size={15} />{isRTL ? "طباعة / PDF" : "Print / PDF"}</Btn>
              <PremiumBtn lang={lang}>{isRTL ? "إرسال عبر واتساب" : "Send via WhatsApp"}</PremiumBtn>
              <Btn variant="outline" className="w-full justify-center" onClick={() => { toast.info(isRTL ? "تم نسخ الرسالة" : "Message copied"); setShowSendModal(false); }}>{isRTL ? "نسخ الرسالة يدوياً" : "Copy Message Manually"}</Btn>
            </div>
            <Btn variant="ghost" className="w-full justify-center" onClick={() => setShowSendModal(false)}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN: QUOTATION PREVIEW ──────────────────────────────────────────────────
export function QuotationPreviewScreen({ lang, onNavigate, quotId }: { lang: Lang; onNavigate: (s: TenantScreen) => void; quotId: string }) {
  const isRTL = lang === "ar";
  const q = QUOTATIONS.find(x => x.id === quotId) || QUOTATIONS[0];

  return (
    <div className="p-4 lg:p-8 max-w-screen-lg mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("quotation-detail")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1" />
        <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn variant="secondary"><Download size={15} />PDF</Btn>
        <PremiumBtn lang={lang}>{isRTL ? "واتساب" : "WhatsApp"}</PremiumBtn>
        {q.status !== "converted" && <Btn variant="amber" onClick={() => onNavigate("quotation-convert")}><FileText size={15} />{isRTL ? "تحويل لفاتورة بيع" : "Convert to Invoice"}</Btn>}
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0F2C59] text-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div><div className="text-2xl font-black">شركة الوطنية للدواجن</div><div className="text-sm font-bold text-white/70">Al Wataniyah Poultry Company LLC</div><div className="text-sm text-white/55 mt-1">TRN: 100345678901203</div></div>
            <div className="text-end">
              <div className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">{isRTL ? "عرض سعر وليس فاتورة ضريبية" : "QUOTATION — NOT A TAX INVOICE"}</div>
              <div className="text-2xl font-black text-white">{isRTL ? "عرض سعر" : "QUOTATION"}</div>
              <div className="text-sm font-bold text-white/70 mt-1">{q.id}</div>
              <div className="text-xs text-white/60">{isRTL ? "التاريخ:" : "Date:"} {q.date} · {isRTL ? "ينتهي:" : "Expires:"} {q.expiry}</div>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase mb-1">{isRTL ? "العميل / Customer" : "Customer / العميل"}</div>
            <div className="font-black text-slate-800 text-lg">{q.customer}</div>
          </div>
          <div className={isRTL ? "" : "text-right"}>
            <QuotStatusBadge status={q.status} lang={lang} />
            <div className="text-xs text-slate-400 mt-1">{isRTL ? "أُنشئ بواسطة:" : "Created by:"} {q.user}</div>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0F2C59]/8 border-b-2 border-[#0F2C59]/20">
                {[[isRTL?"المنتج":"Product","Product / المنتج"],[isRTL?"كرتون":"Ct","Ct/كرتون"],[isRTL?"حبة":"Pcs","Pcs/حبة"],["KG","كيلو"],[isRTL?"السعر":"Price","AED/KG"],[isRTL?"خصم":"Disc.","خصم"],[isRTL?"المبلغ":"Amount","AED"]].map(([a,b],i)=>(
                  <th key={i} className="px-3 py-2.5 text-center font-bold text-xs text-[#0F2C59]"><div>{isRTL?a:b}</div><div className="text-slate-400 font-normal text-[10px]">{isRTL?b:a}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Q_SAMPLE_LINES.map((l, i) => (
                <tr key={i} className={`${i%2===0?"bg-white":"bg-slate-50/50"} border-b border-slate-100`}>
                  <td className="px-3 py-2.5 font-bold text-slate-800 text-center">{isRTL?l.productAr:l.product}{l.free && <span className="ms-2 text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{isRTL?"مجاني":"Free"}</span>}{l.priceChanged && <span className="ms-1 text-[10px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL?"سعر معدّل":"Modified"}</span>}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.ct||"—"}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.pcs||"—"}</td>
                  <td className="px-3 py-2.5 font-mono text-center font-bold text-slate-700">{l.kg}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.free?"0.00":l.price.toFixed(2)}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-amber-600">{l.discount>0?l.discount.toFixed(2):"—"}</td>
                  <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{l.free?(isRTL?"مجاني":"Free"):l.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 pb-8">
          <div className="flex justify-end mb-5">
            <div className="w-72 border-2 border-[#0F2C59]/20 rounded-2xl overflow-hidden">
              {[[isRTL?"الإجمالي قبل الخصم":"Subtotal","AED 1,244.25","bg-slate-50 text-slate-700"],[isRTL?"الخصم":"Discount","−AED 50.00","bg-amber-50 text-amber-600"],[isRTL?"ضريبة 5% / VAT 5%":"VAT 5% / ضريبة","AED 59.71","bg-slate-50 text-slate-700"]].map(([l,v,c])=>(
                <div key={l} className={`flex justify-between px-4 py-2.5 border-b border-slate-200 ${c.split(" ")[0]}`}><span className={`font-semibold text-xs ${c.split(" ").slice(1).join(" ")}`}>{l}</span><span className={`font-mono font-bold ${c.split(" ").slice(1).join(" ")}`}>{v}</span></div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-[#0F2C59] items-center"><span className="font-black text-white text-sm">{isRTL?"الإجمالي النهائي / Grand Total":"Grand Total / الإجمالي النهائي"}</span><span className="font-mono font-black text-[#22C55E] text-lg">AED 1,253.96</span></div>
            </div>
          </div>
          {/* Terms */}
          <div className="bg-slate-50 rounded-xl p-3 mb-5 text-xs text-slate-500 space-y-0.5">
            <p className="font-bold text-slate-600">{isRTL?"الشروط والأحكام:":"Terms & Conditions:"}</p>
            {["الأسعار صالحة حتى تاريخ الانتهاء الموضح.","الكميات حسب توفر المخزون وقت إصدار الفاتورة.","الأسعار لا تشمل أي مصاريف إضافية إلا إذا تم ذكرها."].map((t,i)=><p key={i}>• {t}</p>)}
          </div>
          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8">
            {[isRTL?"ختم الشركة / Company Stamp":"Company Stamp / ختم الشركة", isRTL?"توقيع العميل / Customer Approval":"Customer Approval / توقيع العميل"].map(l=>(
              <div key={l} className="border-t-2 border-slate-300 pt-3 text-center"><div className="text-xs font-black text-slate-400 uppercase tracking-wide">{l}</div><div className="h-12" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: QUOTATION DETAIL ───────────────────────────────────────────────────
export function QuotationDetailScreen({ lang, role, onNavigate, quotId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; quotId: string;
}) {
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("overview");
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const q = QUOTATIONS.find(x => x.id === quotId) || QUOTATIONS[0];
  const daysLeft = Math.ceil((new Date(q.expiry).getTime() - Date.now()) / 86400000);
  const isExpired = daysLeft < 0;

  const TABS = [
    { k: "overview", ar: "العرض", en: "Overview" },
    { k: "products", ar: "المنتجات", en: "Products" },
    { k: "log",      ar: "السجل",   en: "Activity Log" },
    { k: "convert",  ar: "التحويل لفاتورة", en: "Convert to Invoice" },
    { k: "notes",    ar: "الملاحظات والمرفقات", en: "Notes & Attachments" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("quotations")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{q.id}</h2>
            <QuotStatusBadge status={q.status} lang={lang} />
            {isExpired && q.status !== "converted" && q.status !== "cancelled" && <span className="text-xs font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{isRTL ? "منتهي الصلاحية" : "Expired"}</span>}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{q.customer} · {q.date}</div>
        </div>
      </div>

      {/* Expired warning */}
      {isExpired && q.status !== "converted" && q.status !== "cancelled" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <Clock size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1"><div className="font-black text-amber-700">{isRTL ? "انتهت صلاحية عرض السعر" : "Quotation has expired"}</div><p className="text-xs font-bold text-amber-600 mt-0.5">{isRTL ? "يمكنك تحويله بعد تأكيد الأسعار، أو تكرار العرض بتاريخ جديد." : "You can convert it after confirming prices, or duplicate with a new expiry date."}</p></div>
          <Btn size="sm" variant="outline" onClick={() => onNavigate("quotations-new")}><RefreshCw size={13} />{isRTL ? "تكرار العرض" : "Duplicate"}</Btn>
        </div>
      )}

      {/* Action bar */}
      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Btn size="sm" variant="primary" onClick={() => onNavigate("quotation-preview")}><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
        {(q.status === "draft" || q.status === "sent") && q.status !== "converted" && <Btn size="sm" variant="secondary" onClick={() => onNavigate("quotations-new")}><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
        {q.status === "sent" && <Btn size="sm" variant="green" onClick={() => setShowAcceptModal(true)}><CheckCircle size={13} />{isRTL ? "قبول العرض" : "Accept"}</Btn>}
        {q.status === "sent" && <Btn size="sm" variant="danger" onClick={() => setShowRejectModal(true)}><X size={13} />{isRTL ? "رفض العرض" : "Reject"}</Btn>}
        {(q.status === "sent" || q.status === "accepted") && q.status !== "converted" && <Btn size="sm" variant="amber" onClick={() => onNavigate("quotation-convert")}><FileText size={13} />{isRTL ? "تحويل لفاتورة" : "Convert to Invoice"}</Btn>}
        <Btn size="sm" variant="outline"><RefreshCw size={13} />{isRTL ? "تكرار العرض" : "Duplicate"}</Btn>
        <PremiumBtn lang={lang}>{isRTL ? "إرسال واتساب" : "WhatsApp"}</PremiumBtn>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ar:"الإجمالي النهائي",en:"Grand Total",v:`AED ${q.total.toLocaleString()}`,cls:"text-[#0F2C59]"},{ar:"الإجمالي قبل الضريبة",en:"Subtotal",v:`AED ${q.sub.toLocaleString()}`,cls:"text-slate-700"},{ar:"تاريخ الانتهاء",en:"Expiry",v:q.expiry,cls:isExpired?"text-red-500":"text-slate-700"},{ar:"أُنشئ بواسطة",en:"Created By",v:q.user,cls:"text-slate-600"}].map(f=>(
          <Card key={f.ar} className="p-4 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL?f.ar:f.en}</div></Card>
        ))}
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${tab===t.k?"border-[#0F2C59] text-[#0F2C59]":"border-transparent text-slate-400"}`}>{isRTL?t.ar:t.en}</button>)}
          </div>
        </div>
        <div className="p-5">
          {tab === "overview" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[{ar:"العميل",en:"Customer",v:q.customer},{ar:"التاريخ",en:"Date",v:q.date},{ar:"تاريخ الانتهاء",en:"Expiry",v:q.expiry},{ar:"الكراتين",en:"Cartons",v:`${q.ct}`},{ar:"الكيلو",en:"KG",v:`${q.kg} KG`},{ar:"فاتورة البيع",en:"Invoice",v:q.convertedInv||"—"}].map(f=>(
                <div key={f.ar} className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL?f.ar:f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>
              ))}
            </div>
          )}
          {tab === "products" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL?"المنتج":"Product",isRTL?"كرتون":"Ct",isRTL?"حبة":"Pcs","KG",isRTL?"السعر":"Price",isRTL?"الخصم":"Discount",isRTL?"المبلغ":"Amount"].map((h,i)=><th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {Q_SAMPLE_LINES.map((l,i)=><tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2.5 font-bold text-slate-800">{isRTL?l.productAr:l.product}{l.free&&<span className="ms-1 text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{isRTL?"مجاني":"Free"}</span>}</td><td className="px-3 py-2.5 font-mono text-center">{l.ct||"—"}</td><td className="px-3 py-2.5 font-mono text-center">{l.pcs||"—"}</td><td className="px-3 py-2.5 font-mono text-center font-bold">{l.kg}</td><td className="px-3 py-2.5 font-mono text-center">{l.free?"0.00":l.price.toFixed(2)}</td><td className="px-3 py-2.5 font-mono text-center">{l.discount>0?l.discount.toFixed(2):"—"}</td><td className="px-3 py-2.5 font-mono font-black text-[#0F2C59] text-end">{l.free?(isRTL?"مجاني":"Free"):l.amount.toFixed(2)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {tab === "log" && (
            <div className="space-y-2">
              {[{t:"2026-01-28 14:30",a:isRTL?"إرسال للعميل":"Sent to Customer",u:q.user,dot:"bg-blue-500"},{t:"2026-01-28 14:00",a:isRTL?"حفظ المسودة":"Draft Saved",u:q.user,dot:"bg-slate-400"}].map((e,i)=>(
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3"><span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${e.dot}`} /><div className="flex-1"><div className="text-sm font-bold text-slate-700">{e.a}</div><div className="text-xs text-slate-400">{e.u}</div></div><div className="font-mono text-xs text-slate-400 shrink-0">{e.t}</div></div>
              ))}
            </div>
          )}
          {tab === "convert" && (
            <div className="text-center py-6">
              {q.status === "converted" ? (
                <div><CheckCircle size={32} className="text-violet-500 mx-auto mb-2" /><p className="font-bold text-violet-700 text-sm">{isRTL ? "تم تحويل هذا العرض إلى فاتورة بيع" : "This quotation has been converted to a sales invoice"}</p><Btn size="sm" variant="secondary" className="mt-3" onClick={() => onNavigate("sales-detail")}><Eye size={13} />{q.convertedInv}</Btn></div>
              ) : (
                <div><FileText size={32} className="text-slate-300 mx-auto mb-2" /><p className="text-slate-400 font-semibold text-sm mb-4">{isRTL ? "لم يتم تحويل هذا العرض بعد" : "This quotation has not been converted yet"}</p><Btn variant="amber" onClick={() => onNavigate("quotation-convert")}><FileText size={15} />{isRTL ? "تحويل إلى فاتورة بيع" : "Convert to Sales Invoice"}</Btn></div>
              )}
            </div>
          )}
          {tab === "notes" && (
            <div className="space-y-3">
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl"><Download size={24} className="text-slate-300 mx-auto mb-2" /><p className="text-slate-400 font-semibold">{isRTL ? "رفع مرفق" : "Upload Attachment"}</p></div>
            </div>
          )}
        </div>
      </Card>

      {showAcceptModal && <AcceptQuotationModal lang={lang} onClose={() => setShowAcceptModal(false)} onNavigate={onNavigate} />}
      {showRejectModal && <RejectQuotationModal lang={lang} onClose={() => setShowRejectModal(false)} />}
    </div>
  );
}

// ── SCREEN: CONVERT QUOTATION ──────────────────────────────────────────────────
export function ConvertQuotationScreen({ lang, role, onNavigate, quotId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; quotId: string;
}) {
  const isRTL = lang === "ar";
  const q = QUOTATIONS.find(x => x.id === quotId) || QUOTATIONS[0];
  const [keepPrices, setKeepPrices] = useState(true);
  const [copyNotes, setCopyNotes] = useState(true);
  const [createAndApprove, setCreateAndApprove] = useState(false);
  const [success, setSuccess] = useState(false);
  const isExpired = Math.ceil((new Date(q.expiry).getTime() - Date.now()) / 86400000) < 0;
  const canApprove = role === "owner";

  const stockCheck = [
    { product: "1000 GRAM", productAr: "1000 جرام", reqCt: 5, availCt: 180, status: "sufficient" as const },
    { product: "1100 GRAM", productAr: "1100 جرام", reqCt: 3, availCt: 350, status: "sufficient" as const },
    { product: "Liver",     productAr: "كبدة",      reqCt: 0, availCt: 85,  status: "sufficient" as const },
    { product: "Bone",      productAr: "عظام",      reqCt: 0, availCt: 200, status: "sufficient" as const },
  ];

  if (success) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-violet-500" /></div>
        <h2 className="text-2xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تحويل عرض السعر إلى فاتورة بيع" : "Quotation Converted to Sales Invoice!"}</h2>
        <div className="font-mono text-slate-400 mb-2">INV-2026-00052</div>
        <p className="text-sm text-slate-500 mb-6">{isRTL ? "الفاتورة محفوظة كمسودة. المخزون لم يتأثر بعد." : "Invoice saved as draft. Stock not yet affected."}</p>
        <div className="grid grid-cols-1 gap-2">
          <Btn variant="primary" onClick={() => onNavigate("sales-detail")} className="justify-center"><Eye size={15} />{isRTL ? "فتح الفاتورة" : "Open Invoice"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("quotations")} className="justify-center">{isRTL ? "الرجوع لعروض الأسعار" : "Back to Quotations"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("quotation-detail")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تحويل عرض السعر إلى فاتورة بيع" : "Convert Quotation to Sales Invoice"}</h2><p className="text-xs text-slate-400">{q.id} → {q.customer}</p></div>
      </div>

      {/* Expired warning */}
      {isExpired && <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex gap-3"><AlertTriangle size={18} className="text-amber-500 shrink-0" /><p className="text-sm font-bold text-amber-700">{isRTL ? "انتهت صلاحية عرض السعر. يمكنك تحويله بعد تأكيد الأسعار." : "This quotation has expired. You can still convert it after confirming the prices."}</p></div>}

      {/* Important note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3"><Info size={18} className="text-blue-500 shrink-0 mt-0.5" /><p className="text-sm font-bold text-blue-700 leading-relaxed">{isRTL ? "التحويل ينشئ مسودة فاتورة بيع فقط. المخزون لن يتأثر حتى يتم اعتماد الفاتورة." : "Conversion creates a draft sales invoice only. Stock will not be affected until the invoice is approved."}</p></div>

      {/* Stock check */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "التحقق من المخزون" : "Stock Check"}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"المنتج":"Product",isRTL?"مطلوب":"Required",isRTL?"متوفر":"Available",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {stockCheck.map((s,i)=>(
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{isRTL?s.productAr:s.product}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{s.reqCt > 0 ? `${s.reqCt} Ct` : "— KG"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{s.availCt > 0 ? `${s.availCt} Ct` : "—"}</td>
                  <td className="px-4 py-2.5"><span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL?"كافي":"Sufficient"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Options */}
      <Card className="p-5 space-y-3">
        <h3 className="font-black text-[#0F2C59] text-sm mb-4">{isRTL ? "خيارات التحويل" : "Conversion Options"}</h3>
        {[
          [keepPrices, setKeepPrices, isRTL ? "الاحتفاظ بأسعار عرض السعر (افتراضي)" : "Keep quotation prices (default)"],
          [copyNotes, setCopyNotes, isRTL ? "نسخ الملاحظات والشروط للفاتورة" : "Copy notes and terms to invoice"],
          [createAndApprove, setCreateAndApprove, isRTL ? "إنشاء الفاتورة واعتمادها فوراً (يتطلب صلاحية المالك)" : "Create and approve immediately (requires Owner permission)"],
        ].map(([val, setter, label]: any) => (
          <label key={label} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${val ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100"} ${label.includes("فوراً") && !canApprove ? "opacity-60 cursor-not-allowed" : ""}`}>
            <input type="checkbox" checked={val} onChange={() => (label.includes("فوراً") && !canApprove) ? null : setter(!val)} className="accent-[#0F2C59]" />
            <span className="text-xs font-bold text-slate-700">{label}</span>
            {label.includes("فوراً") && !canApprove && <Lock size={11} className="text-slate-400 ms-auto" />}
          </label>
        ))}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "إذا تغيرت الأسعار أو المخزون بعد إنشاء العرض، راجع البيانات قبل اعتماد الفاتورة." : "If prices or stock changed since the quotation was created, review data before approving the invoice."}</p></div>
      </Card>

      <div className="flex flex-wrap gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate("quotation-detail")}>{isRTL ? "رجوع" : "Back"}</Btn>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => setSuccess(true)}><FileText size={15} />{isRTL ? "إنشاء مسودة الفاتورة" : "Create Invoice Draft"}</Btn>
          {canApprove && createAndApprove && <Btn variant="green" onClick={() => setSuccess(true)}><Check size={15} />{isRTL ? "إنشاء واعتماد الفاتورة" : "Create & Approve"}</Btn>}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: QUOTATION ANALYTICS ────────────────────────────────────────────────
export function QuotationAnalyticsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("quotations")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تحليل عروض الأسعار" : "Quotation Analytics"}</h2></div>
        <div className="flex gap-2"><Btn variant="outline" size="sm"><Download size={13} />PDF</Btn><Btn variant="outline" size="sm"><Download size={13} />Excel</Btn></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["18",isRTL?"إجمالي عروض الشهر":"Total This Month","bg-[#0F2C59]"],["5",isRTL?"عروض مفتوحة":"Open Quotes","bg-blue-500"],["4",isRTL?"عروض مقبولة":"Accepted","bg-emerald-500"],["5",isRTL?"محولة لفواتير":"Converted","bg-violet-500"],["28%",isRTL?"معدل التحويل":"Conversion Rate","bg-emerald-600"],["AED 12,400",isRTL?"قيمة العروض المفتوحة":"Open Value","bg-[#0F2C59]"],["2",isRTL?"عروض منتهية":"Expired","bg-amber-500"],["2",isRTL?"عروض مرفوضة":"Rejected","bg-red-500"]].map(([v,l,bg],i)=>(
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}><FileText size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight">{v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{l}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status donut */}
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "توزيع الحالات" : "Status Distribution"}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie key="qa-pie" data={Q_STATUS_DIST} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {Q_STATUS_DIST.map((e, i) => <Cell key={`qac-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="qa-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [v, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {Q_STATUS_DIST.map(s => <div key={s.name} className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} /><span className="font-semibold text-slate-600">{isRTL ? s.name : s.nameEn}: {s.value}</span></div>)}
          </div>
        </Card>

        {/* By customer bar */}
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "عروض حسب العميل" : "Quotations by Customer"}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Q_BY_CUSTOMER} barSize={22}>
              <CartesianGrid key="qa-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="qa-x" dataKey="customer" tick={{ fontSize: 9, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="qa-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="qa-bar-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} />
              <Bar key="qa-count-bar" dataKey="count" fill="#0F2C59" radius={[4,4,0,0]} name={isRTL ? "عدد العروض" : "Count"} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"رقم العرض":"Quote #",isRTL?"التاريخ":"Date",isRTL?"العميل":"Customer",isRTL?"الانتهاء":"Expiry",isRTL?"الإجمالي":"Total",isRTL?"الحالة":"Status",isRTL?"فاتورة البيع":"Invoice"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {QUOTATIONS.map(q=>(
                <tr key={q.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{q.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{q.date}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{q.customer}</td>
                  <td className="px-4 py-2.5 text-xs"><ExpiryBadge expiry={q.expiry} lang={lang} /></td>
                  <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">{q.total>0?`AED ${q.total.toLocaleString()}`:"—"}</td>
                  <td className="px-4 py-2.5"><QuotStatusBadge status={q.status} lang={lang} /></td>
                  <td className="px-4 py-2.5 text-xs">{q.convertedInv?<span className="font-mono text-violet-600 font-bold">{q.convertedInv}</span>:<span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── MODAL: ACCEPT QUOTATION ────────────────────────────────────────────────────
function AcceptQuotationModal({ lang, onClose, onNavigate }: { lang: Lang; onClose: () => void; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [acceptedBy, setAcceptedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [convertNow, setConvertNow] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-emerald-700">{isRTL ? "قبول عرض السعر" : "Accept Quotation"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <FInput label={isRTL ? "تم القبول من قِبل (اسم العميل)" : "Accepted By (Customer Name)"} value={acceptedBy} onChange={setAcceptedBy} placeholder={isRTL ? "اسم الشخص المعتمد" : "Authorized person name"} />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
          <label className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${convertNow ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100"}`}>
            <input type="checkbox" checked={convertNow} onChange={() => setConvertNow(v => !v)} className="accent-[#0F2C59]" />
            <span className="text-xs font-bold text-slate-700">{isRTL ? "تحويل إلى فاتورة بيع الآن" : "Convert to sales invoice now"}</span>
          </label>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="green" onClick={() => { toast.success(isRTL ? "تم قبول عرض السعر" : "Quotation accepted"); onClose(); if (convertNow) onNavigate("quotation-convert"); }} className="flex-1 justify-center"><Check size={15} />{isRTL ? "تأكيد القبول" : "Confirm"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: REJECT QUOTATION ────────────────────────────────────────────────────
function RejectQuotationModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const isRTL = lang === "ar";
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const REASONS = [isRTL?"السعر غير مناسب":"Price not suitable", isRTL?"الكمية غير متوفرة":"Quantity unavailable", isRTL?"العميل لم يرد":"Customer did not respond", isRTL?"تم الاتفاق خارج النظام":"Agreed outside system", isRTL?"سبب آخر":"Other reason"];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-red-600">{isRTL ? "رفض عرض السعر" : "Reject Quotation"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "سبب الرفض *" : "Rejection Reason *"}</label>
            <div className="space-y-1.5">
              {REASONS.map(r => <label key={r} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 ${reason === r ? "border-red-400 bg-red-50" : "border-slate-100"}`}><input type="radio" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-red-500" /><span className="text-xs font-bold text-slate-700">{r}</span></label>)}
            </div>
          </div>
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400" /></div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="danger" disabled={!reason} onClick={() => { toast.success(isRTL ? "تم تسجيل رفض العرض" : "Quotation rejected"); onClose(); }} className="flex-1 justify-center"><X size={14} />{isRTL ? "تأكيد الرفض" : "Confirm Rejection"}</Btn>
        </div>
      </div>
    </div>
  );
}
