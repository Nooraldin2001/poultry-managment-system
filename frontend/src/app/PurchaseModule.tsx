// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — PHASE 4: PURCHASE INVOICE MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import type { ReactNode, ElementType } from "react";
import {
  Plus, Search, Eye, Ban, Check, ChevronRight, ChevronLeft,
  DollarSign, AlertTriangle, Info, Download, ShoppingCart,
  FileText, Package, Mail, Printer, Settings, ChevronDown, X,
  CheckCircle, AlertCircle, Wallet, Pencil
} from "lucide-react";
import { toast } from "sonner";
import { usePurchases, usePurchaseDetail } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { toModulePurchase } from "./moduleMappers";
import { IS_MOCK_MODE } from "@/services/config";
import { LivePurchaseInvoiceScreen } from "@/features/invoices/LivePurchaseInvoiceScreen";
import { cancelPurchase } from "@/services/purchaseService";
import { ApiError } from "@/services/api/errors";
import {
  getPurchaseStatusStyle,
  normalizePurchaseInvoiceStatus,
} from "@/shared/utils/purchaseStatus";

// ── LOCAL TYPE ALIASES (mirrors App.tsx — no circular import) ──────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "sales-preview" | "sales-detail"
  | "purchases" | "purchases-list" | "purchases-new" | "purchases-edit" | "purchases-preview" | "purchases-detail"
  | "quotations" | "inventory" | "customers" | "suppliers" | "payments"
  | "expenses" | "accounts" | "tax" | "reports" | "users" | "settings";

