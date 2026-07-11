// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — PHASE 5: INVENTORY MANAGEMENT MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  Package, AlertTriangle, AlertCircle, CheckCircle, XCircle, Info, X, Plus,
  Search, Eye, Pencil, Settings, Download, Printer, ChevronRight, ChevronLeft,
  ChevronDown, Check, RefreshCw, TrendingUp, TrendingDown, Calendar, ShoppingCart,
  ArrowUp, ArrowDown, BarChart2, Layers, FileText, Filter, Minus, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { useInventory } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { toModuleInvProduct } from "./moduleMappers";
import { IS_MOCK_MODE } from "@/services/config";
import {
  listStockMovements,
  createStocktakingSession,
  addStocktakingLine,
  applyStocktaking,
  getInventoryProductDetail,
  createInventoryAdjustment,
  type InventoryProductDetail,
} from "@/services/inventoryService";
import { ReasonModal } from "@/features/invoices/ReasonModal";
import { ApiError } from "@/services/api/errors";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "dashboard" | "sales" | "sales-list" | "sales-new" | "sales-preview" | "sales-detail"
  | "purchases" | "purchases-list" | "purchases-new" | "purchases-preview" | "purchases-detail"
  | "inventory" | "inventory-product" | "inventory-stocktaking" | "inventory-alerts"
  | "inventory-movement" | "inventory-valuation"
  | "quotations" | "customers" | "suppliers" | "payments" | "expenses"
  | "accounts" | "tax" | "reports" | "users" | "settings";
type InvStatus = "available" | "low" | "out" | "review";
type MovType = "purchase" | "sale" | "return" | "reversal" | "adj-increase" | "adj-decrease" | "stocktake";

