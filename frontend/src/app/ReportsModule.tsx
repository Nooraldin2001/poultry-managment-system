// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — REPORTS & ANALYTICS MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, Download, Printer, TrendingUp, TrendingDown,
  BarChart2, FileText, Users, Truck, Receipt, Package, DollarSign,
  Calendar, Settings, Eye, Lock, Calculator, Layers, Star
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { toast } from "sonner";
import { LoadingState, ErrorState, ApiUnavailableState } from "@/shared/components/ApiStates";
import { IS_MOCK_MODE } from "@/services/config";
import { getReportsExportPayload } from "@/services/reportsService";
import { ExportPayloadModal } from "@/features/export/ExportPayloadModal";
import {
  getSalesReport, getPurchasesReport, getInventoryReport, getProfitReport, getTaxSummaryReport,
} from "@/services/reportsService";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales-new" | "purchases-new" | "inventory" | "inventory-movement"
  | "inventory-valuation" | "customers-profile" | "supplier-profile"
  | "expenses-report" | "customers-statement" | "supplier-statement"
  | "reports" | "reports-daily" | "reports-sales" | "reports-purchases"
  | "reports-inventory" | "reports-customers" | "reports-suppliers"
  | "reports-tax" | "reports-profit" | "reports-statements" | "reports-builder"
  | string;

// ── LOCAL UI ───────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "green";
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
  };
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 font-bold rounded-xl transition-all cursor-pointer border active:scale-[0.98] focus:outline-none ${s[size]} ${v[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>{children}</button>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>;
}
function FInput({ label, type = "text", value, onChange }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59]" />
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

// Shared export bar used on every report
function ExportBar({ lang, title, canExport, dateFrom, dateTo, customerId, supplierId, productId, reportType }: {
  lang: Lang; title: string; canExport: boolean;
  dateFrom?: string; dateTo?: string; customerId?: string; supplierId?: string; productId?: string; reportType?: string;
}) {
  const isRTL = lang === "ar";
  const [exportPayload, setExportPayload] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);

  const loadExport = async () => {
    if (IS_MOCK_MODE) {
      toast.info(isRTL ? "معاينة JSON متاحة في وضع API الحي فقط" : "JSON preview available in live API mode only");
      return;
    }
    setExporting(true);
    try {
      const payload = await getReportsExportPayload({
        date_from: dateFrom,
        date_to: dateTo,
        customer_id: customerId,
        supplier_id: supplierId,
        product_id: productId,
        report_type: reportType ?? title,
      });
      setExportPayload(payload);
    } catch (err) {
      toast.error(isRTL ? "فشل تحميل بيانات التصدير" : "Failed to load export payload");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canExport ? (
        <>
          <Btn variant="primary" size="sm" onClick={() => window.print()}><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
          <Btn variant="secondary" size="sm" disabled><Download size={13} />PDF {isRTL ? "(قريباً)" : "(soon)"}</Btn>
          <Btn variant="outline" size="sm" disabled><Download size={13} />Excel {isRTL ? "(قريباً)" : "(soon)"}</Btn>
          <Btn variant="outline" size="sm" disabled={exporting} onClick={() => void loadExport()}>
            <Download size={13} />{isRTL ? "معاينة JSON" : "JSON preview"}
          </Btn>
        </>
      ) : (
        <PermBtn lang={lang}><Download size={13} />{isRTL ? "تصدير التقرير" : "Export"}</PermBtn>
      )}
      {exportPayload != null && (
        <ExportPayloadModal
          lang={lang}
          titleAr="معاينة تصدير التقرير"
          titleEn="Report export preview"
          payload={exportPayload}
          onClose={() => setExportPayload(null)}
        />
      )}
    </div>
  );
}

