// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — PRODUCT MASTER & PRICING RULES MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  Plus, X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, CheckCircle, Download, Printer,
  Eye, Pencil, Settings, Tag, Package, BarChart2,
  TrendingUp, TrendingDown, Lock, Star, Layers, Scale
} from "lucide-react";
import { toast } from "sonner";
import { useProducts, useProductDetail } from "@/hooks/api/useTenantResources";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { createProduct, updateProduct, getProductRow, buildProductCreatePayload, buildProductUpdatePayload, productFormNeedsReason, type ProductFormSnapshot, listProductCategories, createProductCategory } from "@/services/productService";
import { IS_MOCK_MODE } from "@/services/config";
import { ApiError } from "@/services/api/errors";
import { ReasonModal } from "@/features/invoices/ReasonModal";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "products" | "products-new" | "products-edit" | "product-detail" | "product-categories"
  | "products-bulk-setup" | "products-byproducts" | "products-import-export"
  | "inventory" | "inventory-product" | "reports-sales" | "reports-purchases" | string;
type ProductType = "fixed" | "moving" | "part" | "byproduct" | "service" | "other";
type PriceType = "kg" | "piece" | "carton" | "tray";

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
function FInput({ label, placeholder, type = "text", value, onChange, required = false, helper }: {
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean; helper?: string;
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
function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} className={`w-11 h-[24px] rounded-full flex items-center transition-all shrink-0 ${on ? "bg-[#0F2C59]" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
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

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
interface Product {
  id: string; nameAr: string; nameEn: string; sku: string; cat: string;
  type: ProductType; g: number; ppc: number;
  saleP: number; salePT: PriceType; buyP: number; buyPT: PriceType;
  minCt: number; minKg: number; active: boolean; vatT: boolean;
  stockCt: number; stockKg: number; trackInv: boolean;
}
const MOCK_PRODUCTS: Product[] = [
  { id:"pr1",  nameAr:"900 جرام",       nameEn:"900 GRAM",     sku:"W-900",  cat:"whole",     type:"fixed",     g:900,  ppc:10, saleP:14.75, salePT:"kg",  buyP:1.15, buyPT:"piece", minCt:20, minKg:180, active:true,  vatT:true,  stockCt:34, stockKg:306,  trackInv:true },
  { id:"pr2",  nameAr:"1000 جرام",      nameEn:"1000 GRAM",    sku:"W-1000", cat:"whole",     type:"fixed",     g:1000, ppc:10, saleP:14.75, salePT:"kg",  buyP:1.20, buyPT:"piece", minCt:20, minKg:200, active:true,  vatT:true,  stockCt:8,  stockKg:80,   trackInv:true },
  { id:"pr3",  nameAr:"700 جرام",       nameEn:"700 GRAM",     sku:"W-700",  cat:"whole",     type:"fixed",     g:700,  ppc:16, saleP:13.25, salePT:"kg",  buyP:1.00, buyPT:"piece", minCt:10, minKg:100, active:true,  vatT:true,  stockCt:12, stockKg:134,  trackInv:true },
  { id:"pr4",  nameAr:"1100 جرام",      nameEn:"1100 GRAM",    sku:"W-1100", cat:"whole",     type:"fixed",     g:1100, ppc:10, saleP:14.50, salePT:"kg",  buyP:1.15, buyPT:"piece", minCt:15, minKg:165, active:true,  vatT:true,  stockCt:24, stockKg:264,  trackInv:true },
  { id:"pr5",  nameAr:"1200 جرام",      nameEn:"1200 GRAM",    sku:"W-1200", cat:"whole",     type:"fixed",     g:1200, ppc:10, saleP:14.75, salePT:"kg",  buyP:1.20, buyPT:"piece", minCt:15, minKg:180, active:true,  vatT:true,  stockCt:0,  stockKg:0,    trackInv:true },
  { id:"pr6",  nameAr:"1300 جرام",      nameEn:"1300 GRAM",    sku:"W-1300", cat:"whole",     type:"fixed",     g:1300, ppc:10, saleP:15.00, salePT:"kg",  buyP:1.25, buyPT:"piece", minCt:10, minKg:130, active:true,  vatT:true,  stockCt:5,  stockKg:65,   trackInv:true },
  { id:"pr7",  nameAr:"1600 جرام+",     nameEn:"1600 GRAM+",   sku:"W-1600", cat:"moving",    type:"moving",    g:0,    ppc:8,  saleP:13.75, salePT:"kg",  buyP:1.15, buyPT:"piece", minCt:5,  minKg:60,  active:true,  vatT:true,  stockCt:15, stockKg:180,  trackInv:true },
  { id:"pr8",  nameAr:"كبدة 500 جرام",  nameEn:"Liver 500G",   sku:"BP-LVR", cat:"byproduct", type:"byproduct", g:0,    ppc:0,  saleP:4.00,  salePT:"kg",  buyP:0.70, buyPT:"tray",  minCt:0,  minKg:10,  active:true,  vatT:false, stockCt:0,  stockKg:13,   trackInv:true },
  { id:"pr9",  nameAr:"قانصة 500 جرام", nameEn:"Gizzard 500G", sku:"BP-GZZ", cat:"byproduct", type:"byproduct", g:0,    ppc:0,  saleP:4.00,  salePT:"kg",  buyP:1.00, buyPT:"tray",  minCt:0,  minKg:10,  active:true,  vatT:false, stockCt:0,  stockKg:5,    trackInv:true },
  { id:"pr10", nameAr:"أجنحة",          nameEn:"Wings",        sku:"BP-WNG", cat:"byproduct", type:"byproduct", g:0,    ppc:0,  saleP:14.00, salePT:"kg",  buyP:1.25, buyPT:"tray",  minCt:0,  minKg:5,   active:true,  vatT:false, stockCt:0,  stockKg:90,   trackInv:true },
  { id:"pr11", nameAr:"عظام",           nameEn:"Bone",         sku:"BP-BNE", cat:"byproduct", type:"byproduct", g:0,    ppc:0,  saleP:3.00,  salePT:"kg",  buyP:0.30, buyPT:"tray",  minCt:0,  minKg:0,   active:false, vatT:false, stockCt:0,  stockKg:200,  trackInv:false},
  { id:"pr12", nameAr:"صدور بدون عظم",  nameEn:"Boneless Breast",sku:"BP-BRS",cat:"byproduct",type:"byproduct", g:0,    ppc:0,  saleP:22.00, salePT:"kg",  buyP:1.25, buyPT:"tray",  minCt:0,  minKg:5,   active:true,  vatT:false, stockCt:0,  stockKg:17,   trackInv:true },
];

const PROD_CATEGORIES = [
  { key:"whole",     ar:"دجاج كامل",           en:"Whole Chicken",      count:6, active:true  },
  { key:"moving",    ar:"أوزان متحركة",         en:"Moving Weights",     count:1, active:true  },
  { key:"parts",     ar:"أجزاء الدجاج",         en:"Chicken Parts",      count:0, active:true  },
  { key:"byproduct", ar:"منتجات جانبية",        en:"By-products",        count:5, active:true  },
  { key:"packaging", ar:"خدمات تعبئة / تغليف", en:"Packaging Services", count:0, active:true  },
  { key:"other_meat",ar:"لحوم أخرى",            en:"Other Meats",        count:0, active:false },
  { key:"other",     ar:"أخرى",                 en:"Other",              count:0, active:true  },
];

const CUST_SPECIAL_PRICES = [
  { customer:"مطعم الخليج",         product:"1000 GRAM", price:14.50, pt:"kg",  diff:-0.25, active:true, updated:"2025-01-15" },
  { customer:"سوبر ماركت المدينة", product:"كبدة",      price:3.75,  pt:"kg",  diff:-0.25, active:true, updated:"2025-01-10" },
];

const SUPP_SPECIAL_PRICES = [
  { supplier:"WESTLAND FOODSTUFF", product:"900 GRAM",  price:1.15, pt:"piece", diff:0,    active:true, updated:"2025-01-15" },
  { supplier:"MNM Foodstuff",      product:"1000 GRAM", price:1.20, pt:"piece", diff:0,    active:true, updated:"2025-01-15" },
];

const PRICE_HISTORY = [
  { date:"2025-01-28", user:"أحمد (مالك)", field:isRTL=>"سعر البيع الافتراضي", oldV:"14.50", newV:"14.75", reason:isRTL=>"زيادة تكلفة الشراء" },
  { date:"2025-01-10", user:"أحمد (مالك)", field:isRTL=>"سعر الشراء الافتراضي",oldV:"1.10",  newV:"1.15",  reason:isRTL=>"تغيير المورد" },
];

const BYPRODUCTS_LIST = [
  { name:"Liver 500G",     nameAr:"كبدة 500 جرام",    unit:"tray", saleP:4.00,  buyP:0.70, pt:"tray", track:true  },
  { name:"Gizzard 500G",   nameAr:"قانصة 500 جرام",   unit:"tray", saleP:4.00,  buyP:1.00, pt:"tray", track:true  },
  { name:"Heart 500G",     nameAr:"قلب 500 جرام",      unit:"tray", saleP:5.00,  buyP:0.70, pt:"tray", track:true  },
  { name:"Feet 500G",      nameAr:"أقدام 500 جرام",    unit:"tray", saleP:3.50,  buyP:0.50, pt:"tray", track:false },
  { name:"Neck 500G",      nameAr:"رقبة 500 جرام",     unit:"tray", saleP:3.00,  buyP:0.40, pt:"tray", track:false },
  { name:"Boneless Breast",nameAr:"صدور بدون عظم",     unit:"kg",   saleP:22.00, buyP:1.25, pt:"tray", track:true  },
  { name:"Whole Legs",     nameAr:"أرجل كاملة",         unit:"kg",   saleP:18.00, buyP:1.10, pt:"tray", track:true  },
  { name:"Drumstick",      nameAr:"دجاج تحت الركبة",   unit:"kg",   saleP:16.00, buyP:1.00, pt:"tray", track:false },
  { name:"Thighs",         nameAr:"أفخاذ",              unit:"kg",   saleP:17.00, buyP:1.05, pt:"tray", track:false },
  { name:"Wings",          nameAr:"أجنحة",              unit:"kg",   saleP:14.00, buyP:1.25, pt:"tray", track:true  },
  { name:"Bone",           nameAr:"عظام",               unit:"kg",   saleP:3.00,  buyP:0.30, pt:"tray", track:false },
  { name:"B.G",            nameAr:"B.G",                unit:"kg",   saleP:5.00,  buyP:0.50, pt:"tray", track:false },
  { name:"Portion",        nameAr:"بورشن",              unit:"piece",saleP:8.00,  buyP:0.80, pt:"piece",track:false },
  { name:"Others KG",      nameAr:"أخرى كيلو",          unit:"kg",   saleP:4.00,  buyP:0.40, pt:"kg",   track:false },
];

// ── HELPER BADGES ──────────────────────────────────────────────────────────────
function isRTL_fn(lang: Lang) { return lang === "ar"; }

function ProdTypeBadge({ type, lang }: { type: ProductType; lang: Lang }) {
  const isRTL = isRTL_fn(lang);
  const cfg = {
    fixed:     { bg: "bg-blue-50",    t: "text-blue-700",    ar: "وزن ثابت",     en: "Fixed Weight" },
    moving:    { bg: "bg-violet-50",  t: "text-violet-700",  ar: "وزن متحرك",    en: "Moving Weight" },
    part:      { bg: "bg-emerald-50", t: "text-emerald-700", ar: "جزء دجاج",     en: "Chicken Part" },
    byproduct: { bg: "bg-amber-50",   t: "text-amber-700",   ar: "منتج جانبي",   en: "By-product" },
    service:   { bg: "bg-slate-100",  t: "text-slate-600",   ar: "خدمة",         en: "Service" },
    other:     { bg: "bg-slate-100",  t: "text-slate-600",   ar: "أخرى",         en: "Other" },
  }[type];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{isRTL ? cfg.ar : cfg.en}</span>;
}

function StockStatusBadge({ stockCt, minCt, stockKg, minKg, lang }: {
  stockCt: number; minCt: number; stockKg: number; minKg: number; lang: Lang;
}) {
  const isRTL = isRTL_fn(lang);
  const isOut = stockCt === 0 && stockKg === 0;
  const isLow = !isOut && (stockCt < minCt || (minKg > 0 && stockKg < minKg));
  if (isOut) return <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{isRTL ? "نفد" : "Out"}</span>;
  if (isLow) return <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{isRTL ? "منخفض" : "Low"}</span>;
  return <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "متوفر" : "Available"}</span>;
}

const catLabel = (key: string, isRTL: boolean) => {
  const c = PROD_CATEGORIES.find(x => x.key === key);
  return c ? (isRTL ? c.ar : c.en) : key;
};

const priceTypeLabel = (pt: PriceType, isRTL: boolean) => {
  const labels: Record<PriceType, [string, string]> = { kg: ["KG", "كيلو"], piece: [isRTL ? "حبة" : "piece", "حبة"], carton: [isRTL ? "كرتون" : "carton", "كرتون"], tray: [isRTL ? "طبق" : "tray", "طبق"] };
  return labels[pt]?.[isRTL ? 1 : 0] || pt;
};

// ── SCREEN: PRODUCTS LIST ──────────────────────────────────────────────────────
export function ProductsListScreen({ lang, role, onNavigate, setSelectedProductId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedProductId: (id: string) => void;
}) {
  const isRTL = isRTL_fn(lang);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const canEdit = role === "owner" || role === "accountant";

  const { items: productSource, loading, error, forbidden, reload } = useProducts(
    search ? { search } : undefined,
    async () => MOCK_PRODUCTS,
  );

  if (forbidden) {
    return <PermissionDeniedState lang={lang} />;
  }
  if (loading) {
    return <LoadingState lang={lang} />;
  }
  if (error) {
    return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;
  }

  const filtered = productSource.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.nameAr.includes(search) || p.nameEn.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (filterCat === "all" || p.cat === filterCat) &&
      (filterType === "all" || p.type === filterType) &&
      (filterActive === "all" || (filterActive === "active" && p.active) || (filterActive === "inactive" && !p.active));
  });

  const kpis = [
    { v: productSource.length.toString(),                           ar: "إجمالي المنتجات",     en: "Total Products",      bg: "bg-[#0F2C59]" },
    { v: productSource.filter(p => p.active).length.toString(),    ar: "المنتجات النشطة",     en: "Active",              bg: "bg-emerald-500" },
    { v: productSource.filter(p => !p.active).length.toString(),   ar: "المنتجات الموقوفة",   en: "Disabled",            bg: "bg-slate-500" },
    { v: productSource.filter(p => p.type === "fixed").length.toString(),   ar: "أوزان ثابتة", en: "Fixed Weights",   bg: "bg-blue-500" },
    { v: productSource.filter(p => p.type === "moving").length.toString(),  ar: "أوزان متحركة",en: "Moving Weights",  bg: "bg-violet-500" },
    { v: productSource.filter(p => p.type === "byproduct").length.toString(),ar: "منتجات جانبية",en: "By-products",   bg: "bg-amber-500" },
    { v: productSource.filter(p => p.stockCt < p.minCt && p.active).length.toString(), ar: "منخفضة المخزون", en: "Low Stock", bg: "bg-red-500" },
    { v: productSource.filter(p => !p.saleP && p.active).length.toString(), ar: "بدون سعر",   en: "Missing Price",       bg: "bg-amber-600" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "المنتجات" : "Products"}</h1>
          <p className="text-xs text-slate-400 font-semibold">{productSource.length} {isRTL ? "منتج مسجل" : "products"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="outline" size="sm" onClick={() => onNavigate("product-categories")}><Tag size={13} />{isRTL ? "التصنيفات" : "Categories"}</Btn>
          <Btn variant="outline" size="sm" onClick={() => onNavigate("products-bulk-setup")}><Layers size={13} />{isRTL ? "إعداد دفعة" : "Bulk Setup"}</Btn>
          {canEdit
            ? <Btn variant="primary" onClick={() => onNavigate("products-new")}><Plus size={15} />{isRTL ? "إضافة منتج" : "Add Product"}</Btn>
            : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "إضافة منتج" : "Add Product"}</PermBtn>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><Package size={16} className="text-white" /></div>
            <div><div className="text-xl font-black text-[#0F2C59] font-mono tracking-tight leading-tight">{k.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? k.ar : k.en}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "بحث بالاسم أو الرمز..." : "Search by name or SKU..."}
              className={`w-full py-2 ps-4 pe-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59]`} />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل التصنيفات" : "All Categories"}</option>
            {PROD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{isRTL ? c.ar : c.en}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الأنواع" : "All Types"}</option>
            <option value="fixed">{isRTL ? "وزن ثابت" : "Fixed Weight"}</option>
            <option value="moving">{isRTL ? "وزن متحرك" : "Moving Weight"}</option>
            <option value="byproduct">{isRTL ? "منتج جانبي" : "By-product"}</option>
          </select>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "الكل" : "All"}</option>
            <option value="active">{isRTL ? "نشط" : "Active"}</option>
            <option value="inactive">{isRTL ? "موقوف" : "Inactive"}</option>
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
                  {[isRTL?"المنتج / الوزن":"Product/Weight",isRTL?"التصنيف":"Category",isRTL?"النوع":"Type",isRTL?"وزن الحبة":"Weight",isRTL?"الحبات/كرتون":"Pcs/Ct",isRTL?"وزن الكرتون":"Ct Weight",isRTL?"سعر البيع":"Sale Price",isRTL?"سعر الشراء":"Buy Price",isRTL?"الحد الأدنى":"Min Stock",isRTL?"المخزون":"Stock",isRTL?"الحالة":"Status",isRTL?"إجراءات":"Actions"].map((h,i)=>(
                    <th key={i} className={`px-3 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const cartonKg = p.g > 0 ? (p.g * p.ppc / 1000).toFixed(1) : "—";
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${!p.active ? "opacity-60" : ""}`}>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800 text-sm">{isRTL ? p.nameAr : p.nameEn}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-500">{catLabel(p.cat, isRTL)}</td>
                      <td className="px-3 py-3"><ProdTypeBadge type={p.type} lang={lang} /></td>
                      <td className="px-3 py-3 font-mono text-slate-600 text-xs">{p.g > 0 ? `${p.g}g` : "—"}</td>
                      <td className="px-3 py-3 font-mono text-slate-600 text-xs">{p.ppc > 0 ? p.ppc : "—"}</td>
                      <td className="px-3 py-3 font-mono text-slate-600 text-xs">{cartonKg} KG</td>
                      <td className="px-3 py-3 font-mono text-emerald-600 text-xs">AED {p.saleP}/{priceTypeLabel(p.salePT, isRTL)}</td>
                      <td className="px-3 py-3 font-mono text-[#0F2C59] text-xs">AED {p.buyP}/{priceTypeLabel(p.buyPT, isRTL)}</td>
                      <td className="px-3 py-3 font-mono text-slate-400 text-xs">{p.minCt > 0 ? `${p.minCt} Ct` : p.minKg > 0 ? `${p.minKg} KG` : "—"}</td>
                      <td className="px-3 py-3"><StockStatusBadge stockCt={p.stockCt} minCt={p.minCt} stockKg={p.stockKg} minKg={p.minKg} lang={lang} /></td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {p.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Disabled")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedProductId(p.id); onNavigate("product-detail"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all"><Eye size={13} /></button>
                          {canEdit && <button onClick={() => onNavigate("products-new")} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Pencil size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile Cards */}
      {filtered.length > 0 && (
        <div className="lg:hidden space-y-3">
          {filtered.map(p => {
            const cartonKg = p.g > 0 ? (p.g * p.ppc / 1000).toFixed(1) : null;
            return (
              <Card key={p.id} className={`p-4 ${!p.active ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-black text-slate-800">{isRTL ? p.nameAr : p.nameEn}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ProdTypeBadge type={p.type} lang={lang} />
                      <StockStatusBadge stockCt={p.stockCt} minCt={p.minCt} stockKg={p.stockKg} minKg={p.minKg} lang={lang} />
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Disabled")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div><span className="text-slate-400 font-bold">{isRTL ? "سعر البيع: " : "Sale: "}</span><span className="font-mono font-bold text-emerald-600">AED {p.saleP}/{priceTypeLabel(p.salePT, isRTL)}</span></div>
                  <div><span className="text-slate-400 font-bold">{isRTL ? "سعر الشراء: " : "Buy: "}</span><span className="font-mono font-bold text-[#0F2C59]">AED {p.buyP}/{priceTypeLabel(p.buyPT, isRTL)}</span></div>
                  {p.g > 0 && <div><span className="text-slate-400 font-bold">{isRTL ? "وزن: " : "Weight: "}</span><span className="font-mono font-bold text-slate-700">{p.g}g × {p.ppc} = {cartonKg} KG</span></div>}
                  <div><span className="text-slate-400 font-bold">{isRTL ? "المخزون: " : "Stock: "}</span><span className="font-mono font-bold text-slate-700">{p.stockCt > 0 ? `${p.stockCt} Ct` : `${p.stockKg} KG`}</span></div>
                </div>
                <Btn size="sm" variant="secondary" onClick={() => { setSelectedProductId(p.id); onNavigate("product-detail"); }}><Eye size={13} />{isRTL ? "تفاصيل المنتج" : "Product Detail"}</Btn>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="p-14 text-center">
          <Package size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا توجد منتجات حالياً" : "No products yet"}</h3>
          <p className="text-slate-400 text-sm mb-6">{isRTL ? "ابدأ بإعداد المنتجات الأساسية" : "Start by setting up the core products"}</p>
          <div className="flex gap-2 justify-center">
            {canEdit && <Btn onClick={() => onNavigate("products-new")}><Plus size={15} />{isRTL ? "إضافة منتج" : "Add Product"}</Btn>}
            <Btn variant="secondary" onClick={() => onNavigate("products-bulk-setup")}><Layers size={15} />{isRTL ? "إعداد المنتجات الأساسية" : "Bulk Setup"}</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── SCREEN: ADD / EDIT PRODUCT ─────────────────────────────────────────────────
export function AddProductScreen({ lang, role, onNavigate, productId }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; productId?: string }) {
  const isRTL = isRTL_fn(lang);
  const isEdit = Boolean(productId);
  const [nameAr, setNameAr] = useState(""); const [nameEn, setNameEn] = useState("");
  const [sku, setSku] = useState(""); const [cat, setCat] = useState(""); const [type, setType] = useState<ProductType>("fixed");
  const [active, setActive] = useState(true);
  const [grams, setGrams] = useState(""); const [ppc, setPpc] = useState("10");
  const [saleP, setSaleP] = useState(""); const [salePT, setSalePT] = useState<PriceType>("kg");
  const [buyP, setBuyP] = useState(""); const [buyPT, setBuyPT] = useState<PriceType>("piece");
  const [warnBelowCost, setWarnBelowCost] = useState(true); const [vatT, setVatT] = useState(true);
  const [trackInv, setTrackInv] = useState(true);
  const [minCt, setMinCt] = useState(""); const [minKg, setMinKg] = useState("");
  const [allowKGOverride, setAllowKGOverride] = useState(false);
  const [canCustomerSpecial, setCanCustomerSpecial] = useState(true);
  const [canSupplierSpecial, setCanSupplierSpecial] = useState(true);
  const [canFreeProduct, setCanFreeProduct] = useState(true);
  const [canQuotation, setCanQuotation] = useState(true);
  const [canSales, setCanSales] = useState(true);
  const [canPurchase, setCanPurchase] = useState(true);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(!IS_MOCK_MODE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId) && !IS_MOCK_MODE);
  const [loadedSnapshot, setLoadedSnapshot] = useState<ProductFormSnapshot | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAddAnother, setPendingAddAnother] = useState(false);

  useEffect(() => {
    if (IS_MOCK_MODE) {
      setCategoriesLoading(false);
      return;
    }
    setCategoriesLoading(true);
    void listProductCategories()
      .then((rows) => {
        setCategories(rows.filter((c) => c.active).map((c) => ({
          value: String(c.id),
          label: isRTL ? c.nameAr : c.nameEn,
        })));
      })
      .finally(() => setCategoriesLoading(false));
  }, [isRTL]);

  useEffect(() => {
    if (!productId || IS_MOCK_MODE) return;
    setLoadingProduct(true);
    void getProductRow(productId)
      .then((p) => {
        if (!p) return;
        setNameAr(p.nameAr);
        setNameEn(p.nameEn);
        setSku(p.sku ?? "");
        setCat(String(p.categoryId ?? ""));
        setType((p.type as ProductType) ?? "fixed");
        setActive(p.active !== false);
        setGrams(p.g != null && p.g > 0 ? String(p.g) : "");
        setPpc(p.ppc != null && p.ppc > 0 ? String(p.ppc) : "10");
        setSaleP(p.saleP != null ? String(p.saleP) : "");
        setSalePT((p.salePT as PriceType) ?? "kg");
        setBuyP(p.buyP != null ? String(p.buyP) : "");
        setBuyPT((p.buyPT as PriceType) ?? "piece");
        setTrackInv(p.trackInv !== false);
        setVatT(p.vatT !== false);
        setMinCt(p.minCt != null ? String(p.minCt) : "");
        setMinKg(p.minKg != null ? String(p.minKg) : "");
        setLoadedSnapshot({
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          sku: p.sku ?? "",
          categoryId: p.categoryId ?? 0,
          productType: (p.type as string) ?? "fixed",
          weightGrams: p.g,
          piecesPerCarton: p.ppc,
          salesPrice: p.saleP,
          salesPriceType: p.salePT,
          purchasePrice: p.buyP,
          purchasePriceType: p.buyPT,
          trackInventory: p.trackInv !== false,
          vatTaxable: p.vatT !== false,
          minCartons: p.minCt,
          minKg: p.minKg,
        });
      })
      .finally(() => setLoadingProduct(false));
  }, [productId]);

  const categoryOptions = IS_MOCK_MODE
    ? [{ value: "", label: isRTL ? "اختر التصنيف" : "Select Category" }, ...PROD_CATEGORIES.map(c => ({ value: c.key, label: isRTL ? c.ar : c.en }))]
    : [{ value: "", label: isRTL ? "اختر التصنيف" : "Select Category" }, ...categories];

  const buildFormSnapshot = (): ProductFormSnapshot => ({
    nameAr,
    nameEn,
    sku,
    categoryId: Number(cat),
    productType: type,
    weightGrams: parseFloat(grams) || undefined,
    piecesPerCarton: parseFloat(ppc) || undefined,
    salesPrice: parseFloat(saleP) || 0,
    salesPriceType: salePT,
    purchasePrice: parseFloat(buyP) || 0,
    purchasePriceType: buyPT,
    trackInventory: trackInv,
    vatTaxable: vatT,
    minCartons: minCt ? parseFloat(minCt) : undefined,
    minKg: minKg ? parseFloat(minKg) : undefined,
  });

  const persistProduct = async (addAnother: boolean, reason?: string) => {
    const categoryId = Number(cat);
    const form = buildFormSnapshot();
    const payload = isEdit && productId
      ? buildProductUpdatePayload(form, loadedSnapshot, reason)
      : buildProductCreatePayload(form);
    if (isEdit && productId) {
      await updateProduct(productId, payload);
    } else {
      await createProduct(payload);
    }
    toast.success(isRTL ? "تم حفظ المنتج بنجاح" : "Product saved");
    if (addAnother && !isEdit) {
      setNameAr(""); setNameEn(""); setSku(""); setGrams(""); setSaleP(""); setBuyP(""); setCat("");
    } else if (isEdit && productId) {
      onNavigate("product-detail");
    } else {
      onNavigate("products");
    }
  };

  const handleSave = async (addAnother: boolean) => {
    if (!nameAr.trim() || !cat) {
      toast.error(isRTL ? "أدخل الاسم والتصنيف" : "Name and category are required");
      return;
    }
    if (!sku.trim()) {
      toast.error(isRTL ? "رمز المنتج SKU مطلوب" : "Product SKU is required");
      return;
    }
    if (type === "fixed" && (!grams.trim() || !ppc.trim() || parseFloat(grams) <= 0 || parseFloat(ppc) <= 0)) {
      toast.error(isRTL ? "أدخل وزن الحبة والحبات في الكرتون" : "Weight per piece and pieces per carton are required");
      return;
    }
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ المنتج بنجاح" : "Product saved");
      if (addAnother) {
        setNameAr(""); setNameEn(""); setSku(""); setGrams(""); setSaleP(""); setBuyP("");
      } else {
        onNavigate("products");
      }
      return;
    }
    setSaveError(null);
    setFieldErrors({});
    setSaving(true);
    const categoryId = Number(cat);
    if (!categoryId || Number.isNaN(categoryId)) {
      setSaving(false);
      toast.error(isRTL ? "اختر تصنيفاً صالحاً من القائمة أو أنشئ تصنيفاً أولاً" : "Select a valid category or create one first");
      return;
    }
    try {
      const form = buildFormSnapshot();
      if (isEdit && productFormNeedsReason(form, loadedSnapshot)) {
        setPendingAddAnother(addAnother);
        setShowReasonModal(true);
        setSaving(false);
        return;
      }
      await persistProduct(addAnother);
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWithReason = async (reason: string) => {
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      await persistProduct(pendingAddAnother, reason);
      setShowReasonModal(false);
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const gramsNum = parseFloat(grams) || 0;
  const ppcNum = parseFloat(ppc) || 0;
  const cartonKg = gramsNum > 0 && ppcNum > 0 ? (gramsNum * ppcNum / 1000).toFixed(2) : "—";

  if (loadingProduct) return <LoadingState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate(isEdit ? "product-detail" : "products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isEdit ? (isRTL ? "تعديل المنتج" : "Edit Product") : (isRTL ? "إضافة منتج جديد" : "Add New Product")}</h2>
      </div>
      <FormErrors lang={lang} error={saveError} fieldErrors={fieldErrors} />

      {!IS_MOCK_MODE && !categoriesLoading && categories.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-amber-800">{isRTL ? "لا توجد تصنيفات منتجات. أنشئ تصنيفاً قبل إضافة منتج." : "No product categories yet. Create a category before adding a product."}</p>
          <Btn variant="secondary" size="sm" onClick={() => onNavigate("product-categories")}>{isRTL ? "إدارة التصنيفات" : "Manage Categories"}</Btn>
        </div>
      )}

      {/* A. Basic Info */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "أ. المعلومات الأساسية" : "A. Basic Information"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "اسم المنتج (عربي) *" : "Arabic Name *"} value={nameAr} onChange={setNameAr} placeholder={isRTL ? "مثال: 900 جرام" : "e.g. 900 GRAM"} required />
          <FInput label={isRTL ? "اسم المنتج (إنجليزي)" : "English Name"} value={nameEn} onChange={setNameEn} placeholder="e.g. 900 GRAM" />
          <FInput label={isRTL ? "رمز المنتج / SKU *" : "Product Code / SKU *"} value={sku} onChange={setSku} placeholder="W-900" required />
          <FSelect label={isRTL ? "التصنيف *" : "Category *"} value={cat} onChange={setCat} required
            options={categoryOptions} />
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "نوع المنتج *" : "Product Type *"}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([["fixed", isRTL?"وزن ثابت":"Fixed"], ["moving", isRTL?"وزن متحرك":"Moving"], ["byproduct", isRTL?"منتج جانبي":"By-product"], ["part", isRTL?"جزء دجاج":"Part"], ["service", isRTL?"خدمة":"Service"], ["other", isRTL?"أخرى":"Other"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setType(v)} className={`py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${type === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-700">{isRTL ? "المنتج نشط" : "Product Active"}</span>
            <Toggle on={active} onChange={setActive} />
          </div>
        </div>
      </Card>

      {/* B. Weight & Carton Rules */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ب. قواعد الوزن والكرتون" : "B. Weight & Carton Rules"}</h3>
        {type === "fixed" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FInput label={isRTL ? "وزن الحبة (جرام) *" : "Weight per piece (grams) *"} type="number" value={grams} onChange={setGrams} placeholder="900" required />
              <FInput label={isRTL ? "الحبات في الكرتونة *" : "Pieces per carton *"} type="number" value={ppc} onChange={setPpc} placeholder="10" required />
            </div>
            {/* Live carton weight preview */}
            <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4">
              <div className="text-xs font-black text-slate-500 mb-2">{isRTL ? "معاينة وزن الكرتونة — التلقائي" : "Auto Carton Weight Preview"}</div>
              <div className="font-mono font-black text-[#0F2C59] text-2xl">{cartonKg} KG</div>
              <div className="text-xs text-slate-400 mt-1">{isRTL ? `وزن الكرتونة = ${grams || "?"} جرام × ${ppc || "?"} حبات ÷ 1000` : `Carton weight = ${grams || "?"}g × ${ppc || "?"} pcs ÷ 1000`}</div>
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
              <div><div className="text-sm font-bold text-slate-700">{isRTL ? "السماح بتعديل الكيلو يدوياً في الفاتورة" : "Allow manual KG override in invoice"}</div><div className="text-xs text-slate-400">{isRTL ? "يحتاج صلاحية" : "Requires permission"}</div></div>
              <Toggle on={allowKGOverride} onChange={setAllowKGOverride} />
            </div>
          </div>
        )}
        {type === "moving" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "هذا المنتج يحتاج إدخال الوزن يدوياً داخل الفاتورة." : "This product requires manual weight entry inside the invoice."}</p></div>
            <FInput label={isRTL ? "الحبات الافتراضية في الكرتونة" : "Default Pieces per Carton"} type="number" value={ppc} onChange={setPpc} placeholder="8" helper={isRTL ? "الوزن المتحرك يبدأ من 1550 جرام" : "Moving weight starts from 1550g"} />
          </div>
        )}
        {(type === "byproduct" || type === "part") && (
          <div className="space-y-4">
            <FSelect label={isRTL ? "الوحدة الافتراضية" : "Default Unit"} value="kg" onChange={() => {}}
              options={[{ value: "kg", label: "KG" }, { value: "tray", label: isRTL ? "طبق" : "Tray" }, { value: "piece", label: isRTL ? "حبة" : "Piece" }, { value: "carton", label: isRTL ? "كرتون" : "Carton" }]} />
          </div>
        )}
      </Card>

      {/* C. Pricing */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ج. الأسعار الافتراضية" : "C. Default Pricing"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1"><FInput label={isRTL ? "سعر البيع الافتراضي" : "Default Sale Price"} type="number" value={saleP} onChange={setSaleP} placeholder="14.75" /></div>
            <FSelect label={isRTL ? "نوع السعر" : "Type"} value={salePT} onChange={v => setSalePT(v as PriceType)}
              options={[{ value: "kg", label: isRTL ? "كيلو" : "KG" }, { value: "piece", label: isRTL ? "حبة" : "Piece" }, { value: "carton", label: isRTL ? "كرتون" : "Carton" }, { value: "tray", label: isRTL ? "طبق" : "Tray" }]} />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><FInput label={isRTL ? "سعر الشراء الافتراضي" : "Default Purchase Price"} type="number" value={buyP} onChange={setBuyP} placeholder="1.15" /></div>
            <FSelect label={isRTL ? "نوع السعر" : "Type"} value={buyPT} onChange={v => setBuyPT(v as PriceType)}
              options={[{ value: "piece", label: isRTL ? "حبة" : "Piece" }, { value: "kg", label: isRTL ? "كيلو" : "KG" }, { value: "tray", label: isRTL ? "طبق" : "Tray" }, { value: "carton", label: isRTL ? "كرتون" : "Carton" }]} />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          {[
            [warnBelowCost, setWarnBelowCost, isRTL ? "تحذير إذا كان سعر البيع أقل من تكلفة الشراء" : "Warn if sale price below purchase cost"],
            [vatT, setVatT, isRTL ? "خاضع لضريبة القيمة المضافة" : "VAT taxable"],
          ].map(([val, setter, label]: any) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm font-bold text-slate-700">{label}</span>
              <Toggle on={val} onChange={setter} />
            </div>
          ))}
        </div>
      </Card>

      {/* D. Inventory */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "د. إعدادات المخزون" : "D. Inventory Settings"}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-700">{isRTL ? "متابعة المخزون" : "Track Inventory"}</span>
            <Toggle on={trackInv} onChange={setTrackInv} />
          </div>
          {trackInv && (
            <div className="grid grid-cols-2 gap-4">
              <FInput label={isRTL ? "الحد الأدنى (كرتون)" : "Minimum Stock (Cartons)"} type="number" value={minCt} onChange={setMinCt} placeholder="20" />
              <FInput label={isRTL ? "الحد الأدنى (كيلو)" : "Minimum Stock (KG)"} type="number" value={minKg} onChange={setMinKg} placeholder="180" />
            </div>
          )}
          {/* Negative stock — locked OFF */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <div><div className="text-sm font-bold text-red-700">{isRTL ? "السماح بمخزون سلبي" : "Allow Negative Stock"}</div><div className="text-xs text-red-600">{isRTL ? "لا يمكن بيع كمية أكبر من المخزون المتاح." : "Cannot sell more than available stock."}</div></div>
            <div className="flex items-center gap-1.5"><div className="w-11 h-[24px] rounded-full bg-slate-300 flex items-center cursor-not-allowed"><span className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" /></div><Lock size={13} className="text-slate-400" /></div>
          </div>
        </div>
      </Card>

      {/* E. Agreements */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "هـ. الاتفاقيات والاستخدام" : "E. Agreement Eligibility"}</h3>
        <div className="space-y-1">
          {[
            [canCustomerSpecial, setCanCustomerSpecial, isRTL ? "يمكن استخدامه في أسعار العملاء الخاصة" : "Can be used in customer special prices"],
            [canSupplierSpecial, setCanSupplierSpecial, isRTL ? "يمكن استخدامه في أسعار الموردين الخاصة" : "Can be used in supplier special prices"],
            [canFreeProduct, setCanFreeProduct, isRTL ? "يمكن أن يكون منتجاً مجانياً للعملاء" : "Can be a free product for customers"],
            [canQuotation, setCanQuotation, isRTL ? "يظهر في عروض الأسعار" : "Appears in quotations"],
            [canSales, setCanSales, isRTL ? "يظهر في فواتير البيع" : "Appears in sales invoices"],
            [canPurchase, setCanPurchase, isRTL ? "يظهر في فواتير الشراء" : "Appears in purchase invoices"],
          ].map(([val, setter, label]: any) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm font-bold text-slate-700">{label}</span>
              <Toggle on={val} onChange={setter} />
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate("products")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2">
          {!isEdit && <Btn variant="secondary" disabled={saving} onClick={() => void handleSave(true)}>{isRTL ? "حفظ وإضافة آخر" : "Save & Add Another"}</Btn>}
          <Btn disabled={!nameAr.trim() || !cat || !sku.trim() || saving || (!IS_MOCK_MODE && categories.length === 0)} onClick={() => void handleSave(false)}><Check size={15} />{isEdit ? (isRTL ? "حفظ التعديلات" : "Save Changes") : (isRTL ? "حفظ المنتج" : "Save Product")}</Btn>
        </div>
      </div>
      {showReasonModal && (
        <ReasonModal
          lang={lang}
          titleAr="سبب تغيير السعر أو قواعد الكرتون"
          titleEn="Reason for price or carton rule change"
          confirmLabelAr="حفظ"
          confirmLabelEn="Save"
          loading={saving}
          onClose={() => setShowReasonModal(false)}
          onConfirm={handleSaveWithReason}
        />
      )}
    </div>
  );
}

// ── SCREEN: PRODUCT DETAIL ─────────────────────────────────────────────────────
export function ProductDetailScreen({ lang, role, onNavigate, productId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; productId: string;
}) {
  const isRTL = isRTL_fn(lang);
  const [tab, setTab] = useState("overview");
  const [calcCt, setCalcCt] = useState("10");
  const { item: liveProduct, loading, error, forbidden, reload } = useProductDetail(
    productId,
    async (id) => MOCK_PRODUCTS.find((x) => x.id === id) ?? null,
  );
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;
  const p = liveProduct;
  if (!p) {
    return <EmptyState lang={lang} messageAr="لا توجد منتجات بعد" messageEn="No products yet" />;
  }
  const cartonKg = p.g > 0 ? (p.g * p.ppc / 1000).toFixed(1) : "—";
  const totalPcs = p.g > 0 ? (parseFloat(calcCt) || 0) * p.ppc : 0;
  const totalKg = p.g > 0 ? (totalPcs * p.g / 1000).toFixed(1) : ((parseFloat(calcCt) || 0) * (parseFloat(cartonKg) || 0)).toFixed(1);
  const totalAmt = p.saleP > 0 ? (parseFloat(totalKg) * p.saleP).toFixed(2) : "—";
  const canEdit = role === "owner" || role === "accountant";

  const TABS = [
    { k: "overview", ar: "نظرة عامة",              en: "Overview" },
    { k: "carton",   ar: "قواعد الوزن والكرتون",    en: "Weight & Carton" },
    { k: "pricing",  ar: "الأسعار",                 en: "Pricing" },
    { k: "inventory",ar: "المخزون",                 en: "Inventory" },
    { k: "cust",     ar: "أسعار العملاء الخاصة",    en: "Customer Prices" },
    { k: "supp",     ar: "أسعار الموردين الخاصة",   en: "Supplier Prices" },
    { k: "usage",    ar: "الفواتير المرتبطة",        en: "Linked Records" },
    { k: "audit",    ar: "سجل العمليات",             en: "Audit Log" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? p.nameAr : p.nameEn}</h2>
            <ProdTypeBadge type={p.type} lang={lang} />
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Disabled")}</span>
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{p.sku} · {catLabel(p.cat, isRTL)}</div>
        </div>
      </div>

      {/* Actions */}
      <Card className="p-4 flex flex-wrap gap-2">
        {canEdit && <Btn size="sm" variant="secondary" onClick={() => onNavigate("products-edit")}><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
        <Btn size="sm" variant="outline" onClick={() => onNavigate("inventory-product")}><Package size={13} />{isRTL ? "عرض المخزون" : "View Inventory"}</Btn>
        <Btn size="sm" variant="outline" onClick={() => onNavigate("reports-sales")}><TrendingUp size={13} />{isRTL ? "عرض المبيعات" : "View Sales"}</Btn>
        <Btn size="sm" variant="outline" onClick={() => onNavigate("reports-purchases")}><TrendingDown size={13} />{isRTL ? "عرض المشتريات" : "View Purchases"}</Btn>
        {canEdit && p.active && <Btn size="sm" variant="danger"><Lock size={13} />{isRTL ? "تعطيل المنتج" : "Disable"}</Btn>}
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { ar: "سعر البيع",   en: "Sale Price",     v: `AED ${p.saleP}/${priceTypeLabel(p.salePT, isRTL)}`, cls: "text-emerald-600" },
          { ar: "سعر الشراء",  en: "Buy Price",      v: `AED ${p.buyP}/${priceTypeLabel(p.buyPT, isRTL)}`,  cls: "text-[#0F2C59]"  },
          { ar: "المخزون الحالي",en: "Current Stock", v: p.g > 0 ? `${p.stockCt} Ct` : `${p.stockKg} KG`,   cls: p.stockCt < p.minCt && p.minCt > 0 ? "text-amber-600" : "text-slate-700" },
          { ar: "وزن الكرتونة", en: "Carton Weight",  v: `${cartonKg} KG`,                                  cls: "text-slate-700"  },
        ].map(f => <Card key={f.ar} className="p-4 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>)}
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${tab === t.k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400"}`}>{isRTL ? t.ar : t.en}</button>)}
          </div>
        </div>
        <div className="p-5">
          {tab === "overview" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { ar:"اسم المنتج (عربي)", en:"Arabic Name",    v:p.nameAr },
                { ar:"اسم المنتج (إنجليزي)",en:"English Name", v:p.nameEn || "—" },
                { ar:"رمز المنتج",         en:"SKU",          v:p.sku },
                { ar:"التصنيف",            en:"Category",     v:catLabel(p.cat, isRTL) },
                { ar:"نوع المنتج",          en:"Type",         v:isRTL ? (p.type === "fixed" ? "وزن ثابت" : p.type === "moving" ? "وزن متحرك" : "منتج جانبي") : p.type },
                { ar:"ضريبة القيمة المضافة",en:"VAT Taxable", v:p.vatT ? (isRTL ? "نعم" : "Yes") : (isRTL ? "لا" : "No") },
              ].map(f => <div key={f.ar} className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>)}
            </div>
          )}

          {tab === "carton" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
                {[
                  { ar:"وزن الحبة",         en:"Piece Weight",    v:p.g > 0 ? `${p.g}g` : "—" },
                  { ar:"الحبات في الكرتونة", en:"Pcs/Carton",     v:p.ppc > 0 ? `${p.ppc}` : "—" },
                  { ar:"وزن الكرتونة",      en:"Carton Weight",   v:`${cartonKg} KG` },
                ].map(f => <div key={f.ar} className="text-center"><div className="text-2xl font-black font-mono text-[#0F2C59]">{f.v}</div><div className="text-[10px] text-slate-400 font-bold mt-0.5">{isRTL ? f.ar : f.en}</div></div>)}
              </div>
              {/* Live calculator */}
              <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-5">
                <div className="text-sm font-black text-[#0F2C59] mb-4">{isRTL ? "آلة حاسبة الكرتون / الكيلو" : "Carton / KG Calculator"}</div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-32">
                    <label className="text-xs font-bold text-slate-500 block mb-1">{isRTL ? "عدد الكراتين" : "Cartons"}</label>
                    <input type="number" value={calcCt} onChange={e => setCalcCt(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#0F2C59]/20 bg-white text-sm font-mono focus:outline-none focus:border-[#0F2C59] text-center text-xl font-black" />
                  </div>
                  <div className="text-2xl font-black text-[#0F2C59]">=</div>
                  <div className="grid grid-cols-3 gap-3 flex-1">
                    {[[totalPcs, isRTL ? "إجمالي الحبات" : "Total Pieces"], [totalKg + " KG", isRTL ? "إجمالي الكيلو" : "Total KG"], ["AED " + totalAmt, isRTL ? "الإجمالي" : "Amount"]].map(([v, l]) => (
                      <div key={l as string} className="bg-white rounded-xl p-3 text-center border border-[#0F2C59]/15">
                        <div className="font-mono font-black text-[#0F2C59] text-lg">{v}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400 font-semibold">
                  {p.g > 0 && `${isRTL ? "المعادلة:" : "Formula:"} ${calcCt || "?"} × ${p.ppc} = ${totalPcs} ${isRTL ? "حبة" : "pcs"} → ${totalPcs} × ${p.g}g ÷ 1000 = ${totalKg} KG`}
                </div>
              </div>
            </div>
          )}

          {tab === "pricing" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
                {[
                  { ar:"سعر البيع الافتراضي", en:"Default Sale Price",    v:`AED ${p.saleP}/${priceTypeLabel(p.salePT, isRTL)}`, cls:"text-emerald-600" },
                  { ar:"سعر الشراء الافتراضي",en:"Default Purchase Price", v:`AED ${p.buyP}/${priceTypeLabel(p.buyPT, isRTL)}`,  cls:"text-[#0F2C59]" },
                ].map(f => <div key={f.ar} className="text-center"><div className={`text-xl font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs text-slate-400 font-bold mt-0.5">{isRTL ? f.ar : f.en}</div></div>)}
              </div>
              {/* Customer special prices */}
              <div>
                <div className="flex items-center justify-between mb-2"><h4 className="font-black text-slate-700 text-xs uppercase tracking-wide">{isRTL ? "أسعار العملاء الخاصة" : "Customer Special Prices"}</h4>{canEdit && <Btn size="sm" variant="outline"><Plus size={12} />{isRTL ? "إضافة" : "Add"}</Btn>}</div>
                {CUST_SPECIAL_PRICES.filter(s => s.product === p.nameEn || s.product === p.nameAr).length === 0
                  ? <p className="text-xs text-slate-400 font-semibold">{isRTL ? "لا توجد أسعار خاصة" : "No special prices"}</p>
                  : CUST_SPECIAL_PRICES.filter(s => s.product === p.nameEn || s.product === p.nameAr).map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-violet-50 rounded-xl px-3 py-2 mb-1.5 border border-violet-100">
                      <div><div className="font-bold text-slate-800 text-xs">{s.customer}</div></div>
                      <div className="flex items-center gap-2"><span className="font-mono font-black text-violet-600 text-sm">AED {s.price}/{s.pt}</span><span className={`text-[10px] font-bold ${s.diff < 0 ? "text-red-500" : "text-emerald-600"}`}>{s.diff < 0 ? s.diff : "+" + s.diff}</span></div>
                    </div>
                  ))}
              </div>
              {/* Price change history */}
              <div>
                <h4 className="font-black text-slate-700 text-xs uppercase tracking-wide mb-2">{isRTL ? "سجل تغيير الأسعار" : "Price Change History"}</h4>
                <div className="space-y-2">
                  {PRICE_HISTORY.map((h, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                      <div className="flex justify-between text-xs"><span className="font-bold text-slate-700">{h.field(isRTL)}</span><span className="font-mono text-slate-400">{h.date}</span></div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs"><span className="font-mono text-red-400">{h.oldV}</span><span className="text-slate-400">→</span><span className="font-mono text-emerald-600 font-black">{h.newV}</span><span className="text-slate-400 ms-1">{isRTL ? "السبب:" : "Reason:"} {h.reason(isRTL)}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "inventory" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { ar:"الكراتين المتاحة",en:"Available Cartons",v:p.stockCt,cls:"text-[#0F2C59]" },
                  { ar:"الكيلو المتاح",  en:"Available KG",    v:p.stockKg + " KG",cls:"text-[#0F2C59]" },
                  { ar:"الحد الأدنى",    en:"Min Level",       v:p.minCt > 0 ? p.minCt + " Ct" : p.minKg + " KG", cls:"text-slate-600" },
                  { ar:"الحالة",         en:"Status",          v:<StockStatusBadge stockCt={p.stockCt} minCt={p.minCt} stockKg={p.stockKg} minKg={p.minKg} lang={lang} />, cls:"" },
                ].map((f, i) => <Card key={i} className="p-3 text-center"><div className={`text-base font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? f.ar : f.en}</div></Card>)}
              </div>
              <Btn size="sm" variant="outline" onClick={() => onNavigate("inventory-product")}><Package size={13} />{isRTL ? "فتح صفحة المخزون" : "Open Inventory Page"}</Btn>
            </div>
          )}

          {tab === "cust" && (
            <div className="space-y-2">
              {CUST_SPECIAL_PRICES.length === 0 ? <p className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد أسعار خاصة لهذا المنتج" : "No customer special prices for this product"}</p> : CUST_SPECIAL_PRICES.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <div><div className="font-bold text-slate-800 text-sm">{s.customer}</div><div className="text-xs text-slate-400">{s.updated}</div></div>
                  <div className="flex items-center gap-3"><span className="font-mono font-black text-violet-600">AED {s.price}/{s.pt}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span></div>
                </div>
              ))}
            </div>
          )}

          {tab === "supp" && (
            <div className="space-y-2">
              {SUPP_SPECIAL_PRICES.length === 0 ? <p className="text-center py-8 text-slate-400 font-semibold">{isRTL ? "لا توجد أسعار شراء خاصة" : "No supplier special prices"}</p> : SUPP_SPECIAL_PRICES.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <div><div className="font-bold text-slate-800 text-sm">{s.supplier}</div><div className="text-xs text-slate-400">{s.updated}</div></div>
                  <span className="font-mono font-black text-[#0F2C59]">AED {s.price}/{s.pt}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "usage" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "هذا المنتج مستخدم في معاملات سابقة، لذلك يمكن إيقافه فقط ولا يمكن حذفه." : "This product is used in transactions and can only be disabled, not deleted."}</p></div>
              {[["المبيعات","Sales","4","INV-2025-0086",isRTL?"مطعم الخليج":"Al Khalij","34 Ct",306+" KG"], ["المشتريات","Purchases","6","PUR-2025-0042",isRTL?"WESTLAND":"WESTLAND","146 Ct",1310+" KG"]].map(([moduleAr,moduleEn,count,ref,party,qty,kg])=>(
                <div key={ref} className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div><div className="font-bold text-slate-800 text-xs">{isRTL?moduleAr:moduleEn}</div><div className="text-[10px] text-slate-400">{count} {isRTL?"مرة":"times"} · {isRTL?"آخر:":"Last:"} {ref}</div></div>
                  <div className="text-end"><div className="font-mono text-xs text-slate-600">{qty}</div><div className="font-mono text-xs text-slate-400">{kg}</div></div>
                </div>
              ))}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-2">
              {PRICE_HISTORY.map((e, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-amber-500" />
                  <div className="flex-1"><div className="text-sm font-bold text-slate-700">{isRTL ? "تعديل " : "Modified: "}{e.field(isRTL)}</div><div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5"><span className="font-mono text-red-400">{e.oldV}</span><span>→</span><span className="font-mono text-emerald-600">{e.newV}</span><span>·</span><span>{e.reason(isRTL)}</span></div></div>
                  <div className="font-mono text-xs text-slate-400 shrink-0">{e.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PRODUCT CATEGORIES ─────────────────────────────────────────────────
export function ProductCategoriesScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = isRTL_fn(lang);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCatEn, setNewCatEn] = useState("");
  const [categories, setCategories] = useState(PROD_CATEGORIES.map(c => ({ ...c, id: c.key })));
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const canEdit = role === "owner";

  useEffect(() => {
    if (IS_MOCK_MODE) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const rows = await listProductCategories();
        if (!cancelled) {
          setCategories(rows.map(c => ({
            id: String(c.id),
            key: c.key,
            ar: c.nameAr,
            en: c.nameEn,
            count: c.count ?? 0,
            active: c.active,
          })));
        }
      } catch (err) {
        if (!cancelled) setSaveError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAddCategory = async () => {
    if (!newCat.trim()) return;
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم إضافة التصنيف" : "Category added");
      setShowAdd(false);
      setNewCat("");
      setNewCatEn("");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const created = await createProductCategory({ nameAr: newCat, nameEn: newCatEn || undefined });
      setCategories(prev => [...prev, {
        id: String(created.id),
        key: created.key,
        ar: created.nameAr,
        en: created.nameEn,
        count: 0,
        active: created.active,
      }]);
      toast.success(isRTL ? "تم إنشاء التصنيف" : "Category created");
      setShowAdd(false);
      setNewCat("");
      setNewCatEn("");
    } catch (err) {
      setSaveError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "تصنيفات المنتجات" : "Product Categories"}</h2></div>
        {canEdit && <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}><Plus size={14} />{isRTL ? "إضافة تصنيف" : "Add Category"}</Btn>}
      </div>

      <FormErrors lang={lang} error={saveError} fieldErrors={fieldErrors} />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "لا يمكن حذف تصنيف مستخدم في منتجات أو فواتير، يمكن إيقافه فقط." : "Cannot delete a category used in products or invoices — it can only be disabled."}</p></div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"التصنيف":"Category",isRTL?"الوصف":"Description",isRTL?"عدد المنتجات":"Products",isRTL?"الحالة":"Status",isRTL?"إجراءات":"Actions"].map((h,i)=><th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {categories.length === 0 && (
              <tr><td colSpan={5} className="p-6"><EmptyState lang={lang} messageAr="لا توجد تصنيفات بعد" messageEn="No categories yet" compact /></td></tr>
            )}
            {categories.map(c => (
              <tr key={c.key} className={`hover:bg-slate-50/60 ${!c.active ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{isRTL ? c.ar : c.en}</div>
                  {!isRTL && <div className="text-xs text-slate-400">{c.ar}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{isRTL ? c.ar : c.en}</td>
                <td className="px-4 py-3 font-mono font-bold text-[#0F2C59]">{c.count}</td>
                <td className="px-4 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Disabled")}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {canEdit && <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>}
                    {canEdit && c.count === 0 && <button className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><X size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-black text-[#0F2C59] mb-4 text-lg">{isRTL ? "إضافة تصنيف جديد" : "Add New Category"}</h3>
            <div className="space-y-3">
              <FInput label={isRTL ? "اسم التصنيف (عربي) *" : "Arabic Name *"} value={newCat} onChange={setNewCat} required />
              <FInput label={isRTL ? "اسم التصنيف (إنجليزي)" : "English Name"} value={newCatEn} onChange={setNewCatEn} />
            </div>
            <div className="flex gap-3 mt-4">
              <Btn variant="outline" onClick={() => setShowAdd(false)} className="flex-1 justify-center">{isRTL ? "إلغاء" : "Cancel"}</Btn>
              <Btn disabled={!newCat.trim() || saving} onClick={() => void handleAddCategory()} className="flex-1 justify-center"><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN: BULK PRODUCT SETUP ─────────────────────────────────────────────────
export function BulkProductSetupScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = isRTL_fn(lang);
  const weights = Array.from({ length: 37 }, (_, i) => 400 + i * 50);
  const defaultPpc = (g: number) => g <= 1500 ? 10 : 8;
  const defaultType = (g: number) => g <= 1500 ? "fixed" : "moving";
  const [enabled, setEnabled] = useState<Record<number, boolean>>({
    900: true, 1000: true, 1100: true, 1200: true, 1300: true,
    700: true, 800: true, 1400: true, 1500: true,
  });
  const [prices, setPrices] = useState<Record<number, { sale: string; buy: string; ppc: string }>>({});

  const getP = (g: number) => prices[g] || { sale: g <= 1000 ? "14.75" : g <= 1500 ? "15.00" : "13.75", buy: g <= 1000 ? "1.15" : "1.20", ppc: String(defaultPpc(g)) };
  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "إعداد المنتجات دفعة واحدة" : "Bulk Product Setup"}</h2><p className="text-xs text-slate-400">{isRTL ? "إعداد الأوزان الشائعة للدواجن بسرعة" : "Quick setup for common poultry weights"}</p></div>
        <Btn variant="primary" onClick={() => { toast.success(isRTL ? `تم حفظ ${enabledCount} منتج بنجاح` : `Saved ${enabledCount} products`); onNavigate("products"); }}><Check size={15} />{isRTL ? `حفظ ${enabledCount} منتج` : `Save ${enabledCount} Products`}</Btn>
      </div>

      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex items-start gap-2">
        <Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-slate-500">{isRTL ? "يمكن تعديل هذه القيم لاحقاً من ملف كل منتج." : "These values can be edited later from each product's detail page."}</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-2">
        <Btn size="sm" variant="secondary" onClick={() => setEnabled(Object.fromEntries(weights.map(g => [g, true])))}>{isRTL ? "تحديد الكل" : "Select All"}</Btn>
        <Btn size="sm" variant="outline" onClick={() => setEnabled(Object.fromEntries([700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300].map(g=>[g,true])))}>{isRTL ? "الأوزان الشائعة فقط" : "Common Weights Only"}</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setEnabled({})}>{isRTL ? "إلغاء الكل" : "Clear All"}</Btn>
        <span className="text-sm font-bold text-[#0F2C59] self-center">{enabledCount} {isRTL ? "منتج محدد" : "selected"}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"تفعيل":"Enable",isRTL?"الوزن":"Weight",isRTL?"اسم المنتج":"Name",isRTL?"حبات/كرتون":"Pcs/Ct",isRTL?"سعر البيع/KG":"Sale/KG",isRTL?"سعر الشراء/حبة":"Buy/Pcs",isRTL?"النوع":"Type"].map((h,i)=><th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {weights.map(g => {
                const p = getP(g);
                const isMoving = g > 1500;
                return (
                  <tr key={g} className={`${enabled[g] ? "bg-white" : "bg-slate-50/50 opacity-60"} hover:bg-slate-50/80`}>
                    <td className="px-3 py-2"><Toggle on={!!enabled[g]} onChange={v => setEnabled(prev => ({ ...prev, [g]: v }))} /></td>
                    <td className="px-3 py-2 font-mono font-black text-[#0F2C59] text-sm">{g}g</td>
                    <td className="px-3 py-2 font-bold text-slate-700 text-xs">{isRTL ? `${g} جرام` : `${g} GRAM`}{g > 1500 ? (isRTL ? " (متحرك)" : " (Moving)") : ""}</td>
                    <td className="px-3 py-2"><input type="number" value={p.ppc} onChange={e => setPrices(prev => ({ ...prev, [g]: { ...getP(g), ppc: e.target.value } }))} disabled={!enabled[g]} className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs font-mono bg-white disabled:bg-slate-50 outline-none focus:border-[#0F2C59]" /></td>
                    <td className="px-3 py-2"><input type="number" value={p.sale} onChange={e => setPrices(prev => ({ ...prev, [g]: { ...getP(g), sale: e.target.value } }))} disabled={!enabled[g]} className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs font-mono bg-white disabled:bg-slate-50 outline-none focus:border-[#0F2C59]" /></td>
                    <td className="px-3 py-2"><input type="number" value={p.buy} onChange={e => setPrices(prev => ({ ...prev, [g]: { ...getP(g), buy: e.target.value } }))} disabled={!enabled[g]} className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-center text-xs font-mono bg-white disabled:bg-slate-50 outline-none focus:border-[#0F2C59]" /></td>
                    <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isMoving ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>{isRTL ? (isMoving ? "متحرك" : "ثابت") : (isMoving ? "Moving" : "Fixed")}</span></td>
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

// ── SCREEN: BY-PRODUCTS SETUP ──────────────────────────────────────────────────
export function ByProductsSetupScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = isRTL_fn(lang);
  const [items, setItems] = useState(BYPRODUCTS_LIST.map(b => ({ ...b, enabled: ["Liver 500G","Gizzard 500G","Wings","Boneless Breast"].includes(b.name) })));
  const canEdit = role === "owner";

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "إعداد المنتجات الجانبية والأجزاء" : "By-products & Parts Setup"}</h2></div>
        {canEdit && <Btn variant="primary" onClick={() => { toast.success(isRTL ? "تم حفظ المنتجات الجانبية" : "By-products saved"); onNavigate("products"); }}><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"تفعيل":"Enable",isRTL?"اسم المنتج":"Product",isRTL?"الوحدة الافتراضية":"Default Unit",isRTL?"سعر البيع":"Sale Price",isRTL?"سعر الشراء":"Buy Price",isRTL?"نوع السعر":"Price Type",isRTL?"متابعة المخزون":"Track Inv.",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-3 py-2.5 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.name} className={`${item.enabled ? "bg-white" : "bg-slate-50/50 opacity-70"} hover:bg-slate-50/80`}>
                  <td className="px-3 py-2"><Toggle on={item.enabled} onChange={v => setItems(prev => prev.map((x, i) => i === idx ? { ...x, enabled: v } : x))} /></td>
                  <td className="px-3 py-2"><div className="font-bold text-slate-800 text-xs">{isRTL ? item.nameAr : item.name}</div></td>
                  <td className="px-3 py-2"><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.unit}</span></td>
                  <td className="px-3 py-2 font-mono text-emerald-600 text-xs">AED {item.saleP}/KG</td>
                  <td className="px-3 py-2 font-mono text-[#0F2C59] text-xs">AED {item.buyP}/{item.pt}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{item.pt}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.track ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.track ? (isRTL ? "نعم" : "Yes") : (isRTL ? "لا" : "No")}</span></td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.enabled ? (isRTL ? "مفعّل" : "Enabled") : (isRTL ? "موقوف" : "Disabled")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: IMPORT / EXPORT ────────────────────────────────────────────────────
export function ProductImportExportScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = isRTL_fn(lang);
  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("products")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "استيراد وتصدير المنتجات" : "Import & Export Products"}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export */}
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "تصدير المنتجات" : "Export Products"}</h3>
          <p className="text-xs text-slate-500 mb-4">{isRTL ? "تصدير قائمة المنتجات الحالية إلى Excel" : "Export current product list to Excel"}</p>
          <Btn variant="primary" className="w-full justify-center" onClick={() => toast.success(isRTL ? "تم تجهيز الملف للتصدير" : "Export ready")}><Download size={15} />{isRTL ? "تصدير Excel" : "Export Excel"}</Btn>
        </Card>
        {/* Import */}
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "استيراد المنتجات" : "Import Products"}</h3>
          <p className="text-xs text-slate-500 mb-4">{isRTL ? "رفع ملف Excel لإضافة أو تحديث المنتجات" : "Upload Excel file to add or update products"}</p>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center mb-3 cursor-pointer hover:border-[#0F2C59]/30 transition-all">
            <Download size={20} className="text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-400">{isRTL ? "رفع ملف Excel" : "Upload Excel File"}</p>
            <p className="text-[10px] text-slate-300">{isRTL ? "أو اسحب الملف هنا" : "or drag & drop"}</p>
          </div>
          <Btn variant="secondary" className="w-full justify-center" onClick={() => toast.info(isRTL ? "قريباً" : "Coming soon")}><Download size={14} />{isRTL ? "تنزيل النموذج" : "Download Template"}</Btn>
        </Card>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "الاستيراد عبر Excel قادم في إصدار مستقبلي. يمكن استخدام الإعداد اليدوي أو إعداد دفعة واحدة حالياً." : "Excel import is coming in a future release. Use manual setup or bulk setup for now."}</p></div>
    </div>
  );
}

// ── PANEL: PRODUCT SETTINGS ────────────────────────────────────────────────────
export function ProductSettingsPanel({ lang, role, onClose }: { lang: Lang; role: TenantRole; onClose: () => void }) {
  const isRTL = isRTL_fn(lang);
  const canEdit = role === "owner";
  const [custSpecial, setCustSpecial] = useState(true);
  const [suppSpecial, setSuppSpecial] = useState(true);
  const [freeProducts, setFreeProducts] = useState(true);
  const [reqPriceReason, setReqPriceReason] = useState(true);
  const [defaultVAT, setDefaultVAT] = useState(true);
  const [showSKU, setShowSKU] = useState(true);
  const [defPpc, setDefPpc] = useState("10");
  const [defPpcBig, setDefPpcBig] = useState("8");

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات المنتجات" : "Product Settings"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-700">{isRTL ? "حبات/كرتون (ثابت)" : "Pcs/Ct (Fixed)"}</label><input type="number" value={defPpc} onChange={e => canEdit && setDefPpc(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-center bg-white outline-none focus:border-[#0F2C59]" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-700">{isRTL ? "حبات/كرتون (متحرك)" : "Pcs/Ct (Moving)"}</label><input type="number" value={defPpcBig} onChange={e => canEdit && setDefPpcBig(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-center bg-white outline-none focus:border-[#0F2C59]" /></div>
          </div>
          <div className="space-y-1">
            {[
              [custSpecial, setCustSpecial, isRTL ? "تفعيل أسعار العملاء الخاصة" : "Enable customer special prices"],
              [suppSpecial, setSuppSpecial, isRTL ? "تفعيل أسعار الموردين الخاصة" : "Enable supplier special prices"],
              [freeProducts, setFreeProducts, isRTL ? "تفعيل المنتجات المجانية للعملاء" : "Enable free products for customers"],
              [reqPriceReason, setReqPriceReason, isRTL ? "طلب سبب عند تغيير الأسعار الافتراضية" : "Require reason for price changes"],
              [defaultVAT, setDefaultVAT, isRTL ? "المنتجات خاضعة للضريبة بشكل افتراضي" : "Products VAT taxable by default"],
              [showSKU, setShowSKU, isRTL ? "إظهار رمز المنتج / SKU" : "Show product code / SKU"],
            ].map(([val, setter, label]: any) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <Toggle on={val} onChange={setter} disabled={!canEdit} />
              </div>
            ))}
          </div>
          {/* Locked settings */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="text-xs font-black text-slate-400 uppercase">{isRTL ? "إعدادات مثبتة" : "Locked Settings"}</div>
            {[[isRTL ? "المخزون السلبي معطل" : "Negative stock disabled"], [isRTL ? "طريقة التكلفة: FIFO مثبّتة" : "Costing method: FIFO locked"]].map(([l]) => (
              <div key={l} className="flex items-center gap-2"><Lock size={12} className="text-slate-400 shrink-0" /><span className="text-xs font-bold text-slate-500">{l}</span></div>
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