// ── LOCAL UI PRIMITIVES ────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "green" | "amber";
  size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-2 font-bold rounded-xl transition-all cursor-pointer border focus:outline-none active:scale-[0.98]";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary:   "bg-[#0F2C59] text-white border-[#0F2C59] hover:bg-[#162f5f]",
    secondary: "bg-white text-[#0F2C59] border-[#0F2C59]/20 hover:border-[#0F2C59]/40 hover:bg-[#0F2C59]/5",
    danger:    "bg-[#EF4444] text-white border-[#EF4444] hover:bg-red-600",
    ghost:     "bg-transparent text-slate-500 border-transparent hover:bg-slate-100",
    outline:   "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    green:     "bg-[#22C55E] text-white border-[#22C55E] hover:bg-emerald-600 shadow-lg shadow-emerald-200/50",
    amber:     "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>{children}</button>;
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
      <div className="inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed select-none bg-slate-50 text-slate-400 border-slate-200 opacity-60">{children}</div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 pointer-events-none shadow-xl max-w-48 text-center whitespace-nowrap`}>
        {lang === "ar" ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission"}
      </div>
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface InvProduct {
  id: string; name: string; nameAr: string; cartons: number; pcs: number; kg: number;
  minCartons: number; minKg: number; status: InvStatus; category: string;
  lastPurchase: string; lastSale: string; avgSalePrice: number; fifoCost: number;
}
const MOCK_INV_PRODUCTS: InvProduct[] = [
  { id: "ip900",  name: "900 GRAM",  nameAr: "900 جرام",   cartons: 34,  pcs: 340,  kg: 306,   minCartons: 20, minKg: 270, status: "available", category: "chicken", lastPurchase: "2025-01-28", lastSale: "2025-01-28", avgSalePrice: 13.75, fifoCost: 12.25 },
  { id: "ip1000", name: "1000 GRAM", nameAr: "1000 جرام",  cartons: 8,   pcs: 80,   kg: 80,    minCartons: 20, minKg: 200, status: "low",       category: "chicken", lastPurchase: "2025-01-27", lastSale: "2025-01-28", avgSalePrice: 14.00, fifoCost: 12.50 },
  { id: "ip1100", name: "1100 GRAM", nameAr: "1100 جرام",  cartons: 24,  pcs: 240,  kg: 264,   minCartons: 15, minKg: 165, status: "available", category: "chicken", lastPurchase: "2025-01-25", lastSale: "2025-01-27", avgSalePrice: 14.50, fifoCost: 13.00 },
  { id: "ip1200", name: "1200 GRAM", nameAr: "1200 جرام",  cartons: 0,   pcs: 0,    kg: 0,     minCartons: 15, minKg: 180, status: "out",       category: "chicken", lastPurchase: "2025-01-20", lastSale: "2025-01-22", avgSalePrice: 14.75, fifoCost: 13.25 },
  { id: "ip700",  name: "700 GRAM",  nameAr: "700 جرام",   cartons: 12,  pcs: 192,  kg: 134.4, minCartons: 10, minKg: 100, status: "available", category: "chicken", lastPurchase: "2025-01-26", lastSale: "2025-01-28", avgSalePrice: 13.25, fifoCost: 11.50 },
  { id: "ip800",  name: "800 GRAM",  nameAr: "800 جرام",   cartons: 20,  pcs: 320,  kg: 256,   minCartons: 15, minKg: 150, status: "available", category: "chicken", lastPurchase: "2025-01-26", lastSale: "2025-01-28", avgSalePrice: 13.50, fifoCost: 12.00 },
  { id: "ip1300", name: "1300 GRAM", nameAr: "1300 جرام",  cartons: 5,   pcs: 50,   kg: 65,    minCartons: 10, minKg: 130, status: "low",       category: "big",     lastPurchase: "2025-01-24", lastSale: "2025-01-25", avgSalePrice: 15.00, fifoCost: 13.50 },
  { id: "ip1500", name: "1500 GRAM", nameAr: "1500 جرام",  cartons: 18,  pcs: 180,  kg: 270,   minCartons: 10, minKg: 150, status: "available", category: "big",     lastPurchase: "2025-01-23", lastSale: "2025-01-26", avgSalePrice: 15.50, fifoCost: 14.00 },
  { id: "ipliver",name: "Liver",     nameAr: "كبدة",        cartons: 0,   pcs: 0,    kg: 13,    minCartons: 0,  minKg: 10,  status: "available", category: "parts",   lastPurchase: "2025-01-28", lastSale: "2025-01-28", avgSalePrice: 4.00,  fifoCost: 3.50 },
  { id: "ipgizz", name: "Gizzard",   nameAr: "قانصة",       cartons: 0,   pcs: 0,    kg: 5,     minCartons: 0,  minKg: 10,  status: "low",       category: "parts",   lastPurchase: "2025-01-27", lastSale: "2025-01-28", avgSalePrice: 4.00,  fifoCost: 3.80 },
  { id: "ipbrst", name: "Breast",    nameAr: "صدور",        cartons: 0,   pcs: 0,    kg: 17,    minCartons: 0,  minKg: 15,  status: "available", category: "parts",   lastPurchase: "2025-01-27", lastSale: "2025-01-28", avgSalePrice: 22.00, fifoCost: 18.00 },
];

const INV_MOVEMENTS = [
  { id: "mv1", date: "2025-01-28 14:30", productId: "ip900",  type: "purchase"     as MovType, ref: "PUR-2025-0042",        ctDelta:  34,  pcsDelta:  340, kgDelta:  306,  balAfter: 34, user: "أحمد (مالك)",   note: "" },
  { id: "mv2", date: "2025-01-28 10:15", productId: "ip900",  type: "sale"         as MovType, ref: "INV-2025-0086",        ctDelta:  -4,  pcsDelta:  -40, kgDelta:  -36,  balAfter: 30, user: "محمد (كاشير)",  note: "" },
  { id: "mv3", date: "2025-01-28 09:00", productId: "ipliver",type: "adj-decrease" as MovType, ref: "ADJ-2025-001",         ctDelta:   0,  pcsDelta:    0, kgDelta:  -2,   balAfter: 13, user: "أحمد (مالك)",   note: "تلف بضاعة" },
  { id: "mv4", date: "2025-01-27 16:00", productId: "ip1000", type: "return"       as MovType, ref: "INV-2025-0079-CANCEL", ctDelta:   2,  pcsDelta:   20, kgDelta:   20,  balAfter: 8,  user: "أحمد (مالك)",   note: "إرجاع من إلغاء" },
  { id: "mv5", date: "2025-01-27 11:00", productId: "ip1100", type: "purchase"     as MovType, ref: "PUR-2025-0041",        ctDelta:  24,  pcsDelta:  240, kgDelta:  264,  balAfter: 24, user: "أحمد (مالك)",   note: "" },
  { id: "mv6", date: "2025-01-26 14:00", productId: "ip800",  type: "purchase"     as MovType, ref: "PUR-2025-0038",        ctDelta:  20,  pcsDelta:  320, kgDelta:  256,  balAfter: 20, user: "أحمد (مالك)",   note: "" },
  { id: "mv7", date: "2025-01-25 09:30", productId: "ip1300", type: "sale"         as MovType, ref: "INV-2025-0083",        ctDelta:  -2,  pcsDelta:  -20, kgDelta:  -26,  balAfter: 5,  user: "محمد (كاشير)",  note: "" },
  { id: "mv8", date: "2025-01-24 08:00", productId: "ip1000", type: "adj-decrease" as MovType, ref: "STKTAKE-001",          ctDelta:  -1,  pcsDelta:  -10, kgDelta:  -10,  balAfter: 6,  user: "أحمد (مالك)",   note: "جرد فعلي — فرق وزن" },
];

type DisplayMovement = (typeof INV_MOVEMENTS)[number];

function mapApiMovementType(type: string): MovType {
  const t = type.toLowerCase();
  if (t.includes("purchase")) return "purchase";
  if (t.includes("sales_approved") || (t.includes("sale") && !t.includes("cancel"))) return "sale";
  if (t.includes("cancel") || t.includes("return")) return "return";
  if (t.includes("reversal")) return "reversal";
  if (t.includes("manual_increase") || t.includes("opening") || t.includes("stocktaking_increase")) return "adj-increase";
  if (t.includes("manual_decrease") || t.includes("stocktaking_decrease")) return "adj-decrease";
  if (t.includes("correction") || t.includes("stocktake")) return "stocktake";
  return "adj-increase";
}

function mapDetailMovements(rows: InventoryProductDetail["recentMovements"], productId: string): DisplayMovement[] {
  return rows.map((m) => ({
    id: m.id,
    date: m.date,
    productId,
    type: mapApiMovementType(m.type),
    ref: m.reference ?? "",
    ctDelta: m.cartons,
    pcsDelta: m.pieces,
    kgDelta: m.weightKg,
    balAfter: m.balanceAfter ?? 0,
    user: m.createdByName ?? "",
    note: m.notes ?? "",
  }));
}

// ── STATUS & MOVEMENT BADGES ───────────────────────────────────────────────────
function InvStatusBadge({ status, lang }: { status: InvStatus; lang: Lang }) {
  const cfg = {
    available: { bg: "bg-emerald-50",  t: "text-emerald-700", dot: "bg-emerald-500", ar: "متوفر",         en: "Available" },
    low:       { bg: "bg-amber-50",    t: "text-amber-700",   dot: "bg-amber-500",   ar: "منخفض",         en: "Low" },
    out:       { bg: "bg-red-50",      t: "text-red-700",     dot: "bg-red-500",     ar: "نفد",           en: "Out of Stock" },
    review:    { bg: "bg-slate-100",   t: "text-slate-600",   dot: "bg-slate-400",   ar: "يحتاج مراجعة", en: "Needs Review" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.t}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {lang === "ar" ? cfg.ar : cfg.en}
    </span>
  );
}

function MovTypeBadge({ type, lang }: { type: MovType; lang: Lang }) {
  const cfg = {
    "purchase":     { bg: "bg-emerald-50", t: "text-emerald-700", icon: "↑", ar: "إضافة شراء",         en: "Purchase" },
    "sale":         { bg: "bg-red-50",     t: "text-red-700",     icon: "↓", ar: "خصم بيع",            en: "Sale" },
    "return":       { bg: "bg-blue-50",    t: "text-blue-700",    icon: "↑", ar: "إرجاع من إلغاء",     en: "Return" },
    "reversal":     { bg: "bg-[#0F2C59]/8",t: "text-[#0F2C59]",  icon: "⟲", ar: "عكس فاتورة",         en: "Reversal" },
    "adj-increase": { bg: "bg-amber-50",   t: "text-amber-700",   icon: "↑", ar: "تعديل يدوي زيادة",  en: "Manual +" },
    "adj-decrease": { bg: "bg-amber-50",   t: "text-amber-700",   icon: "↓", ar: "تعديل يدوي نقص",   en: "Manual −" },
    "stocktake":    { bg: "bg-violet-50",  t: "text-violet-700",  icon: "≡", ar: "جرد مخزون",          en: "Stocktake" },
  }[type];
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.t}`}><span>{cfg.icon}</span>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

// Helper: format quantity change with sign
function QtyDelta({ val, suffix = "" }: { val: number; suffix?: string }) {
  if (val === 0) return <span className="text-slate-400 text-xs">—</span>;
  return <span className={`font-mono font-black text-xs ${val > 0 ? "text-emerald-600" : "text-red-500"}`}>{val > 0 ? "+" : ""}{val}{suffix}</span>;
}

function inventoryRowFromMock(p: InvProduct) {
  const status = p.status === "available" ? "ok" : p.status;
  return { id: p.id, productId: p.id, name: p.nameAr, nameEn: p.name, cartons: p.cartons, pieces: p.pcs, weightKg: p.kg, minStock: p.minCartons || p.minKg, priceKg: p.fifoCost, status: status as "ok" | "low" | "out" };
}

function enrichInvProduct(m: ReturnType<typeof toModuleInvProduct>, mock?: InvProduct): InvProduct {
  const statusMap: Record<string, InvStatus> = { ok: "available", low: "low", out: "out" };
  const productId = m.productId || m.id;
  return {
    id: productId,
    name: m.nameEn,
    nameAr: m.nameAr,
    cartons: m.cartons,
    pcs: m.pieces,
    kg: m.kg,
    minCartons: mock?.minCartons ?? m.minCt,
    minKg: mock?.minKg ?? m.minKg,
    status: statusMap[m.status] ?? mock?.status ?? "available",
    category: mock?.category ?? "chicken",
    lastPurchase: mock?.lastPurchase ?? "",
    lastSale: mock?.lastSale ?? "",
    avgSalePrice: mock?.avgSalePrice ?? m.avgCost,
    fifoCost: mock?.fifoCost ?? m.avgCost,
  };
}

function invProductFromDetail(detail: InventoryProductDetail): InvProduct {
  const statusMap: Record<string, InvStatus> = { ok: "available", low: "low", out: "out" };
  return {
    id: detail.productId,
    name: detail.nameEn ?? detail.name,
    nameAr: detail.name,
    cartons: detail.cartons,
    pcs: detail.pieces,
    kg: detail.weightKg,
    minCartons: detail.minCartons,
    minKg: detail.minKg,
    status: statusMap[detail.status ?? "ok"] ?? "available",
    category: "chicken",
    lastPurchase: "",
    lastSale: detail.lastMovementAt?.slice(0, 10) ?? "",
    avgSalePrice: detail.fifoCostPerKg,
    fifoCost: detail.fifoCostPerKg,
  };
}

// ── SCREEN: INVENTORY OVERVIEW ─────────────────────────────────────────────────
export function InventoryOverviewScreen({ lang, role, onNavigate, selectedProductId, setSelectedProductId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  selectedProductId: string; setSelectedProductId: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<InvProduct | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const canAdjust = role === "owner" || role === "accountant";
  const canStocktake = role === "owner" || role === "accountant";
  const canViewValuation = role === "owner" || role === "accountant";

  const { items: inventoryRows, loading, error, forbidden, reload } = useInventory(
    search ? { search } : undefined,
    async () => MOCK_INV_PRODUCTS.map(inventoryRowFromMock),
  );
  const INV_PRODUCTS = inventoryRows.map((row) =>
    enrichInvProduct(toModuleInvProduct(row), IS_MOCK_MODE ? MOCK_INV_PRODUCTS.find((m) => m.id === row.productId || m.id === row.id) : undefined),
  );

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const filtered = INV_PRODUCTS.filter(p => {
    const s = search.toLowerCase();
    return (!s || p.nameAr.includes(search) || p.name.toLowerCase().includes(s)) &&
      (filterStatus === "all" || p.status === filterStatus) &&
      (filterCategory === "all" || p.category === filterCategory);
  });

  const totalCartons = INV_PRODUCTS.reduce((s, p) => s + p.cartons, 0);
  const totalPcs = INV_PRODUCTS.reduce((s, p) => s + p.pcs, 0);
  const totalKg = INV_PRODUCTS.reduce((s, p) => s + p.kg, 0);
  const lowCount = INV_PRODUCTS.filter(p => p.status === "low").length;
  const outCount = INV_PRODUCTS.filter(p => p.status === "out").length;
  const availCount = INV_PRODUCTS.filter(p => p.status === "available").length;
  const estValue = Math.round(INV_PRODUCTS.reduce((s, p) => s + (p.kg * p.fifoCost), 0));

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "المخزون" : "Inventory"}</h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? "المخزون الحالي حسب آخر فواتير شراء وبيع معتمدة" : "Current stock based on last approved purchase and sales invoices"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canStocktake
            ? <Btn variant="secondary" size="sm" onClick={() => onNavigate("inventory-stocktaking")}><Layers size={14} />{isRTL ? "جرد المخزون" : "Stocktaking"}</Btn>
            : <PermBtn lang={lang}><Layers size={14} />{isRTL ? "جرد المخزون" : "Stocktaking"}</PermBtn>}
          <Btn variant="outline" size="sm" onClick={() => onNavigate("inventory-movement")}><BarChart2 size={14} />{isRTL ? "الحركات" : "Movements"}</Btn>
          {canViewValuation && <Btn variant="outline" size="sm" onClick={() => onNavigate("inventory-valuation")}><TrendingUp size={14} />{isRTL ? "تقييم FIFO" : "FIFO Value"}</Btn>}
          <Btn variant="outline" size="sm" onClick={() => setShowSettings(true)}><Settings size={14} /></Btn>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { v: totalCartons.toLocaleString(),        ar: "إجمالي الكراتين المتاحة",   en: "Total Cartons",       iconBg: "bg-[#0F2C59]",   icon: Package },
          { v: totalPcs.toLocaleString(),            ar: "إجمالي الحبات المتاحة",     en: "Total Pieces",        iconBg: "bg-violet-500",  icon: Layers },
          { v: `${Math.round(totalKg).toLocaleString()} KG`, ar: "إجمالي الكيلو المتاح",  en: "Total KG",      iconBg: "bg-blue-500",    icon: BarChart2 },
          { v: availCount.toString(),                ar: "المنتجات المتوفرة",          en: "Available Products",  iconBg: "bg-emerald-500", icon: CheckCircle },
          { v: lowCount.toString(),                  ar: "منتجات منخفضة المخزون",     en: "Low Stock",           iconBg: "bg-amber-500",   icon: AlertTriangle, onClick: () => onNavigate("inventory-alerts") },
          { v: outCount.toString(),                  ar: "منتجات نفدت من المخزون",    en: "Out of Stock",        iconBg: "bg-red-500",     icon: XCircle, onClick: () => onNavigate("inventory-alerts") },
          { v: `AED ${estValue.toLocaleString()}`,   ar: "قيمة المخزون التقديرية",    en: "Estimated Value",     iconBg: "bg-emerald-600", icon: TrendingUp },
          { v: IS_MOCK_MODE ? `36 KG` : `0 KG`,                              ar: "مبيعات اليوم من المخزون",   en: "Today's Stock Sales", iconBg: "bg-[#0F2C59]",   icon: TrendingDown },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} onClick={c.onClick} className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all ${c.onClick ? "cursor-pointer hover:border-[#0F2C59]/30" : ""}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}><Icon size={18} className="text-white" /></div>
              <div className="min-w-0">
                <div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{c.v}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 leading-tight">{isRTL ? c.ar : c.en}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FIFO note */}
      <div className="flex items-center gap-2 bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl px-4 py-2.5">
        <Info size={14} className="text-[#0F2C59]/60 shrink-0" />
        <span className="text-xs font-semibold text-slate-500">{isRTL ? "يتم حساب تكلفة المخزون والربح بطريقة FIFO تلقائياً دون الحاجة لاختيار الدفعات." : "Inventory cost and profit are calculated using FIFO automatically, no manual batch selection needed."}</span>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث عن منتج أو وزن..." : "Search product or weight..."}
              className={`w-full py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="available">{isRTL ? "متوفر" : "Available"}</option>
            <option value="low">{isRTL ? "منخفض" : "Low"}</option>
            <option value="out">{isRTL ? "نفد" : "Out of Stock"}</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الفئات" : "All Categories"}</option>
            <option value="chicken">{isRTL ? "دجاج كامل" : "Whole Chicken"}</option>
            <option value="big">{isRTL ? "أوزان كبيرة" : "Big Weights"}</option>
            <option value="parts">{isRTL ? "أجزاء" : "Parts"}</option>
          </select>
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
        </div>
      </Card>

      {/* Desktop Stock Table */}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "المنتج / الوزن" : "Product / Weight", isRTL ? "كرتون" : "Cartons", isRTL ? "حبة" : "Pieces", "KG", isRTL ? "الحد الأدنى" : "Min Level", isRTL ? "الحالة" : "Status", isRTL ? "آخر شراء" : "Last Purchase", isRTL ? "متوسط البيع" : "Avg Sale", "FIFO", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={`h-${i}`} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${p.status === "out" ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{isRTL ? p.nameAr : p.name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold capitalize">{p.category}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{p.cartons || "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{p.pcs || "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0F2C59]">{p.kg > 0 ? `${p.kg}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{p.minCartons > 0 ? `${p.minCartons} Ct` : `${p.minKg} KG`}</td>
                    <td className="px-4 py-3"><InvStatusBadge status={p.status} lang={lang} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">{p.lastPurchase}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600 text-xs">AED {p.avgSalePrice}/KG</td>
                    <td className="px-4 py-3 font-mono text-blue-600 text-xs">AED {p.fifoCost}/KG</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedProductId(p.id); onNavigate("inventory-product"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all" title={isRTL ? "عرض الحركة" : "View Movements"}><Eye size={13} /></button>
                        {canAdjust
                          ? <button onClick={() => { setAdjustProduct(p); setShowAdjust(p.id); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all" title={isRTL ? "تعديل المخزون" : "Adjust Stock"}><Pencil size={13} /></button>
                          : <div className="relative group"><div className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed"><Pencil size={13} /></div><div className="absolute bottom-full mb-1 right-0 bg-[#0F2C59] text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{isRTL ? "ليس لديك صلاحية" : "No permission"}</div></div>}
                        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all" title={isRTL ? "طباعة" : "Print"}><Printer size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile stock cards */}
      {filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className={`p-4 ${p.status === "out" ? "border-red-200" : p.status === "low" ? "border-amber-200" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div><div className="font-bold text-slate-800">{isRTL ? p.nameAr : p.name}</div><div className="text-[10px] text-slate-400 font-semibold capitalize mt-0.5">{p.category}</div></div>
                <InvStatusBadge status={p.status} lang={lang} />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-lg">{p.cartons}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "كرتون" : "Cartons"}</div></div>
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-lg">{p.pcs || p.kg}</div><div className="text-[10px] text-slate-400 font-bold">{p.pcs ? (isRTL ? "حبة" : "Pcs") : "KG"}</div></div>
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-lg">{p.kg}</div><div className="text-[10px] text-slate-400 font-bold">KG</div></div>
              </div>
              {(p.status === "low" || p.status === "out") && (
                <div className={`text-xs font-bold px-3 py-2 rounded-xl mb-3 flex items-center gap-2 ${p.status === "out" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  <AlertTriangle size={12} className="shrink-0" />
                  {p.status === "out" ? (isRTL ? "نفد المخزون — يحتاج شراء" : "Out of stock — needs reorder") : (isRTL ? `منخفض — الحد الأدنى: ${p.minCartons > 0 ? p.minCartons + " كرتون" : p.minKg + " KG"}` : `Low — min: ${p.minCartons > 0 ? p.minCartons + " Ct" : p.minKg + " KG"}`)}
                </div>
              )}
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" onClick={() => { setSelectedProductId(p.id); onNavigate("inventory-product"); }}><Eye size={13} />{isRTL ? "الحركة" : "Movements"}</Btn>
                {canAdjust && <Btn size="sm" variant="amber" onClick={() => { setAdjustProduct(p); setShowAdjust(p.id); }}><Pencil size={13} />{isRTL ? "تعديل" : "Adjust"}</Btn>}
                {p.status !== "available" && <Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-new")}><ShoppingCart size={13} />{isRTL ? "شراء" : "Purchase"}</Btn>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState lang={lang} messageAr="لا يوجد مخزون فعلي بعد" messageEn="No inventory yet" />
      )}

      {/* Mobile sticky actions */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-2 shadow-lg z-10">
        {canStocktake && <Btn size="sm" variant="secondary" className="flex-1 justify-center" onClick={() => onNavigate("inventory-stocktaking")}><Layers size={13} />{isRTL ? "جرد" : "Count"}</Btn>}
        <Btn size="sm" variant="primary" className="flex-1 justify-center" onClick={() => onNavigate("purchases-new")}><ShoppingCart size={13} />{isRTL ? "إنشاء شراء" : "Purchase"}</Btn>
      </div>

      {showAdjust && (
        <StockAdjustModal
          lang={lang}
          productId={showAdjust}
          productSnapshot={adjustProduct ?? undefined}
          onClose={() => { setShowAdjust(null); setAdjustProduct(null); }}
          onSuccess={() => void reload()}
        />
      )}
      {showSettings && <InventorySettingsPanel lang={lang} role={role} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── SCREEN: PRODUCT STOCK DETAIL ───────────────────────────────────────────────
export function ProductDetailScreen({ lang, role, onNavigate, productId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; productId: string;
}) {
  const isRTL = lang === "ar";
  const [showAdjust, setShowAdjust] = useState(false);
  const [showFIFO, setShowFIFO] = useState(false);
  const [product, setProduct] = useState<InvProduct | null>(null);
  const [movements, setMovements] = useState<DisplayMovement[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState<unknown>(null);
  const canAdjust = role === "owner" || role === "accountant";

  const loadDetail = () => {
    if (!productId) {
      setProduct(null);
      setMovements([]);
      setLoading(false);
      return;
    }
    if (IS_MOCK_MODE) {
      const mock = MOCK_INV_PRODUCTS.find((x) => x.id === productId) ?? null;
      setProduct(mock);
      setMovements(mock ? INV_MOVEMENTS.filter((m) => m.productId === mock.id) : []);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getInventoryProductDetail(productId)
      .then((detail) => {
        if (cancelled) return;
        setProduct(invProductFromDetail(detail));
        setMovements(mapDetailMovements(detail.recentMovements, detail.productId));
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = loadDetail();
    return cleanup;
  }, [productId]);

  if (!productId) {
    return (
      <div className="p-8 max-w-screen-xl mx-auto">
        <EmptyState lang={lang} messageAr="لم يتم تحديد المنتج" messageEn="No product selected" />
      </div>
    );
  }
  if (loading) return <LoadingState lang={lang} />;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    if (notFound) {
      return (
        <div className="p-8 max-w-screen-xl mx-auto space-y-4">
          <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
          <EmptyState lang={lang} messageAr="المنتج غير موجود أو تم حذفه" messageEn="Product not found or has been deleted" />
        </div>
      );
    }
    return <ErrorState lang={lang} error={error} onRetry={loadDetail} />;
  }
  if (!product) {
    return (
      <div className="p-8 max-w-screen-xl mx-auto space-y-4">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <EmptyState lang={lang} messageAr="المنتج غير موجود أو تم حذفه" messageEn="Product not found or has been deleted" />
      </div>
    );
  }

  const p = product;
  const totalPurchased = movements.filter(m => m.type === "purchase").reduce((s, m) => s + Math.abs(m.kgDelta), 0);
  const totalSold = movements.filter(m => m.type === "sale").reduce((s, m) => s + Math.abs(m.kgDelta), 0);
  const totalReturned = movements.filter(m => m.type === "return").reduce((s, m) => s + Math.abs(m.kgDelta), 0);
  const totalAdjusted = movements.filter(m => m.type.startsWith("adj")).reduce((s, m) => s + m.kgDelta, 0);

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? `مخزون ${p.nameAr}` : `${p.name} Stock`}</h2>
          <div className="flex items-center gap-2 mt-0.5"><InvStatusBadge status={p.status} lang={lang} /></div>
        </div>
        <div className="flex items-center gap-2">
          {canAdjust
            ? <Btn size="sm" variant="amber" onClick={() => setShowAdjust(true)}><Pencil size={13} />{isRTL ? "تعديل المخزون" : "Adjust Stock"}</Btn>
            : <PermBtn lang={lang}><Pencil size={13} />{isRTL ? "تعديل المخزون" : "Adjust Stock"}</PermBtn>}
          <Btn size="sm" variant="outline"><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { v: p.cartons.toString(),      ar: "الكراتين المتاحة",  en: "Available Cartons",     cls: "text-[#0F2C59]" },
          { v: p.pcs.toString() || "—",   ar: "الحبات المتاحة",    en: "Available Pieces",      cls: "text-[#0F2C59]" },
          { v: `${p.kg} KG`,              ar: "الكيلو المتاح",     en: "Available KG",          cls: "text-[#0F2C59]" },
          { v: `AED ${p.fifoCost}/KG`,    ar: "تكلفة FIFO التقديرية", en: "Estimated FIFO Cost", cls: "text-blue-600" },
          { v: p.minCartons > 0 ? `${p.minCartons} Ct` : `${p.minKg} KG`, ar: "الحد الأدنى", en: "Minimum Level", cls: "text-slate-600" },
          { v: p.lastPurchase,            ar: "آخر شراء",          en: "Last Purchase",         cls: "text-slate-600" },
          { v: p.lastSale,                ar: "آخر بيع",           en: "Last Sale",             cls: "text-slate-600" },
          { v: `AED ${p.avgSalePrice}/KG`,ar: "متوسط سعر البيع",  en: "Avg Sale Price",        cls: "text-emerald-600" },
        ].map(c => (
          <Card key={c.ar} className="p-3.5 text-center">
            <div className={`text-base font-black font-mono ${c.cls}`}>{c.v}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? c.ar : c.en}</div>
          </Card>
        ))}
      </div>

      {/* A. Stock Summary */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص المخزون" : "Stock Summary"}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { v: `${totalPurchased} KG`, ar: "إجمالي المشتريات", en: "Total Purchased", cls: "text-emerald-600 bg-emerald-50" },
            { v: `${totalSold} KG`,      ar: "إجمالي المبيعات",   en: "Total Sold",      cls: "text-red-500 bg-red-50" },
            { v: `${totalReturned} KG`,  ar: "إجمالي المرتجع",   en: "Total Returned",  cls: "text-blue-600 bg-blue-50" },
            { v: `${totalAdjusted} KG`,  ar: "التعديلات اليدوية", en: "Adjustments",     cls: "text-amber-600 bg-amber-50" },
            { v: `${p.kg} KG`,           ar: "الرصيد الحالي",    en: "Current Balance", cls: "text-[#0F2C59] bg-[#0F2C59]/8" },
          ].map(c => (
            <div key={c.ar} className={`rounded-2xl p-3 text-center ${c.cls.split(" ")[1]}`}>
              <div className={`text-lg font-black font-mono ${c.cls.split(" ")[0]}`}>{c.v}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? c.ar : c.en}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* B. Movement History */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "سجل حركة المخزون" : "Movement History"}</h3>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center"><Package size={28} className="text-slate-200 mx-auto mb-2" /><p className="text-slate-400 font-semibold text-sm">{isRTL ? "لا توجد حركات مخزون لهذا المنتج." : "No inventory movements for this product."}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "التاريخ" : "Date", isRTL ? "نوع الحركة" : "Type", isRTL ? "المرجع" : "Ref", isRTL ? "كرتون" : "Ct", isRTL ? "حبة" : "Pcs", "KG", isRTL ? "الرصيد بعد" : "Balance After", isRTL ? "المستخدم" : "User", isRTL ? "ملاحظات" : "Notes"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 uppercase tracking-wide ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.date}</td>
                    <td className="px-4 py-3"><MovTypeBadge type={m.type} lang={lang} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.ref}</td>
                    <td className="px-4 py-3"><QtyDelta val={m.ctDelta} /></td>
                    <td className="px-4 py-3"><QtyDelta val={m.pcsDelta} /></td>
                    <td className="px-4 py-3"><QtyDelta val={m.kgDelta} suffix=" KG" /></td>
                    <td className="px-4 py-3 font-mono font-black text-[#0F2C59] text-xs">{m.balAfter} KG</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{m.user}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{m.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* C. FIFO Costing Note */}
      <Card className="p-5">
        <button onClick={() => setShowFIFO(v => !v)} className="w-full flex items-center justify-between">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "ملاحظة حساب التكلفة — FIFO" : "Costing Note — FIFO"}</h3>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${showFIFO ? "rotate-180" : ""}`} />
        </button>
        {showFIFO && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-blue-700">{isRTL ? "طريقة احتساب التكلفة: FIFO" : "Costing Method: FIFO"}</p>
              <p className="text-xs font-semibold text-blue-600 leading-relaxed">{isRTL ? "عند البيع، يتم احتساب تكلفة البضاعة المباعة من أقدم كميات شراء متاحة أولاً. هذا لا يحتاج أي اختيار يدوي من المستخدم." : "When selling, cost of goods sold is calculated from the oldest available purchase quantities first. No manual batch selection is needed."}</p>
              <div className="flex items-center gap-2 mt-2 bg-blue-100 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-blue-700">{isRTL ? `تكلفة FIFO الحالية لـ ${p.nameAr}:` : `Current FIFO cost for ${p.name}:`}</span>
                <span className="font-mono font-black text-blue-800">AED {p.fifoCost}/KG</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {showAdjust && (
        <StockAdjustModal
          lang={lang}
          productId={p.id}
          productSnapshot={p}
          onClose={() => setShowAdjust(false)}
          onSuccess={loadDetail}
        />
      )}
    </div>
  );
}

// ── MODAL: MANUAL STOCK ADJUSTMENT ────────────────────────────────────────────
export function StockAdjustModal({
  lang,
  productId,
  productSnapshot,
  onClose,
  onSuccess,
}: {
  lang: Lang;
  productId: string;
  productSnapshot?: InvProduct;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const isRTL = lang === "ar";
  const [product, setProduct] = useState<InvProduct | null>(productSnapshot ?? null);
  const [loading, setLoading] = useState(!IS_MOCK_MODE && !productSnapshot);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [adjType, setAdjType] = useState<"increase" | "decrease" | "correction">("increase");
  const [ctAdj, setCtAdj] = useState("");
  const [pcsAdj, setPcsAdj] = useState("");
  const [kgAdj, setKgAdj] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAdjType("increase");
    setCtAdj("");
    setPcsAdj("");
    setKgAdj("");
    setReason("");
    setNotes("");
    setSuccess(false);
    setSubmitting(false);
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }
    if (IS_MOCK_MODE) {
      setProduct(MOCK_INV_PRODUCTS.find((x) => x.id === productId) ?? null);
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (productSnapshot?.id === productId) {
      setProduct(productSnapshot);
      setLoading(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getInventoryProductDetail(productId)
      .then((detail) => {
        if (!cancelled) setProduct(invProductFromDetail(detail));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, productSnapshot]);

  const p = product;
  const kgAdjNum = parseFloat(kgAdj) || 0;
  const ctAdjNum = parseFloat(ctAdj) || 0;
  const pcsAdjNum = parseFloat(pcsAdj) || 0;
  const newKg = !p ? 0 : adjType === "correction" ? kgAdjNum : adjType === "increase" ? p.kg + kgAdjNum : Math.max(0, p.kg - kgAdjNum);
  const newCt = !p ? 0 : adjType === "correction" ? ctAdjNum : adjType === "increase" ? p.cartons + ctAdjNum : Math.max(0, p.cartons - ctAdjNum);
  const cannotReduce = Boolean(p && adjType === "decrease" && (kgAdjNum > p.kg || ctAdjNum > p.cartons || pcsAdjNum > p.pcs));

  const REASONS = [
    { ar: "جرد فعلي",     en: "Actual stocktake" },
    { ar: "تلف بضاعة",    en: "Damaged goods" },
    { ar: "فرق وزن",       en: "Weight difference" },
    { ar: "خطأ إدخال",    en: "Data entry error" },
    { ar: "بضاعة مفقودة", en: "Missing goods" },
    { ar: "بضاعة زائدة",  en: "Excess goods" },
    { ar: "سبب آخر",       en: "Other reason" },
  ];

  const handleSubmit = async () => {
    if (!p || !reason) return;
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم تعديل المخزون بنجاح" : "Stock adjusted successfully");
      setSuccess(true);
      onSuccess?.();
      return;
    }
    setSubmitting(true);
    try {
      const payload =
        adjType === "correction"
          ? {
              product: Number(productId),
              adjustment_type: "correction",
              new_cartons: ctAdj || "0",
              new_pieces: pcsAdj || "0",
              new_kg: kgAdj || "0",
              reason,
              notes,
            }
          : {
              product: Number(productId),
              adjustment_type: adjType,
              cartons: ctAdj || "0",
              pieces: pcsAdj || "0",
              kg: kgAdj || "0",
              reason,
              notes,
            };
      await createInventoryAdjustment(payload);
      toast.success(isRTL ? "تم تعديل المخزون بنجاح" : "Stock adjusted successfully");
      onSuccess?.();
      setSuccess(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل تعديل المخزون" : "Adjustment failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!productId) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8"><LoadingState lang={lang} /></div>
      </div>
    );
  }

  if (loadError || !p) {
    const notFound = loadError instanceof ApiError && loadError.status === 404;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-4">
          <EmptyState
            lang={lang}
            messageAr={notFound ? "المنتج غير موجود أو تم حذفه" : "تعذر تحميل بيانات المنتج"}
            messageEn={notFound ? "Product not found or has been deleted" : "Failed to load product data"}
          />
          <Btn variant="outline" className="w-full justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    );
  }

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تعديل المخزون بنجاح" : "Stock Adjusted Successfully"}</h3>
        <p className="text-slate-400 font-semibold mb-6 text-sm">{isRTL ? p.nameAr : p.name}</p>
        <Btn variant="primary" className="w-full justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تعديل مخزون يدوي" : "Manual Stock Adjustment"}</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? p.nameAr : p.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Current stock */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
            {[[p.cartons, isRTL ? "الكراتين الحالية" : "Current Cartons"], [p.pcs, isRTL ? "الحبات الحالية" : "Current Pcs"], [`${p.kg} KG`, isRTL ? "الكيلو الحالي" : "Current KG"]].map(([v, l]) => (
              <div key={l as string} className="text-center"><div className="text-xl font-black font-mono text-[#0F2C59]">{v}</div><div className="text-[10px] text-slate-400 font-bold mt-0.5">{l}</div></div>
            ))}
          </div>

          {/* Adjustment type */}
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "نوع التعديل" : "Adjustment Type"}</label>
            <div className="grid grid-cols-3 gap-2">
              {([["increase", isRTL ? "زيادة" : "Increase", "bg-emerald-500"], ["decrease", isRTL ? "نقص" : "Decrease", "bg-red-500"], ["correction", isRTL ? "تصحيح رصيد" : "Balance Fix", "bg-amber-500"]] as const).map(([v, l, c]) => (
                <button key={v} onClick={() => setAdjType(v)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${adjType === v ? `text-white border-transparent ${c}` : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {v === "increase" ? <ArrowUp size={12} /> : v === "decrease" ? <ArrowDown size={12} /> : <Minus size={12} />}{l}
                </button>
              ))}
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-3 gap-3">
            <FInput label={isRTL ? "الكراتين" : "Cartons"} type="number" value={ctAdj} onChange={setCtAdj} placeholder="0" />
            <FInput label={isRTL ? "الحبات" : "Pieces"} type="number" value={pcsAdj} onChange={setPcsAdj} placeholder="0" />
            <FInput label="KG" type="number" value={kgAdj} onChange={setKgAdj} placeholder="0" required />
          </div>

          {cannotReduce && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="text-xs font-bold text-red-700">{isRTL ? "لا يمكن خصم كمية أكبر من المخزون المتاح." : "Cannot reduce more than available stock."}</span>
            </div>
          )}

          {/* Before / After preview */}
          {kgAdjNum > 0 && !cannotReduce && (
            <div className="space-y-2">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold ${adjType === "decrease" ? "bg-amber-50 border border-amber-200 text-amber-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
                <Info size={14} className="shrink-0" />
                {adjType === "increase" ? (isRTL ? "سيتم إضافة الكمية إلى المخزون فوراً بعد الحفظ." : "Quantity will be added immediately after saving.") : adjType === "decrease" ? (isRTL ? "سيتم خصم الكمية من المخزون فوراً بعد الحفظ." : "Quantity will be deducted immediately after saving.") : (isRTL ? "سيتم تعيين الرصيد للقيمة الجديدة." : "Balance will be set to the new value.")}
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
                {[[`${p.kg} KG`, isRTL ? "الرصيد الحالي" : "Current", "text-slate-700"], [adjType === "increase" ? `+${kgAdjNum} KG` : adjType === "decrease" ? `−${kgAdjNum} KG` : `=${kgAdjNum} KG`, isRTL ? "التعديل" : "Adjustment", adjType === "decrease" ? "text-red-500" : "text-emerald-600"], [`${newKg} KG`, isRTL ? "الرصيد الجديد" : "New Balance", "text-[#0F2C59] font-black"]].map(([v, l, c]) => (
                  <div key={l}><div className={`text-base font-black font-mono ${c}`}>{v}</div><div className="text-[10px] text-slate-400 font-bold mt-0.5">{l}</div></div>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <FSelect label={isRTL ? "سبب التعديل *" : "Reason *"} value={reason} onChange={setReason} required options={[{ value: "", label: isRTL ? "اختر السبب" : "Select reason" }, ...REASONS.map(r => ({ value: r.ar, label: isRTL ? r.ar : r.en }))]} />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all">
            <Download size={16} className="text-slate-300 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-slate-400">{isRTL ? "إرفاق مستند (اختياري)" : "Attach document (optional)"}</p>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn disabled={!reason || !kgAdj || cannotReduce || submitting} onClick={() => void handleSubmit()}>
            <Check size={15} />{submitting ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "تطبيق التعديل" : "Apply Adjustment")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: STOCKTAKING ────────────────────────────────────────────────────────
export function StocktakingScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canApply = role === "owner" || role === "accountant";
  const [showConfirm, setShowConfirm] = useState(false);
  const [counts, setCounts] = useState<Record<string, { ct: string; pcs: string; kg: string }>>({});
  const [sessionId, setSessionId] = useState("");
  const [applying, setApplying] = useState(false);

  const { items: inventoryRows, loading, error, forbidden, reload } = useInventory(
    undefined,
    async () => (IS_MOCK_MODE ? MOCK_INV_PRODUCTS.map(inventoryRowFromMock) : []),
  );
  const products = inventoryRows.map((row) =>
    enrichInvProduct(toModuleInvProduct(row), IS_MOCK_MODE ? MOCK_INV_PRODUCTS.find((x) => x.id === row.productId || x.id === row.id) : undefined),
  );

  useEffect(() => {
    if (IS_MOCK_MODE || sessionId) return;
    void createStocktakingSession().then((s) => setSessionId(s.id)).catch(() => {});
  }, [sessionId]);

  if (!IS_MOCK_MODE && forbidden) return <PermissionDeniedState lang={lang} />;
  if (!IS_MOCK_MODE && loading) return <LoadingState lang={lang} />;
  if (!IS_MOCK_MODE && error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const setCount = (id: string, field: "ct" | "pcs" | "kg", val: string) =>
    setCounts(prev => ({ ...prev, [id]: { ct: "", pcs: "", kg: "", ...prev[id], [field]: val } }));

  const getDiff = (p: { id: string; kg: number }) => {
    const c = counts[p.id];
    const actualKg = parseFloat(c?.kg || "") || null;
    if (actualKg === null) return null;
    return actualKg - p.kg;
  };

  const getDiffStatus = (diff: number | null) => {
    if (diff === null) return "review";
    if (diff === 0) return "match";
    if (diff > 0) return "excess";
    return "short";
  };

  const hasDiffs = products.some(p => getDiff(p) !== null && getDiff(p) !== 0);

  const handleApply = async (reason: string) => {
    if (!sessionId || IS_MOCK_MODE) {
      toast.success(isRTL ? "تم تطبيق الجرد بنجاح" : "Stocktake applied successfully");
      setShowConfirm(false);
      return;
    }
    setApplying(true);
    try {
      for (const p of products) {
        const c = counts[p.id];
        if (!c?.kg) continue;
        await addStocktakingLine(sessionId, {
          product: Number(p.id),
          actual_cartons: c.ct || "0",
          actual_pieces: c.pcs || "0",
          actual_weight_kg: c.kg,
          system_weight_kg: String(p.kg),
        });
      }
      await applyStocktaking(sessionId, reason);
      toast.success(isRTL ? "تم تطبيق الجرد بنجاح" : "Stocktake applied successfully");
      setShowConfirm(false);
      onNavigate("inventory");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "جرد المخزون" : "Stocktaking"}</h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? "أدخل الكميات الفعلية لكل منتج" : "Enter actual quantities for each product"}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير الجرد" : "Export"}</Btn>
          <Btn variant="outline" size="sm"><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
          <Btn variant="secondary" size="sm"><FileText size={13} />{isRTL ? "حفظ مسودة" : "Save Draft"}</Btn>
          {canApply
            ? <Btn variant="green" size="sm" disabled={!hasDiffs} onClick={() => setShowConfirm(true)}><Check size={13} />{isRTL ? "تطبيق الفروقات" : "Apply Differences"}</Btn>
            : <PermBtn lang={lang}><Check size={13} />{isRTL ? "تطبيق الفروقات" : "Apply Differences"}</PermBtn>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {[isRTL ? "المنتج" : "Product", isRTL ? "رصيد النظام (كرتون)" : "System Ct", isRTL ? "رصيد النظام (كيلو)" : "System KG", isRTL ? "الرصيد الفعلي (كرتون)" : "Actual Ct", isRTL ? "الرصيد الفعلي (كيلو)" : "Actual KG", isRTL ? "الفرق KG" : "Diff KG", isRTL ? "الحالة" : "Status", isRTL ? "ملاحظات" : "Notes"].map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 uppercase tracking-wide ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => {
                const diff = getDiff(p);
                const diffStatus = getDiffStatus(diff);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/60 ${diffStatus === "short" ? "bg-red-50/30" : diffStatus === "excess" ? "bg-amber-50/20" : ""}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{isRTL ? p.nameAr : p.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{p.cartons}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0F2C59]">{p.kg} KG</td>
                    <td className="px-4 py-3"><input type="number" placeholder={p.cartons.toString()} value={counts[p.id]?.ct || ""} onChange={e => setCount(p.id, "ct", e.target.value)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none" /></td>
                    <td className="px-4 py-3"><input type="number" placeholder={p.kg.toString()} value={counts[p.id]?.kg || ""} onChange={e => setCount(p.id, "kg", e.target.value)} className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none" /></td>
                    <td className="px-4 py-3">
                      {diff === null ? <span className="text-slate-300 text-xs">—</span> : diff === 0 ? <span className="text-emerald-600 font-bold text-xs">=</span> : <QtyDelta val={diff} suffix=" KG" />}
                    </td>
                    <td className="px-4 py-3">
                      {diffStatus === "match"  && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "مطابق" : "Match"}</span>}
                      {diffStatus === "excess" && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{isRTL ? "زيادة" : "Excess"}</span>}
                      {diffStatus === "short"  && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{isRTL ? "نقص" : "Short"}</span>}
                      {diffStatus === "review" && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{isRTL ? "لم يُعدّ" : "Pending"}</span>}
                    </td>
                    <td className="px-4 py-3"><input type="text" className="w-32 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-[#0F2C59] outline-none" placeholder={isRTL ? "ملاحظة..." : "Note..."} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showConfirm && (
        <ReasonModal
          lang={lang}
          titleAr="تأكيد تطبيق الجرد"
          titleEn="Confirm apply stocktake"
          confirmLabelAr="تطبيق"
          confirmLabelEn="Apply"
          loading={applying}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleApply}
        />
      )}
    </div>
  );
}

// ── SCREEN: LOW STOCK ALERTS ───────────────────────────────────────────────────
export function LowStockScreen({ lang, role, onNavigate, setSelectedProductId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; setSelectedProductId: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const canAdjustMin = role === "owner";

  const { items: inventoryRows, loading, error, forbidden, reload } = useInventory(undefined, async () => MOCK_INV_PRODUCTS.map(inventoryRowFromMock));
  const INV_PRODUCTS = inventoryRows.map((row) =>
    enrichInvProduct(toModuleInvProduct(row), IS_MOCK_MODE ? MOCK_INV_PRODUCTS.find((m) => m.id === row.productId || m.id === row.id) : undefined),
  );

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const alerts = INV_PRODUCTS.filter(p => p.status === "low" || p.status === "out");

  if (alerts.length === 0) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle size={38} className="text-emerald-500" /></div>
        <h2 className="text-xl font-black text-emerald-700 mb-2">{isRTL ? "المخزون بحالة جيدة" : "Inventory is in Good Condition"}</h2>
        <p className="text-slate-400 font-semibold">{isRTL ? "لا توجد منتجات تحت الحد الأدنى." : "No products below minimum level."}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تنبيهات انخفاض المخزون" : "Low Stock Alerts"}</h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">{alerts.length} {isRTL ? "منتج يحتاج مراجعة" : "products need attention"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map(p => {
          const shortage = p.minCartons > 0 ? Math.max(0, p.minCartons - p.cartons) : Math.max(0, p.minKg - p.kg);
          const suggested = Math.ceil(shortage * 1.5);
          return (
            <Card key={p.id} className={`p-5 border-2 ${p.status === "out" ? "border-red-200" : "border-amber-200"}`}>
              <div className="flex items-start justify-between mb-3">
                <div><div className="font-black text-slate-800">{isRTL ? p.nameAr : p.name}</div></div>
                <InvStatusBadge status={p.status} lang={lang} />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className={`rounded-xl p-2 ${p.status === "out" ? "bg-red-50" : "bg-amber-50"}`}>
                  <div className={`font-mono font-black text-base ${p.status === "out" ? "text-red-600" : "text-amber-700"}`}>{p.cartons}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{isRTL ? "حالياً" : "Current"}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2">
                  <div className="font-mono font-black text-base text-slate-600">{p.minCartons > 0 ? p.minCartons : `${p.minKg} KG`}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{isRTL ? "الحد الأدنى" : "Min Level"}</div>
                </div>
                <div className="bg-[#0F2C59]/8 rounded-xl p-2">
                  <div className="font-mono font-black text-base text-[#0F2C59]">{suggested}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{isRTL ? "مقترح شراء" : "Suggested"}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" variant="primary" onClick={() => onNavigate("purchases-new")} className="flex-1 justify-center"><ShoppingCart size={13} />{isRTL ? "إنشاء شراء" : "New Purchase"}</Btn>
                <button onClick={() => { setSelectedProductId(p.id); onNavigate("inventory-product"); }} className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"><Eye size={14} /></button>
                {canAdjustMin && <button className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50" title={isRTL ? "تعديل الحد الأدنى" : "Edit min level"}><Pencil size={14} /></button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── SCREEN: INVENTORY MOVEMENT ─────────────────────────────────────────────────
export function MovementScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [movements, setMovements] = useState<typeof INV_MOVEMENTS>([]);
  const [movLoading, setMovLoading] = useState(!IS_MOCK_MODE);
  const [movError, setMovError] = useState<unknown>(null);

  const { items: inventoryRows, loading, error, forbidden, reload } = useInventory(
    undefined,
    async () => (IS_MOCK_MODE ? MOCK_INV_PRODUCTS.map(inventoryRowFromMock) : []),
  );
  const INV_PRODUCTS = inventoryRows.map((row) =>
    enrichInvProduct(toModuleInvProduct(row), IS_MOCK_MODE ? MOCK_INV_PRODUCTS.find((x) => x.id === row.productId || x.id === row.id) : undefined),
  );

  const mapApiMovement = (r: Awaited<ReturnType<typeof listStockMovements>>[number]) => ({
    id: r.id,
    date: r.date,
    productId: "",
    type: (r.type || "adj-increase") as MovType,
    ref: r.reference,
    ctDelta: r.cartons,
    pcsDelta: r.pieces,
    kgDelta: r.weightKg,
    balAfter: r.balanceAfter,
    user: "",
    note: "",
  });

  useEffect(() => {
    if (IS_MOCK_MODE) {
      setMovements(INV_MOVEMENTS);
      setMovLoading(false);
      return;
    }
    setMovLoading(true);
    listStockMovements()
      .then((rows) => setMovements(rows.map(mapApiMovement)))
      .catch((err) => setMovError(err))
      .finally(() => setMovLoading(false));
  }, []);

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading || movLoading) return <LoadingState lang={lang} />;
  if (error || movError) return <ErrorState lang={lang} error={error ?? movError} onRetry={() => { void reload(); if (!IS_MOCK_MODE) void listStockMovements().then((rows) => setMovements(rows.map(mapApiMovement))); }} />;

  const filtered = movements.filter(m =>
    (filterProduct === "all" || m.productId === filterProduct) &&
    (filterType === "all" || m.type === filterType)
  );

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "حركة المخزون" : "Inventory Movement"}</h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? "جميع حركات الإضافة والخصم والتعديل" : "All additions, deductions and adjustments"}</p>
        </div>
        <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل المنتجات" : "All Products"}</option>
            {INV_PRODUCTS.map(p => <option key={p.id} value={p.id}>{isRTL ? p.nameAr : p.name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحركات" : "All Types"}</option>
            <option value="purchase">{isRTL ? "إضافة شراء" : "Purchase"}</option>
            <option value="sale">{isRTL ? "خصم بيع" : "Sale"}</option>
            <option value="return">{isRTL ? "إرجاع" : "Return"}</option>
            <option value="adj-increase">{isRTL ? "تعديل زيادة" : "Manual +"}</option>
            <option value="adj-decrease">{isRTL ? "تعديل نقص" : "Manual −"}</option>
            <option value="stocktake">{isRTL ? "جرد" : "Stocktake"}</option>
          </select>
        </div>
      </Card>

      {/* Desktop table */}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "التاريخ" : "Date", isRTL ? "المنتج" : "Product", isRTL ? "نوع الحركة" : "Type", isRTL ? "المرجع" : "Reference", isRTL ? "كرتون" : "Ct", isRTL ? "حبة" : "Pcs", "KG", isRTL ? "الرصيد بعد" : "Balance After", isRTL ? "المستخدم" : "User"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 uppercase tracking-wide ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => {
                  const p = INV_PRODUCTS.find(x => x.id === m.productId);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{isRTL ? p?.nameAr : p?.name}</td>
                      <td className="px-4 py-3"><MovTypeBadge type={m.type} lang={lang} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{m.ref}</td>
                      <td className="px-4 py-3"><QtyDelta val={m.ctDelta} /></td>
                      <td className="px-4 py-3"><QtyDelta val={m.pcsDelta} /></td>
                      <td className="px-4 py-3"><QtyDelta val={m.kgDelta} suffix=" KG" /></td>
                      <td className="px-4 py-3 font-mono font-black text-[#0F2C59] text-xs">{m.balAfter} KG</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{m.user}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map(m => {
          const p = INV_PRODUCTS.find(x => x.id === m.productId);
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{isRTL ? p?.nameAr : p?.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">{m.date} · {m.ref}</div>
                </div>
                <MovTypeBadge type={m.type} lang={lang} />
              </div>
              <div className="flex items-center gap-3 text-sm font-mono">
                <QtyDelta val={m.ctDelta} suffix=" Ct" />
                <QtyDelta val={m.kgDelta} suffix=" KG" />
                <span className="text-slate-400 text-xs">{isRTL ? "رصيد:" : "Bal:"} {m.balAfter} KG</span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">{m.user}{m.note ? ` — ${m.note}` : ""}</div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center"><Package size={32} className="text-slate-200 mx-auto mb-3" /><p className="text-slate-400 font-semibold">{isRTL ? "لا توجد حركات مخزون بهذا الفلتر." : "No movements match this filter."}</p></Card>
      )}
    </div>
  );
}

// ── SCREEN: FIFO VALUATION ─────────────────────────────────────────────────────
export function ValuationScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canView = role === "owner" || role === "accountant";

  if (!canView) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Info size={28} className="text-slate-400" /></div>
        <p className="font-bold text-slate-500">{isRTL ? "ليس لديك صلاحية عرض تقييم المخزون." : "You do not have permission to view inventory valuation."}</p>
      </div>
    </div>
  );

  const totalValue = Math.round(MOCK_INV_PRODUCTS.reduce((s, p) => s + p.kg * p.fifoCost, 0));
  const avgMargin = ((MOCK_INV_PRODUCTS.reduce((s, p) => s + p.avgSalePrice, 0) / MOCK_INV_PRODUCTS.length - MOCK_INV_PRODUCTS.reduce((s, p) => s + p.fifoCost, 0) / MOCK_INV_PRODUCTS.length) / (MOCK_INV_PRODUCTS.reduce((s, p) => s + p.avgSalePrice, 0) / MOCK_INV_PRODUCTS.length) * 100).toFixed(1);

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("inventory")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div>
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تقييم المخزون والربح" : "Inventory Valuation & Profit"}</h2>
          <p className="text-xs text-slate-400 font-semibold">{isRTL ? "يعتمد النظام على FIFO — تلقائي دون اختيار دفعات" : "System uses FIFO — automatic, no batch selection"}</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { v: `AED ${totalValue.toLocaleString()}`,  ar: "قيمة المخزون الحالية",          en: "Current Inventory Value",  cls: "text-[#0F2C59]", bg: "bg-[#0F2C59]/5" },
          { v: "AED 298,000",                         ar: "تكلفة البضاعة المباعة الشهر",   en: "COGS This Month",          cls: "text-red-600",    bg: "bg-red-50" },
          { v: `${avgMargin}%`,                       ar: "هامش الربح التقديري",            en: "Est. Profit Margin",       cls: "text-emerald-600",bg: "bg-emerald-50" },
          { v: "AED 12.50/KG",                        ar: "آخر تكلفة شراء",                en: "Last Purchase Cost",       cls: "text-blue-600",   bg: "bg-blue-50" },
          { v: "AED 14.10/KG",                        ar: "متوسط سعر البيع",               en: "Avg Selling Price",        cls: "text-emerald-600",bg: "bg-emerald-50" },
        ].map(c => (
          <Card key={c.ar} className={`p-4 ${c.bg} border-none`}>
            <div className={`text-lg font-black font-mono ${c.cls}`}>{c.v}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-0.5">{isRTL ? c.ar : c.en}</div>
          </Card>
        ))}
      </div>

      {/* FIFO explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-black text-blue-700 mb-1">{isRTL ? "طريقة احتساب التكلفة — FIFO" : "Costing Method — FIFO"}</div>
          <p className="text-xs font-semibold text-blue-600 leading-relaxed">{isRTL ? "يعتمد النظام على FIFO: عند البيع يتم احتساب تكلفة البيع من أقدم كميات مشتراة أولاً. لا يحتاج المستخدم لاختيار أي دفعات." : "The system uses FIFO: when selling, cost of goods sold is calculated from the oldest purchased quantities first. No manual batch selection is needed."}</p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        <span className="text-xs font-bold text-amber-700">{isRTL ? "القيم تقديرية وتعتمد على فواتير الشراء والبيع المعتمدة." : "Values are estimates based on approved purchase and sales invoices."}</span>
      </div>

      {/* Product valuation table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "جدول التقييم بالمنتج" : "Product Valuation Table"}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {[isRTL ? "المنتج" : "Product", isRTL ? "الكيلو المتاح" : "KG Available", isRTL ? "الكراتين" : "Cartons", isRTL ? "تكلفة FIFO/KG" : "FIFO Cost/KG", isRTL ? "قيمة المخزون" : "Stock Value", isRTL ? "سعر البيع/KG" : "Sale Price/KG", isRTL ? "هامش الربح" : "Est. Margin"].map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 uppercase tracking-wide ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_INV_PRODUCTS.filter(p => p.kg > 0).map(p => {
                const stockValue = Math.round(p.kg * p.fifoCost);
                const margin = ((p.avgSalePrice - p.fifoCost) / p.avgSalePrice * 100).toFixed(1);
                const marginNum = parseFloat(margin);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-slate-800">{isRTL ? p.nameAr : p.name}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0F2C59]">{p.kg} KG</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{p.cartons || "—"}</td>
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">AED {p.fifoCost}</td>
                    <td className="px-4 py-3 font-mono font-black text-[#0F2C59]">AED {stockValue.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600">AED {p.avgSalePrice}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${marginNum >= 15 ? "bg-emerald-100 text-emerald-700" : marginNum >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{margin}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── PANEL: INVENTORY SETTINGS ──────────────────────────────────────────────────
export function InventorySettingsPanel({ lang, role, onClose }: { lang: Lang; role: TenantRole; onClose: () => void }) {
  const isRTL = lang === "ar";
  const canEdit = role === "owner";
  const [alerts, setAlerts] = useState(true);
  const [allowManual, setAllowManual] = useState(true);
  const [showFIFONote, setShowFIFONote] = useState(true);
  const [defMinCt, setDefMinCt] = useState("15");
  const [defMinKg, setDefMinKg] = useState("10");

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات المخزون" : "Inventory Settings"}</h3>
            {!canEdit && <p className="text-[10px] text-amber-600 font-bold">{isRTL ? "للعرض فقط" : "View only"}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Alerts toggle */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">{isRTL ? "تنبيهات المخزون" : "Stock Alerts"}</p>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-700">{isRTL ? "تفعيل تنبيهات انخفاض المخزون" : "Enable low stock alerts"}</span>
              <button onClick={() => canEdit && setAlerts(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${alerts ? "bg-[#0F2C59]" : "bg-slate-300"} ${!canEdit ? "cursor-not-allowed" : ""}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${alerts ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Min defaults */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">{isRTL ? "الحدود الدنيا الافتراضية" : "Default Minimum Levels"}</p>
            <div className="space-y-3">
              <FInput label={isRTL ? "الحد الأدنى الافتراضي (كرتون)" : "Default Min Cartons"} value={defMinCt} onChange={v => canEdit && setDefMinCt(v)} placeholder="15" />
              <FInput label={isRTL ? "الحد الأدنى الافتراضي (كيلو)" : "Default Min KG"} value={defMinKg} onChange={v => canEdit && setDefMinKg(v)} placeholder="10" />
            </div>
          </div>

          {/* Permissions */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">{isRTL ? "صلاحيات التعديل" : "Adjustment Permissions"}</p>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-700">{isRTL ? "السماح بالتعديل اليدوي للمخزون" : "Allow manual stock adjustment"}</span>
              <button onClick={() => canEdit && setAllowManual(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${allowManual ? "bg-[#0F2C59]" : "bg-slate-300"} ${!canEdit ? "cursor-not-allowed" : ""}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${allowManual ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {[
                [isRTL ? "المالك" : "Owner", true],
                [isRTL ? "المحاسب" : "Accountant", true],
                [isRTL ? "الكاشير (بإذن)" : "Cashier (if enabled)", false],
              ].map(([l, checked]: any) => (
                <label key={l} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" defaultChecked={checked} disabled={!canEdit} className="accent-[#0F2C59]" />
                  <span className="text-sm font-semibold text-slate-700">{l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Negative stock — always disabled */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-red-700">{isRTL ? "السماح بالمخزون السلبي" : "Allow Negative Stock"}</span>
              <div className="w-10 h-[22px] rounded-full bg-slate-300 flex items-center cursor-not-allowed"><span className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5" /></div>
            </div>
            <p className="text-xs font-bold text-red-600">{isRTL ? "لا يمكن بيع كمية أكبر من المخزون المتاح." : "Cannot sell more than available stock."}</p>
          </div>

          {/* Costing method — locked FIFO */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-blue-700">{isRTL ? "طريقة احتساب التكلفة" : "Costing Method"}</span>
              <span className="text-xs font-black bg-[#0F2C59] text-white px-2.5 py-1 rounded-full">FIFO 🔒</span>
            </div>
            <p className="text-xs font-bold text-blue-600">{isRTL ? "طريقة التكلفة المعتمدة للنظام — لا يمكن تغييرها." : "System's fixed costing method — cannot be changed."}</p>
            <button onClick={() => setShowFIFONote(v => !v)} className="text-xs font-black text-blue-700 mt-2 flex items-center gap-1">
              <Info size={11} />{isRTL ? "عرض تفسير FIFO" : "Show FIFO explanation"}
            </button>
            {showFIFONote && <p className="text-xs font-semibold text-blue-600 leading-relaxed mt-2">{isRTL ? "عند البيع، يتم احتساب تكلفة البيع من أقدم كميات مشتراة أولاً." : "When selling, cost of goods sold is from the oldest purchased quantities first."}</p>}
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