// Date filter bar shared across reports
function DateFilterBar({ lang, from, to, onFrom, onTo, preset, onPreset }: {
  lang: Lang; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
  preset: string; onPreset: (v: string) => void;
}) {
  const isRTL = lang === "ar";
  const presets = [["today", isRTL ? "اليوم" : "Today"], ["yesterday", isRTL ? "أمس" : "Yesterday"], ["week", isRTL ? "هذا الأسبوع" : "This Week"], ["month", isRTL ? "هذا الشهر" : "This Month"], ["custom", isRTL ? "مخصص" : "Custom"]];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {presets.map(([v, l]) => (
            <button key={v} onClick={() => onPreset(v)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${preset === v ? "bg-[#0F2C59] text-white border-[#0F2C59]" : "bg-white text-slate-500 border-slate-200 hover:border-[#0F2C59]/30"}`}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <input type="date" value={from} onChange={e => onFrom(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
            <span className="text-slate-400 font-bold text-sm">—</span>
            <input type="date" value={to} onChange={e => onTo(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0F2C59]" />
          </>
        )}
      </div>
    </Card>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
const R_SALES_TREND = [
  { day: "الأحد", dayEn: "Sun", sales: 15200, purchases: 9800,  expenses: 620  },
  { day: "الاثنين",dayEn: "Mon", sales: 18300, purchases: 12100, expenses: 850  },
  { day: "الثلاثاء",dayEn:"Tue", sales: 14800, purchases: 10200, expenses: 430  },
  { day: "الأربعاء",dayEn:"Wed", sales: 21500, purchases: 14300, expenses: 1150 },
  { day: "الخميس",  dayEn:"Thu", sales: 16700, purchases: 11500, expenses: 780  },
  { day: "الجمعة",  dayEn:"Fri", sales: 19200, purchases: 13100, expenses: 290  },
  { day: "اليوم",   dayEn:"Today",sales: 18450, purchases: 11200, expenses: 850  },
];
const R_PROFIT_TREND = [
  { month: "أغسطس",  monthEn: "Aug", profit: 78000 },
  { month: "سبتمبر", monthEn: "Sep", profit: 82000 },
  { month: "أكتوبر", monthEn: "Oct", profit: 88000 },
  { month: "نوفمبر", monthEn: "Nov", profit: 75000 },
  { month: "ديسمبر", monthEn: "Dec", profit: 91000 },
  { month: "يناير",  monthEn: "Jan", profit: 87950 },
];
const R_PAY_PIE = [
  { name: "كاش", nameEn: "Cash", value: 43, color: "#22C55E" },
  { name: "بنكي", nameEn: "Bank", value: 33, color: "#0F2C59" },
  { name: "آجل",  nameEn: "Credit", value: 24, color: "#F59E0B" },
];
const R_BY_CUSTOMER = [
  { customer: "مطعم الخليج",         sales: 42000, color: "#0F2C59"  },
  { customer: "سوبر ماركت المدينة",  sales: 68000, color: "#22C55E"  },
  { customer: "مطبخ الإمارات",        sales: 31000, color: "#F59E0B"  },
  { customer: "Prime Fresh Meat",    sales: 55000, color: "#8B5CF6"  },
];
const R_SUPP_STATUS = [
  { name: "مدفوع", nameEn: "Paid", value: 70, color: "#22C55E" },
  { name: "جزئي", nameEn: "Partial", value: 20, color: "#F59E0B" },
  { name: "معلق",  nameEn: "Pending", value: 10, color: "#EF4444" },
];
const R_PROFIT_STACK = [
  { label: "المبيعات", labelEn: "Sales", value: 425000, color: "#22C55E" },
  { label: "تكلفة FIFO", labelEn: "FIFO Cost", value: 298000, color: "#EF4444" },
  { label: "المصروفات", labelEn: "Expenses", value: 39050, color: "#F59E0B" },
];
const R_SALES_INVOICES = [
  { id: "INV-2025-0086", date: "2025-01-28", customer: "مطعم الخليج",        ct: 10,  kg: 126,  sub: 1906.25, vat: 95.31,  total: 2001.56, paid: 2001.56, rem: 0,      method: "cash",   status: "paid"    },
  { id: "INV-2025-0085", date: "2025-01-28", customer: "سوبر ماركت المدينة", ct: 80,  kg: 800,  sub: 11200,   vat: 560,    total: 11760,   paid: 5000,    rem: 6760,   method: "credit", status: "partial" },
  { id: "INV-2025-0084", date: "2025-01-27", customer: "مطبخ الإمارات",       ct: 40,  kg: 400,  sub: 5800,    vat: 290,    total: 6090,    paid: 6090,    rem: 0,      method: "bank",   status: "paid"    },
  { id: "INV-2025-0083", date: "2025-01-27", customer: "مطعم الخليج",        ct: 20,  kg: 200,  sub: 2950,    vat: 147.50, total: 3097.50, paid: 0,       rem: 3097.50,method: "credit", status: "approved"},
];
const R_PURCH_INVOICES = [
  { id: "PUR-2025-0042", suppInv: "WST-2025-1234", date: "2025-01-28", supplier: "WESTLAND", ct: 146, kg: 1310, goods: 3305.55, ded: 0,    vat: 165.28, netP: 3470.83, paid: 3470.83, rem: 0,       status: "paid"    },
  { id: "PUR-2025-0041", suppInv: "WST-2025-1198", date: "2025-01-25", supplier: "WESTLAND", ct: 220, kg: 2800, goods: 8400,    ded: 1000, vat: 385,    netP: 8085,    paid: 5000,    rem: 3085,    status: "partial" },
  { id: "PUR-2025-0038", suppInv: "EMR-0041",       date: "2025-01-20", supplier: "الإمارات للدواجن", ct: 180, kg: 1900, goods: 5700, ded: 300, vat: 270, netP: 5670, paid: 5670, rem: 0, status: "paid" },
];
const R_CUSTOMERS = [
  { name: "مطعم الخليج",         balance: 12450,  limit: 15000,  pct: 83,  totalSales: 42000, collected: 29550, lastInv: "2025-01-28", lastPay: "2025-01-15" },
  { name: "سوبر ماركت المدينة", balance: 18700,  limit: 15000,  pct: 125, totalSales: 68000, collected: 49300, lastInv: "2025-01-28", lastPay: "2025-01-10" },
  { name: "مطبخ الإمارات",       balance: 0,      limit: 0,      pct: 0,   totalSales: 31000, collected: 31000, lastInv: "2025-01-27", lastPay: "2025-01-27" },
  { name: "Prime Fresh Meat",    balance: 4250,   limit: 20000,  pct: 21,  totalSales: 55000, collected: 50750, lastInv: "2025-01-26", lastPay: "2025-01-20" },
];
const R_SUPPLIERS = [
  { name: "WESTLAND FOODSTUFF",   balance: 18500,  totalP: 45000, paid: 26500, ded: 1300, lastInv: "2025-01-28", lastPay: "2025-01-28" },
  { name: "مزرعة العين للدواجن", balance: 25000,  totalP: 65000, paid: 40000, ded: 0,    lastInv: "2025-01-25", lastPay: "2025-01-15" },
  { name: "MNM Foodstuff",        balance: 6942.86,totalP: 28000, paid: 21057, ded: 0,    lastInv: "2025-01-22", lastPay: "2025-01-20" },
  { name: "نقل الإمارات",         balance: 0,      totalP: 4500,  paid: 4500,  ded: 0,    lastInv: "2025-01-22", lastPay: "2025-01-22" },
];
const R_VAT_SALES = [
  { inv: "INV-2025-0086", date: "2025-01-28", customer: "مطعم الخليج",        trn: "",                taxable: 1906.25, vat: 95.31,  total: 2001.56 },
  { inv: "INV-2025-0085", date: "2025-01-28", customer: "سوبر ماركت المدينة", trn: "100123456700003", taxable: 11200,   vat: 560,    total: 11760   },
  { inv: "INV-2025-0084", date: "2025-01-27", customer: "مطبخ الإمارات",       trn: "",                taxable: 5800,    vat: 290,    total: 6090    },
];
const R_VAT_PURCHASE = [
  { inv: "PUR-2025-0042", date: "2025-01-28", supplier: "WESTLAND",    trn: "100765432100003", taxable: 3305.55, vat: 165.28, netP: 3470.83 },
  { inv: "PUR-2025-0041", date: "2025-01-25", supplier: "WESTLAND",    trn: "100765432100003", taxable: 8085,    vat: 0,      netP: 8085    },
  { inv: "PUR-2025-0038", date: "2025-01-20", supplier: "الإمارات",    trn: "",                taxable: 5670,    vat: 270,    netP: 5670    },
];
const R_PROFIT_ROWS = [
  { date: "2025-01-28", ref: "INV-2025-0086", party: "مطعم الخليج",        sales: 2001.56, fifoCost: 1533.75, grossP: 467.81, expDis: 120, netP: 347.81, margin: 17.4 },
  { date: "2025-01-28", ref: "INV-2025-0085", party: "سوبر ماركت المدينة", sales: 11760,   fifoCost: 9200,    grossP: 2560,   expDis: 200, netP: 2360,   margin: 20.1 },
  { date: "2025-01-27", ref: "INV-2025-0084", party: "مطبخ الإمارات",       sales: 6090,    fifoCost: 4680,    grossP: 1410,   expDis: 150, netP: 1260,   margin: 20.7 },
  { date: "2025-01-27", ref: "INV-2025-0083", party: "مطعم الخليج",        sales: 3097.50, fifoCost: 2435.50, grossP: 662,    expDis: 80,  netP: 582,    margin: 18.8 },
];

// ── SCREEN: REPORTS HOME ───────────────────────────────────────────────────────
export function ReportsHomeScreen({ lang, role, onNavigate }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
}) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const canProfit = role === "owner" || role === "accountant";
  const [showSettings, setShowSettings] = useState(false);

  const kpis = [
    { v: "AED 18,450",  ar: "مبيعات اليوم",       en: "Today's Sales",      bg: "bg-emerald-500" },
    { v: "AED 11,200",  ar: "مشتريات اليوم",      en: "Today's Purchases",  bg: "bg-[#0F2C59]" },
    { v: "AED 850",     ar: "مصروفات اليوم",      en: "Today's Expenses",   bg: "bg-amber-500" },
    { v: "AED 6,400",   ar: "صافي ربح اليوم",     en: "Today's Net Profit", bg: "bg-emerald-600" },
    { v: "AED 425,000", ar: "مبيعات الشهر",       en: "Month Sales",        bg: "bg-emerald-500" },
    { v: "AED 298,000", ar: "مشتريات الشهر",      en: "Month Purchases",    bg: "bg-[#0F2C59]" },
    { v: "AED 39,050",  ar: "مصروفات الشهر",      en: "Month Expenses",     bg: "bg-amber-500" },
    { v: "AED 87,950",  ar: "صافي ربح الشهر",     en: "Month Net Profit",   bg: "bg-emerald-600" },
  ];

  const reportCards = [
    { icon: TrendingUp,    ar: "تقارير المبيعات",     en: "Sales Reports",      desc_ar: "فواتير المبيعات، التحصيلات، الرصيد",         desc_en: "Sales invoices, collections, balances",       nav: "reports-sales" as TenantScreen,      locked: false },
    { icon: TrendingDown,  ar: "تقارير المشتريات",   en: "Purchase Reports",   desc_ar: "فواتير الشراء، دفعات الموردين، الخصومات",   desc_en: "Purchase invoices, payments, deductions",    nav: "reports-purchases" as TenantScreen,  locked: false },
    { icon: Package,       ar: "تقارير المخزون",     en: "Inventory Reports",  desc_ar: "المخزون الحالي، الحركات، تقييم FIFO",        desc_en: "Current stock, movements, FIFO valuation",   nav: "reports-inventory" as TenantScreen,  locked: false },
    { icon: Users,         ar: "تقارير العملاء",     en: "Customer Reports",   desc_ar: "أرصدة العملاء، التحصيلات، الخصومات",        desc_en: "Customer balances, collections, discounts",  nav: "reports-customers" as TenantScreen,  locked: false },
    { icon: Truck,         ar: "تقارير الموردين",    en: "Supplier Reports",   desc_ar: "مستحقات الموردين، المشتريات، الدفعات",       desc_en: "Supplier payables, purchases, payments",     nav: "reports-suppliers" as TenantScreen,  locked: false },
    { icon: Receipt,       ar: "تقارير المصروفات",   en: "Expense Reports",    desc_ar: "مصروفات يومية وشهرية ومرتبطة بالشراء",      desc_en: "Daily, monthly and purchase-linked expenses",nav: "expenses-report" as TenantScreen,   locked: false },
    { icon: Calculator,    ar: "تقارير الضريبة",     en: "Tax/VAT Reports",    desc_ar: "ضريبة المبيعات والمشتريات وصافي الضريبة",   desc_en: "Sales VAT, purchase VAT, net VAT",           nav: "reports-tax" as TenantScreen,        locked: false },
    { icon: BarChart2,     ar: "تقارير صافي الربح",  en: "Profit Reports",     desc_ar: "المبيعات - تكلفة FIFO - المصروفات = الربح", desc_en: "Sales - FIFO cost - Expenses = Profit",      nav: "reports-profit" as TenantScreen,     locked: !canProfit },
    { icon: Calendar,      ar: "تقرير اليوم",        en: "Daily Report",       desc_ar: "ملخص يومي شامل لكل العمليات",               desc_en: "Comprehensive daily operations summary",      nav: "reports-daily" as TenantScreen,      locked: false },
    { icon: Layers,        ar: "كشف الحسابات",       en: "Account Statements", desc_ar: "كشوف العملاء والموردين وتصديرها",           desc_en: "Customer and supplier statements",            nav: "reports-statements" as TenantScreen, locked: false },
    { icon: Star,          ar: "تقرير مخصص",         en: "Custom Report",      desc_ar: "اختر بياناتك وصدّر تقريراً مخصصاً",         desc_en: "Choose your data and export a custom report", nav: "reports-builder" as TenantScreen,    locked: false },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "التقارير والتحليلات" : "Reports & Analytics"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{isRTL ? "جميع التقارير تعتمد على الفواتير المعتمدة فقط" : "All reports use approved transactions only"}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" onClick={() => onNavigate("reports-daily")}><Calendar size={13} />{isRTL ? "تقرير اليوم" : "Daily Report"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowSettings(true)}><Settings size={13} /></Btn>
        </div>
      </div>

      {/* Date filter */}
      <Card className="p-4">
        <div className="flex gap-1.5 flex-wrap">
          {[["today", isRTL ? "اليوم" : "Today"], ["yesterday", isRTL ? "أمس" : "Yesterday"], ["week", isRTL ? "هذا الأسبوع" : "This Week"], ["month", isRTL ? "هذا الشهر" : "This Month"], ["custom", isRTL ? "فترة مخصصة" : "Custom"]].map(([v, l]) => (
            <button key={v} onClick={() => setPreset(v)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${preset === v ? "bg-[#0F2C59] text-white border-[#0F2C59]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>{l}</button>
          ))}
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><BarChart2 size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
          </div>
        ))}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col transition-all hover:shadow-md ${r.locked ? "opacity-80" : "cursor-pointer hover:border-[#0F2C59]/30"}`}
              onClick={() => !r.locked && onNavigate(r.nav)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-[#0F2C59]/8 rounded-2xl flex items-center justify-center"><Icon size={20} className="text-[#0F2C59]" /></div>
                {r.locked && <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"><Lock size={9} />{isRTL ? "مقيد" : "Restricted"}</div>}
              </div>
              <h3 className="font-black text-slate-800 text-sm mb-1">{isRTL ? r.ar : r.en}</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed flex-1">{isRTL ? r.desc_ar : r.desc_en}</p>
              <div className="mt-3 flex items-center justify-between">
                {r.locked
                  ? <span className="text-xs text-amber-600 font-bold">{isRTL ? "يحتاج صلاحية" : "Requires permission"}</span>
                  : <span className="text-xs font-bold text-[#0F2C59] flex items-center gap-1">{isRTL ? "فتح التقرير" : "Open Report"}{isRTL ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {showSettings && <ReportsSettingsPanel lang={lang} role={role} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── SCREEN: DAILY SUMMARY ──────────────────────────────────────────────────────
export function DailySummaryReport({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canExport = role !== "cashier";
  const today = new Date().toISOString().slice(0, 10);

  const kpis = IS_MOCK_MODE ? [
    { v: "AED 18,450", ar: "إجمالي المبيعات",       en: "Total Sales",        cls: "text-emerald-600 bg-emerald-50" },
    { v: "AED 8,000",  ar: "مبيعات كاش",            en: "Cash Sales",         cls: "text-emerald-600 bg-emerald-50" },
    { v: "AED 6,000",  ar: "مبيعات بنكية",           en: "Bank Sales",         cls: "text-blue-600 bg-blue-50" },
    { v: "AED 4,450",  ar: "مبيعات آجلة",            en: "Credit Sales",       cls: "text-amber-600 bg-amber-50" },
    { v: "AED 11,200", ar: "إجمالي المشتريات",      en: "Total Purchases",    cls: "text-[#0F2C59] bg-[#0F2C59]/5" },
    { v: "AED 6,096",  ar: "تحصيلات من العملاء",    en: "Customer Collections",cls: "text-emerald-600 bg-emerald-50" },
    { v: "AED 9,600",  ar: "دفعات للموردين",        en: "Supplier Payments",  cls: "text-[#0F2C59] bg-[#0F2C59]/5" },
    { v: "AED 850",    ar: "مصروفات اليوم",          en: "Daily Expenses",     cls: "text-red-500 bg-red-50" },
    { v: "AED 6,400",  ar: "صافي ربح اليوم",        en: "Net Profit",         cls: "text-emerald-700 bg-emerald-50 font-black text-xl" },
  ] : [];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير اليوم" : "Daily Summary Report"}</h2>
          <p className="text-xs text-slate-400 font-semibold">{today}</p>
        </div>
        <ExportBar lang={lang} title="daily" reportType="daily" canExport={canExport} dateFrom={today} dateTo={today} />
      </div>

      {!IS_MOCK_MODE ? (
        <ApiUnavailableState lang={lang} messageAr="تقرير اليوم يعرض بيانات API عند توفر نقطة التقرير اليومي" messageEn="Daily report shows API data when the daily report endpoint is available" />
      ) : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className={`p-4 text-center ${k.cls.split(" ")[1]}`}>
            <div className={`text-lg font-black font-mono ${k.cls.split(" ")[0]}`}>{k.v}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? k.ar : k.en}</div>
          </Card>
        ))}
      </div>

      {/* Sections */}
      {[
        [isRTL ? "أ. فواتير البيع اليوم" : "A. Today's Sales Invoices", R_SALES_INVOICES],
        [isRTL ? "ب. فواتير الشراء اليوم" : "B. Today's Purchase Invoices", R_PURCH_INVOICES],
      ].map(([title, _], si) => (
        <Card key={si} className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-black text-[#0F2C59] text-sm">{title as string}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50/80 border-b border-slate-200">{(si === 0 ? [isRTL?"رقم الفاتورة":"Invoice #", isRTL?"العميل":"Customer", "KG", isRTL?"الإجمالي":"Total", isRTL?"المدفوع":"Paid", isRTL?"المتبقي":"Remaining", isRTL?"الحالة":"Status"] : [isRTL?"رقم الفاتورة":"Invoice #", isRTL?"المورد":"Supplier", "KG", isRTL?"صافي المستحق":"Net Payable", isRTL?"المدفوع":"Paid", isRTL?"المتبقي":"Remaining", isRTL?"الحالة":"Status"]).map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {si === 0 ? R_SALES_INVOICES.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.id}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.customer}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{r.kg}</td>
                    <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">AED {r.total.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {r.paid.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs">{r.rem > 0 ? <span className="font-mono font-black text-red-500">AED {r.rem.toLocaleString()}</span> : <span className="text-emerald-500 font-bold">✓</span>}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status==="paid"?"bg-emerald-100 text-emerald-700":r.status==="partial"?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}`}>{r.status==="paid"?(isRTL?"مدفوعة":"Paid"):r.status==="partial"?(isRTL?"جزئياً":"Partial"):(isRTL?"معتمدة":"Approved")}</span></td>
                  </tr>
                )) : R_PURCH_INVOICES.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.id}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.supplier}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{r.kg}</td>
                    <td className="px-4 py-2.5 font-mono font-black text-amber-700 text-xs">AED {r.netP.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {r.paid.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs">{r.rem > 0 ? <span className="font-mono font-black text-red-500">AED {r.rem.toLocaleString()}</span> : <span className="text-emerald-500 font-bold">✓</span>}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status==="paid"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{r.status==="paid"?(isRTL?"مدفوعة":"Paid"):(isRTL?"جزئياً":"Partial")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      </>
      )}
    </div>
  );
}

// ── SCREEN: SALES REPORT ───────────────────────────────────────────────────────
export function SalesReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const [reportTab, setReportTab] = useState("total");
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canExport = role !== "cashier";

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    let cancelled = false;
    setLoading(true);
    getSalesReport({ date_from: from, date_to: to })
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const totals = (reportData.totals ?? {}) as Record<string, number>;
  const kpis = IS_MOCK_MODE ? [
    { v: "AED 425,000", ar: "إجمالي المبيعات",   en: "Total Sales",      cls: "text-emerald-600" },
    { v: "AED 21,250",  ar: "إجمالي الضريبة",    en: "Total VAT",        cls: "text-[#0F2C59]" },
    { v: "AED 389,600", ar: "إجمالي المدفوع",    en: "Total Paid",       cls: "text-emerald-600" },
    { v: "AED 35,400",  ar: "إجمالي المتبقي",    en: "Total Remaining",  cls: "text-red-500" },
    { v: "1,456",       ar: "إجمالي الكراتين",   en: "Total Cartons",    cls: "text-slate-700" },
    { v: "14,560",      ar: "إجمالي الحبات",     en: "Total Pieces",     cls: "text-slate-700" },
    { v: "14,530 KG",   ar: "إجمالي الكيلو",     en: "Total KG",         cls: "text-slate-700" },
    { v: "AED 2,125",   ar: "متوسط قيمة الفاتورة",en: "Avg Invoice",     cls: "text-violet-600" },
  ] : [
    { v: `AED ${Number(totals.total_sales ?? 0).toLocaleString()}`, ar: "إجمالي المبيعات", en: "Total Sales", cls: "text-emerald-600" },
    { v: `AED ${Number(totals.total_vat ?? 0).toLocaleString()}`, ar: "إجمالي الضريبة", en: "Total VAT", cls: "text-[#0F2C59]" },
    { v: `AED ${Number(totals.total_paid ?? 0).toLocaleString()}`, ar: "إجمالي المدفوع", en: "Total Paid", cls: "text-emerald-600" },
    { v: `AED ${Number(totals.total_remaining ?? 0).toLocaleString()}`, ar: "إجمالي المتبقي", en: "Total Remaining", cls: "text-red-500" },
    { v: String(totals.total_cartons ?? 0), ar: "إجمالي الكراتين", en: "Total Cartons", cls: "text-slate-700" },
    { v: String(totals.total_pieces ?? 0), ar: "إجمالي الحبات", en: "Total Pieces", cls: "text-slate-700" },
    { v: `${Number(totals.total_kg ?? 0).toLocaleString()} KG`, ar: "إجمالي الكيلو", en: "Total KG", cls: "text-slate-700" },
    { v: `AED ${Number(totals.avg_invoice ?? 0).toLocaleString()}`, ar: "متوسط قيمة الفاتورة", en: "Avg Invoice", cls: "text-violet-600" },
  ];

  const TABS = [["total", isRTL?"إجمالي المبيعات":"Total Sales"], ["customer", isRTL?"حسب العميل":"By Customer"], ["product", isRTL?"حسب المنتج":"By Product"], ["unpaid", isRTL?"غير المدفوعة":"Unpaid"]];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقارير المبيعات" : "Sales Reports"}</h2></div>
        <ExportBar lang={lang} title="sales" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>

      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => <Card key={i} className="p-4 text-center"><div className={`text-xl font-black font-mono ${k.cls}`}>{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></Card>)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "المبيعات خلال الفترة" : "Sales Over Period"}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={R_SALES_TREND}>
              <CartesianGrid key="sr-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="sr-x" dataKey={isRTL ? "day" : "dayEn"} tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="sr-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="sr-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Line key="sr-sales" type="monotone" dataKey="sales" stroke="#22C55E" strokeWidth={2.5} dot={false} name={isRTL ? "المبيعات" : "Sales"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "طرق الدفع" : "Payment Methods"}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie key="sr-pie" data={R_PAY_PIE} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                {R_PAY_PIE.map((e, i) => <Cell key={`src-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="sr-pie-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [`${v}%`, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {R_PAY_PIE.map(p => <div key={p.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} /><span className="font-semibold text-slate-600">{isRTL ? p.name : p.nameEn}</span></div><span className="font-bold text-slate-700">{p.value}%</span></div>)}
          </div>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Card>
        <div className="border-b border-slate-100 px-4 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(([k, l]) => <button key={k} onClick={() => setReportTab(k)} className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${reportTab === k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400"}`}>{l}</button>)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"رقم الفاتورة":"Invoice #",isRTL?"التاريخ":"Date",isRTL?"العميل":"Customer","KG",isRTL?"الإجمالي":"Total","VAT",isRTL?"المدفوع":"Paid",isRTL?"المتبقي":"Remaining",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_SALES_INVOICES.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.customer}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{r.kg}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">AED {r.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">AED {r.vat.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {r.paid.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs">{r.rem > 0 ? <span className="font-mono font-black text-red-500">AED {r.rem.toLocaleString()}</span> : <span className="text-emerald-500 font-bold">✓</span>}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status==="paid"?"bg-emerald-100 text-emerald-700":r.status==="partial"?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}`}>{r.status==="paid"?(isRTL?"مدفوعة":"Paid"):r.status==="partial"?(isRTL?"جزئياً":"Partial"):(isRTL?"معتمدة":"Approved")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PURCHASE REPORT ────────────────────────────────────────────────────
export function PurchaseReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canExport = role !== "cashier";

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    let cancelled = false;
    setLoading(true);
    getPurchasesReport({ date_from: from, date_to: to })
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const totals = (reportData.totals ?? {}) as Record<string, number>;
  const kpis = IS_MOCK_MODE ? [
    { v: "AED 298,000",  ar: "إجمالي المشتريات",       en: "Total Purchases",    cls: "text-[#0F2C59]" },
    { v: "AED 50,443",   ar: "مستحقات الموردين",       en: "Supplier Payables",  cls: "text-amber-600" },
    { v: "AED 247,557",  ar: "إجمالي المدفوع للموردين",en: "Total Paid",         cls: "text-emerald-600" },
    { v: "AED 50,443",   ar: "الرصيد غير المسدد",      en: "Remaining Balance",  cls: "text-red-500" },
    { v: "AED 14,900",   ar: "ضريبة المشتريات",        en: "Purchase VAT",       cls: "text-violet-600" },
    { v: "1,266",        ar: "إجمالي الكراتين",        en: "Total Cartons",      cls: "text-slate-700" },
    { v: "14,560 KG",    ar: "إجمالي الكيلو",          en: "Total KG",           cls: "text-slate-700" },
    { v: "AED 2,450",    ar: "إجمالي الخصومات",        en: "Total Deductions",   cls: "text-blue-600" },
  ] : [
    { v: `AED ${Number(totals.total_purchases ?? 0).toLocaleString()}`, ar: "إجمالي المشتريات", en: "Total Purchases", cls: "text-[#0F2C59]" },
    { v: `AED ${Number(totals.supplier_payables ?? 0).toLocaleString()}`, ar: "مستحقات الموردين", en: "Supplier Payables", cls: "text-amber-600" },
    { v: `AED ${Number(totals.total_paid ?? 0).toLocaleString()}`, ar: "إجمالي المدفوع للموردين", en: "Total Paid", cls: "text-emerald-600" },
    { v: `AED ${Number(totals.remaining_balance ?? 0).toLocaleString()}`, ar: "الرصيد غير المسدد", en: "Remaining Balance", cls: "text-red-500" },
    { v: `AED ${Number(totals.purchase_vat ?? 0).toLocaleString()}`, ar: "ضريبة المشتريات", en: "Purchase VAT", cls: "text-violet-600" },
    { v: String(totals.total_cartons ?? 0), ar: "إجمالي الكراتين", en: "Total Cartons", cls: "text-slate-700" },
    { v: `${Number(totals.total_kg ?? 0).toLocaleString()} KG`, ar: "إجمالي الكيلو", en: "Total KG", cls: "text-slate-700" },
    { v: `AED ${Number(totals.total_deductions ?? 0).toLocaleString()}`, ar: "إجمالي الخصومات", en: "Total Deductions", cls: "text-blue-600" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقارير المشتريات" : "Purchase Reports"}</h2></div>
        <ExportBar lang={lang} title="purchases" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => <Card key={i} className="p-4 text-center"><div className={`text-xl font-black font-mono ${k.cls}`}>{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></Card>)}
      </div>
      {/* Supplier status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "المشتريات حسب المورد" : "Purchases by Supplier"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={R_SUPPLIERS.map(s => ({ name: s.name.split(" ")[0], value: s.totalP }))} barSize={28}>
              <CartesianGrid key="pr-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="pr-x" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="pr-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="pr-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Bar key="pr-bar" dataKey="value" fill="#0F2C59" radius={[4,4,0,0]} name={isRTL ? "المشتريات" : "Purchases"} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "حالة مدفوعات الموردين" : "Supplier Payment Status"}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie key="pr-pie" data={R_SUPP_STATUS} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                {R_SUPP_STATUS.map((e, i) => <Cell key={`prc-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="pr-pie-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _, p: { payload: { name: string; nameEn: string } }) => [`${v}%`, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {R_SUPP_STATUS.map(s => <div key={s.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="font-semibold text-slate-600">{isRTL ? s.name : s.nameEn}</span></div><span className="font-bold text-slate-700">{s.value}%</span></div>)}
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"رقم الفاتورة":"Invoice #",isRTL?"رقم فاتورة المورد":"Supplier Inv",isRTL?"التاريخ":"Date",isRTL?"المورد":"Supplier","KG",isRTL?"إجمالي البضاعة":"Goods",isRTL?"الخصومات":"Deductions","VAT",isRTL?"صافي المستحق":"Net Payable",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_PURCH_INVOICES.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.suppInv}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{r.kg}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">AED {r.goods.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-600 text-xs">{r.ded > 0 ? `−AED ${r.ded}` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">AED {r.vat.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-amber-700 text-xs">AED {r.netP.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status==="paid"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{r.status==="paid"?(isRTL?"مدفوعة":"Paid"):(isRTL?"جزئياً":"Partial")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: TAX REPORT ─────────────────────────────────────────────────────────
export function TaxReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const [preset, setPreset] = useState("month");
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canExport = role === "owner" || role === "accountant";

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    let cancelled = false;
    setLoading(true);
    getTaxSummaryReport({ date_from: from, date_to: to })
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const totals = (reportData.totals ?? {}) as Record<string, number>;
  const salesVat = IS_MOCK_MODE ? 21250 : Number(totals.sales_vat ?? 0);
  const purchVat = IS_MOCK_MODE ? 14900 : Number(totals.purchase_vat ?? 0);
  const netVat = salesVat - purchVat;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير الضريبة — الضريبة على القيمة المضافة" : "Tax Report — VAT"}</h2></div>
        <ExportBar lang={lang} title="tax" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      {/* VAT KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { v: `AED ${salesVat.toLocaleString()}`, ar: "ضريبة المبيعات", en: "Sales VAT", cls: "text-red-500 bg-red-50" },
          { v: `AED ${purchVat.toLocaleString()}`, ar: "ضريبة المشتريات", en: "Purchase VAT", cls: "text-emerald-600 bg-emerald-50" },
          { v: `AED ${netVat.toLocaleString()}`, ar: "صافي الضريبة المستحقة", en: "Net VAT Payable", cls: "text-[#0F2C59] bg-[#0F2C59]/5 font-black text-xl" },
          { v: String(IS_MOCK_MODE ? 2 : totals.missing_customer_trn ?? 0), ar: "فواتير بدون TRN للعميل", en: "Invoices Missing TRN", cls: "text-amber-600 bg-amber-50" },
          { v: String(IS_MOCK_MODE ? 1 : totals.missing_supplier_trn ?? 0), ar: "مورد بدون TRN", en: "Supplier Missing TRN", cls: "text-amber-600 bg-amber-50" },
          { v: String(IS_MOCK_MODE ? 12 : totals.tax_invoices ?? 0), ar: "فواتير ضريبية", en: "Tax Invoices", cls: "text-blue-600 bg-blue-50" },
        ].map((k, i) => <Card key={i} className={`p-4 text-center ${k.cls.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${k.cls.split(" ")[0]}`}>{k.v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? k.ar : k.en}</div></Card>)}
      </div>

      {/* Net VAT formula */}
      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4 flex gap-3">
        <Info size={16} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
        <div>
          <div className="font-black text-[#0F2C59] text-sm mb-1">{isRTL ? "المعادلة: صافي الضريبة = ضريبة المبيعات − ضريبة المشتريات" : "Formula: Net VAT = Sales VAT − Purchase VAT"}</div>
          <div className="font-mono text-[#0F2C59] text-base">AED {salesVat.toLocaleString()} − AED {purchVat.toLocaleString()} = <strong>AED {netVat.toLocaleString()}</strong></div>
        </div>
      </div>

      {/* Warnings */}
      {R_VAT_SALES.filter(r => !r.trn).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-amber-700">{isRTL ? `${R_VAT_SALES.filter(r => !r.trn).length} فواتير بيع لعملاء بدون رقم TRN` : `${R_VAT_SALES.filter(r => !r.trn).length} sales invoices for customers missing TRN`}</span>
        </div>
      )}

      {/* Sales VAT table */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-100 font-black text-[#0F2C59] text-sm">{isRTL ? "أ. ضريبة المبيعات" : "A. Sales VAT"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"رقم الفاتورة":"Invoice #",isRTL?"التاريخ":"Date",isRTL?"العميل":"Customer","TRN",isRTL?"المبلغ الخاضع":"Taxable",isRTL?"الضريبة":"VAT",isRTL?"الإجمالي":"Total"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_VAT_SALES.map(r => (
                <tr key={r.inv} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.inv}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.customer}</td>
                  <td className="px-4 py-2.5 text-xs">{r.trn ? <span className="font-mono text-slate-500">{r.trn}</span> : <span className="text-amber-500 font-bold text-[10px]">⚠ {isRTL ? "مفقود" : "Missing"}</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">AED {r.taxable.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">AED {r.vat.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-emerald-700 text-xs">AED {r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Purchase VAT table */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-100 font-black text-[#0F2C59] text-sm">{isRTL ? "ب. ضريبة المشتريات" : "B. Purchase VAT"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"رقم الفاتورة":"Invoice #",isRTL?"التاريخ":"Date",isRTL?"المورد":"Supplier","TRN",isRTL?"المبلغ الخاضع":"Taxable",isRTL?"الضريبة":"VAT",isRTL?"صافي المستحق":"Net Payable"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_VAT_PURCHASE.map(r => (
                <tr key={r.inv} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.inv}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.supplier}</td>
                  <td className="px-4 py-2.5 text-xs">{r.trn ? <span className="font-mono text-slate-500 text-[10px]">{r.trn}</span> : <span className="text-amber-500 font-bold text-[10px]">⚠ {isRTL ? "مفقود" : "Missing"}</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">AED {r.taxable.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">AED {r.vat.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-amber-700 text-xs">AED {r.netP.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PROFIT REPORT ──────────────────────────────────────────────────────
export function ProfitReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canView = role === "owner" || role === "accountant";
  const canExport = role === "owner" || role === "accountant";

  useEffect(() => {
    if (!canView || IS_MOCK_MODE) return;
    let cancelled = false;
    setLoading(true);
    getProfitReport({ date_from: from, date_to: to })
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, canView]);

  if (!canView) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock size={28} className="text-slate-400" /></div>
        <h2 className="text-xl font-black text-slate-600 mb-2">{isRTL ? "ليس لديك صلاحية عرض تقرير الربح" : "No permission to view profit report"}</h2>
        <p className="text-slate-400 font-semibold text-sm mb-6">{isRTL ? "يحتاج إذن من المالك" : "Requires Owner permission"}</p>
        <Btn variant="outline" onClick={() => onNavigate("reports")}>{isRTL ? "العودة للتقارير" : "Back to Reports"}</Btn>
      </div>
    </div>
  );

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const totals = (reportData.totals ?? {}) as Record<string, number>;
  const kpis = IS_MOCK_MODE ? [
    { v: "AED 425,000", ar: "إجمالي المبيعات",              en: "Total Sales",            cls: "text-emerald-600 bg-emerald-50" },
    { v: "AED 298,000", ar: "تكلفة البضاعة المباعة (FIFO)", en: "FIFO COGS",               cls: "text-red-500 bg-red-50" },
    { v: "AED 127,000", ar: "إجمالي الربح",                 en: "Gross Profit",            cls: "text-[#0F2C59] bg-[#0F2C59]/5" },
    { v: "AED 12,400",  ar: "المصروفات اليومية",             en: "Daily Expenses",          cls: "text-amber-600 bg-amber-50" },
    { v: "AED 26,650",  ar: "المصروفات الشهرية",             en: "Monthly Expenses",        cls: "text-amber-600 bg-amber-50" },
    { v: "AED 1,150",   ar: "مصروفات مرتبطة بالمشتريات",   en: "Purchase-Linked Exp.",    cls: "text-amber-600 bg-amber-50" },
    { v: "AED 300",     ar: "خصومات التحصيل",                en: "Collection Discounts",    cls: "text-red-400 bg-red-50" },
    { v: "AED 87,950",  ar: "صافي الربح",                    en: "Net Profit",              cls: "text-emerald-700 bg-emerald-50 text-xl" },
    { v: "20.7%",       ar: "هامش الربح",                    en: "Profit Margin",           cls: "text-emerald-600 bg-emerald-50" },
  ] : [
    { v: `AED ${Number(totals.total_sales ?? 0).toLocaleString()}`, ar: "إجمالي المبيعات", en: "Total Sales", cls: "text-emerald-600 bg-emerald-50" },
    { v: `AED ${Number(totals.cogs ?? 0).toLocaleString()}`, ar: "تكلفة البضاعة المباعة (FIFO)", en: "FIFO COGS", cls: "text-red-500 bg-red-50" },
    { v: `AED ${Number(totals.gross_profit ?? 0).toLocaleString()}`, ar: "إجمالي الربح", en: "Gross Profit", cls: "text-[#0F2C59] bg-[#0F2C59]/5" },
    { v: `AED ${Number(totals.daily_expenses ?? 0).toLocaleString()}`, ar: "المصروفات اليومية", en: "Daily Expenses", cls: "text-amber-600 bg-amber-50" },
    { v: `AED ${Number(totals.monthly_expenses ?? 0).toLocaleString()}`, ar: "المصروفات الشهرية", en: "Monthly Expenses", cls: "text-amber-600 bg-amber-50" },
    { v: `AED ${Number(totals.purchase_expenses ?? 0).toLocaleString()}`, ar: "مصروفات مرتبطة بالمشتريات", en: "Purchase-Linked Exp.", cls: "text-amber-600 bg-amber-50" },
    { v: `AED ${Number(totals.collection_discounts ?? 0).toLocaleString()}`, ar: "خصومات التحصيل", en: "Collection Discounts", cls: "text-red-400 bg-red-50" },
    { v: `AED ${Number(totals.net_profit ?? 0).toLocaleString()}`, ar: "صافي الربح", en: "Net Profit", cls: "text-emerald-700 bg-emerald-50 text-xl" },
    { v: `${Number(totals.profit_margin ?? 0).toFixed(1)}%`, ar: "هامش الربح", en: "Profit Margin", cls: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير صافي الربح" : "Net Profit Report"}</h2></div>
        <ExportBar lang={lang} title="profit" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k, i) => <Card key={i} className={`p-4 text-center ${k.cls.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${k.cls.split(" ")[0]}`}>{k.v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? k.ar : k.en}</div></Card>)}
      </div>

      {/* Formula cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 bg-[#0F2C59]/5 border-[#0F2C59]/20">
          <div className="text-xs font-black text-slate-500 mb-2">{isRTL ? "معادلة إجمالي الربح" : "Gross Profit Formula"}</div>
          <div className="font-mono text-sm text-[#0F2C59] font-bold">{isRTL ? "المبيعات − تكلفة البضاعة FIFO" : "Sales − FIFO COGS"}</div>
          <div className="font-mono text-base font-black text-[#0F2C59] mt-1">425,000 − 298,000 = <span className="text-emerald-600">127,000</span></div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-xs font-black text-slate-500 mb-2">{isRTL ? "معادلة صافي الربح" : "Net Profit Formula"}</div>
          <div className="font-mono text-sm text-emerald-700 font-bold">{isRTL ? "إجمالي الربح − المصروفات − الخصومات" : "Gross Profit − Expenses − Discounts"}</div>
          <div className="font-mono text-base font-black text-emerald-700 mt-1">127,000 − 39,050 − 300 = <span>87,950</span></div>
        </Card>
      </div>

      {/* FIFO note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-black text-blue-700 text-sm mb-0.5">{isRTL ? "تكلفة البضاعة المباعة — FIFO" : "Cost of Goods Sold — FIFO"}</div>
          <p className="text-xs font-semibold text-blue-600 leading-relaxed">{isRTL ? "يتم احتساب تكلفة البضاعة المباعة بطريقة FIFO من أقدم مشتريات متاحة أولاً. القيم تقديرية." : "COGS is calculated using FIFO from oldest available purchases first. Values are estimates."}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "الربح الشهري" : "Monthly Profit"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={R_PROFIT_TREND}>
              <CartesianGrid key="profrpt-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="profrpt-x" dataKey={isRTL ? "month" : "monthEn"} tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="profrpt-y" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="profrpt-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Line key="profrpt-line" type="monotone" dataKey="profit" stroke="#22C55E" strokeWidth={2.5} dot={false} name={isRTL ? "الربح" : "Profit"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "المبيعات مقابل التكلفة والمصروفات" : "Sales vs Cost vs Expenses"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={R_PROFIT_STACK} layout="vertical" barSize={22}>
              <CartesianGrid key="profbar-grid" strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis key="profbar-x" type="number" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis key="profbar-y" type="category" dataKey={isRTL ? "label" : "labelEn"} tick={{ fontSize: 10, fill: "#64748B", fontFamily: "Cairo" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip key="profbar-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Bar key="profbar-bar" dataKey="value" radius={[0,4,4,0]}>
                {R_PROFIT_STACK.map((e, i) => <Cell key={`pbc-${i}`} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Profit table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-black text-[#0F2C59] text-sm">{isRTL ? "تفصيل الربح حسب الفاتورة" : "Profit Detail by Invoice"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"التاريخ":"Date",isRTL?"المرجع":"Ref",isRTL?"العميل":"Customer",isRTL?"المبيعات":"Sales",isRTL?"تكلفة FIFO":"FIFO Cost",isRTL?"إجمالي الربح":"Gross Profit",isRTL?"المصروفات/الخصومات":"Exp/Disc",isRTL?"صافي الربح":"Net Profit",isRTL?"الهامش":"Margin"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_PROFIT_ROWS.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.ref}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.party}</td>
                  <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {r.sales.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-red-500 text-xs">AED {r.fifoCost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-[#0F2C59] text-xs">AED {r.grossP.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-amber-600 text-xs">AED {r.expDis}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-emerald-700 text-xs">AED {r.netP.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r.margin >= 20 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.margin}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: CUSTOMER REPORT ────────────────────────────────────────────────────
export function CustomerReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const canExport = role !== "cashier";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقارير العملاء" : "Customer Reports"}</h2></div>
        <ExportBar lang={lang} title="customers" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["AED 35,400",isRTL?"إجمالي مستحقات العملاء":"Total Receivables","text-red-500 bg-red-50"],["4",isRTL?"عملاء عليهم مديونية":"Customers With Balance","text-amber-600 bg-amber-50"],["1",isRTL?"تجاوزوا الحد الائتماني":"Exceeded Credit Limit","text-red-600 bg-red-50"],["AED 161,600",isRTL?"إجمالي التحصيلات":"Total Collections","text-emerald-600 bg-emerald-50"]].map(([v,l,c],i)=><Card key={i} className={`p-4 text-center ${c.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${c.split(" ")[0]}`}>{v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{l}</div></Card>)}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"العميل":"Customer",isRTL?"الرصيد الحالي":"Balance",isRTL?"الحد الائتماني":"Credit Limit",isRTL?"نسبة الاستخدام":"Usage",isRTL?"إجمالي المبيعات":"Total Sales",isRTL?"إجمالي التحصيلات":"Collections",isRTL?"آخر فاتورة":"Last Invoice",isRTL?"الإجراءات":"Actions"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_CUSTOMERS.map((c, i) => (
                <tr key={i} className={`hover:bg-slate-50/60 ${c.pct >= 100 ? "bg-red-50/20" : ""}`}>
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-sm">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-xs">{c.balance > 0 ? <span className="text-red-500">AED {c.balance.toLocaleString()}</span> : <span className="text-emerald-500">صفر</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{c.limit > 0 ? `AED ${c.limit.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="w-20 bg-slate-100 rounded-full h-2"><div className={`h-2 rounded-full ${c.pct >= 100 ? "bg-red-500" : c.pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, c.pct)}%` }} /></div><span className={`text-xs font-black ${c.pct >= 100 ? "text-red-500" : c.pct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{c.pct}%</span></div></td>
                  <td className="px-4 py-2.5 font-mono text-[#0F2C59] text-xs">AED {c.totalSales.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {c.collected.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{c.lastInv}</td>
                  <td className="px-4 py-2.5"><button onClick={() => onNavigate("customers-profile")} className="text-xs font-bold text-[#0F2C59] hover:underline">{isRTL ? "عرض" : "View"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: SUPPLIER REPORT ────────────────────────────────────────────────────
export function SupplierReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const canExport = role !== "cashier";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقارير الموردين" : "Supplier Reports"}</h2></div>
        <ExportBar lang={lang} title="suppliers" canExport={canExport} dateFrom={from} dateTo={to} />
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[["AED 50,443",isRTL?"إجمالي مستحقات الموردين":"Total Payables","text-amber-600 bg-amber-50"],["3",isRTL?"موردين لهم مستحقات":"Suppliers With Balance","text-amber-600 bg-amber-50"],["AED 142,500",isRTL?"إجمالي المشتريات":"Total Purchases","text-[#0F2C59] bg-[#0F2C59]/5"],["AED 92,057",isRTL?"إجمالي الدفعات":"Total Payments","text-emerald-600 bg-emerald-50"],["AED 1,300",isRTL?"إجمالي الخصومات":"Total Deductions","text-blue-600 bg-blue-50"],["4",isRTL?"فواتير غير مسددة":"Unpaid Invoices","text-red-500 bg-red-50"]].map(([v,l,c],i)=><Card key={i} className={`p-4 text-center ${c.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${c.split(" ")[0]}`}>{v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{l}</div></Card>)}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"المورد":"Supplier",isRTL?"الرصيد الحالي":"Balance",isRTL?"إجمالي المشتريات":"Total Purchases",isRTL?"إجمالي الدفعات":"Total Payments",isRTL?"إجمالي الخصومات":"Total Deductions",isRTL?"آخر فاتورة":"Last Invoice",isRTL?"الإجراءات":"Actions"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_SUPPLIERS.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{s.name}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-xs">{s.balance > 0 ? <span className="text-amber-600">AED {s.balance.toLocaleString()}</span> : <span className="text-emerald-500">صفر</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-[#0F2C59] text-xs">AED {s.totalP.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-emerald-600 text-xs">AED {s.paid.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-600 text-xs">{s.ded > 0 ? `AED ${s.ded}` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{s.lastInv}</td>
                  <td className="px-4 py-2.5"><button onClick={() => onNavigate("supplier-profile")} className="text-xs font-bold text-[#0F2C59] hover:underline">{isRTL ? "عرض" : "View"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: STATEMENTS CENTER ──────────────────────────────────────────────────
export function StatementsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [selectedCust, setSelectedCust] = useState("مطعم الخليج");
  const [selectedSupp, setSelectedSupp] = useState("WESTLAND FOODSTUFF");
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState("2025-01-31");
  const canExport = role !== "cashier";

  const RECENT_EXPORTS = [
    { date: "2025-01-28", type: isRTL ? "عميل" : "Customer",  name: "مطعم الخليج",         period: "يناير 2025", by: "أحمد (مالك)" },
    { date: "2025-01-27", type: isRTL ? "مورد" : "Supplier",  name: "WESTLAND FOODSTUFF",  period: "يناير 2025", by: "أحمد (مالك)" },
    { date: "2025-01-25", type: isRTL ? "عميل" : "Customer",  name: "Prime Fresh Meat LLC", period: "يناير 2025", by: "أحمد (مالك)" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "مركز كشوف الحساب" : "Account Statements Center"}</h2>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-2 flex">
          {[["customers", isRTL ? "كشوف العملاء" : "Customer Statements"], ["suppliers", isRTL ? "كشوف الموردين" : "Supplier Statements"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as "customers" | "suppliers")} className={`px-5 py-3.5 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${tab === k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400"}`}>{l}</button>
          ))}
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FSelect label={tab === "customers" ? (isRTL ? "اختر العميل" : "Select Customer") : (isRTL ? "اختر المورد" : "Select Supplier")}
              value={tab === "customers" ? selectedCust : selectedSupp}
              onChange={tab === "customers" ? setSelectedCust : setSelectedSupp}
              options={tab === "customers"
                ? R_CUSTOMERS.map(c => ({ value: c.name, label: c.name }))
                : R_SUPPLIERS.map(s => ({ value: s.name, label: s.name }))} />
            <FInput label={isRTL ? "من تاريخ" : "From Date"} type="date" value={from} onChange={setFrom} />
            <FInput label={isRTL ? "إلى تاريخ" : "To Date"} type="date" value={to} onChange={setTo} />
          </div>
          <div className="flex gap-3">
            {canExport ? (
              <>
                <Btn variant="primary" onClick={() => onNavigate(tab === "customers" ? "customers-statement" : "supplier-statement")}><Eye size={15} />{isRTL ? "عرض الكشف" : "View Statement"}</Btn>
                <Btn variant="secondary" onClick={() => toast.success(isRTL ? "تم تجهيز التقرير بنجاح" : "Statement ready")}><Download size={15} />PDF</Btn>
                <Btn variant="outline" onClick={() => toast.success(isRTL ? "تم تجهيز التقرير بنجاح" : "Statement ready")}><Download size={15} />Excel</Btn>
              </>
            ) : <PermBtn lang={lang}><Download size={15} />{isRTL ? "تصدير الكشف" : "Export"}</PermBtn>}
          </div>
        </div>
      </Card>

      {/* Recent exports */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "آخر الكشوف المُصدَّرة" : "Recently Exported Statements"}</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {RECENT_EXPORTS.map((r, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm">{r.name}</div>
                <div className="text-xs text-slate-400">{r.date} · {r.period} · {r.by}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.type === (isRTL ? "عميل" : "Customer") ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{r.type}</span>
                {canExport && <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Download size={13} /></button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: INVENTORY REPORT ───────────────────────────────────────────────────
export function InventoryReportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("2025-01-01"); const [to, setTo] = useState("2025-01-31");
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);
  const canExport = role !== "cashier";

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    let cancelled = false;
    setLoading(true);
    getInventoryReport({ date_from: from, date_to: to })
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const totals = (reportData.totals ?? {}) as Record<string, number>;
  const inventoryKpis = IS_MOCK_MODE
    ? [["103 كرتونة",isRTL?"الكراتين المتاحة":"Available Cartons","text-[#0F2C59] bg-[#0F2C59]/5"],["1,123 KG",isRTL?"الكيلو المتاح":"Available KG","text-[#0F2C59] bg-[#0F2C59]/5"],["AED 128,450",isRTL?"قيمة المخزون التقديرية":"Est. Inventory Value","text-emerald-600 bg-emerald-50"],["2",isRTL?"منتجات منخفضة":"Low Stock","text-amber-600 bg-amber-50"],["1",isRTL?"نفدت من المخزون":"Out of Stock","text-red-500 bg-red-50"],["4,200 KG",isRTL?"مضاف خلال الفترة":"Added This Period","text-emerald-600 bg-emerald-50"],["836 KG",isRTL?"مخصوم خلال الفترة":"Deducted This Period","text-red-500 bg-red-50"],["11",isRTL?"منتجات في الكتالوج":"Products in Catalog","text-slate-600 bg-slate-100"]]
    : [
      [String(totals.available_cartons ?? 0), isRTL ? "الكراتين المتاحة" : "Available Cartons", "text-[#0F2C59] bg-[#0F2C59]/5"],
      [`${Number(totals.available_kg ?? 0).toLocaleString()} KG`, isRTL ? "الكيلو المتاح" : "Available KG", "text-[#0F2C59] bg-[#0F2C59]/5"],
      [`AED ${Number(totals.inventory_value ?? 0).toLocaleString()}`, isRTL ? "قيمة المخزون التقديرية" : "Est. Inventory Value", "text-emerald-600 bg-emerald-50"],
      [String(totals.low_stock_count ?? 0), isRTL ? "منتجات منخفضة" : "Low Stock", "text-amber-600 bg-amber-50"],
      [String(totals.out_of_stock_count ?? 0), isRTL ? "نفدت من المخزون" : "Out of Stock", "text-red-500 bg-red-50"],
      [`${Number(totals.added_kg ?? 0).toLocaleString()} KG`, isRTL ? "مضاف خلال الفترة" : "Added This Period", "text-emerald-600 bg-emerald-50"],
      [`${Number(totals.deducted_kg ?? 0).toLocaleString()} KG`, isRTL ? "مخصوم خلال الفترة" : "Deducted This Period", "text-red-500 bg-red-50"],
      [String(totals.product_count ?? 0), isRTL ? "منتجات في الكتالوج" : "Products in Catalog", "text-slate-600 bg-slate-100"],
    ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقارير المخزون" : "Inventory Reports"}</h2></div>
        <div className="flex gap-2">
          <ExportBar lang={lang} title="inventory" canExport={canExport} dateFrom={from} dateTo={to} />
          <Btn variant="outline" size="sm" onClick={() => onNavigate("inventory-valuation")}><BarChart2 size={13} />{isRTL ? "تقييم FIFO" : "FIFO Valuation"}</Btn>
        </div>
      </div>
      <DateFilterBar lang={lang} from={from} to={to} onFrom={setFrom} onTo={setTo} preset={preset} onPreset={setPreset} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {inventoryKpis.map(([v,l,c],i)=><Card key={i} className={`p-4 text-center ${c.split(" ")[1]}`}><div className={`text-xl font-black font-mono ${c.split(" ")[0]}`}>{v}</div><div className="text-[10px] font-bold text-slate-500 mt-0.5">{l}</div></Card>)}
      </div>

      <Card>
        <div className="px-5 py-3 border-b border-slate-100 font-black text-[#0F2C59] text-sm">{isRTL ? "المخزون الحالي" : "Current Stock"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"المنتج":"Product",isRTL?"الكراتين":"Cartons","KG",isRTL?"الحد الأدنى":"Min Level",isRTL?"الحالة":"Status",isRTL?"تكلفة FIFO":"FIFO Cost",isRTL?"آخر شراء":"Last Purchase",isRTL?"آخر بيع":"Last Sale"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { name: "900 جرام", ct: 34, kg: 306, minCt: 20, status: "available", fifo: 12.25, lastP: "2025-01-28", lastS: "2025-01-28" },
                { name: "1000 جرام", ct: 8, kg: 80, minCt: 20, status: "low", fifo: 12.50, lastP: "2025-01-27", lastS: "2025-01-28" },
                { name: "1100 جرام", ct: 24, kg: 264, minCt: 15, status: "available", fifo: 13.00, lastP: "2025-01-25", lastS: "2025-01-27" },
                { name: "1200 جرام", ct: 0, kg: 0, minCt: 15, status: "out", fifo: 13.25, lastP: "2025-01-20", lastS: "2025-01-22" },
                { name: "كبدة", ct: 0, kg: 13, minCt: 0, status: "available", fifo: 3.50, lastP: "2025-01-28", lastS: "2025-01-28" },
              ].map((p, i) => (
                <tr key={i} className={`hover:bg-slate-50/60 ${p.status === "out" ? "bg-red-50/20" : ""}`}>
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{p.name}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#0F2C59] text-xs">{p.ct || "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#0F2C59] text-xs">{p.kg > 0 ? `${p.kg} KG` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{p.minCt > 0 ? `${p.minCt} Ct` : "—"}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status==="available"?"bg-emerald-100 text-emerald-700":p.status==="low"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>{p.status==="available"?(isRTL?"متوفر":"Available"):p.status==="low"?(isRTL?"منخفض":"Low"):(isRTL?"نفد":"Out")}</span></td>
                  <td className="px-4 py-2.5 font-mono text-blue-600 text-xs">AED {p.fifo}/KG</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{p.lastP}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{p.lastS}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: REPORT BUILDER ─────────────────────────────────────────────────────
export function ReportBuilderScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [source, setSource] = useState("sales");
  const [groupBy, setGroupBy] = useState("date");
  const [format, setFormat] = useState("pdf");

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("reports")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقرير مخصص" : "Custom Report"}</h2>
      </div>

      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2">
        <Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-slate-500">{isRTL ? "التقرير المخصص يساعدك على اختيار البيانات التي تريد عرضها فقط." : "Custom report helps you select only the data you want to display."}</p>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "إعدادات التقرير" : "Report Configuration"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FSelect label={isRTL ? "مصدر البيانات *" : "Data Source *"} value={source} onChange={setSource}
            options={[{value:"sales",label:isRTL?"المبيعات":"Sales"},{value:"purchases",label:isRTL?"المشتريات":"Purchases"},{value:"inventory",label:isRTL?"المخزون":"Inventory"},{value:"customers",label:isRTL?"العملاء":"Customers"},{value:"suppliers",label:isRTL?"الموردين":"Suppliers"},{value:"expenses",label:isRTL?"المصروفات":"Expenses"},{value:"tax",label:isRTL?"الضريبة":"Tax"}]} />
          <FSelect label={isRTL ? "تجميع حسب" : "Group By"} value={groupBy} onChange={setGroupBy}
            options={[{value:"date",label:isRTL?"التاريخ":"Date"},{value:"customer",label:isRTL?"العميل":"Customer"},{value:"supplier",label:isRTL?"المورد":"Supplier"},{value:"product",label:isRTL?"المنتج":"Product"},{value:"method",label:isRTL?"طريقة الدفع":"Payment Method"}]} />
          <FInput label={isRTL ? "من تاريخ" : "From Date"} type="date" value="2025-01-01" onChange={() => {}} />
          <FInput label={isRTL ? "إلى تاريخ" : "To Date"} type="date" value="2025-01-31" onChange={() => {}} />
          <FSelect label={isRTL ? "صيغة التصدير" : "Export Format"} value={format} onChange={setFormat}
            options={[{value:"pdf",label:"PDF"},{value:"excel",label:"Excel"}]} />
        </div>
      </Card>

      {/* Preview table */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "معاينة التقرير" : "Report Preview"}</h3>
          <span className="text-xs text-slate-400 font-semibold">{isRTL ? "أول 5 سجلات" : "First 5 records"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"التاريخ":"Date",isRTL?"المرجع":"Reference",source==="sales"?(isRTL?"العميل":"Customer"):source==="purchases"?(isRTL?"المورد":"Supplier"):(isRTL?"المنتج":"Product"),isRTL?"المبلغ":"Amount",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-4 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {R_SALES_INVOICES.slice(0,4).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0F2C59] font-bold">{r.id}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 text-xs">{r.customer}</td>
                  <td className="px-4 py-2.5 font-mono font-black text-[#0F2C59] text-xs">AED {r.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status==="paid"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex gap-3 justify-end">
        <Btn variant="secondary" onClick={() => toast.success(isRTL ? "تم تجهيز التقرير بنجاح" : "Report ready")}><Download size={15} />PDF</Btn>
        <Btn variant="primary" onClick={() => toast.success(isRTL ? "تم تجهيز التقرير بنجاح" : "Report ready")}><Download size={15} />Excel</Btn>
      </div>
    </div>
  );
}

// ── PANEL: REPORTS SETTINGS ────────────────────────────────────────────────────
function ReportsSettingsPanel({ lang, role, onClose }: { lang: Lang; role: TenantRole; onClose: () => void }) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner";
  const [showCancelled, setShowCancelled] = useState(false);
  const [includeDraft, setIncludeDraft] = useState(false);
  const [accProfit, setAccProfit] = useState(true);
  const [cashierDaily, setCashierDaily] = useState(false);
  const [cashierExport, setCashierExport] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات التقارير" : "Reports Settings"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {[
            [showCancelled, setShowCancelled, isRTL ? "إظهار الفواتير الملغاة في التقارير" : "Show cancelled invoices in reports"],
            [includeDraft, setIncludeDraft, isRTL ? "تضمين المسودات في التقارير (غير مفعّل افتراضياً)" : "Include drafts in reports (off by default)"],
            [accProfit, setAccProfit, isRTL ? "السماح للمحاسب بعرض تقرير الربح" : "Allow accountant to view profit report"],
            [cashierDaily, setCashierDaily, isRTL ? "السماح للكاشير بعرض تقرير المبيعات اليومي" : "Allow cashier to view daily sales report"],
            [cashierExport, setCashierExport, isRTL ? "السماح للكاشير بتصدير التقارير" : "Allow cashier to export reports"],
          ].map(([val, setter, label]: any) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm font-bold text-slate-700">{label}</span>
              <button onClick={() => canEdit && setter(!val)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${val ? "bg-[#0F2C59]" : "bg-slate-300"} ${!canEdit ? "cursor-not-allowed" : ""}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${val ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-5 py-4 flex gap-3 shrink-0">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
          {canEdit && <Btn className="flex-1 justify-center" onClick={() => { toast.success(isRTL ? "تم حفظ الإعدادات" : "Settings saved"); onClose(); }}><Check size={14} />{isRTL ? "حفظ" : "Save"}</Btn>}
        </div>
      </div>
    </div>
  );
}
