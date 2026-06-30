import React, { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from "recharts";
import {
  AlertTriangle, AlertCircle, CheckCircle, Info, X, Download, Printer,
  FileText, Settings, Eye, ChevronRight, ChevronLeft, Filter, Search,
  RefreshCw, Shield, TrendingUp, TrendingDown, Calendar, Hash,
  FileSpreadsheet, Clock, User, Lock, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen = string;

// ── SAMPLE DATA ──────────────────────────────────────────────────────────────
const VAT_TREND = [
  { month: "يناير", salesVat: 14200, purchVat: 9800 },
  { month: "فبراير", salesVat: 16500, purchVat: 11200 },
  { month: "مارس",  salesVat: 18900, purchVat: 13100 },
  { month: "أبريل", salesVat: 17300, purchVat: 12400 },
  { month: "مايو",  salesVat: 19800, purchVat: 14100 },
  { month: "يونيو", salesVat: 21250, purchVat: 14900 },
];

const SALES_VAT_ROWS = [
  { id: "INV-2026-00052", date: "2026-06-28", customer: "مزرعة الفلاح الذهبي",    trn: "100234567800003", subtotal: 48500, vatRate: 5, vat: 2425, total: 50925, taxStatus: "taxable",    trnStatus: "ok",      user: "محمد العدوي" },
  { id: "INV-2026-00051", date: "2026-06-27", customer: "شركة الوادي للدواجن",     trn: "",              subtotal: 31200, vatRate: 0, vat: 0,    total: 31200, taxStatus: "disabled",   trnStatus: "missing", user: "أحمد المحاسب" },
  { id: "INV-2026-00050", date: "2026-06-26", customer: "مجمع المدينة للمواد",     trn: "100456789000004", subtotal: 62400, vatRate: 5, vat: 3120, total: 65520, taxStatus: "taxable",    trnStatus: "ok",      user: "محمد العدوي" },
  { id: "INV-2026-00049", date: "2026-06-25", customer: "مطاعم الريف اللبناني",   trn: "100567890100005", subtotal: 28900, vatRate: 5, vat: 1445, total: 30345, taxStatus: "taxable",    trnStatus: "ok",      user: "محمد العدوي" },
  { id: "INV-2026-00048", date: "2026-06-24", customer: "فندق الشرق الكبير",       trn: "100678901200006", subtotal: 74000, vatRate: 5, vat: 3700, total: 77700, taxStatus: "taxable",    trnStatus: "ok",      user: "سارة البيع" },
  { id: "INV-2026-00047", date: "2026-06-23", customer: "مجمع الخير للتجزئة",     trn: "100789012300007", subtotal: 19800, vatRate: 5, vat: 990,  total: 20790, taxStatus: "taxable",    trnStatus: "ok",      user: "سارة البيع" },
  { id: "INV-2026-00046", date: "2026-06-22", customer: "مطعم النخيل الذهبي",     trn: "",              subtotal: 33500, vatRate: 5, vat: 1675, total: 35175, taxStatus: "adjusted",   trnStatus: "missing", user: "مدير النظام" },
  { id: "INV-2026-00045", date: "2026-06-21", customer: "شركة البستان للتوزيع",   trn: "100890123400008", subtotal: 55600, vatRate: 5, vat: 2780, total: 58380, taxStatus: "taxable",    trnStatus: "ok",      user: "محمد العدوي" },
];

const PURCH_VAT_ROWS = [
  { id: "PUR-2026-00038", suppInv: "SI-4421", date: "2026-06-28", supplier: "مزرعة الأمل الكبرى",       trn: "100112233400001", subtotal: 52000, vatRate: 5, vat: 2600, total: 54600, taxStatus: "taxable",  trnStatus: "ok",      user: "أحمد المحاسب" },
  { id: "PUR-2026-00037", suppInv: "SI-4398", date: "2026-06-27", supplier: "شركة الريف للإمداد",       trn: "100223344500002", subtotal: 34800, vatRate: 5, vat: 1740, total: 36540, taxStatus: "taxable",  trnStatus: "ok",      user: "أحمد المحاسب" },
  { id: "PUR-2026-00036", suppInv: "SI-4376", date: "2026-06-26", supplier: "مجمع البادية للحيوانات",   trn: "100334455600003", subtotal: 41200, vatRate: 5, vat: 2060, total: 43260, taxStatus: "taxable",  trnStatus: "ok",      user: "مدير النظام" },
  { id: "PUR-2026-00035", suppInv: "SI-4355", date: "2026-06-25", supplier: "مورد الدواجن المعتمد",     trn: "",              subtotal: 38500, vatRate: 0, vat: 0,    total: 38500, taxStatus: "adjusted", trnStatus: "missing", user: "أحمد المحاسب" },
  { id: "PUR-2026-00034", suppInv: "SI-4332", date: "2026-06-24", supplier: "مؤسسة الخير للأعلاف",     trn: "",              subtotal: 47000, vatRate: 5, vat: 2350, total: 49350, taxStatus: "taxable",  trnStatus: "missing", user: "مدير النظام" },
  { id: "PUR-2026-00033", suppInv: "SI-4310", date: "2026-06-23", supplier: "شركة النور للمواد الحيوية", trn: "100556677800006", subtotal: 29600, vatRate: 5, vat: 1480, total: 31080, taxStatus: "taxable",  trnStatus: "ok",      user: "أحمد المحاسب" },
  { id: "PUR-2026-00032", suppInv: "SI-4288", date: "2026-06-22", supplier: "مزرعة السلام المتكاملة",   trn: "100667788900007", subtotal: 55900, vatRate: 5, vat: 2795, total: 58695, taxStatus: "taxable",  trnStatus: "ok",      user: "مدير النظام" },
];

const TAX_WARNINGS = [
  { id: "W001", date: "2026-06-28", type: "missing_customer_trn",  ref: "INV-2026-00046", entity: "مطعم النخيل الذهبي",      desc: "رقم TRN للعميل مفقود في فاتورة ضريبية",       severity: "high",   status: "open",     action: "إضافة TRN للعميل" },
  { id: "W002", date: "2026-06-27", type: "vat_disabled_no_reason", ref: "INV-2026-00051", entity: "شركة الوادي للدواجن",     desc: "تم تعطيل الضريبة بدون سبب مُدخل",             severity: "high",   status: "open",     action: "إضافة سبب التعطيل" },
  { id: "W003", date: "2026-06-25", type: "missing_supplier_trn",  ref: "PUR-2026-00035", entity: "مورد الدواجن المعتمد",     desc: "رقم TRN للمورد مفقود في فاتورة شراء ضريبية",  severity: "high",   status: "open",     action: "تحديث ملف المورد" },
  { id: "W004", date: "2026-06-24", type: "missing_supplier_trn",  ref: "PUR-2026-00034", entity: "مؤسسة الخير للأعلاف",     desc: "رقم TRN للمورد مفقود في فاتورة شراء",         severity: "medium", status: "open",     action: "تحديث ملف المورد" },
  { id: "W005", date: "2026-06-23", type: "vat_rate_changed",      ref: "PUR-2026-00035", entity: "مورد الدواجن المعتمد",     desc: "تم تغيير نسبة الضريبة يدوياً من 5% إلى 0%",  severity: "medium", status: "reviewed", action: "مراجعة السجل" },
  { id: "W006", date: "2026-06-20", type: "print_stamp_missing",   ref: "INV-2026-00042", entity: "متجر البركة العام",        desc: "ختم الشركة مفقود في قالب طباعة الفاتورة",     severity: "low",    status: "dismissed", action: "فتح إعدادات الطباعة" },
  { id: "W007", date: "2026-06-18", type: "attachment_missing",    ref: "PUR-2026-00031", entity: "مزرعة الفجر الجديد",      desc: "مرفق فاتورة المورد الأصلية غير موجود",        severity: "medium", status: "open",     action: "إرفاق الفاتورة الأصلية" },
];

const AUDIT_ROWS = [
  { id: "A001", dt: "2026-06-28 14:32", user: "مدير النظام",    role: "مالك",      section: "فاتورة مبيعات",  ref: "INV-2026-00046", action: "تغيير نسبة VAT",      prev: "0%",                  next: "5%",                  reason: "خطأ في الإدخال الأولي",      severity: "high" },
  { id: "A002", dt: "2026-06-27 10:15", user: "أحمد المحاسب", role: "محاسب",    section: "فاتورة شراء",    ref: "PUR-2026-00035", action: "تعطيل VAT",           prev: "مفعّل",               next: "معطّل",               reason: "تعفية مؤقتة باتفاق المورد",  severity: "high" },
  { id: "A003", dt: "2026-06-26 09:05", user: "مدير النظام",    role: "مالك",      section: "إعدادات الشركة", ref: "—",              action: "تحديث TRN الشركة",    prev: "غير مُدخل",           next: "100111222300003",     reason: "إدخال أولي",                severity: "medium" },
  { id: "A004", dt: "2026-06-25 16:48", user: "أحمد المحاسب", role: "محاسب",    section: "تقارير الضريبة", ref: "—",              action: "تصدير تقرير VAT",     prev: "—",                   next: "PDF",                 reason: "مراجعة شهر يونيو 2026",      severity: "low" },
  { id: "A005", dt: "2026-06-24 11:22", user: "مدير النظام",    role: "مالك",      section: "ملف مورد",       ref: "PUR-2026-00034", action: "تعديل TRN المورد",    prev: "غير مُدخل",           next: "100445566700005",     reason: "إضافة بيانات ضريبية",       severity: "medium" },
  { id: "A006", dt: "2026-06-22 08:30", user: "مدير النظام",    role: "مالك",      section: "إعدادات الضريبة", ref: "—",             action: "تفعيل تحذير TRN",    prev: "معطّل",               next: "مفعّل",               reason: "متطلبات التدقيق الداخلي",   severity: "low" },
  { id: "A007", dt: "2026-06-20 14:10", user: "أحمد المحاسب", role: "محاسب",    section: "تحذيرات",        ref: "INV-2026-00042", action: "رفض تحذير",           prev: "مفتوح",               next: "مرفوض",               reason: "الفاتورة لعميل معفى",        severity: "low" },
];

const NON_TAX_ROWS = [
  { id: "INV-2026-00051", type: "sales",    date: "2026-06-27", entity: "شركة الوادي للدواجن",   subtotal: 31200, vatExpected: 1560, vatActual: 0, reason: "",                         disabledBy: "أحمد المحاسب", status: "needs_reason" },
  { id: "INV-2026-00039", type: "sales",    date: "2026-06-15", entity: "مزرعة الفلاح الصغيرة", subtotal: 12800, vatExpected: 640,  vatActual: 0, reason: "عميل معفى من الضريبة",     disabledBy: "مدير النظام",   status: "reviewed" },
  { id: "PUR-2026-00035", type: "purchase", date: "2026-06-25", entity: "مورد الدواجن المعتمد",  subtotal: 38500, vatExpected: 1925, vatActual: 0, reason: "اتفاقية إعفاء مؤقتة",      disabledBy: "أحمد المحاسب", status: "reviewed" },
  { id: "INV-2026-00028", type: "sales",    date: "2026-05-30", entity: "مؤسسة الوفاء التجارية", subtotal: 9600,  vatExpected: 480,  vatActual: 0, reason: "بيع جملة كبير معفى",       disabledBy: "مدير النظام",   status: "reviewed" },
];

// ── SHARED PRIMITIVES ─────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ar-SA");
const fmtAED = (n: number) => `${n.toLocaleString("ar-SA")} د.إ`;

function KpiCard({ label, value, sub, color = "blue", icon: Icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ElementType }) {
  const colors: Record<string, string> = {
    blue: "bg-[#0F2C59]/8 text-[#0F2C59]", green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600", purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-1 shadow-sm">
      {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${colors[color]}`}><Icon size={15} /></div>}
      <p className="text-xs text-slate-500 leading-tight">{label}</p>
      <p className="text-lg font-bold text-[#0F2C59] leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SevBadge({ sev, lang }: { sev: string; lang: Lang }) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    high:   { ar: "عالي",    en: "High",   cls: "bg-red-100 text-red-700" },
    medium: { ar: "متوسط",   en: "Medium", cls: "bg-amber-100 text-amber-700" },
    low:    { ar: "منخفض",   en: "Low",    cls: "bg-slate-100 text-slate-600" },
  };
  const s = map[sev] ?? map.low;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{lang === "ar" ? s.ar : s.en}</span>;
}

function TaxStatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    taxable:   { ar: "ضريبية",         en: "Taxable",    cls: "bg-emerald-100 text-emerald-700" },
    disabled:  { ar: "بدون ضريبة",    en: "No VAT",     cls: "bg-slate-100 text-slate-600" },
    adjusted:  { ar: "الضريبة معدلة", en: "Adjusted",   cls: "bg-amber-100 text-amber-700" },
    cancelled: { ar: "ملغاة",          en: "Cancelled",  cls: "bg-red-100 text-red-700" },
    draft:     { ar: "مسودة",          en: "Draft",      cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? map.taxable;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{lang === "ar" ? s.ar : s.en}</span>;
}

function TrnBadge({ status, lang }: { status: string; lang: Lang }) {
  if (status === "ok") return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={12} />{lang === "ar" ? "موجود" : "OK"}</span>;
  return <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} />{lang === "ar" ? "مفقود" : "Missing"}</span>;
}

function PermBtn({ allowed, children, onClick, className = "" }: { allowed: boolean; children: React.ReactNode; onClick?: () => void; className?: string }) {
  if (!allowed) return (
    <button disabled className={`opacity-40 cursor-not-allowed ${className}`} title="ليس لديك صلاحية لتنفيذ هذا الإجراء">{children}</button>
  );
  return <button onClick={onClick} className={className}>{children}</button>;
}

function BackBtn({ lang, onClick }: { lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#0F2C59] transition-colors mb-4">
      {lang === "ar" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      {lang === "ar" ? "رجوع" : "Back"}
    </button>
  );
}

// ── 1. TAX DASHBOARD ─────────────────────────────────────────────────────────
export function TaxDashboardScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canAccess = role !== "cashier";
  if (!canAccess) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-6">
      <Lock size={40} className="text-slate-300" />
      <p className="text-lg font-semibold text-slate-500">{isRTL ? "ليس لديك صلاحية لعرض إدارة الضريبة" : "Access Denied"}</p>
    </div>
  );
  const netVat = 21250 - 14900;
  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "إدارة الضريبة VAT" : "VAT Management"}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{isRTL ? "مراجعة وإعداد تقارير ضريبة القيمة المضافة" : "Review and report VAT position"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate("tax-export-preview")} className="flex items-center gap-1.5 px-3 py-2 bg-[#0F2C59] text-white rounded-lg text-sm hover:bg-[#0F2C59]/90">
            <Download size={14} />{isRTL ? "تصدير التقرير" : "Export Report"}
          </button>
          <button onClick={() => onNavigate("tax-settings")} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
            <Settings size={14} />{isRTL ? "الإعدادات" : "Settings"}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">{isRTL ? "هذا التقرير تقديري لمساعدة المحاسب، ولا يعتبر إقراراً ضريبياً مقدماً للهيئة." : "This is an internal estimate only and is not a submitted VAT return."}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={isRTL ? "ضريبة المبيعات هذا الشهر" : "Sales VAT (Month)"} value={fmtAED(21250)} color="green" icon={TrendingUp} />
        <KpiCard label={isRTL ? "ضريبة المشتريات هذا الشهر" : "Purchase VAT (Month)"} value={fmtAED(14900)} color="amber" icon={TrendingDown} />
        <KpiCard label={isRTL ? "صافي الضريبة التقديري" : "Net VAT Estimate"} value={fmtAED(netVat)} sub={isRTL ? "ضريبة مستحقة تقديرية" : "Est. VAT payable"} color="blue" icon={Hash} />
        <KpiCard label={isRTL ? "تحذيرات TRN" : "TRN Warnings"} value="5" color="red" icon={AlertTriangle} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={isRTL ? "فواتير مبيعات ضريبية" : "Taxable Sales Inv."} value="86" color="green" icon={FileText} />
        <KpiCard label={isRTL ? "فواتير شراء ضريبية" : "Taxable Purch. Inv."} value="62" color="amber" icon={FileText} />
        <KpiCard label={isRTL ? "فواتير بدون ضريبة" : "Non-taxable Inv."} value="4" color="slate" icon={Shield} />
        <KpiCard label={isRTL ? "تغييرات ضريبية يدوية" : "Manual VAT Changes"} value="7" color="purple" icon={RefreshCw} />
      </div>

      {/* Net VAT formula */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-600 mb-3">{isRTL ? "صافي الضريبة = ضريبة المبيعات - ضريبة المشتريات" : "Net VAT = Sales VAT − Purchase VAT"}</p>
        <div className={`flex items-center gap-3 flex-wrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
          <div className="bg-emerald-50 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-emerald-600">{isRTL ? "ضريبة المبيعات" : "Sales VAT"}</p>
            <p className="font-bold text-emerald-700">{fmtAED(21250)}</p>
          </div>
          <span className="text-xl font-light text-slate-300">−</span>
          <div className="bg-amber-50 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-amber-600">{isRTL ? "ضريبة المشتريات" : "Purchase VAT"}</p>
            <p className="font-bold text-amber-700">{fmtAED(14900)}</p>
          </div>
          <span className="text-xl font-light text-slate-300">=</span>
          <div className="bg-[#0F2C59]/8 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-[#0F2C59]">{isRTL ? "صافي الضريبة" : "Net VAT"}</p>
            <p className="font-bold text-[#0F2C59]">{fmtAED(netVat)}</p>
          </div>
          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium">{isRTL ? "ضريبة مستحقة تقديرية" : "Est. Payable"}</span>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "اتجاه الضريبة الشهري" : "Monthly VAT Trend"}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={VAT_TREND} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid key="tax-dash-grid" strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis key="tax-dash-x" dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis key="tax-dash-y" tick={{ fontSize: 11 }} />
            <Tooltip key="tax-dash-tt" formatter={(v: number) => fmtAED(v)} />
            <Legend key="tax-dash-leg" />
            <Bar key="tax-dash-sv" dataKey="salesVat" name={isRTL ? "ضريبة مبيعات" : "Sales VAT"} fill="#22C55E" radius={[4,4,0,0]} />
            <Bar key="tax-dash-pv" dataKey="purchVat" name={isRTL ? "ضريبة مشتريات" : "Purch VAT"} fill="#F59E0B" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Warnings & Quick actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className={`flex items-center justify-between mb-3`}>
            <p className="text-sm font-semibold text-[#0F2C59]">{isRTL ? "آخر تحذيرات الضريبة" : "Latest Tax Warnings"}</p>
            <button onClick={() => onNavigate("tax-warnings")} className="text-xs text-[#0F2C59] hover:underline">{isRTL ? "عرض الكل" : "View All"}</button>
          </div>
          <div className="space-y-2">
            {TAX_WARNINGS.filter(w => w.status === "open").slice(0, 4).map(w => (
              <div key={w.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <AlertTriangle size={13} className={w.severity === "high" ? "text-red-500 mt-0.5 shrink-0" : "text-amber-500 mt-0.5 shrink-0"} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{w.ref} — {w.entity}</p>
                  <p className="text-xs text-slate-500">{w.desc}</p>
                </div>
                <SevBadge sev={w.severity} lang={lang} />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "الإجراءات السريعة" : "Quick Actions"}</p>
          <div className="space-y-2">
            {[
              { ar: "تقرير ضريبة المبيعات",    en: "Sales VAT Report",    nav: "tax-sales",    icon: TrendingUp,    color: "text-emerald-600" },
              { ar: "تقرير ضريبة المشتريات",   en: "Purchase VAT Report", nav: "tax-purchases", icon: TrendingDown,  color: "text-amber-600" },
              { ar: "صافي الضريبة التقديري",   en: "Net VAT Estimate",    nav: "tax-net",      icon: Hash,          color: "text-[#0F2C59]" },
              { ar: "مراجعة تحذيرات TRN",      en: "TRN Warnings",        nav: "tax-warnings", icon: AlertTriangle, color: "text-red-500" },
              { ar: "إعدادات الضريبة",          en: "Tax Settings",        nav: "tax-settings", icon: Settings,      color: "text-slate-600" },
            ].map(a => (
              <button key={a.nav} onClick={() => onNavigate(a.nav as TenantScreen)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                <a.icon size={14} className={a.color} />
                <span>{isRTL ? a.ar : a.en}</span>
                {isRTL ? <ChevronLeft size={14} className="text-slate-400 mr-auto" /> : <ChevronRight size={14} className="text-slate-400 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. SALES VAT REPORT ───────────────────────────────────────────────────────
export function SalesVATReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const canExport = role !== "cashier";
  const rows = SALES_VAT_ROWS.filter(r =>
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    r.customer.includes(search)
  );
  const totalSub = rows.reduce((a, r) => a + r.subtotal, 0);
  const totalVat = rows.reduce((a, r) => a + r.vat, 0);
  const totalGrand = rows.reduce((a, r) => a + r.total, 0);
  const missingTrn = rows.filter(r => r.trnStatus === "missing").length;
  const adjusted = rows.filter(r => r.taxStatus === "adjusted").length;

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "تقرير ضريبة المبيعات" : "Sales VAT Report"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "يونيو 2026" : "June 2026"}</p>
        </div>
        <div className="flex gap-2">
          <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري تجهيز ملف PDF..." : "Preparing PDF...")}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100">
            <FileText size={13} />PDF
          </PermBtn>
          <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري تجهيز ملف Excel..." : "Preparing Excel...")}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-100">
            <FileSpreadsheet size={13} />Excel
          </PermBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label={isRTL ? "إجمالي المبيعات قبل الضريبة" : "Sales Before VAT"} value={fmtAED(425000)} color="slate" />
        <KpiCard label={isRTL ? "إجمالي ضريبة المبيعات" : "Total Sales VAT"} value={fmtAED(21250)} color="green" />
        <KpiCard label={isRTL ? "إجمالي المبيعات بعد الضريبة" : "Sales incl. VAT"} value={fmtAED(446250)} color="blue" />
        <KpiCard label={isRTL ? "عدد الفواتير الضريبية" : "Taxable Invoices"} value="86" color="green" />
        <KpiCard label={isRTL ? "فواتير بدون TRN" : "Missing TRN"} value={String(missingTrn)} color="red" />
        <KpiCard label={isRTL ? "فواتير ضريبة معدلة" : "VAT Adjusted"} value={String(adjusted)} color="amber" />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-slate-400`} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? "بحث برقم الفاتورة أو العميل..." : "Search invoice or customer..."}
            className={`w-full ${isRTL ? "pr-9 text-right" : "pl-9"} py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F2C59]`} />
        </div>
        <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none">
          <option>{isRTL ? "كل الحالات" : "All Status"}</option>
          <option>{isRTL ? "ضريبية" : "Taxable"}</option>
          <option>{isRTL ? "بدون ضريبة" : "No VAT"}</option>
          <option>{isRTL ? "معدلة" : "Adjusted"}</option>
        </select>
        <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none">
          <option>{isRTL ? "كل العملاء" : "All Customers"}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  isRTL ? "رقم الفاتورة" : "Invoice",
                  isRTL ? "التاريخ" : "Date",
                  isRTL ? "العميل" : "Customer",
                  "TRN",
                  isRTL ? "قبل الضريبة" : "Pre-VAT",
                  isRTL ? "نسبة" : "Rate",
                  isRTL ? "VAT" : "VAT",
                  isRTL ? "الإجمالي" : "Total",
                  isRTL ? "الحالة" : "Status",
                  isRTL ? "TRN" : "TRN",
                  isRTL ? "إجراء" : "Action",
                ].map((h, i) => (
                  <th key={`svat-h-${i}`} className="px-3 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-medium">{r.id}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[140px] truncate">{r.customer}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{r.trn || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 font-medium">{fmt(r.subtotal)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{r.vatRate}%</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-emerald-700">{fmt(r.vat)}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-[#0F2C59]">{fmt(r.total)}</td>
                  <td className="px-3 py-2.5"><TaxStatusBadge status={r.taxStatus} lang={lang} /></td>
                  <td className="px-3 py-2.5"><TrnBadge status={r.trnStatus} lang={lang} /></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toast.info(`${r.id}`)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-xs font-bold text-slate-700">{isRTL ? "الإجمالي" : "Total"}</td>
                <td className="px-3 py-2.5 text-xs font-bold">{fmt(totalSub)}</td>
                <td />
                <td className="px-3 py-2.5 text-xs font-bold text-emerald-700">{fmt(totalVat)}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-[#0F2C59]">{fmt(totalGrand)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 3. PURCHASE VAT REPORT ────────────────────────────────────────────────────
export function PurchaseVATReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const canExport = role !== "cashier";
  const rows = PURCH_VAT_ROWS.filter(r =>
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier.includes(search)
  );
  const totalSub = rows.reduce((a, r) => a + r.subtotal, 0);
  const totalVat = rows.reduce((a, r) => a + r.vat, 0);
  const totalGrand = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "تقرير ضريبة المشتريات" : "Purchase VAT Report"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "يونيو 2026" : "June 2026"}</p>
        </div>
        <div className="flex gap-2">
          <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري تجهيز PDF..." : "Preparing PDF...")}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100">
            <FileText size={13} />PDF
          </PermBtn>
          <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري تجهيز Excel..." : "Preparing Excel...")}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-100">
            <FileSpreadsheet size={13} />Excel
          </PermBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label={isRTL ? "إجمالي المشتريات قبل الضريبة" : "Purchases Before VAT"} value={fmtAED(298000)} color="slate" />
        <KpiCard label={isRTL ? "إجمالي ضريبة المشتريات" : "Total Purchase VAT"} value={fmtAED(14900)} color="amber" />
        <KpiCard label={isRTL ? "إجمالي المشتريات بعد الضريبة" : "Purchases incl. VAT"} value={fmtAED(312900)} color="blue" />
        <KpiCard label={isRTL ? "فواتير شراء ضريبية" : "Taxable Invoices"} value="62" color="amber" />
        <KpiCard label={isRTL ? "فواتير بدون TRN للمورد" : "Missing Supplier TRN"} value="2" color="red" />
        <KpiCard label={isRTL ? "فواتير ضريبة معدلة" : "VAT Adjusted"} value="1" color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-slate-400`} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? "بحث..." : "Search..."}
            className={`w-full ${isRTL ? "pr-9 text-right" : "pl-9"} py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F2C59]`} />
        </div>
        <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg"><option>{isRTL ? "كل الموردين" : "All Suppliers"}</option></select>
        <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg"><option>{isRTL ? "كل الحالات" : "All Status"}</option></select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[isRTL?"رقم الشراء":"PO #", isRTL?"ف. المورد":"Supp.Inv", isRTL?"التاريخ":"Date", isRTL?"المورد":"Supplier", "TRN", isRTL?"قبل VAT":"Pre-VAT", isRTL?"نسبة":"Rate", "VAT", isRTL?"الإجمالي":"Total", isRTL?"الحالة":"Status", isRTL?"TRN":"TRN", isRTL?"إجراء":"Action"].map((h, i) =>
                  <th key={`pvat-h-${i}`} className="px-3 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-3 py-2.5 font-mono text-xs text-[#0F2C59] font-medium">{r.id}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{r.suppInv}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[130px] truncate">{r.supplier}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{r.trn || "—"}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">{fmt(r.subtotal)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{r.vatRate}%</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-amber-700">{fmt(r.vat)}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-[#0F2C59]">{fmt(r.total)}</td>
                  <td className="px-3 py-2.5"><TaxStatusBadge status={r.taxStatus} lang={lang} /></td>
                  <td className="px-3 py-2.5"><TrnBadge status={r.trnStatus} lang={lang} /></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toast.info(r.id)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Eye size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-slate-700">{isRTL ? "الإجمالي" : "Total"}</td>
                <td className="px-3 py-2.5 text-xs font-bold">{fmt(totalSub)}</td>
                <td />
                <td className="px-3 py-2.5 text-xs font-bold text-amber-700">{fmt(totalVat)}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-[#0F2C59]">{fmt(totalGrand)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 4. NET VAT ESTIMATE ───────────────────────────────────────────────────────
export function NetVATScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [inclCancelled, setInclCancelled] = useState(false);
  const [inclManual, setInclManual] = useState(true);
  const salesVat = 21250;
  const purchVat = 14900;
  const netVat = salesVat - purchVat;
  const canExport = role !== "cashier";

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "صافي الضريبة التقديري" : "Net VAT Estimate"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "فترة: يونيو 2026" : "Period: June 2026"}</p>
        </div>
        <div className="flex gap-2">
          <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري التجهيز..." : "Preparing...")}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0F2C59] text-white rounded-lg text-sm hover:bg-[#0F2C59]/90">
            <Download size={13} />{isRTL ? "تصدير PDF" : "Export PDF"}
          </PermBtn>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">{isRTL ? "هذه أرقام داخلية تقديرية ويجب مراجعتها محاسبياً قبل أي إقرار رسمي." : "These are internal estimates and must be reviewed before any official filing."}</p>
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={inclCancelled} onChange={e => setInclCancelled(e.target.checked)} className="rounded" />
          <span className="text-sm text-slate-600">{isRTL ? "تضمين الفواتير الملغاة" : "Include cancelled invoices"}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={inclManual} onChange={e => setInclManual(e.target.checked)} className="rounded" />
          <span className="text-sm text-slate-600">{isRTL ? "تضمين التغييرات اليدوية" : "Include manual VAT changes"}</span>
        </label>
      </div>

      {/* A + B + C sections */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* A - Sales VAT */}
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">A — {isRTL ? "ضريبة المبيعات" : "Sales VAT"}</p>
          </div>
          <div className="space-y-2">
            {[
              { label: isRTL ? "مبيعات خاضعة للضريبة" : "Taxable sales", val: 425000 },
              { label: isRTL ? "ضريبة المبيعات (5%)" : "Sales VAT (5%)", val: salesVat, bold: true, color: "text-emerald-700" },
              { label: isRTL ? "مبيعات غير خاضعة" : "Non-taxable sales", val: 31200 },
            ].map((row, i) => (
              <div key={`net-a-${i}`} className={`flex justify-between text-sm ${row.bold ? "font-bold" : ""} ${row.color ?? "text-slate-700"}`}>
                <span className="text-xs text-slate-500">{row.label}</span>
                <span>{fmtAED(row.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* B - Purchase VAT */}
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingDown size={14} className="text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-amber-700">B — {isRTL ? "ضريبة المشتريات" : "Purchase VAT"}</p>
          </div>
          <div className="space-y-2">
            {[
              { label: isRTL ? "مشتريات خاضعة للضريبة" : "Taxable purchases", val: 298000 },
              { label: isRTL ? "ضريبة المشتريات (5%)" : "Purchase VAT (5%)", val: purchVat, bold: true, color: "text-amber-700" },
              { label: isRTL ? "مشتريات غير خاضعة" : "Non-taxable purchases", val: 38500 },
            ].map((row, i) => (
              <div key={`net-b-${i}`} className={`flex justify-between text-sm ${row.bold ? "font-bold" : ""} ${row.color ?? "text-slate-700"}`}>
                <span className="text-xs text-slate-500">{row.label}</span>
                <span>{fmtAED(row.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C - Net VAT */}
        <div className="bg-[#0F2C59] rounded-xl p-4 text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
              <Hash size={14} className="text-white" />
            </div>
            <p className="text-sm font-semibold">C — {isRTL ? "صافي الضريبة" : "Net VAT"}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-white/70">
              <span>{isRTL ? "ضريبة المبيعات (A)" : "Sales VAT (A)"}</span>
              <span>{fmtAED(salesVat)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/70">
              <span>{isRTL ? "ضريبة المشتريات (B)" : "Purchase VAT (B)"}</span>
              <span>− {fmtAED(purchVat)}</span>
            </div>
            <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-lg">
              <span>{isRTL ? "صافي الضريبة" : "Net VAT"}</span>
              <span>{fmtAED(netVat)}</span>
            </div>
          </div>
          <div className="mt-3 bg-emerald-400/20 rounded-lg px-3 py-2 text-center">
            <p className="text-xs font-semibold text-emerald-300">{isRTL ? "ضريبة مستحقة تقديرية" : "Estimated VAT Payable"}</p>
          </div>
        </div>
      </div>

      {/* Mini trend */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "صافي الضريبة الشهري" : "Monthly Net VAT"}</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={VAT_TREND.map(d => ({ ...d, net: d.salesVat - d.purchVat }))} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid key="net-vat-grid" strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis key="net-vat-x" dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis key="net-vat-y" tick={{ fontSize: 11 }} />
            <Tooltip key="net-vat-tt" formatter={(v: number) => fmtAED(v)} />
            <Line key="net-vat-line" type="monotone" dataKey="net" name={isRTL ? "صافي الضريبة" : "Net VAT"} stroke="#0F2C59" strokeWidth={2} dot={{ fill: "#0F2C59", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 5. TAX WARNINGS ───────────────────────────────────────────────────────────
export function TaxWarningsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [filter, setFilter] = useState<"all" | "open" | "reviewed" | "dismissed">("all");
  const canDismiss = role === "owner" || role === "accountant";
  const rows = TAX_WARNINGS.filter(w => filter === "all" || w.status === filter);

  const typeLabel = (t: string, ar: boolean) => {
    const map: Record<string, [string, string]> = {
      missing_customer_trn:  ["TRN عميل مفقود",      "Missing Customer TRN"],
      missing_supplier_trn:  ["TRN مورد مفقود",      "Missing Supplier TRN"],
      vat_disabled_no_reason:["ضريبة معطلة بلا سبب","VAT Disabled w/o Reason"],
      vat_rate_changed:      ["تغيير نسبة الضريبة",  "VAT Rate Changed"],
      print_stamp_missing:   ["ختم مفقود",            "Print Stamp Missing"],
      attachment_missing:    ["مرفق مفقود",           "Attachment Missing"],
    };
    const pair = map[t] ?? [t, t];
    return ar ? pair[0] : pair[1];
  };
  const statusLabel = (s: string, ar: boolean) => {
    const map: Record<string, [string, string]> = { open: ["مفتوح", "Open"], reviewed: ["مراجع", "Reviewed"], dismissed: ["مرفوض", "Dismissed"] };
    const pair = map[s] ?? [s, s];
    return ar ? pair[0] : pair[1];
  };

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "تحذيرات الضريبة" : "Tax Warnings"}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={isRTL ? "إجمالي التحذيرات" : "Total Warnings"} value={String(TAX_WARNINGS.length)} color="blue" icon={AlertTriangle} />
        <KpiCard label={isRTL ? "تحذيرات TRN" : "TRN Warnings"} value={String(TAX_WARNINGS.filter(w => w.type.includes("trn")).length)} color="red" icon={Hash} />
        <KpiCard label={isRTL ? "الضريبة المعدلة" : "VAT Adjusted"} value={String(TAX_WARNINGS.filter(w => w.type === "vat_rate_changed").length)} color="amber" icon={RefreshCw} />
        <KpiCard label={isRTL ? "مفتوحة" : "Open"} value={String(TAX_WARNINGS.filter(w => w.status === "open").length)} color="red" icon={AlertCircle} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all","open","reviewed","dismissed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-[#0F2C59] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {f === "all" ? (isRTL ? "الكل" : "All") : statusLabel(f, isRTL)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[isRTL?"التاريخ":"Date", isRTL?"نوع التحذير":"Warning Type", isRTL?"المرجع":"Ref", isRTL?"العميل/المورد":"Entity", isRTL?"الوصف":"Description", isRTL?"الخطورة":"Severity", isRTL?"الحالة":"Status", isRTL?"الإجراءات":"Actions"]
                  .map((h, i) => <th key={`warn-h-${i}`} className="px-3 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => (
                <tr key={w.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{w.date}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{typeLabel(w.type, isRTL)}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-[#0F2C59]">{w.ref}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[120px] truncate">{w.entity}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[180px]">{w.desc}</td>
                  <td className="px-3 py-2.5"><SevBadge sev={w.severity} lang={lang} /></td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.status === "open" ? "bg-red-100 text-red-700" : w.status === "reviewed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {statusLabel(w.status, isRTL)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => toast.info(w.ref)} className="p-1 hover:bg-slate-100 rounded text-slate-500 text-xs">{isRTL ? "فتح" : "Open"}</button>
                      {canDismiss && w.status === "open" && (
                        <button onClick={() => toast.success(isRTL ? "تم رفض التحذير" : "Warning dismissed")}
                          className="p-1 hover:bg-red-50 rounded text-red-500 text-xs">{isRTL ? "رفض" : "Dismiss"}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 6. VAT CHANGE AUDIT ───────────────────────────────────────────────────────
export function VATAuditScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canExport = role !== "cashier";

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "سجل تغييرات الضريبة" : "VAT Change Audit Log"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "جميع التغييرات الضريبية الحساسة" : "All sensitive tax changes"}</p>
        </div>
        <PermBtn allowed={canExport} onClick={() => toast.success(isRTL ? "جاري تصدير سجل التدقيق..." : "Exporting audit log...")}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0F2C59] text-white rounded-lg text-sm hover:bg-[#0F2C59]/90">
          <Download size={13} />{isRTL ? "تصدير السجل" : "Export Log"}
        </PermBtn>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[isRTL?"التاريخ والوقت":"Date/Time", isRTL?"المستخدم":"User", isRTL?"الدور":"Role", isRTL?"القسم":"Section", isRTL?"المرجع":"Ref", isRTL?"الإجراء":"Action", isRTL?"القيمة السابقة":"Before", isRTL?"القيمة الجديدة":"After", isRTL?"السبب":"Reason", isRTL?"الخطورة":"Sev."]
                  .map((h, i) => <th key={`audit-h-${i}`} className="px-3 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {AUDIT_ROWS.map((r, i) => (
                <tr key={r.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.dt}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{r.user}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.role}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.section}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-[#0F2C59]">{r.ref}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{r.action}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-red-600 bg-red-50 rounded px-1">{r.prev}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-emerald-700 bg-emerald-50 rounded px-1">{r.next}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[140px] truncate">{r.reason}</td>
                  <td className="px-3 py-2.5"><SevBadge sev={r.severity} lang={lang} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 7. TAX CREDIT NOTES PLACEHOLDER ──────────────────────────────────────────
export function TaxCreditNotesScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "الإشعارات الدائنة الضريبية" : "Tax Credit Notes"}</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800 mb-1">{isRTL ? "هذه الشاشة قيد التطوير" : "Coming Soon"}</p>
          <p className="text-xs text-blue-700">{isRTL ? "الإشعار الدائن الضريبي يستخدم لاحقاً عند تعديل أو تخفيض فاتورة ضريبية معتمدة." : "Tax credit notes will be used to adjust or reduce approved tax invoices."}</p>
          <p className="text-xs text-blue-600 mt-2">{isRTL ? "حالياً استخدم خصم عند التحصيل لتعديل رصيد العميل فقط، أو انتظر مرحلة الإشعارات الدائنة للمعالجة الضريبية الكاملة." : "For now, use a collection discount to adjust the customer balance, or wait for the credit notes phase for full tax processing."}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { ar: "إشعارات دائنة قادمة",       en: "Credit Notes" },
          { ar: "مرتجعات مبيعات قادمة",      en: "Sales Returns" },
          { ar: "تخفيض فاتورة ضريبية قادم",  en: "Invoice Reduction" },
          { ar: "ربط بالفاتورة الأصلية قادم", en: "Link to Original Inv." },
        ].map((c, i) => (
          <div key={`cn-card-${i}`} className="bg-white rounded-xl border border-dashed border-slate-200 p-4 flex flex-col items-center justify-center gap-2 opacity-60">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <Clock size={14} className="text-slate-400" />
            </div>
            <p className="text-xs text-center text-slate-500">{isRTL ? c.ar : c.en}</p>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{isRTL ? "قريباً" : "Soon"}</span>
          </div>
        ))}
      </div>

      {/* Placeholder table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b border-slate-100">
          <p className="text-sm font-medium text-slate-700">{isRTL ? "الإشعارات الدائنة الضريبية" : "Tax Credit Notes"}</p>
          <button disabled className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm cursor-not-allowed">
            <FileText size={13} />{isRTL ? "إنشاء إشعار دائن — قريباً" : "Create Credit Note — Soon"}
          </button>
        </div>
        <div className="p-8 text-center text-slate-400">
          <Clock size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{isRTL ? "لا توجد إشعارات دائنة بعد" : "No credit notes yet"}</p>
        </div>
      </div>
    </div>
  );
}

// ── 8. NON-TAXABLE INVOICES ───────────────────────────────────────────────────
export function NonTaxableInvoicesScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "فواتير بدون ضريبة" : "Non-Taxable Invoices"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "فواتير تم تعطيل الضريبة عليها" : "Invoices where VAT was disabled"}</p>
        </div>
        <button onClick={() => toast.success(isRTL ? "جاري التصدير..." : "Exporting...")}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
          <Download size={13} />{isRTL ? "تصدير" : "Export"}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
        <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">{isRTL ? "الفواتير بدون سبب مُدخل تحتاج مراجعة قبل إغلاق الفترة المحاسبية." : "Invoices without a reason entered need review before closing the accounting period."}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[isRTL?"المرجع":"Ref", isRTL?"النوع":"Type", isRTL?"التاريخ":"Date", isRTL?"العميل/المورد":"Entity", isRTL?"الإجمالي":"Subtotal", isRTL?"VAT المتوقع":"Exp.VAT", isRTL?"VAT الفعلي":"Act.VAT", isRTL?"السبب":"Reason", isRTL?"معطَّل بواسطة":"Disabled By", isRTL?"الحالة":"Status", isRTL?"إجراء":"Action"]
                  .map((h, i) => <th key={`ntax-h-${i}`} className="px-3 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {NON_TAX_ROWS.map((r, i) => (
                <tr key={r.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-3 py-2.5 text-xs font-mono text-[#0F2C59] font-medium">{r.id}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === "sales" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.type === "sales" ? (isRTL ? "مبيعات" : "Sales") : (isRTL ? "شراء" : "Purchase")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[130px] truncate">{r.entity}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">{fmt(r.subtotal)}</td>
                  <td className="px-3 py-2.5 text-xs text-amber-600">{fmt(r.vatExpected)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{fmt(r.vatActual)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.reason || <span className="text-red-500 font-medium">{isRTL ? "مطلوب" : "Required"}</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.disabledBy}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "needs_reason" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {r.status === "needs_reason" ? (isRTL ? "يحتاج سبب" : "Needs Reason") : (isRTL ? "مراجع" : "Reviewed")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => toast.info(r.id)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Eye size={13} /></button>
                      {r.status === "needs_reason" && (
                        <button onClick={() => toast.info(isRTL ? "أدخل السبب" : "Enter reason")} className="text-xs text-amber-600 hover:text-amber-700 underline px-1">
                          {isRTL ? "إضافة سبب" : "Add Reason"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 9. TAX SETTINGS PANEL ─────────────────────────────────────────────────────
export function TaxSettingsPanel({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner" || role === "accountant";
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate] = useState(5);
  const [trn] = useState("100111222300003");
  const [requireReason, setRequireReason] = useState(true);
  const [warnCustomerTrn, setWarnCustomerTrn] = useState(true);
  const [warnSupplierTrn, setWarnSupplierTrn] = useState(true);
  const [showOnPrint, setShowOnPrint] = useState(true);
  const [allowSalesDisable, setAllowSalesDisable] = useState(true);
  const [allowPurchDisable, setAllowPurchDisable] = useState(true);

  const Toggle = ({ value, onChange, disabled = false }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-[#22C55E]" : "bg-slate-200"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? (isRTL ? "translate-x-[-20px]" : "translate-x-5") : (isRTL ? "translate-x-[-2px]" : "translate-x-0.5")}`} />
    </button>
  );

  const SettingRow = ({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} disabled={!canEdit} />
    </div>
  );

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "إعدادات الضريبة المختصرة" : "Tax Settings"}</h1>
          <p className="text-sm text-slate-500">{isRTL ? "إعدادات ضريبة القيمة المضافة السريعة" : "Quick VAT configuration"}</p>
        </div>
        <button onClick={() => onNavigate("settings-vat")} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
          <ExternalLink size={13} />{isRTL ? "الإعدادات الكاملة" : "Full Settings"}
        </button>
      </div>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
          <Lock size={14} className="text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700">{isRTL ? "للعرض فقط. يحتاج دور المالك أو المحاسب للتعديل." : "View only. Owner or Accountant role required to edit."}</p>
        </div>
      )}

      {/* Company TRN & rate */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-[#0F2C59]">{isRTL ? "بيانات الشركة الضريبية" : "Company Tax Info"}</p>
        <div className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg`}>
          <div>
            <p className="text-xs text-slate-500">{isRTL ? "TRN الشركة" : "Company TRN"}</p>
            <p className="font-mono text-sm font-semibold text-[#0F2C59]">{trn}</p>
          </div>
          <button onClick={() => toast.info(isRTL ? "افتح الإعدادات الكاملة لتعديل TRN" : "Open full settings to edit TRN")}
            className="text-xs text-[#0F2C59] hover:underline flex items-center gap-1">
            <Settings size={12} />{isRTL ? "تعديل" : "Edit"}
          </button>
        </div>
        <div className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg`}>
          <div>
            <p className="text-xs text-slate-500">{isRTL ? "نسبة الضريبة الافتراضية" : "Default VAT Rate"}</p>
            <p className="text-sm font-semibold text-[#0F2C59]">{vatRate}%</p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{isRTL ? "قياسية UAE" : "UAE Standard"}</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F2C59] mb-2">{isRTL ? "إعدادات التطبيق" : "Application Settings"}</p>
        <SettingRow label={isRTL ? "تفعيل الضريبة افتراضياً" : "Enable VAT by default"} value={vatEnabled} onChange={setVatEnabled} />
        <SettingRow label={isRTL ? "السماح بتعطيل VAT في المبيعات" : "Allow disable VAT on sales"} value={allowSalesDisable} onChange={setAllowSalesDisable} />
        <SettingRow label={isRTL ? "السماح بتعطيل VAT في المشتريات" : "Allow disable VAT on purchases"} value={allowPurchDisable} onChange={setAllowPurchDisable} />
        <SettingRow label={isRTL ? "طلب سبب عند تغيير الضريبة" : "Require reason for VAT changes"} value={requireReason} onChange={setRequireReason} />
        <SettingRow label={isRTL ? "تحذير عند غياب TRN العميل" : "Warn on missing customer TRN"} value={warnCustomerTrn} onChange={setWarnCustomerTrn} />
        <SettingRow label={isRTL ? "تحذير عند غياب TRN المورد" : "Warn on missing supplier TRN"} value={warnSupplierTrn} onChange={setWarnSupplierTrn} />
        <SettingRow label={isRTL ? "عرض الضريبة في قوالب الطباعة" : "Show VAT on print templates"} value={showOnPrint} onChange={setShowOnPrint} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onNavigate("settings-vat")} className="flex items-center gap-1.5 px-4 py-2 bg-[#0F2C59] text-white rounded-lg text-sm hover:bg-[#0F2C59]/90">
          <ExternalLink size={13} />{isRTL ? "فتح إعدادات الضريبة الكاملة" : "Open Full Tax Settings"}
        </button>
        <button onClick={() => onNavigate("settings-print-templates")} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
          <Printer size={13} />{isRTL ? "قوالب الطباعة" : "Print Templates"}
        </button>
      </div>
    </div>
  );
}

// ── 10. TAX EXPORT PREVIEW ────────────────────────────────────────────────────
export function TaxExportPreviewScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [reportType, setReportType] = useState<"sales" | "purchase" | "net">("net");
  const [inclHeader, setInclHeader] = useState(true);
  const [inclFormulas, setInclFormulas] = useState(true);
  const [inclWarnings, setInclWarnings] = useState(true);
  const [inclTable, setInclTable] = useState(true);
  const [inclCancelled, setInclCancelled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const canExport = role !== "cashier";

  const handleExport = (format: "pdf" | "excel") => {
    if (!canExport) { toast.error(isRTL ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "Access denied"); return; }
    setLoading(true); setExported(false);
    setTimeout(() => { setLoading(false); setExported(true); toast.success(isRTL ? "تم تجهيز تقرير الضريبة بنجاح" : "Tax report ready"); }, 1800);
  };

  const typeLabel = { sales: isRTL ? "ضريبة المبيعات" : "Sales VAT", purchase: isRTL ? "ضريبة المشتريات" : "Purchase VAT", net: isRTL ? "صافي الضريبة التقديري" : "Net VAT Estimate" };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-[#22C55E]" : "bg-slate-200"} cursor-pointer`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? (isRTL ? "translate-x-[-20px]" : "translate-x-5") : (isRTL ? "translate-x-[-2px]" : "translate-x-0.5")}`} />
    </button>
  );

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <BackBtn lang={lang} onClick={() => onNavigate("tax")} />
      <h1 className="text-xl font-bold text-[#0F2C59]">{isRTL ? "معاينة تصدير تقرير الضريبة" : "Tax Report Export Preview"}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Config */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "نوع التقرير" : "Report Type"}</p>
            <div className="space-y-2">
              {(["sales","purchase","net"] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="rtype" value={t} checked={reportType === t} onChange={() => setReportType(t)} className="text-[#0F2C59]" />
                  <span className="text-sm text-slate-700">{typeLabel[t]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "خيارات الطباعة" : "Print Options"}</p>
            {[
              { label: isRTL ? "تضمين ترويسة الشركة" : "Company header", value: inclHeader, onChange: setInclHeader },
              { label: isRTL ? "تضمين صيغ الملخص" : "Summary formulas", value: inclFormulas, onChange: setInclFormulas },
              { label: isRTL ? "تضمين قائمة التحذيرات" : "Warnings list", value: inclWarnings, onChange: setInclWarnings },
              { label: isRTL ? "تضمين جدول الفواتير التفصيلي" : "Detailed invoice table", value: inclTable, onChange: setInclTable },
              { label: isRTL ? "تضمين الفواتير الملغاة" : "Include cancelled invoices", value: inclCancelled, onChange: setInclCancelled },
            ].map((o, i) => (
              <div key={`exp-opt-${i}`} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-600">{o.label}</span>
                <Toggle value={o.value} onChange={o.onChange} />
              </div>
            ))}
          </div>
        </div>

        {/* Preview summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "ملخص التقرير" : "Report Summary"}</p>
            <div className="space-y-2.5">
              {[
                { label: isRTL ? "نوع التقرير" : "Report type", val: typeLabel[reportType] },
                { label: isRTL ? "الفترة" : "Period", val: isRTL ? "يونيو 2026" : "June 2026" },
                { label: isRTL ? "ضريبة المبيعات" : "Sales VAT", val: fmtAED(21250) },
                { label: isRTL ? "ضريبة المشتريات" : "Purchase VAT", val: fmtAED(14900) },
                { label: isRTL ? "صافي الضريبة" : "Net VAT", val: fmtAED(6350) },
                { label: isRTL ? "عدد التحذيرات" : "Warnings", val: "5" },
                { label: isRTL ? "الفواتير المضمنة" : "Invoices included", val: "148" },
                { label: isRTL ? "المسودات المستبعدة" : "Drafts excluded", val: "3" },
                { label: isRTL ? "الملغاة المستبعدة" : "Cancelled excluded", val: inclCancelled ? "0" : "6" },
              ].map((r, i) => (
                <div key={`sum-${i}`} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-medium text-slate-700">{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0F2C59] mb-3">{isRTL ? "تنسيق التصدير" : "Export Format"}</p>
            {loading ? (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-2 border-[#0F2C59] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-500">{isRTL ? "جاري تجهيز تقرير الضريبة..." : "Preparing tax report..."}</p>
              </div>
            ) : exported ? (
              <div className="text-center py-4">
                <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-emerald-600 font-medium">{isRTL ? "تم تجهيز تقرير الضريبة بنجاح" : "Tax report ready"}</p>
                <button onClick={() => setExported(false)} className="mt-2 text-xs text-slate-400 hover:underline">{isRTL ? "تصدير مرة أخرى" : "Export again"}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => handleExport("pdf")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium ${canExport ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" : "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"}`}>
                  <FileText size={14} />PDF
                </button>
                <button onClick={() => handleExport("excel")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium ${canExport ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200" : "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"}`}>
                  <FileSpreadsheet size={14} />Excel
                </button>
              </div>
            )}
            {!canExport && <p className="text-xs text-center text-red-500 mt-2">{isRTL ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "Access denied"}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