// ── LOCAL SHARED UI PRIMITIVES ─────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "green";
  size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-2 font-bold rounded-xl transition-all duration-150 cursor-pointer border focus:outline-none";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary:   "bg-[#0F2C59] text-white border-[#0F2C59] hover:bg-[#162f5f] active:scale-[0.98]",
    secondary: "bg-white text-[#0F2C59] border-[#0F2C59]/20 hover:border-[#0F2C59]/40 hover:bg-[#0F2C59]/5",
    danger:    "bg-[#EF4444] text-white border-[#EF4444] hover:bg-red-600 active:scale-[0.98]",
    ghost:     "bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700",
    outline:   "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    green:     "bg-[#22C55E] text-white border-[#22C55E] hover:bg-emerald-600 active:scale-[0.98] shadow-lg shadow-emerald-200/50",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
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

function AuditBadge({ type, lang }: { type: "price" | "kg"; lang: Lang }) {
  const cfg = {
    price: { bg: "bg-amber-100", t: "text-amber-700", ar: "تم تعديل السعر", en: "Price modified" },
    kg:    { bg: "bg-amber-100", t: "text-amber-700", ar: "تم تعديل الكيلو", en: "KG overridden" },
  }[type] ?? { bg: "bg-slate-100", t: "text-slate-600", ar: "—", en: "—" };
  return <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

function PermBtn({ children, lang }: { children: ReactNode; lang: Lang }) {
  const msg = lang === "ar" ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission";
  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed select-none bg-slate-50 text-slate-400 border-slate-200 opacity-60">{children}</div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-30 pointer-events-none shadow-xl max-w-48 text-center`}>{msg}</div>
    </div>
  );
}

// ── PURCHASE TYPES ─────────────────────────────────────────────────────────────
type PurchStatus = "draft" | "approved" | "paid" | "partial" | "credit" | "cancelled";

interface PurchLine {
  id: string; productId: string; method: "kg" | "piece" | "carton";
  cartons: number; pcs: number; kg: number; rate: number; amount: number;
  kgOverride: boolean; priceOverride: boolean; notes: string;
}
interface PurchCostLine {
  id: string; type: string; description: string; amount: number;
  treatment: "deduct" | "add-cost" | "expense" | "commercial-discount";
}

// ── PURCHASE DATA ──────────────────────────────────────────────────────────────
const P_SUPPLIERS = [
  { id: "ps1", name: "WESTLAND FOODSTUFF TRADING LLC", nameAr: "ويستلاند للمواد الغذائية", phone: "+971 4 123 4567",  balance: 28000, creditType: "credit", trn: "100765432100003" },
  { id: "ps2", name: "MNM Foodstuff Trading LLC",       nameAr: "MNM للمواد الغذائية",       phone: "+971 50 987 6543", balance: 15500, creditType: "credit", trn: "" },
  { id: "ps3", name: "مزرعة العين للدواجن",             nameAr: "مزرعة العين للدواجن",        phone: "+971 3 765 4321",  balance: 0,     creditType: "cash",   trn: "" },
  { id: "ps4", name: "شركة الإمارات للدواجن",           nameAr: "شركة الإمارات للدواجن",      phone: "+971 2 654 3210",  balance: 8400,  creditType: "credit", trn: "100444555600009" },
];

const MOCK_P_INVOICES = [
  { id: "PUR-2025-0042", date: "2025-01-28", supplierId: "ps1", supplier: "WESTLAND FOODSTUFF",   supplierInvNo: "WST-2025-1234", cartons: 146, pieces: 1460, kg: 1310, goodsTotal: 3305.55, deductions: 0,    vat: 165.28, netPayable: 3470.83, paid: 3470.83, remaining: 0,    method: "bank",   status: "paid"    as PurchStatus, user: "أحمد (مالك)"  },
  { id: "PUR-2025-0041", date: "2025-01-27", supplierId: "ps4", supplier: "الإمارات للدواجن",    supplierInvNo: "EMR-0041-2025", cartons: 400, pieces: 4000, kg: 4200, goodsTotal: 10000,   deductions: 1000, vat: 450,    netPayable: 9450,    paid: 5000,    remaining: 4450, method: "credit", status: "partial" as PurchStatus, user: "محمد (كاشير)" },
  { id: "PUR-2025-0040", date: "2025-01-26", supplierId: "ps2", supplier: "MNM Foodstuff",        supplierInvNo: "MNM-501",       cartons: 0,   pieces: 0,    kg: 0,    goodsTotal: 0,       deductions: 0,    vat: 0,      netPayable: 0,       paid: 0,       remaining: 0,    method: "cash",   status: "draft"   as PurchStatus, user: "محمد (كاشير)" },
  { id: "PUR-2025-0038", date: "2025-01-25", supplierId: "ps1", supplier: "WESTLAND FOODSTUFF",   supplierInvNo: "WST-2025-1198", cartons: 220, pieces: 2200, kg: 2800, goodsTotal: 8400,    deductions: 700,  vat: 385,    netPayable: 8085,    paid: 8085,    remaining: 0,    method: "bank",   status: "paid"    as PurchStatus, user: "أحمد (مالك)"  },
  { id: "PUR-2025-0035", date: "2025-01-20", supplierId: "ps4", supplier: "الإمارات للدواجن",    supplierInvNo: "EMR-0035-2025", cartons: 180, pieces: 1800, kg: 1900, goodsTotal: 5700,    deductions: 300,  vat: 270,    netPayable: 5670,    paid: 5670,    remaining: 0,    method: "bank",   status: "paid"    as PurchStatus, user: "أحمد (مالك)"  },
  { id: "PUR-2025-0030", date: "2025-01-15", supplierId: "ps3", supplier: "مزرعة العين للدواجن", supplierInvNo: "AIN-887",       cartons: 300, pieces: 3000, kg: 3200, goodsTotal: 9600,    deductions: 0,    vat: 0,      netPayable: 9600,    paid: 9600,    remaining: 0,    method: "cash",   status: "paid"    as PurchStatus, user: "أحمد (مالك)"  },
];

interface PProd { id: string; name: string; nameAr: string; g: number; ppc: number; costKg: number; variable?: boolean; }
const P_PRODUCTS: PProd[] = [
  { id: "pp400",  name: "400 GRAM",  nameAr: "400 جرام",  g: 400,  ppc: 20, costKg: 10.50 },
  { id: "pp450",  name: "450 GRAM",  nameAr: "450 جرام",  g: 450,  ppc: 20, costKg: 10.75 },
  { id: "pp500",  name: "500 GRAM",  nameAr: "500 جرام",  g: 500,  ppc: 20, costKg: 11.00 },
  { id: "pp550",  name: "550 GRAM",  nameAr: "550 جرام",  g: 550,  ppc: 20, costKg: 11.00 },
  { id: "pp600",  name: "600 GRAM",  nameAr: "600 جرام",  g: 600,  ppc: 20, costKg: 11.25 },
  { id: "pp650",  name: "650 GRAM",  nameAr: "650 جرام",  g: 650,  ppc: 20, costKg: 11.50 },
  { id: "pp700",  name: "700 GRAM",  nameAr: "700 جرام",  g: 700,  ppc: 16, costKg: 11.50 },
  { id: "pp750",  name: "750 GRAM",  nameAr: "750 جرام",  g: 750,  ppc: 16, costKg: 11.75 },
  { id: "pp800",  name: "800 GRAM",  nameAr: "800 جرام",  g: 800,  ppc: 16, costKg: 12.00 },
  { id: "pp850",  name: "850 GRAM",  nameAr: "850 جرام",  g: 850,  ppc: 16, costKg: 12.00 },
  { id: "pp900",  name: "900 GRAM",  nameAr: "900 جرام",  g: 900,  ppc: 10, costKg: 12.25 },
  { id: "pp950",  name: "950 GRAM",  nameAr: "950 جرام",  g: 950,  ppc: 10, costKg: 12.50 },
  { id: "pp1000", name: "1000 GRAM", nameAr: "1000 جرام", g: 1000, ppc: 10, costKg: 12.50 },
  { id: "pp1050", name: "1050 GRAM", nameAr: "1050 جرام", g: 1050, ppc: 10, costKg: 12.75 },
  { id: "pp1100", name: "1100 GRAM", nameAr: "1100 جرام", g: 1100, ppc: 10, costKg: 13.00 },
  { id: "pp1150", name: "1150 GRAM", nameAr: "1150 جرام", g: 1150, ppc: 10, costKg: 13.00 },
  { id: "pp1200", name: "1200 GRAM", nameAr: "1200 جرام", g: 1200, ppc: 10, costKg: 13.25 },
  { id: "pp1250", name: "1250 GRAM", nameAr: "1250 جرام", g: 1250, ppc: 10, costKg: 13.25 },
  { id: "pp1300", name: "1300 GRAM", nameAr: "1300 جرام", g: 1300, ppc: 10, costKg: 13.50 },
  { id: "pp1350", name: "1350 GRAM", nameAr: "1350 جرام", g: 1350, ppc: 10, costKg: 13.50 },
  { id: "pp1400", name: "1400 GRAM", nameAr: "1400 جرام", g: 1400, ppc: 10, costKg: 13.75 },
  { id: "pp1450", name: "1450 GRAM", nameAr: "1450 جرام", g: 1450, ppc: 10, costKg: 13.75 },
  { id: "pp1500", name: "1500 GRAM", nameAr: "1500 جرام", g: 1500, ppc: 10, costKg: 14.00 },
  { id: "pp1550", name: "1550 GRAM", nameAr: "1550 جرام", g: 1550, ppc: 10, costKg: 14.00, variable: true },
  { id: "pp1600", name: "1600 GRAM", nameAr: "1600 جرام", g: 1600, ppc: 10, costKg: 14.25, variable: true },
  { id: "pp1700", name: "1700 GRAM", nameAr: "1700 جرام", g: 1700, ppc: 10, costKg: 14.50, variable: true },
  { id: "pp1800", name: "1800 GRAM", nameAr: "1800 جرام", g: 1800, ppc: 8,  costKg: 14.75, variable: true },
  { id: "pp1900", name: "1900 GRAM", nameAr: "1900 جرام", g: 1900, ppc: 8,  costKg: 15.00, variable: true },
  { id: "pp2000", name: "2000 GRAM", nameAr: "2000 جرام", g: 2000, ppc: 6,  costKg: 15.25, variable: true },
];
const P_PARTS = [
  { id: "pliver", name: "Liver 500G",      nameAr: "كبدة 500 جرام",   rate: 0.70 },
  { id: "pgizz",  name: "Gizzard 500G",    nameAr: "قانصة 500 جرام",  rate: 1.00 },
  { id: "pheart", name: "Heart 500G",      nameAr: "قلب 500 جرام",    rate: 0.70 },
  { id: "pfeet",  name: "Feet 500G",       nameAr: "أقدام 500 جرام",  rate: 0.50 },
  { id: "pneck",  name: "Neck 500G",       nameAr: "رقبة 500 جرام",   rate: 0.40 },
  { id: "pbrst",  name: "Boneless Breast", nameAr: "صدور بدون عظم",   rate: 1.25 },
  { id: "pleg",   name: "Whole Legs",      nameAr: "أرجل كاملة",       rate: 1.10 },
  { id: "pwing",  name: "Wings",           nameAr: "أجنحة",             rate: 1.25 },
  { id: "pbone",  name: "Bone",            nameAr: "عظام",              rate: 0.30 },
  { id: "poth",   name: "Others KG",       nameAr: "أخرى كيلو",        rate: 0.50 },
];
const P_COST_TYPES = [
  { ar: "تكلفة الذبح",    en: "Slaughter cost" },
  { ar: "تكلفة النقل",    en: "Transport cost" },
  { ar: "تحميل وتنزيل",  en: "Loading/Unloading" },
  { ar: "تعبئة وتغليف",  en: "Packaging" },
  { ar: "رسوم مسلخ",     en: "Slaughterhouse fees" },
  { ar: "خصم من المورد", en: "Supplier discount" },
  { ar: "فرق وزن",        en: "Weight difference" },
  { ar: "سبب آخر",        en: "Other reason" },
];
const P_SAMPLE_LINES = [
  { product: "700 GRAM",  productAr: "700 جرام",  method: "piece", ct: 6,  pcs: 60,  kg: 42,   rate: 1.15, rateType: "piece", amount: 69     },
  { product: "750 GRAM",  productAr: "750 جرام",  method: "piece", ct: 11, pcs: 110, kg: 82.5, rate: 1.15, rateType: "piece", amount: 126.50 },
  { product: "800 GRAM",  productAr: "800 جرام",  method: "piece", ct: 20, pcs: 200, kg: 160,  rate: 1.15, rateType: "piece", amount: 230    },
  { product: "900 GRAM",  productAr: "900 جرام",  method: "piece", ct: 34, pcs: 340, kg: 306,  rate: 1.15, rateType: "piece", amount: 391    },
  { product: "1000 GRAM", productAr: "1000 جرام", method: "piece", ct: 36, pcs: 360, kg: 360,  rate: 1.15, rateType: "piece", amount: 414    },
  { product: "1100 GRAM", productAr: "1100 جرام", method: "piece", ct: 24, pcs: 240, kg: 264,  rate: 1.15, rateType: "piece", amount: 276    },
  { product: "1200 GRAM", productAr: "1200 جرام", method: "piece", ct: 15, pcs: 150, kg: 180,  rate: 1.15, rateType: "piece", amount: 172.50 },
];
const P_SAMPLE_BYPRODUCTS = [
  { product: "Liver 500G",      productAr: "كبدة 500 جرام",  trays: 170, kg: 85,   rate: 0.70, amount: 119   },
  { product: "Gizzard 500G",    productAr: "قانصة 500 جرام", trays: 59,  kg: 29.5, rate: 1.00, amount: 59    },
  { product: "Heart 500G",      productAr: "قلب 500 جرام",   trays: 29,  kg: 14.5, rate: 0.70, amount: 20.30 },
  { product: "Boneless Breast", productAr: "صدور بدون عظم",  trays: 17,  kg: 17,   rate: 1.25, amount: 21.25 },
  { product: "Wings",           productAr: "أجنحة",           trays: 7,   kg: 7,    rate: 1.25, amount: 8.75  },
];

// ── PURCHASE STATUS BADGE ──────────────────────────────────────────────────────
function PurchStatusBadge({ status, lang, paymentStatus }: { status: string; lang: Lang; paymentStatus?: string }) {
  const cfg = getPurchaseStatusStyle(status, paymentStatus);
  const label = lang === "ar" ? (cfg.labelAr ?? cfg.ar ?? status) : (cfg.labelEn ?? cfg.en ?? status);
  const textClass = cfg.t ?? cfg.text;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${textClass}`}>{label}</span>;
}

type PurchListItem = (typeof MOCK_P_INVOICES)[number];

function purchaseRowFromMock(inv: PurchListItem) {
  return {
    id: inv.id,
    number: inv.id,
    supplier: inv.supplier,
    supplierId: inv.supplierId,
    date: inv.date,
    dueDate: inv.date,
    status: inv.status,
    paymentStatus: inv.method,
    subtotal: inv.goodsTotal,
    vat: inv.vat,
    total: inv.netPayable,
    paid: inv.paid,
    balance: inv.remaining,
  };
}

function mergePurchaseListItem(row: import("@/shared/types/entities").PurchaseInvoiceRow): PurchListItem & { recordId: string } {
  const m = toModulePurchase(row);
  const mock = IS_MOCK_MODE ? MOCK_P_INVOICES.find((x) => x.id === row.id || x.id === row.number) : undefined;
  const displayStatus = normalizePurchaseInvoiceStatus(m.status, m.paymentStatus) as PurchStatus;
  return {
    id: m.number || m.id,
    recordId: row.id,
    date: m.date || "",
    supplierId: m.supplierId,
    supplier: m.supplier || "—",
    supplierInvNo: mock?.supplierInvNo ?? "",
    cartons: mock?.cartons ?? 0,
    pieces: mock?.pieces ?? 0,
    kg: mock?.kg ?? 0,
    goodsTotal: mock?.goodsTotal ?? m.subtotal,
    deductions: mock?.deductions ?? 0,
    vat: m.vat,
    netPayable: m.total,
    paid: m.paid,
    remaining: m.balance,
    method: mock?.method ?? m.paymentStatus,
    status: displayStatus,
    user: mock?.user ?? "",
  };
}

// ── SCREEN: PURCHASE LIST ──────────────────────────────────────────────────────
export function PurchListScreen({ lang, role, onNavigate, setSelectedPurchaseId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; setSelectedPurchaseId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showPay, setShowPay] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState<string | null>(null);

  const listFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    if (filterStatus === "cancelled") f.status = "cancelled";
    else if (filterStatus === "draft") f.status = "draft";
    else if (filterStatus === "approved") f.status = "approved";
    else if (filterStatus === "partial") f.status = "partially_paid";
    else if (filterStatus === "paid") f.status = "paid";
    else if (filterStatus === "credit") f.status = "credit";
    else if (filterStatus === "all") f.include_cancelled = "1";
    return Object.keys(f).length ? f : undefined;
  }, [search, filterStatus]);

  const { items: purchaseRows, loading, error, forbidden, reload } = usePurchases(
    listFilters,
    async () => MOCK_P_INVOICES.map(purchaseRowFromMock),
  );
  const P_INVOICES = (Array.isArray(purchaseRows) ? purchaseRows : []).map(mergePurchaseListItem);

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const filtered = P_INVOICES;

  const openDetail = (recordId: string) => {
    setSelectedPurchaseId?.(recordId);
    onNavigate("purchases-detail");
  };
  const openEdit = (recordId: string) => {
    setSelectedPurchaseId?.(recordId);
    onNavigate("purchases-edit");
  };
  const openPrint = (recordId: string) => {
    setSelectedPurchaseId?.(recordId);
    onNavigate("purchases-preview");
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#0F2C59] transition-colors">
          <Settings size={13} />{isRTL ? "إعدادات ترقيم فواتير الشراء" : "Purchase Numbering Settings"}
        </button>
        <Btn variant="primary" onClick={() => { setSelectedPurchaseId?.(""); onNavigate("purchases-new"); }}><Plus size={15} />{isRTL ? "فاتورة شراء جديدة" : "New Purchase Invoice"}</Btn>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث برقم الفاتورة أو المورد..." : "Search by invoice or supplier..."}
              className={`w-full py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600 focus:outline-none">
            <option value="active">{isRTL ? "نشطة (بدون الملغاة)" : "Active (excl. cancelled)"}</option>
            <option value="all">{isRTL ? "الكل (مع الملغاة)" : "All (incl. cancelled)"}</option>
            <option value="draft">{isRTL ? "مسودة" : "Draft"}</option>
            <option value="approved">{isRTL ? "معتمدة" : "Approved"}</option>
            <option value="paid">{isRTL ? "مدفوعة" : "Paid"}</option>
            <option value="partial">{isRTL ? "مدفوعة جزئياً" : "Partial"}</option>
            <option value="credit">{isRTL ? "على الحساب" : "Credit"}</option>
            <option value="cancelled">{isRTL ? "ملغاة" : "Cancelled"}</option>
          </select>
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
        </div>
      </Card>

      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "رقم الفاتورة" : "Invoice #", isRTL ? "التاريخ" : "Date", isRTL ? "المورد" : "Supplier", isRTL ? "رقم فاتورة المورد" : "Supplier Inv#", isRTL ? "الكراتين" : "Cartons", "KG", isRTL ? "إجمالي البضاعة" : "Goods Total", isRTL ? "الخصومات" : "Deductions", isRTL ? "صافي المستحق" : "Net Payable", isRTL ? "المدفوع" : "Paid", isRTL ? "المتبقي" : "Remaining", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={`ph-${i}`} className={`px-3 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-3"><div className="font-mono font-bold text-[#0F2C59] text-xs">{inv.id}</div><div className="text-[10px] text-slate-400">{inv.user}</div></td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{inv.date}</td>
                    <td className="px-3 py-3 font-bold text-slate-800 text-xs">{inv.supplier}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{inv.supplierInvNo || "—"}</td>
                    <td className="px-3 py-3 font-mono text-slate-600">{inv.cartons || "—"}</td>
                    <td className="px-3 py-3 font-mono text-slate-600">{inv.kg ? `${inv.kg}` : "—"}</td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-700">{inv.goodsTotal ? `AED ${inv.goodsTotal.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-3 font-mono text-amber-600">{inv.deductions ? `−AED ${inv.deductions.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-3 font-mono font-black text-[#0F2C59]">{inv.netPayable ? `AED ${inv.netPayable.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-3 font-mono font-bold text-emerald-600">{inv.paid ? `AED ${inv.paid.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-3">{inv.remaining > 0 ? <span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span> : inv.status !== "draft" && inv.status !== "cancelled" ? <span className="text-emerald-500 font-bold text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-3"><PurchStatusBadge status={inv.status} lang={lang} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {inv.status === "draft" && <button onClick={() => openEdit(inv.recordId)} className="text-xs px-2 py-1 bg-[#0F2C59] text-white rounded-lg font-bold">{isRTL ? "تعديل" : "Edit"}</button>}
                        {(inv.status === "approved" || inv.status === "partial" || inv.status === "credit") && <button onClick={() => setShowPay(inv.id)} className="text-xs px-2 py-1 bg-emerald-500 text-white rounded-lg font-bold">{isRTL ? "دفعة" : "Pay"}</button>}
                        <button onClick={() => openDetail(inv.recordId)} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all"><Eye size={13} /></button>
                        <button onClick={() => openPrint(inv.recordId)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all" title={isRTL ? "طباعة / حفظ PDF" : "Print / Save PDF"}><Printer size={13} /></button>
                        {inv.status !== "cancelled" && inv.status !== "draft" && role === "owner" && <button onClick={() => setShowCancel(inv.recordId)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><Ban size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map(inv => (
            <Card key={inv.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-mono font-bold text-[#0F2C59] text-sm">{inv.id}</div><div className="font-bold text-slate-700 text-sm mt-0.5">{inv.supplier}</div><div className="text-xs text-slate-400">{isRTL ? "فاتورة المورد:" : "Supplier Inv:"} {inv.supplierInvNo}</div></div>
                <PurchStatusBadge status={inv.status} lang={lang} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center my-3">
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-sm">{inv.netPayable ? inv.netPayable.toLocaleString() : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "صافي المستحق" : "Net Payable"}</div></div>
                <div className="bg-emerald-50 rounded-xl p-2"><div className="font-mono font-black text-emerald-600 text-sm">{inv.paid ? inv.paid.toLocaleString() : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "المدفوع" : "Paid"}</div></div>
                <div className={`rounded-xl p-2 ${inv.remaining > 0 ? "bg-red-50" : "bg-slate-50"}`}><div className={`font-mono font-black text-sm ${inv.remaining > 0 ? "text-red-500" : "text-slate-300"}`}>{inv.remaining > 0 ? inv.remaining.toLocaleString() : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "المتبقي" : "Remaining"}</div></div>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" onClick={() => openDetail(inv.recordId)}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
                {(inv.status === "approved" || inv.status === "partial" || inv.status === "credit") && <Btn size="sm" variant="green" onClick={() => setShowPay(inv.id)}><DollarSign size={13} />{isRTL ? "دفعة للمورد" : "Pay Supplier"}</Btn>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <EmptyState lang={lang} messageAr="لا توجد فواتير شراء بعد" messageEn="No purchase invoices yet" />
      )}

      {showPay && <SupplierPayModal lang={lang} invoiceId={showPay} onClose={() => setShowPay(null)} />}
      {showCancel && <CancelPurchModal lang={lang} invoiceId={showCancel} onClose={() => setShowCancel(null)} onSuccess={() => { setShowCancel(null); void reload(); }} />}
    </div>
  );
}

// ── SCREEN: NEW PURCHASE INVOICE ───────────────────────────────────────────────
export function PurchNewScreen({ lang, role, permissions, onNavigate, purchaseId, onSaved }: {
  lang: Lang; role: TenantRole; permissions?: string[]; onNavigate: (s: TenantScreen) => void; purchaseId?: string; onSaved?: (id: string) => void;
}) {
  if (!IS_MOCK_MODE) {
    return (
      <LivePurchaseInvoiceScreen
        lang={lang}
        role={role}
        permissions={permissions}
        onNavigate={onNavigate}
        invoiceId={purchaseId ?? null}
        onSaved={onSaved}
      />
    );
  }
  const isRTL = lang === "ar";
  const canEditPrice = role === "owner";
  const canApprove = role === "owner" || role === "accountant";

  const [supplierId, setSupplierId] = useState("");
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [supplierInvDate, setSupplierInvDate] = useState("");
  const [lines, setLines] = useState<PurchLine[]>([]);
  const [byproductLines, setByproductLines] = useState<{ id: string; productId: string; trays: number; kg: number; rate: number; amount: number }[]>([]);
  const [costLines, setCostLines] = useState<PurchCostLine[]>([]);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [payMethod, setPayMethod] = useState("bank");
  const [amountPaid, setAmountPaid] = useState("");
  const [showByproducts, setShowByproducts] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [flowState, setFlowState] = useState<"form" | "confirm" | "success">("form");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPart, setSelectedPart] = useState("");

  const supplier = P_SUPPLIERS.find(s => s.id === supplierId);
  const linesTotal = lines.reduce((s, l) => s + l.amount, 0);
  const byproductsTotal = byproductLines.reduce((s, l) => s + l.amount, 0);
  const goodsTotal = linesTotal + byproductsTotal;
  const deductTotal = costLines.filter(c => c.treatment === "deduct" || c.treatment === "commercial-discount").reduce((s, c) => s + c.amount, 0);
  const inventoryCostAdds = costLines.filter(c => c.treatment === "add-cost").reduce((s, c) => s + c.amount, 0);
  const expenseOnly = costLines.filter(c => c.treatment === "expense").reduce((s, c) => s + c.amount, 0);
  const inventoryCostBasis = goodsTotal + inventoryCostAdds;
  const netGoods = Math.max(0, goodsTotal - deductTotal);
  const vatAmt = vatEnabled ? Math.round(netGoods * 5) / 100 : 0;
  const netPayable = netGoods + vatAmt;
  const paid = parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, netPayable - paid);
  const totalCartons = lines.reduce((s, l) => s + l.cartons, 0);
  const totalPcs = lines.reduce((s, l) => s + l.pcs, 0);
  const totalKg = lines.reduce((s, l) => s + l.kg, 0) + byproductLines.reduce((s, l) => s + (l.kg || 0), 0);

  const updateLine = (id: string, field: string, value: number | boolean | string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [field]: value } as PurchLine;
      if (field === "cartons" && !u.kgOverride) {
        const prod = P_PRODUCTS.find(p => p.id === u.productId);
        if (prod) { u.pcs = u.cartons * prod.ppc; u.kg = Math.round(u.pcs * prod.g / 100) / 10; }
      }
      if (u.method === "kg")     u.amount = Math.round(u.kg * u.rate * 100) / 100;
      if (u.method === "piece")  u.amount = Math.round(u.pcs * u.rate * 100) / 100;
      if (u.method === "carton") u.amount = Math.round(u.cartons * u.rate * 100) / 100;
      return u;
    }));
  };

  const addLine = (productId: string) => {
    const prod = P_PRODUCTS.find(p => p.id === productId);
    if (!prod) return;
    setLines(prev => [...prev, { id: Date.now().toString(), productId, method: "piece", cartons: 0, pcs: 0, kg: 0, rate: prod.costKg / (prod.ppc || 10) * (prod.g / 1000), amount: 0, kgOverride: false, priceOverride: false, notes: "" }]);
    setSelectedProduct("");
  };

  const addByproduct = (productId: string) => {
    const part = P_PARTS.find(p => p.id === productId);
    if (!part) return;
    setByproductLines(prev => [...prev, { id: Date.now().toString(), productId, trays: 0, kg: 0, rate: part.rate, amount: 0 }]);
    setSelectedPart("");
  };

  const updateByproduct = (id: string, field: string, value: number) => {
    setByproductLines(prev => prev.map(l => { if (l.id !== id) return l; const u = { ...l, [field]: value }; u.amount = Math.round(u.trays * u.rate * 100) / 100; return u; }));
  };

  const addCostLine = () => setCostLines(prev => [...prev, { id: Date.now().toString(), type: "", description: "", amount: 0, treatment: "deduct" }]);
  const updateCostLine = (id: string, field: string, value: string | number) => setCostLines(prev => prev.map(l => l.id !== id ? l : { ...l, [field]: value }));

  const methodBadgeColor = (m: "kg" | "piece" | "carton") => ({ kg: "bg-blue-100 text-blue-700", piece: "bg-emerald-100 text-emerald-700", carton: "bg-violet-100 text-violet-700" })[m];

  if (flowState === "success") return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div>
        <h2 className="text-2xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم اعتماد فاتورة الشراء وإضافة الكميات إلى المخزون بنجاح" : "Purchase Invoice Approved & Stock Added!"}</h2>
        <div className="font-mono text-slate-400 mb-6 font-bold text-sm">PUR-2025-0043</div>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-emerald-50 rounded-2xl p-3 text-center"><div className="text-lg font-black font-mono text-emerald-600">+{totalKg.toFixed(1)} KG</div><div className="text-xs text-slate-400 font-bold">{isRTL ? "أُضيف للمخزون" : "Added to Stock"}</div></div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center"><div className="text-lg font-black font-mono text-[#0F2C59]">AED {netPayable.toFixed(2)}</div><div className="text-xs text-slate-400 font-bold">{isRTL ? "صافي المستحق" : "Net Payable"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" variant="primary" onClick={() => onNavigate("inventory")} className="justify-center"><Package size={13} />{isRTL ? "عرض المخزون" : "View Inventory"}</Btn>
          {remaining > 0 && <Btn size="sm" variant="secondary" className="justify-center"><DollarSign size={13} />{isRTL ? "دفعة للمورد" : "Pay Supplier"}</Btn>}
          <Btn size="sm" variant="secondary" onClick={() => { setLines([]); setSupplierId(""); setAmountPaid(""); setCostLines([]); setByproductLines([]); setFlowState("form"); }} className="justify-center"><Plus size={13} />{isRTL ? "فاتورة جديدة" : "New Purchase"}</Btn>
          <Btn size="sm" variant="outline" onClick={() => onNavigate("purchases-list")} className="justify-center"><ShoppingCart size={13} />{isRTL ? "القائمة" : "List"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("purchases-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "فاتورة شراء جديدة" : "New Purchase Invoice"}</h2>
          <div className="flex items-center gap-2 mt-0.5"><span className="font-mono text-xs text-slate-400">PUR-2025-0043</span><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{isRTL ? "مسودة" : "Draft"}</span></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* LEFT */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* A. Supplier */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "المورد" : "Supplier"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "اختر المورد" : "Select Supplier"} <span className="text-red-500">*</span></label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#0F2C59] outline-none font-semibold text-slate-700">
                  <option value="">{isRTL ? "— اختر المورد —" : "— Select Supplier —"}</option>
                  {P_SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}{s.nameAr !== s.name ? ` / ${s.nameAr}` : ""}</option>)}
                </select>
              </div>
              {supplier && (
                <div className="space-y-2">
                  {supplier.creditType === "cash"
                    ? <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600"><Info size={14} className="text-slate-400 shrink-0" />{isRTL ? "هذا المورد كاش، لن يتم إنشاء رصيد مستحق إلا إذا تم اختيار دفع جزئي أو آجل." : "Cash supplier — no balance unless partial/credit."}</div>
                    : <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-700"><Info size={14} className="shrink-0" />{isRTL ? "سيتم تحديث حساب المورد بعد اعتماد الفاتورة." : "Supplier balance will update after approval."}</div>}
                  {supplier.balance > 0 && <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-amber-700"><AlertTriangle size={14} className="shrink-0" />{isRTL ? `رصيد مستحق للمورد: AED ${supplier.balance.toLocaleString()}` : `Supplier outstanding: AED ${supplier.balance.toLocaleString()}`}</div>}
                  <div className="grid grid-cols-2 gap-3">
                    <FInput label={isRTL ? "رقم فاتورة المورد" : "Supplier Invoice #"} value={supplierInvNo} onChange={setSupplierInvNo} placeholder="WST-2025-1234" />
                    <FInput label={isRTL ? "تاريخ فاتورة المورد" : "Invoice Date"} type="date" value={supplierInvDate} onChange={setSupplierInvDate} />
                  </div>
                  {supplier.trn && <div className="text-xs text-slate-400 font-semibold">TRN: {supplier.trn}</div>}
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all">
                    <Download size={18} className="text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-400">{isRTL ? "رفع فاتورة المورد (PDF / صورة)" : "Upload Supplier Invoice (PDF / Image)"}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* B. Products */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "المنتجات" : "Products"}</h3>
              <select value={selectedProduct} onChange={e => { if (e.target.value) addLine(e.target.value); }}
                className="px-3 py-1.5 rounded-xl border border-[#0F2C59]/20 text-sm bg-white font-bold text-[#0F2C59] focus:border-[#0F2C59] outline-none cursor-pointer">
                <option value="">{isRTL ? "+ إضافة منتج" : "+ Add Product"}</option>
                {P_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name} — {p.costKg} AED/KG</option>)}
              </select>
            </div>
            {lines.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                <ShoppingCart size={26} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">{isRTL ? "أضف منتجاً للبدء" : "Add a product to start"}</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:grid gap-2 px-2 pb-2 border-b border-slate-100 mb-2 text-xs font-black text-slate-400 uppercase tracking-wide" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                  <span>{isRTL ? "المنتج" : "Product"}</span><span className="text-center">{isRTL ? "طريقة الشراء" : "Method"}</span><span className="text-center">{isRTL ? "كرتون" : "Ct"}</span><span className="text-center">{isRTL ? "حبة" : "Pcs"}</span><span className="text-center">KG</span><span className="text-center">{isRTL ? "سعر الشراء" : "Rate"}</span><span className="text-center">{isRTL ? "المبلغ" : "Amount"}</span><span />
                </div>
                <div className="space-y-2">
                  {lines.map(line => {
                    const prod = P_PRODUCTS.find(p => p.id === line.productId)!;
                    return (
                      <div key={line.id} className="rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-3">
                        <div className="hidden lg:grid gap-2 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${methodBadgeColor(line.method)}`}>{line.method === "kg" ? (isRTL ? "بالكيلو" : "By KG") : line.method === "piece" ? (isRTL ? "بالحبة" : "By Piece") : (isRTL ? "بالكرتون" : "By Carton")}</span>
                              {line.priceOverride && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{isRTL ? "تم تعديل سعر الشراء" : "Purchase price modified"}</span>}
                              {line.kgOverride && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{isRTL ? "تم تعديل الكيلو" : "KG overridden"}</span>}
                              {line.method !== "kg" && line.kg > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700" title={isRTL ? "سيتم حفظ الكمية بالكرتون والحبة والكيلو، حتى لو كان التسعير بالحبة أو بالكرتون." : "Quantity will be saved in all 3 units regardless of pricing method."}>
                                  {isRTL ? "تغيير طريقة الشراء" : "Method change"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 justify-center">
                            {(["kg","piece","carton"] as const).map(m => (
                              <button key={m} onClick={() => updateLine(line.id, "method", m)} className={`text-[9px] font-black px-1.5 py-1 rounded-lg transition-all ${line.method === m ? "bg-[#0F2C59] text-white" : "bg-slate-100 text-slate-500"}`}>
                                {m === "kg" ? "KG" : m === "piece" ? (isRTL ? "حبة" : "Pcs") : (isRTL ? "كرتون" : "Ct")}
                              </button>
                            ))}
                          </div>
                          <input type="number" min="0" value={line.cartons || ""} onChange={e => updateLine(line.id, "cartons", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white" />
                          <input type="number" min="0" value={line.pcs || ""} onChange={e => updateLine(line.id, "pcs", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white" />
                          <input type="number" min="0" step="0.1" value={line.kg || ""} onChange={e => { updateLine(line.id, "kgOverride", true); updateLine(line.id, "kg", parseFloat(e.target.value) || 0); }} placeholder="0.0" className={`w-full px-2 py-1.5 rounded-lg border text-center text-sm font-mono outline-none bg-white ${line.kgOverride ? "border-amber-300" : "border-slate-200 focus:border-[#0F2C59]"}`} />
                          <input type="number" min="0" step="0.01" value={line.rate || ""} onChange={e => { updateLine(line.id, "priceOverride", true); updateLine(line.id, "rate", parseFloat(e.target.value) || 0); }} disabled={!canEditPrice} className={`w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none ${!canEditPrice ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`} />
                          <div className="text-center font-mono font-black text-[#0F2C59] text-sm">{line.amount > 0 ? line.amount.toFixed(2) : "—"}</div>
                          <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><X size={14} /></button>
                        </div>
                        {/* Mobile */}
                        <div className="lg:hidden space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                            <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500"><X size={14} /></button>
                          </div>
                          <div className="flex gap-1">
                            {(["kg","piece","carton"] as const).map(m => <button key={m} onClick={() => updateLine(line.id, "method", m)} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${line.method === m ? "bg-[#0F2C59] text-white" : "bg-slate-100 text-slate-500"}`}>{m === "kg" ? "KG" : m === "piece" ? (isRTL ? "حبة" : "Pcs") : (isRTL ? "كرتون" : "Ct")}</button>)}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{isRTL ? "كرتون" : "Ct"}</label><input type="number" value={line.cartons || ""} onChange={e => updateLine(line.id, "cartons", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 block mb-1">KG</label><input type="number" step="0.1" value={line.kg || ""} onChange={e => updateLine(line.id, "kg", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{isRTL ? "السعر" : "Rate"}</label><input type="number" step="0.01" value={line.rate || ""} onChange={e => updateLine(line.id, "rate", parseFloat(e.target.value) || 0)} disabled={!canEditPrice} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white disabled:bg-slate-100" /></div>
                          </div>
                          <div className="text-end font-mono font-black text-[#0F2C59]">AED {line.amount > 0 ? line.amount.toFixed(2) : "—"}</div>
                        </div>
                        {/* Inventory cost warning (item 6) */}
                        {line.method !== "kg" && line.kg > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5">
                            <Info size={11} className="text-blue-500 shrink-0" />
                            <span className="text-[10px] font-bold text-blue-700">{isRTL ? "سيتم حفظ الكمية بالكرتون والحبة والكيلو، حتى لو كان التسعير بالحبة أو بالكرتون." : "Quantity will be saved in cartons, pieces, and KG even if pricing is per piece or carton."}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3">
                  {[[totalCartons, isRTL ? "كرتون" : "Cartons"], [totalPcs, isRTL ? "حبة" : "Pieces"], [`${totalKg.toFixed(1)} KG`, isRTL ? "إجمالي الكيلو" : "Total KG"]].map(([v, l]) => (
                    <div key={l as string} className="text-center"><div className="text-xl font-black font-mono text-[#0F2C59]">{v}</div><div className="text-xs text-slate-400 font-bold">{l}</div></div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* C. By-products */}
          <Card className="overflow-hidden">
            <button onClick={() => setShowByproducts(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-slate-50 transition-all">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "المنتجات الجانبية والأجزاء" : "By-products & Parts"}</h3>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showByproducts ? "rotate-180" : ""}`} />
            </button>
            {showByproducts && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-semibold">{isRTL ? "أضف أجزاء الدواجن بالطبق/الكيلو" : "Add poultry parts by tray or KG"}</p>
                  <select value={selectedPart} onChange={e => { if (e.target.value) addByproduct(e.target.value); }} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-bold text-[#0F2C59] outline-none cursor-pointer">
                    <option value="">{isRTL ? "+ إضافة جزء" : "+ Add Part"}</option>
                    {P_PARTS.map(p => <option key={p.id} value={p.id}>{isRTL ? p.nameAr : p.name}</option>)}
                  </select>
                </div>
                {byproductLines.length === 0 && <div className="text-center py-4 text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">{isRTL ? "لا توجد منتجات جانبية بعد" : "No by-products added yet"}</div>}
                {byproductLines.map(l => {
                  const part = P_PARTS.find(p => p.id === l.productId)!;
                  return (
                    <div key={l.id} className="grid gap-3 items-center bg-slate-50 rounded-xl p-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
                      <div className="font-bold text-sm text-slate-800">{isRTL ? part.nameAr : part.name}</div>
                      <div><label className="text-[10px] text-slate-400 block">{isRTL ? "طبق" : "Trays"}</label><input type="number" min="0" value={l.trays || ""} onChange={e => updateByproduct(l.id, "trays", parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white outline-none" /></div>
                      <div><label className="text-[10px] text-slate-400 block">KG</label><input type="number" step="0.1" value={l.kg || ""} onChange={e => updateByproduct(l.id, "kg", parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white outline-none" /></div>
                      <div><label className="text-[10px] text-slate-400 block">{isRTL ? "السعر" : "Rate"}</label><div className="font-mono font-bold text-sm text-center text-slate-600 py-1.5">{l.rate}</div></div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono font-black text-[#0F2C59] text-sm">{l.amount > 0 ? l.amount.toFixed(2) : "—"}</div>
                        <button onClick={() => setByproductLines(prev => prev.filter(x => x.id !== l.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500"><X size={13} /></button>
                      </div>
                    </div>
                  );
                })}
                {byproductLines.length > 0 && <div className="text-end font-mono font-black text-[#0F2C59] text-sm">AED {byproductsTotal.toFixed(2)}</div>}
              </div>
            )}
          </Card>

          {/* D. Purchase Settlements & Costs */}
          <Card className="overflow-hidden">
            <button onClick={() => setShowCosts(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-slate-50 transition-all">
              <div>
                <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "تسويات وتكاليف مرتبطة بفاتورة الشراء" : "Purchase Settlements & Linked Costs"}</h3>
                {costLines.length > 0 && (
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {deductTotal > 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{isRTL ? `خصم مورد: −AED ${deductTotal.toFixed(2)}` : `Supplier deduction: −AED ${deductTotal.toFixed(2)}`}</span>}
                    {inventoryCostAdds > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{isRTL ? `تكلفة مخزون: +AED ${inventoryCostAdds.toFixed(2)}` : `Inventory cost: +AED ${inventoryCostAdds.toFixed(2)}`}</span>}
                    {expenseOnly > 0 && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{isRTL ? `مصروف فقط: AED ${expenseOnly.toFixed(2)}` : `Expense only: AED ${expenseOnly.toFixed(2)}`}</span>}
                  </div>
                )}
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCosts ? "rotate-180" : ""}`} />
            </button>
            {showCosts && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                {/* Helper text */}
                <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2">
                  <Info size={14} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                    {isRTL
                      ? "استخدم هذا الجزء لتحديد هل المبلغ سيخصم من مستحق المورد، أو يضاف على تكلفة المخزون، أو يسجل كمصروف مرتبط بعملية الشراء."
                      : "Use this section to specify whether the amount will be deducted from supplier payable, added to inventory cost basis, or recorded as a linked purchase expense."}
                  </p>
                </div>
                {costLines.map(c => (
                  <div key={c.id} className="bg-slate-50 rounded-2xl p-3 space-y-2 border border-slate-100">
                    <div className="grid gap-2 items-start" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">{isRTL ? "النوع / السبب" : "Type / Reason"}</label>
                        <select value={c.type} onChange={e => updateCostLine(c.id, "type", e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold text-slate-700 outline-none">
                          <option value="">{isRTL ? "اختر النوع" : "Select type"}</option>
                          {P_COST_TYPES.map(t => <option key={t.ar} value={t.ar}>{isRTL ? t.ar : t.en}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">AED</label>
                        <input type="number" value={c.amount || ""} onChange={e => updateCostLine(c.id, "amount", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm font-mono bg-white outline-none" />
                      </div>
                      <button onClick={() => setCostLines(prev => prev.filter(x => x.id !== c.id))} className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all mt-5"><X size={14} /></button>
                    </div>
                    {/* Improved treatment selector with descriptions */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">{isRTL ? "طريقة المعالجة المحاسبية" : "Accounting Treatment"}</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { v: "deduct",              ar: "يخصم من مستحق المورد",     en: "Deduct from supplier",    desc_ar: "يقلل المبلغ المطلوب دفعه للمورد.", desc_en: "Reduces amount payable to supplier.", color: "border-amber-400 bg-amber-50 text-amber-800" },
                          { v: "add-cost",            ar: "يضاف على تكلفة المخزون",   en: "Add to inventory cost",   desc_ar: "يزيد تكلفة البضاعة ويؤثر على حساب الربح.", desc_en: "Increases goods cost, affects profit.", color: "border-blue-400 bg-blue-50 text-blue-800" },
                          { v: "expense",             ar: "مصروف مرتبط بالشراء فقط", en: "Linked expense only",      desc_ar: "يسجل كمصروف دون تعديل كمية المخزون.", desc_en: "Recorded as expense, no stock change.", color: "border-slate-400 bg-slate-50 text-slate-700" },
                          { v: "commercial-discount", ar: "خصم تجاري من المورد",      en: "Commercial supplier discount", desc_ar: "يقلل قيمة الشراء وصافي المستحق.", desc_en: "Reduces purchase value and net payable.", color: "border-emerald-400 bg-emerald-50 text-emerald-800" },
                        ].map(opt => (
                          <button key={opt.v} onClick={() => updateCostLine(c.id, "treatment", opt.v)}
                            className={`text-start p-2 rounded-xl border-2 transition-all ${c.treatment === opt.v ? opt.color + " shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                            <div className="text-[10px] font-black leading-tight">{isRTL ? opt.ar : opt.en}</div>
                            <div className="text-[9px] font-semibold opacity-70 mt-0.5 leading-tight">{isRTL ? opt.desc_ar : opt.desc_en}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <Btn size="sm" variant="outline" onClick={addCostLine}><Plus size={13} />{isRTL ? "إضافة بند" : "Add Item"}</Btn>
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملاحظات ومرفقات" : "Notes & Attachments"}</h3>
            <div className="space-y-3">
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات الشراء" : "Purchase Notes"}</label><textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
              <div className="grid grid-cols-2 gap-3">
                {[isRTL ? "رفع إيصال المسلخ" : "Slaughterhouse Receipt", isRTL ? "رفع إيصال النقل" : "Transport Receipt"].map(l => (
                  <div key={l} className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all"><Download size={15} className="text-slate-300 mx-auto mb-1" /><p className="text-[10px] font-bold text-slate-400">{l}</p></div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT — Summary */}
        <div className="lg:w-80 xl:w-96 space-y-4 shrink-0">
          <Card className="p-5 lg:sticky lg:top-20">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص فاتورة الشراء" : "Purchase Summary"}</h3>

            {/* 3 Financial Meaning Cards */}
            <div className="space-y-2.5 mb-4">
              {/* Card 1: Goods Total */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <div className="text-xs font-black text-slate-600">{isRTL ? "إجمالي البضاعة" : "Goods Total"}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{isRTL ? "قيمة المنتجات قبل التسويات" : "Product value before adjustments"}</div>
                  </div>
                  <span className="font-mono font-black text-slate-700 text-base">AED {goodsTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Card 2: Net Payable to Supplier */}
              <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <div className="text-xs font-black text-[#0F2C59]">{isRTL ? "صافي المستحق للمورد" : "Net Payable to Supplier"}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{isRTL ? "المبلغ الذي سيتم دفعه أو إضافته على حساب المورد" : "Amount to pay or add to supplier account"}</div>
                  </div>
                  <span className="font-mono font-black text-[#0F2C59] text-base">AED {netPayable.toFixed(2)}</span>
                </div>
              </div>

              {/* Card 3: Inventory Cost Basis */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-start gap-1.5">
                    <div>
                      <div className="text-xs font-black text-blue-700">{isRTL ? "تكلفة المخزون للحسابات" : "Inventory Cost Basis"}</div>
                      <div className="text-[10px] text-blue-500 font-semibold">{isRTL ? "القيمة التي ستستخدم لاحقاً في حساب الربح" : "Value used later for profit calculation"}</div>
                    </div>
                    <Info size={12} className="text-blue-400 shrink-0 mt-0.5 cursor-help" />
                  </div>
                  <span className="font-mono font-black text-blue-700 text-base">AED {inventoryCostBasis.toFixed(2)}</span>
                </div>
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl leading-snug">
                  {isRTL ? "قد يختلف صافي المستحق للمورد عن تكلفة المخزون حسب طريقة معالجة النقل أو الذبح أو الخصومات." : "Supplier payable may differ from inventory cost depending on how transport, slaughter, or discounts are treated."}
                </div>
              </div>
            </div>

            {/* Calculation Preview */}
            {costLines.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200 space-y-1.5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">{isRTL ? "تفصيل الحساب" : "Calculation Breakdown"}</div>
                {[
                  [`${isRTL ? "إجمالي البضاعة" : "Goods total"}`, `AED ${goodsTotal.toFixed(2)}`, "text-slate-700"],
                  ...(deductTotal > 0    ? [[isRTL ? "خصم من مستحق المورد" : "Supplier deduction",   `−AED ${deductTotal.toFixed(2)}`,       "text-amber-600"]] : []),
                  ...(inventoryCostAdds > 0 ? [[isRTL ? "تكاليف مضافة للمخزون" : "Added to inventory",  `+AED ${inventoryCostAdds.toFixed(2)}`,  "text-blue-600"]] : []),
                  ...(expenseOnly > 0    ? [[isRTL ? "مصروفات مرتبطة فقط" : "Linked expenses",        `AED ${expenseOnly.toFixed(2)}`,         "text-slate-500"]] : []),
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between text-[10px]">
                    <span className="text-slate-500 font-semibold">{l}</span>
                    <span className={`font-mono font-black ${c}`}>{v}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-1.5 mt-1.5 space-y-1">
                  <div className="flex justify-between text-xs"><span className="font-black text-[#0F2C59]">{isRTL ? "صافي المستحق للمورد" : "Net Payable"}</span><span className="font-mono font-black text-[#0F2C59]">AED {netPayable.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span className="font-black text-blue-700">{isRTL ? "تكلفة المخزون للحسابات" : "Inventory Cost Basis"}</span><span className="font-mono font-black text-blue-700">AED {inventoryCostBasis.toFixed(2)}</span></div>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold leading-snug mt-1.5 border-t border-slate-200 pt-1.5">
                  {isRTL ? "صافي المستحق يستخدم في حساب المورد. تكلفة المخزون تستخدم لاحقاً لحساب الربح." : "Net payable is used for supplier account. Inventory cost is used later for profit calculation."}
                </p>
              </div>
            )}

            {/* VAT */}
            <div className="border-t border-slate-100 pt-3 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">{isRTL ? "ضريبة القيمة المضافة 5%" : "VAT 5%"}</span>
                <button onClick={() => setVatEnabled(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${vatEnabled ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
                  <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${vatEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {!supplier?.trn && supplierId && vatEnabled && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" /><span className="text-[10px] font-bold text-amber-700">{isRTL ? "TRN المورد غير موجود" : "Supplier TRN missing"}</span>
                </div>
              )}
              {vatEnabled && <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-semibold">{isRTL ? "الضريبة 5%" : "VAT 5%"}</span><span className="font-mono font-bold text-slate-700">AED {vatAmt.toFixed(2)}</span></div>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 mb-4">
              <span className="font-black text-[#0F2C59]">{isRTL ? "صافي المستحق للمورد" : "Net Payable to Supplier"}</span>
              <span className="font-mono font-black text-[#0F2C59] text-lg">AED {netPayable.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <h4 className="font-black text-slate-600 text-xs uppercase tracking-wide">{isRTL ? "طريقة الدفع" : "Payment Method"}</h4>
              <div className="grid grid-cols-2 gap-2">
                {[["cash", isRTL ? "كاش" : "Cash"], ["bank", isRTL ? "بنكي" : "Bank"], ["credit", isRTL ? "آجل" : "Credit"], ["partial", isRTL ? "جزئي" : "Partial"]].map(([k, l]) => (
                  <button key={k} onClick={() => setPayMethod(k)} className={`py-1.5 px-2 rounded-xl text-xs font-bold border-2 transition-all ${payMethod === k ? "border-[#0F2C59] bg-[#0F2C59] text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{l}</button>
                ))}
              </div>
              {(payMethod === "cash" || payMethod === "bank" || payMethod === "partial") && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{isRTL ? "المبلغ المدفوع الآن" : "Amount Paid Now"}</label>
                  <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:border-[#0F2C59] outline-none bg-white" />
                </div>
              )}
              {payMethod === "cash" && paid > 0 && paid < netPayable && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-700">{isRTL ? "سيتم إنشاء رصيد مستحق لهذا المورد بسبب وجود مبلغ غير مدفوع." : "A supplier balance will be created due to unpaid amount."}</span>
                </div>
              )}
              {netPayable > 0 && (
                <div className={`flex items-center justify-between text-sm p-2.5 rounded-xl ${remaining > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                  <span className={`font-bold ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{isRTL ? "المتبقي للمورد" : "Remaining"}</span>
                  <span className={`font-mono font-black ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>AED {remaining.toFixed(2)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap gap-3 justify-between shadow-lg z-10">
        <Btn variant="outline" onClick={() => onNavigate("purchases-list")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => toast.success(isRTL ? "تم حفظ مسودة الشراء ✓" : "Purchase draft saved ✓")}>{isRTL ? "حفظ كمسودة" : "Save Draft"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("purchases-preview")}><Eye size={14} />{isRTL ? "معاينة" : "Preview"}</Btn>
          <Btn variant="primary" disabled={!supplierId || lines.length === 0 || !canApprove} onClick={() => setFlowState("confirm")}><Check size={14} />{isRTL ? "اعتماد فاتورة الشراء" : "Approve Purchase Invoice"}</Btn>
        </div>
      </div>

      {/* Approval modal */}
      {flowState === "confirm" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#0F2C59] mb-1">{isRTL ? "تأكيد اعتماد فاتورة الشراء" : "Confirm Purchase Approval"}</h3>
              <p className="text-sm text-slate-500">{isRTL ? "بعد الاعتماد سيتم إضافة الكميات إلى المخزون وتحديث حساب المورد." : "After approval, quantities will be added to stock and supplier balance updated."}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                {[[totalCartons, isRTL ? "كرتون" : "Cartons"], [totalPcs, isRTL ? "حبة" : "Pieces"], [`${totalKg.toFixed(1)} KG`, isRTL ? "الكيلو" : "Weight"]].map(([v, l]) => (
                  <div key={l as string} className="text-center"><div className="text-xl font-black text-emerald-700 font-mono">{v}</div><div className="text-xs font-bold text-emerald-600">{l}</div></div>
                ))}
              </div>
              <div className="text-center text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl py-2 border border-emerald-200">↑ {isRTL ? "سيتم إضافة هذه الكميات إلى المخزون" : "These quantities will be ADDED to inventory"}</div>

              {/* Stock batch preview (item 5) */}
              {lines.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-wide">{isRTL ? "دفعات المخزون التي سيتم إنشاؤها" : "Stock Batches to be Created"}</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {lines.map((l, idx) => {
                      const prod = P_PRODUCTS.find(p => p.id === l.productId);
                      if (!prod) return null;
                      const batchRef = `${supplierId ? P_SUPPLIERS.find(s => s.id === supplierId)?.name?.split(" ")[0] || "SUP" : "SUP"} / ${isRTL ? prod.nameAr : prod.name}`;
                      const unitCost = l.kg > 0 ? (l.amount / l.kg).toFixed(3) : "—";
                      const invCostUnit = l.kg > 0 ? ((inventoryCostBasis / (totalKg || 1)) ).toFixed(3) : "—";
                      return (
                        <div key={l.id} className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-800">{isRTL ? prod.nameAr : prod.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{isRTL ? "دفعة" : "Batch"}: PUR-2025-0043/{idx + 1}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-semibold">
                            {l.cartons > 0 && <span>{l.cartons} {isRTL ? "كرتون" : "Ct"}</span>}
                            {l.pcs > 0 && <span>{l.pcs} {isRTL ? "حبة" : "Pcs"}</span>}
                            {l.kg > 0 && <span className="font-black text-slate-700">{l.kg} KG</span>}
                            <span className="text-amber-600">{isRTL ? "سعر الشراء:" : "Unit cost:"} AED {unitCost}/KG</span>
                            <span className="text-blue-600">{isRTL ? "تكلفة المخزون:" : "Inv cost:"} AED {invCostUnit}/KG</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{batchRef}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded-lg px-2.5 py-1.5">{isRTL ? "بعد الاعتماد سيتم إنشاء حركة مخزون وإضافة الكميات إلى المخزون المتاح." : "After approval, inventory movements will be created and quantities added to available stock."}</p>
                </div>
              )}

              <div className="space-y-2">
                {[
                  [isRTL ? "إجمالي البضاعة" : "Goods Total", `AED ${goodsTotal.toFixed(2)}`, "text-slate-700"],
                  ...(deductTotal > 0 ? [[isRTL ? "الخصومات" : "Deductions", `−AED ${deductTotal.toFixed(2)}`, "text-amber-600"]] : []),
                  ...(vatEnabled ? [[isRTL ? "الضريبة 5%" : "VAT 5%", `AED ${vatAmt.toFixed(2)}`, "text-slate-500"]] : []),
                  [isRTL ? "صافي المستحق للمورد" : "Net Payable", `AED ${netPayable.toFixed(2)}`, "text-[#0F2C59]"],
                  [isRTL ? "المدفوع الآن" : "Paid Now", `AED ${paid.toFixed(2)}`, "text-emerald-600"],
                  [isRTL ? "المتبقي للمورد" : "Remaining", `AED ${remaining.toFixed(2)}`, remaining > 0 ? "text-red-500" : "text-emerald-600"],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between text-sm"><span className="font-semibold text-slate-500">{l}</span><span className={`font-mono font-black ${c}`}>{v}</span></div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <Btn variant="outline" onClick={() => setFlowState("form")} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
              <Btn variant="primary" onClick={() => { toast.success(isRTL ? "تم اعتماد فاتورة الشراء وإضافة المخزون!" : "Purchase approved & stock added!"); setFlowState("success"); }} className="flex-1 justify-center"><Check size={15} />{isRTL ? "تأكيد الاعتماد" : "Confirm Approval"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN: PURCHASE INVOICE DETAIL ───────────────────────────────────────────
export function PurchDetailScreen({ lang, role, onNavigate, purchaseId, onOpenPrint }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; purchaseId?: string;
  onOpenPrint?: () => void;
}) {
  if (!IS_MOCK_MODE) {
    if (!purchaseId) {
      return <EmptyState lang={lang} messageAr="اختر فاتورة شراء من القائمة" messageEn="Select a purchase invoice from the list" />;
    }
    return (
      <LivePurchaseInvoiceScreen
        lang={lang}
        role={role}
        onNavigate={onNavigate}
        invoiceId={purchaseId}
        onOpenPrint={onOpenPrint}
      />
    );
  }
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("details");
  const [showPay, setShowPay] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const detailId = purchaseId ?? MOCK_P_INVOICES[1]?.id ?? null;
  const { item: row, loading, error, forbidden, reload } = usePurchaseDetail(
    detailId,
    async (id) => {
      const m = MOCK_P_INVOICES.find((x) => x.id === id);
      return m ? purchaseRowFromMock(m) : null;
    },
  );
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;
  const inv = row ? mergePurchaseListItem(row) : null;
  if (!inv) return <EmptyState lang={lang} messageAr="لا توجد فواتير شراء بعد" messageEn="No purchase invoices yet" />;

  const canViewCosting = role === "owner" || role === "accountant";
  const detailTabs = [
    { k: "details",     ar: "تفاصيل الفاتورة",              en: "Invoice Details" },
    { k: "products",    ar: "المنتجات",                     en: "Products" },
    { k: "costs",       ar: "التسويات والتكاليف",           en: "Settlements & Costs" },
    { k: "payments",    ar: "المدفوعات",                    en: "Payments" },
    { k: "inventory",   ar: "حركة المخزون",                en: "Inventory" },
    { k: "costing",     ar: "حساب التكلفة",                en: "Costing", locked: !canViewCosting },
    { k: "supplier",    ar: "حساب المورد",                  en: "Supplier Account" },
    { k: "attachments", ar: "المرفقات",                     en: "Attachments" },
    { k: "audit",       ar: "سجل العمليات",                en: "Audit Log" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("purchases-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 mt-0.5">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><h2 className="text-xl font-black text-[#0F2C59]">{inv.id}</h2><PurchStatusBadge status={inv.status} lang={lang} /></div>
          <div className="text-sm text-slate-400 mt-0.5">{inv.supplier} · {isRTL ? "فاتورة المورد:" : "Supplier Inv:"} {inv.supplierInvNo} · {inv.date}</div>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-preview")}><Printer size={13} />{isRTL ? "طباعة السجل" : "Print Record"}</Btn>
        <Btn size="sm" variant="green" onClick={() => setShowPay(true)}><DollarSign size={13} />{isRTL ? "تسجيل دفعة للمورد" : "Record Supplier Payment"}</Btn>
        <Btn size="sm" variant="outline"><Download size={13} />{isRTL ? "رفع فاتورة المورد" : "Upload Supplier Invoice"}</Btn>
        <Btn size="sm" variant="outline"><FileText size={13} />{isRTL ? "تكرار الفاتورة" : "Duplicate"}</Btn>
        {role === "owner" ? <Btn size="sm" variant="danger" onClick={() => setShowCancel(true)}><Ban size={13} />{isRTL ? "إلغاء فاتورة الشراء" : "Cancel Purchase"}</Btn> : <PermBtn lang={lang}><Ban size={13} />{isRTL ? "إلغاء فاتورة الشراء" : "Cancel Purchase"}</PermBtn>}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ ar: "إجمالي البضاعة", en: "Goods Total", v: `AED ${inv.goodsTotal.toLocaleString()}`, cls: "text-slate-700" }, { ar: "الخصومات", en: "Deductions", v: inv.deductions ? `−AED ${inv.deductions.toLocaleString()}` : "—", cls: "text-amber-600" }, { ar: "صافي المستحق", en: "Net Payable", v: `AED ${inv.netPayable.toLocaleString()}`, cls: "text-[#0F2C59]" }, { ar: "المتبقي للمورد", en: "Remaining", v: `AED ${inv.remaining.toLocaleString()}`, cls: inv.remaining > 0 ? "text-red-500" : "text-emerald-600" }].map(f => (
          <Card key={f.ar} className="p-4 text-center"><div className={`text-lg font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {detailTabs.map(t => (
              <button key={t.k} onClick={() => !t.locked && setTab(t.k)}
                className={`px-4 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all relative group
                  ${t.locked ? "border-transparent text-slate-300 cursor-not-allowed" : tab === t.k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                {isRTL ? t.ar : t.en}
                {t.locked && <span className="ms-1 text-[9px]">🔒</span>}
                {t.locked && (
                  <div className={`absolute top-full mt-1 ${isRTL ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-lg whitespace-nowrap`}>
                    {isRTL ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission"}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {tab === "details" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[{ ar: "المورد", en: "Supplier", v: inv.supplier }, { ar: "رقم فاتورة المورد", en: "Supplier Invoice #", v: inv.supplierInvNo }, { ar: "التاريخ", en: "Date", v: inv.date }, { ar: "طريقة الدفع", en: "Method", v: inv.method === "bank" ? (isRTL ? "بنكي" : "Bank") : inv.method === "credit" ? (isRTL ? "آجل" : "Credit") : (isRTL ? "كاش" : "Cash") }, { ar: "إجمالي الكراتين", en: "Total Cartons", v: `${inv.cartons}` }, { ar: "إجمالي الكيلو", en: "Total KG", v: `${inv.kg} KG` }].map(f => <div key={f.ar} className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>)}
            </div>
          )}
          {tab === "products" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">{[isRTL ? "المنتج" : "Product", isRTL ? "كرتون" : "Ct", isRTL ? "حبة" : "Pcs", "KG", isRTL ? "السعر" : "Rate", isRTL ? "نوع السعر" : "Rate Type", isRTL ? "المبلغ" : "Amount"].map((h, i) => <th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {P_SAMPLE_LINES.map((l, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2.5 font-bold text-slate-800">{isRTL ? l.productAr : l.product}</td><td className="px-3 py-2.5 font-mono text-center">{l.ct}</td><td className="px-3 py-2.5 font-mono text-center">{l.pcs}</td><td className="px-3 py-2.5 font-mono text-center">{l.kg}</td><td className="px-3 py-2.5 font-mono text-center">{l.rate}</td><td className="px-3 py-2.5 text-center"><span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{isRTL ? "بالحبة" : "By Piece"}</span></td><td className="px-3 py-2.5 font-mono font-black text-[#0F2C59] text-end">AED {l.amount.toFixed(2)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {tab === "costs" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
                {[[isRTL ? "إجمالي البضاعة" : "Goods Total", `AED ${inv.goodsTotal.toLocaleString()}`, "text-slate-700"], [isRTL ? "الخصومات المرتبطة" : "Deductions", `−AED ${inv.deductions.toLocaleString()}`, "text-amber-600"], [isRTL ? "صافي المستحق" : "Net Payable", `AED ${(inv.goodsTotal - inv.deductions).toLocaleString()}`, "text-[#0F2C59]"]].map(([l, v, c]) => <div key={l} className="text-center"><div className={`font-black font-mono text-base ${c}`}>{v}</div><div className="text-xs text-slate-400 font-bold mt-0.5">{l}</div></div>)}
              </div>
              {[{ type: isRTL ? "تكلفة الذبح" : "Slaughter cost", amount: 700, treatment: isRTL ? "خصم من صافي المستحق" : "Deducted from payable" }, { type: isRTL ? "تكلفة النقل" : "Transport cost", amount: 300, treatment: isRTL ? "خصم من صافي المستحق" : "Deducted from payable" }].map((c, i) => <div key={i} className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border border-amber-100"><div><div className="font-bold text-amber-800 text-sm">{c.type}</div><div className="text-xs text-amber-600">{c.treatment}</div></div><span className="font-mono font-black text-amber-600">−AED {c.amount}</span></div>)}
            </div>
          )}
          {tab === "payments" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-amber-500 shrink-0" />
                <div><div className="font-black text-amber-700">{isRTL ? "مدفوع جزئياً" : "Partially Paid"}</div><div className="text-sm text-amber-600">{isRTL ? `المتبقي للمورد: AED ${inv.remaining.toLocaleString()}` : `Remaining: AED ${inv.remaining.toLocaleString()}`}</div></div>
                <Btn size="sm" variant="green" onClick={() => setShowPay(true)} className={`${isRTL ? "mr-auto" : "ml-auto"}`}><DollarSign size={13} />{isRTL ? "دفعة" : "Pay"}</Btn>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between"><div><div className="font-bold text-slate-800">AED {inv.paid.toLocaleString()}</div><div className="text-xs text-slate-400">{inv.date} · {isRTL ? "بنكي" : "Bank"}</div></div><PurchStatusBadge status="partial" lang={lang} /></div>
            </div>
          )}
          {tab === "inventory" && (
            <div className="space-y-2">
              {P_SAMPLE_LINES.slice(0, 4).map((l, i) => <div key={i} className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-2.5 border border-emerald-100"><span className="font-bold text-sm text-slate-700">{isRTL ? l.productAr : l.product}</span><span className="font-mono font-black text-emerald-600 text-sm">+{l.ct} Ct, +{l.pcs} Pcs, +{l.kg} KG</span></div>)}
              <div className="bg-slate-50 rounded-xl p-3 text-center mt-2"><div className="text-sm font-bold text-slate-500">{isRTL ? "تم إضافة المخزون بعد اعتماد الفاتورة" : "Stock added after purchase approval"}</div><div className="text-xs text-slate-400">{inv.date} · {inv.user}</div></div>
            </div>
          )}
          {tab === "costing" && (
            canViewCosting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <Info size={14} className="text-blue-500 shrink-0" />
                  <p className="text-xs font-bold text-blue-700">{isRTL ? "قد يختلف صافي المستحق للمورد عن تكلفة المخزون حسب طريقة معالجة التكاليف." : "Supplier payable may differ from inventory cost basis depending on how costs are treated."}</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Supplier account side */}
                  <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4">
                    <h4 className="font-black text-[#0F2C59] text-sm mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#0F2C59]" />{isRTL ? "حساب المورد" : "Supplier Account"}</h4>
                    <div className="space-y-2">
                      {[
                        [isRTL ? "إجمالي البضاعة" : "Goods total",          `AED ${inv.goodsTotal.toLocaleString()}`, "text-slate-700"],
                        [isRTL ? "خصم من مستحق المورد" : "Supplier deduction", `−AED ${inv.deductions.toLocaleString()}`, "text-amber-600"],
                        [isRTL ? "الضريبة المضافة" : "VAT added",             `+AED ${inv.vat.toLocaleString()}`, "text-slate-600"],
                      ].map(([l, v, c]) => (
                        <div key={l} className="flex justify-between text-xs"><span className="text-slate-500 font-semibold">{l}</span><span className={`font-mono font-black ${c}`}>{v}</span></div>
                      ))}
                      <div className="border-t border-[#0F2C59]/20 pt-2 flex justify-between text-sm">
                        <span className="font-black text-[#0F2C59]">{isRTL ? "صافي المستحق للمورد" : "Net Payable"}</span>
                        <span className="font-mono font-black text-[#0F2C59]">AED {inv.netPayable.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {/* Inventory cost side */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <h4 className="font-black text-blue-700 text-sm mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />{isRTL ? "تكلفة المخزون للحسابات" : "Inventory Cost Basis"}</h4>
                    <div className="space-y-2">
                      {[
                        [isRTL ? "إجمالي البضاعة" : "Goods total",               `AED ${inv.goodsTotal.toLocaleString()}`, "text-slate-700"],
                        [isRTL ? "تكاليف مضافة للمخزون" : "Added inventory costs", `+AED 0.00`,                               "text-blue-600"],
                        [isRTL ? "خصومات تجارية" : "Commercial discounts",         `−AED 0.00`,                               "text-emerald-600"],
                      ].map(([l, v, c]) => (
                        <div key={l} className="flex justify-between text-xs"><span className="text-slate-500 font-semibold">{l}</span><span className={`font-mono font-black ${c}`}>{v}</span></div>
                      ))}
                      <div className="border-t border-blue-200 pt-2 flex justify-between text-sm">
                        <span className="font-black text-blue-700">{isRTL ? "تكلفة المخزون للحسابات" : "Inventory Cost Basis"}</span>
                        <span className="font-mono font-black text-blue-700">AED {inv.goodsTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Adjustments breakdown */}
                <div className="bg-slate-50 rounded-2xl p-4">
                  <h4 className="font-black text-slate-600 text-xs uppercase tracking-wide mb-3">{isRTL ? "تفصيل التسويات والتكاليف" : "Adjustments & Costs Breakdown"}</h4>
                  {[
                    { label: isRTL ? "تكلفة الذبح" : "Slaughter cost",   amount: 700,  treatment: "deduct",   affectsSupplier: true,  affectsProfit: false, isExpense: false },
                    { label: isRTL ? "تكلفة النقل" : "Transport cost",   amount: 300,  treatment: "deduct",   affectsSupplier: true,  affectsProfit: false, isExpense: false },
                  ].map((adj, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0 text-xs">
                      <div>
                        <span className="font-bold text-slate-700">{adj.label}</span>
                        <div className="flex gap-1.5 mt-0.5">
                          {adj.affectsSupplier && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL ? "يخصم من المورد" : "Deducted from supplier"}</span>}
                          {adj.affectsProfit && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{isRTL ? "يضاف لتكلفة المخزون" : "Added to inventory cost"}</span>}
                          {adj.isExpense && <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{isRTL ? "مصروف فقط" : "Expense only"}</span>}
                        </div>
                      </div>
                      <span className="font-mono font-black text-amber-600">−AED {adj.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Info size={24} className="text-slate-400" /></div>
                <p className="font-bold text-slate-500 text-sm">{isRTL ? "ليس لديك صلاحية عرض حساب التكلفة" : "You do not have permission to view costing"}</p>
              </div>
            )
          )}
          {tab === "supplier" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
                {[[isRTL ? "صافي المستحق" : "Net Payable", `AED ${inv.netPayable.toLocaleString()}`, "text-[#0F2C59]"], [isRTL ? "المدفوع" : "Paid", `AED ${inv.paid.toLocaleString()}`, "text-emerald-600"], [isRTL ? "رصيد المورد" : "Supplier Balance", `AED ${inv.remaining.toLocaleString()}`, "text-red-500"]].map(([l, v, c]) => <div key={l} className="text-center"><div className={`font-black font-mono text-base ${c}`}>{v}</div><div className="text-xs text-slate-400 font-bold mt-0.5">{l}</div></div>)}
              </div>
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? "المورد" : "Supplier"}</div><div className="font-bold text-slate-700">{inv.supplier}</div><div className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? "شروط الدفع: آجل 30 يوم" : "Payment terms: Net 30 days"}</div></div>
            </div>
          )}
          {tab === "attachments" && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all"><Download size={24} className="text-slate-300 mx-auto mb-2" /><p className="font-bold text-slate-400 text-sm">{isRTL ? "رفع فاتورة المورد" : "Upload Supplier Invoice"}</p></div>
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between"><div><div className="font-bold text-slate-600 text-sm">{inv.supplierInvNo}.pdf</div><div className="text-xs text-slate-400">{isRTL ? "فاتورة المورد الأصلية" : "Original supplier invoice"}</div></div><div className="flex gap-1"><Btn size="sm" variant="ghost"><Eye size={13} /></Btn><Btn size="sm" variant="ghost"><Download size={13} /></Btn></div></div>
            </div>
          )}
          {tab === "audit" && (
            <div className="space-y-2">
              {[
                { t: `${inv.date} 14:30`, a: isRTL ? "اعتماد فاتورة الشراء" : "Purchase Invoice Approved", u: "أحمد (مالك)", prev: isRTL ? "مسودة" : "Draft", next: isRTL ? "معتمدة" : "Approved", dot: "bg-emerald-500" },
                { t: `${inv.date} 14:15`, a: isRTL ? "إضافة مصاريف مرتبطة" : "Purchase Costs Added",      u: "أحمد (مالك)", prev: "0",              next: "AED 1,000",          dot: "bg-amber-500" },
                { t: `${inv.date} 13:30`, a: isRTL ? "رفع فاتورة المورد" : "Supplier Invoice Uploaded",    u: "أحمد (مالك)", prev: "",               next: `${inv.supplierInvNo}.pdf`, dot: "bg-blue-500" },
                { t: `${inv.date} 13:00`, a: isRTL ? "إنشاء فاتورة الشراء" : "Purchase Invoice Created",   u: "محمد (كاشير)",prev: "",               next: isRTL ? "مسودة" : "Draft", dot: "bg-slate-400" },
              ].map((e, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} /><span className="text-sm font-bold text-slate-700">{e.a}</span></div><span className="font-mono text-xs text-slate-400 shrink-0">{e.t}</span></div>
                  <div className="text-xs text-slate-400 ms-4 mb-1">{e.u}</div>
                  {(e.prev || e.next) && <div className="flex items-center gap-2 flex-wrap ms-4">{e.prev && <span className="text-[10px] font-mono bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg">{isRTL ? "قبل:" : "Before:"} {e.prev}</span>}{e.next && <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-lg">{isRTL ? "بعد:" : "After:"} {e.next}</span>}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showPay && <SupplierPayModal lang={lang} invoiceId={inv.id} onClose={() => setShowPay(false)} />}
      {showCancel && <CancelPurchModal lang={lang} invoiceId={inv.id} onClose={() => setShowCancel(false)} />}
    </div>
  );
}

// ── SCREEN: INTERNAL PURCHASE RECORD PREVIEW ──────────────────────────────────
export function PurchPreviewScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: TenantScreen) => void; role?: TenantRole }) {
  const isRTL = lang === "ar";
  const inv = MOCK_P_INVOICES[0];
  const goodsTotal = 3305.55; const vat = 165.28; const total = 3470.83;
  const tCt = 146; const tPcs = 1460; const tKg = 1310;

  return (
    <div className="p-4 lg:p-8 max-w-screen-lg mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("purchases-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1" />
        <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn variant="secondary"><Download size={15} />PDF</Btn>
        <Btn variant="outline"><Download size={14} />{isRTL ? "رفع فاتورة المورد" : "Upload Invoice"}</Btn>
        <Btn variant="outline"><Mail size={14} />{isRTL ? "إرسال بريد" : "Email"}</Btn>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0F2C59] text-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-2xl font-black">شركة الوطنية للدواجن</div>
              <div className="text-base font-bold text-white/75">Al Wataniyah Poultry Company LLC</div>
              <div className="text-sm text-white/55 mt-2">{isRTL ? "المنطقة الصناعية، الشارع 12، دبي" : "Industrial Area, Street 12, Dubai"}</div>
            </div>
            <div className="text-end">
              <div className="text-xl font-black text-amber-300 leading-tight">{isRTL ? "سجل شراء داخلي" : "INTERNAL PURCHASE RECORD"}</div>
              <div className="text-sm font-bold text-white/75 mt-1">{isRTL ? "فاتورة ضريبية داخلية" : "Internal Tax Record"}</div>
              <div className="mt-2 space-y-0.5">
                <div className="text-sm font-bold text-white/70">{isRTL ? "رقم:" : "No:"} <span className="font-mono text-amber-300 font-black">{inv.id}</span></div>
                <div className="text-sm font-bold text-white/70">{isRTL ? "التاريخ:" : "Date:"} <span className="font-mono text-white">{inv.date}</span></div>
              </div>
            </div>
          </div>
        </div>
        {/* Supplier */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">{isRTL ? "المورد / Supplier" : "Supplier / المورد"}</div>
            <div className="font-black text-slate-800 text-base">{inv.supplier}</div>
            <div className="text-sm text-slate-500 mt-1">{isRTL ? "فاتورة المورد:" : "Supplier Invoice:"} {inv.supplierInvNo}</div>
            <div className="text-sm text-slate-500">{isRTL ? "تاريخ الفاتورة:" : "Invoice Date:"} {inv.date}</div>
          </div>
          <div className={isRTL ? "" : "text-right"}>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1">TRN {isRTL ? "المورد" : "Supplier"}</div>
            <div className="font-mono text-slate-500 text-sm">{P_SUPPLIERS[0].trn || "—"}</div>
          </div>
        </div>
        {/* Table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0F2C59]/8 border-b-2 border-[#0F2C59]/20">
                {[[isRTL ? "المنتج" : "Product", "Product / المنتج"], [isRTL ? "طريقة الشراء" : "Method", "Method"], ["Ct", isRTL ? "كرتون" : "Ct"], ["Pcs", isRTL ? "حبة" : "Pcs"], ["Kg", "كيلو"], [isRTL ? "السعر" : "Rate", "Rate"], [isRTL ? "نوع السعر" : "Rate Type", "Type"], [isRTL ? "المبلغ" : "Amount", "Amount"]].map(([a, b], i) => (
                  <th key={i} className="px-3 py-2.5 text-center font-bold text-xs text-[#0F2C59]"><div>{isRTL ? a : b}</div><div className="text-slate-400 font-normal text-[10px]">{isRTL ? b : a}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {P_SAMPLE_LINES.map((l, i) => (
                <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} border-b border-slate-100`}>
                  <td className="px-3 py-2 font-bold text-slate-800 text-center">{isRTL ? l.productAr : l.product}</td>
                  <td className="px-3 py-2 text-center"><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{isRTL ? "بالحبة" : "By Piece"}</span></td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.ct}</td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.pcs}</td>
                  <td className="px-3 py-2 font-mono text-center font-bold text-slate-700">{l.kg}</td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.rate}</td>
                  <td className="px-3 py-2 text-center text-xs text-slate-500">{isRTL ? "سعر الحبة" : "Per Piece"}</td>
                  <td className="px-3 py-2 font-mono font-black text-center text-[#0F2C59]">{l.amount.toFixed(2)}</td>
                </tr>
              ))}
              {P_SAMPLE_BYPRODUCTS.map((l, i) => (
                <tr key={`bp-${i}`} className={`${i % 2 === 1 ? "bg-white" : "bg-amber-50/30"} border-b border-slate-100`}>
                  <td className="px-3 py-2 font-bold text-slate-700 text-center text-xs">{isRTL ? l.productAr : l.product}</td>
                  <td className="px-3 py-2 text-center"><span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL ? "بالطبق" : "By Tray"}</span></td>
                  <td className="px-3 py-2 text-center text-slate-400">—</td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.trays}</td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.kg}</td>
                  <td className="px-3 py-2 font-mono text-center text-slate-600">{l.rate}</td>
                  <td className="px-3 py-2 text-center text-xs text-slate-500">{isRTL ? "سعر الطبق" : "Per Tray"}</td>
                  <td className="px-3 py-2 font-mono font-black text-center text-[#0F2C59]">{l.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-[#0F2C59]/8 border-t-2 border-[#0F2C59]/20 font-black">
                <td className="px-3 py-2.5 text-center text-[#0F2C59]">{isRTL ? "الإجمالي / Total" : "Total / الإجمالي"}</td>
                <td /><td className="px-3 py-2.5 font-mono text-center text-[#0F2C59]">{tCt}</td>
                <td className="px-3 py-2.5 font-mono text-center text-[#0F2C59]">{tPcs}</td>
                <td className="px-3 py-2.5 font-mono text-center text-[#0F2C59]">{tKg}</td>
                <td /><td />
                <td className="px-3 py-2.5 font-mono text-center text-[#0F2C59]">{goodsTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Totals + Footer */}
        <div className="px-6 pb-8">
          <div className="flex justify-end mb-5">
            <div className="w-72 border-2 border-[#0F2C59]/20 rounded-2xl overflow-hidden">
              {[[isRTL ? "إجمالي البضاعة / Goods Total" : "Goods Total / إجمالي البضاعة", goodsTotal.toFixed(2), "bg-slate-50 text-slate-700"], [isRTL ? "ضريبة 5% / VAT" : "VAT 5% / ضريبة", vat.toFixed(2), "bg-slate-50 text-slate-700"]].map(([l, v, c]) => (
                <div key={l} className={`flex justify-between px-4 py-2.5 text-sm border-b border-slate-200 ${c}`}><span className="font-semibold text-slate-500">{l}</span><span className="font-mono font-bold">AED {v}</span></div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-[#0F2C59] items-center">
                <span className="font-black text-white text-sm">{isRTL ? "صافي المستحق / Net Payable" : "Net Payable / صافي المستحق"}</span>
                <span className="font-mono font-black text-amber-300 text-lg">AED {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {[isRTL ? "أعدّه / Prepared by" : "Prepared by / أعدّه", isRTL ? "اعتمده / Approved by" : "Approved by / اعتمده", isRTL ? "مرجع / Reference" : "Reference / مرجع"].map(l => (
              <div key={l} className="border-t-2 border-slate-200 pt-3 text-center"><div className="text-xs font-black text-slate-400 uppercase tracking-wide">{l}</div><div className="h-10" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: SUPPLIER PAYMENT ────────────────────────────────────────────────────
export function SupplierPayModal({ lang, invoiceId, onClose }: { lang: Lang; invoiceId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const inv = MOCK_P_INVOICES.find(i => i.id === invoiceId) || MOCK_P_INVOICES[1];
  const [amount, setAmount] = useState(String(inv.remaining));
  const [method, setMethod] = useState("bank");
  const [date, setDate] = useState("2025-01-28");
  const [ref, setRef] = useState("");
  const [success, setSuccess] = useState(false);
  const after = Math.max(0, inv.remaining - (parseFloat(amount) || 0));

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل الدفعة للمورد!" : "Supplier Payment Recorded!"}</h3>
        <p className="text-slate-400 font-semibold mb-6 font-mono">AED {parseFloat(amount || "0").toLocaleString()}</p>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" className="flex-1 justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال" : "Print Receipt"}</Btn>
          <Btn variant="outline" size="sm" className="flex-1 justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل دفعة للمورد" : "Record Supplier Payment"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "المورد" : "Supplier"}</span><span className="font-bold text-slate-800">{inv.supplier}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "صافي المستحق" : "Net Payable"}</span><span className="font-mono font-black text-[#0F2C59]">AED {inv.netPayable.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "المدفوع سابقاً" : "Prev. Paid"}</span><span className="font-mono font-bold text-emerald-600">AED {inv.paid.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-black text-red-600">{isRTL ? "المتبقي الحالي" : "Current Remaining"}</span><span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span></div>
          </div>
          <FInput label={isRTL ? "المبلغ المدفوع (AED)" : "Amount Paid (AED)"} type="number" value={amount} onChange={setAmount} required />
          <FSelect label={isRTL ? "طريقة الدفع" : "Payment Method"} value={method} onChange={setMethod} options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
          <FInput label={isRTL ? "تاريخ الدفع" : "Payment Date"} type="date" value={date} onChange={setDate} />
          <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference (Optional)"} value={ref} onChange={setRef} />
          {parseFloat(amount) > 0 && (
            <div className={`rounded-xl p-3 border ${after === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${after === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `رصيد المورد بعد الدفع: AED ${after.toLocaleString()}` : `Supplier balance after payment: AED ${after.toLocaleString()}`}
                {after === 0 && (isRTL ? " ✓ مسدّد بالكامل" : " ✓ Fully settled")}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="primary" onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error(isRTL ? "أدخل المبلغ" : "Enter amount"); return; } setSuccess(true); }}><Check size={15} />{isRTL ? "تسجيل الدفعة" : "Record Payment"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: CANCEL PURCHASE INVOICE ────────────────────────────────────────────
export function CancelPurchModal({ lang, invoiceId, onClose, onSuccess }: { lang: Lang; invoiceId: string; onClose: () => void; onSuccess?: () => void }) {
  const isRTL = lang === "ar";
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockPartlySold, setStockPartlySold] = useState(false); // demo toggle only in mock flows

  const handleConfirm = async () => {
    if (!reason.trim() || !confirmed || stockPartlySold) return;
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم إلغاء فاتورة الشراء" : "Purchase invoice cancelled");
      onSuccess?.();
      onClose();
      return;
    }
    setSaving(true);
    try {
      await cancelPurchase(invoiceId, reason);
      toast.success(isRTL ? "تم إلغاء الفاتورة بنجاح" : "Invoice cancelled successfully");
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (isRTL ? "فشل الإلغاء" : "Cancel failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-red-600 mb-0.5">{isRTL ? "إلغاء فاتورة الشراء" : "Cancel Purchase Invoice"}</h3>
            <p className="text-xs text-slate-400 font-mono">{invoiceId}</p>
          </div>
          {/* Demo toggle for state A / B */}
          <div className="text-end">
            <button onClick={() => { setStockPartlySold(v => !v); setConfirmed(false); }}
              className={`text-[10px] font-black px-2.5 py-1.5 rounded-full border transition-all ${stockPartlySold ? "bg-red-50 border-red-300 text-red-600" : "bg-emerald-50 border-emerald-300 text-emerald-600"}`}>
              {stockPartlySold ? (isRTL ? "جزء مباع ▸ عكس" : "Stock sold ▸ flip") : (isRTL ? "مخزون متاح ▸ عكس" : "Stock free ▸ flip")}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* State A — stock not sold yet */}
          {!stockPartlySold && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-emerald-700 text-sm mb-1">{isRTL ? "يمكن إلغاء الفاتورة" : "Cancellation is possible"}</div>
                <p className="text-xs font-bold text-emerald-600 leading-relaxed">{isRTL ? "يمكن إلغاء الفاتورة وسيتم عكس حركة المخزون وحساب المورد." : "Invoice can be cancelled and inventory movement + supplier balance will be reversed."}</p>
              </div>
            </div>
          )}

          {/* State B — stock partly sold */}
          {stockPartlySold && (
            <div className="bg-red-50 border border-red-300 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <span className="font-black text-red-700 text-sm">{isRTL ? "تحذير: جزء من المخزون تم بيعه" : "Warning: Some stock has been sold"}</span>
              </div>
              <p className="text-xs font-bold text-red-600 leading-relaxed">{isRTL ? "لا يمكن إلغاء الفاتورة بالكامل لأن جزءاً من المخزون تم بيعه. استخدم تسوية مخزون أو مرتجع شراء لاحقاً." : "Cannot fully cancel because some stock was already sold. Use inventory adjustment or purchase return instead."}</p>
            </div>
          )}

          {/* Common consequences */}
          <div className={`border rounded-2xl p-4 space-y-1.5 ${stockPartlySold ? "bg-red-50/50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            {[
              [isRTL ? "سيتم تعديل حساب المورد" : "Supplier balance will be updated", !stockPartlySold],
              [isRTL ? "سيتم عكس حركة المخزون إذا كان المخزون متاحاً" : "Inventory movement reversed if stock available", !stockPartlySold],
              [isRTL ? "لا يمكن التراجع عن الإلغاء" : "Cancellation cannot be undone", false],
            ].map(([w, ok], i) => (
              <div key={i} className={`flex items-center gap-2 text-xs font-bold ${ok ? "text-emerald-700" : "text-amber-700"}`}>
                {ok ? <CheckCircle size={11} className="shrink-0" /> : <AlertTriangle size={11} className="shrink-0" />}{w}
              </div>
            ))}
          </div>

          {/* Reason — only shown for State A */}
          {!stockPartlySold && (
            <>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "سبب الإلغاء *" : "Cancellation Reason *"}</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder={isRTL ? "أدخل سبب الإلغاء..." : "Enter reason..."} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400" /></div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 shrink-0" />
                <span className="text-sm font-bold text-slate-700">{isRTL ? "أفهم أن إلغاء فاتورة الشراء سيؤثر على المخزون وحساب المورد." : "I understand that cancellation will affect inventory and supplier balance."}</span>
              </label>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
          {stockPartlySold
            ? <div className="flex-1 relative group">
                <div className="w-full flex items-center justify-center gap-2 font-bold rounded-xl border px-4 py-2 text-sm cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200 opacity-70 select-none">
                  <Ban size={14} />{isRTL ? "لا يمكن الإلغاء الكامل" : "Full cancellation blocked"}
                </div>
                <div className={`absolute bottom-full mb-2 ${isRTL ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-10 pointer-events-none shadow-xl whitespace-nowrap`}>
                  {isRTL ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission for this action"}
                </div>
              </div>
            : <Btn variant="danger" disabled={!reason.trim() || !confirmed || saving} onClick={() => void handleConfirm()} className="flex-1 justify-center"><Ban size={14} />{isRTL ? "تأكيد الإلغاء" : "Confirm Cancel"}</Btn>}
        </div>
      </div>
    </div>
  );
}
