// ═══════════════════════════════════════════════════════════════════════════════
// POULTRY HERO — SETTINGS, USERS & PERMISSIONS MODULE (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  X, Check, ChevronRight, ChevronLeft, ChevronDown,
  AlertTriangle, Info, CheckCircle, Download, Printer,
  Settings, Users, Shield, FileText, Lock, Unlock,
  Eye, Pencil, Plus, Search, Tag, BarChart2,
  Calendar, Phone, Mail, Building2, Star, Zap, Crown
} from "lucide-react";
import { toast } from "sonner";
import { IS_MOCK_MODE } from "@/services/config";
import {
  getTenantSettings, updateCompanySettings, getVatSettings, updateVatSettings,
  listNumberingSettings, updateNumberingSettings, listPrintTemplateSettings, updatePrintTemplateSettings,
} from "@/services/settingsService";
import { listTenantUsers, suspendTenantUser, reactivateTenantUser, createTenantUser } from "@/services/userService";
import { LoadingState, ErrorState, PermissionDeniedState, ApiUnavailableState, EmptyState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { ApiError } from "@/services/api/errors";
import { LiveUserPermissionsScreen } from "@/features/permissions/LiveUserPermissionsScreen";

// ── LOCAL TYPES ────────────────────────────────────────────────────────────────
type Lang = "ar" | "en";
type TenantRole = "owner" | "accountant" | "cashier";
type TenantScreen =
  | "settings" | "settings-company" | "settings-users" | "settings-user-new"
  | "settings-user-permissions" | "settings-roles" | "settings-sensitive-actions"
  | "settings-audit" | "settings-numbering" | "settings-vat" | "settings-print-templates"
  | "settings-transactions" | "settings-plan" | "settings-security" | string;
type UserRole = "owner" | "accountant" | "cashier";
type RiskLevel = "high" | "medium" | "low";

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
function FInput({ label, placeholder, type = "text", value, onChange, required = false, error }: {
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean; error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white focus:border-[#0F2C59] focus:ring-2 focus:ring-[#0F2C59]/10"}`} />
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}
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

// Reusable back header for all settings sub-screens
function SettingsHeader({ title, titleEn, onBack, lang, children }: {
  title: string; titleEn: string; onBack: () => void; lang: Lang; children?: ReactNode;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="flex items-start gap-3 flex-wrap mb-5">
      <button onClick={onBack} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
      <h2 className="text-xl font-black text-[#0F2C59] flex-1">{isRTL ? title : titleEn}</h2>
      {children}
    </div>
  );
}

// ── SAMPLE DATA ────────────────────────────────────────────────────────────────
const SETTINGS_USERS = [
  { id: "u1", name: "Owner Admin",       email: "owner@primefresh.ae",      role: "owner"      as UserRole, active: true,  customPerms: false, lastLogin: "2025-01-28 14:30", created: "2024-06-01" },
  { id: "u2", name: "Ahmed Accountant",  email: "accountant@primefresh.ae", role: "accountant" as UserRole, active: true,  customPerms: true,  lastLogin: "2025-01-28 11:00", created: "2024-07-15" },
  { id: "u3", name: "Sale Cashier",      email: "cashier@primefresh.ae",    role: "cashier"    as UserRole, active: true,  customPerms: true,  lastLogin: "2025-01-28 09:00", created: "2024-09-01" },
];

const NUMBERING_DOCS = [
  { key: "sales",    ar: "فاتورة المبيعات",        en: "Sales Invoice",         prefix: "INV", next: "00046", reset: "yearly",   preview: "INV-2026-00046" },
  { key: "purchases",ar: "فاتورة الشراء",           en: "Purchase Invoice",      prefix: "PUR", next: "00035", reset: "yearly",   preview: "PUR-2026-00035" },
  { key: "receipts", ar: "إيصال تحصيل",            en: "Customer Receipt",      prefix: "REC", next: "00019", reset: "yearly",   preview: "REC-2026-00019" },
  { key: "payments", ar: "إيصال دفعة مورد",        en: "Supplier Payment",      prefix: "PAY", next: "00008", reset: "yearly",   preview: "PAY-2026-00008" },
  { key: "expenses", ar: "سند مصروف",              en: "Expense Voucher",        prefix: "EXP", next: "00023", reset: "yearly",   preview: "EXP-2026-00023" },
  { key: "adjust",   ar: "تعديل مخزون",            en: "Stock Adjustment",      prefix: "ADJ", next: "00004", reset: "yearly",   preview: "ADJ-2026-00004" },
  { key: "quotation",ar: "عرض سعر",                en: "Quotation",             prefix: "QUO", next: "00012", reset: "yearly",   preview: "QUO-2026-00012" },
  { key: "discount", ar: "تعديل تحصيل",            en: "Collection Adjustment", prefix: "CAD", next: "00006", reset: "yearly",   preview: "CAD-2026-00006" },
];

const SENSITIVE_ACTIONS = [
  { ar: "تعديل سعر البيع",           en: "Edit Sale Price",            module: isRTL => isRTL ? "المبيعات" : "Sales",       risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل سعر الشراء",          en: "Edit Purchase Price",        module: isRTL => isRTL ? "المشتريات" : "Purchases",  risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل الكيلو يدوياً",       en: "Override KG Manually",       module: isRTL => isRTL ? "الفواتير" : "Invoices",    risk: "medium" as RiskLevel, requireReason: true },
  { ar: "تغيير الضريبة",             en: "Change VAT",                 module: isRTL => isRTL ? "الضريبة" : "Tax",          risk: "medium" as RiskLevel, requireReason: true },
  { ar: "إلغاء فاتورة بيع",          en: "Cancel Sales Invoice",       module: isRTL => isRTL ? "المبيعات" : "Sales",       risk: "high"   as RiskLevel, requireReason: true },
  { ar: "إلغاء فاتورة شراء",         en: "Cancel Purchase Invoice",    module: isRTL => isRTL ? "المشتريات" : "Purchases",  risk: "high"   as RiskLevel, requireReason: true },
  { ar: "خصم عند التحصيل",           en: "Apply Collection Discount",  module: isRTL => isRTL ? "التحصيلات" : "Collections",risk: "medium" as RiskLevel, requireReason: true },
  { ar: "رفع الحد الائتماني",         en: "Increase Credit Limit",      module: isRTL => isRTL ? "العملاء" : "Customers",    risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل رصيد افتتاحي للعميل", en: "Edit Customer Opening Balance",module: isRTL => isRTL ? "العملاء" : "Customers",  risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل رصيد افتتاحي للمورد", en: "Edit Supplier Opening Balance",module: isRTL => isRTL ? "الموردين" : "Suppliers", risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل مخزون يدوي",          en: "Manual Stock Adjustment",    module: isRTL => isRTL ? "المخزون" : "Inventory",    risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تطبيق فروقات الجرد",        en: "Apply Stocktake Differences",module: isRTL => isRTL ? "المخزون" : "Inventory",    risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تعديل ترقيم الفواتير",       en: "Edit Invoice Numbering",     module: isRTL => isRTL ? "الإعدادات" : "Settings",  risk: "medium" as RiskLevel, requireReason: true },
  { ar: "تعديل قالب الطباعة",         en: "Edit Print Template",        module: isRTL => isRTL ? "الإعدادات" : "Settings",  risk: "low"    as RiskLevel, requireReason: false },
  { ar: "تغيير صلاحيات مستخدم",       en: "Change User Permissions",    module: isRTL => isRTL ? "المستخدمين" : "Users",    risk: "high"   as RiskLevel, requireReason: true },
  { ar: "إيقاف مستخدم",              en: "Suspend User",               module: isRTL => isRTL ? "المستخدمين" : "Users",    risk: "high"   as RiskLevel, requireReason: true },
  { ar: "تصدير تقرير مالي حساس",     en: "Export Sensitive Report",    module: isRTL => isRTL ? "التقارير" : "Reports",     risk: "medium" as RiskLevel, requireReason: false },
];

const AUDIT_ENTRIES = [
  { dt: "2025-01-28 14:55", user: "Sale Cashier",      role: "cashier",     module: "المبيعات",  action: "محاولة تعديل السعر",              ref: "INV-2025-0086", prev: "AED 14.50/KG", next: "—",              reason: "—", risk: "high"   as RiskLevel, status: "denied"  },
  { dt: "2025-01-28 14:30", user: "Owner Admin",       role: "owner",       module: "العملاء",   action: "رفع الحد الائتماني",               ref: "cu2",            prev: "AED 15,000",   next: "AED 20,000",     reason: "اتفاق تجاري جديد",     risk: "high"   as RiskLevel, status: "success" },
  { dt: "2025-01-28 11:00", user: "Ahmed Accountant",  role: "accountant",  module: "الضريبة",   action: "تغيير إعداد الضريبة",              ref: "—",              prev: "معطّل",         next: "مفعّل 5%",       reason: "تفعيل الضريبة",         risk: "medium" as RiskLevel, status: "success" },
  { dt: "2025-01-27 16:00", user: "Owner Admin",       role: "owner",       module: "المبيعات",  action: "إلغاء فاتورة بيع",                ref: "INV-2025-0079", prev: "معتمدة",        next: "ملغاة",          reason: "خطأ في الكمية",         risk: "high"   as RiskLevel, status: "success" },
  { dt: "2025-01-27 10:00", user: "Owner Admin",       role: "owner",       module: "المخزون",   action: "تعديل مخزون يدوي",                ref: "ADJ-001",        prev: "15 KG",         next: "13 KG",          reason: "تلف بضاعة",             risk: "high"   as RiskLevel, status: "success" },
  { dt: "2025-01-26 14:00", user: "Ahmed Accountant",  role: "accountant",  module: "التقارير",  action: "تصدير تقرير الأرباح",              ref: "—",              prev: "—",             next: "—",              reason: "—",                     risk: "medium" as RiskLevel, status: "success" },
  { dt: "2025-01-25 09:00", user: "Owner Admin",       role: "owner",       module: "المستخدمين","action": "تغيير صلاحيات مستخدم",           ref: "u3",             prev: "كاشير",         next: "كاشير + تحصيل", reason: "ضرورة العمل",          risk: "high"   as RiskLevel, status: "success" },
];

const PERM_GROUPS = [
  { key: "dashboard", ar: "لوحة التحكم", en: "Dashboard" },
  { key: "sales",     ar: "المبيعات",    en: "Sales" },
  { key: "purchases", ar: "المشتريات",   en: "Purchases" },
  { key: "inventory", ar: "المخزون",     en: "Inventory" },
  { key: "customers", ar: "العملاء",     en: "Customers" },
  { key: "suppliers", ar: "الموردين",    en: "Suppliers" },
  { key: "expenses",  ar: "المصروفات",   en: "Expenses" },
  { key: "reports",   ar: "التقارير",    en: "Reports" },
  { key: "tax",       ar: "الضريبة",     en: "Tax" },
  { key: "settings",  ar: "الإعدادات",   en: "Settings" },
  { key: "users",     ar: "المستخدمين",  en: "Users" },
  { key: "audit",     ar: "سجل العمليات",en: "Audit Logs" },
];

// Permission defaults per role (simplified)
const ROLE_PERMS: Record<UserRole, Record<string, boolean[]>> = {
  owner:      Object.fromEntries(PERM_GROUPS.map(g => [g.key, [true,true,true,true,true,true]])),
  accountant: { dashboard:[true,false,false,false,false,true], sales:[true,true,true,false,false,true], purchases:[true,true,true,false,false,true], inventory:[true,false,false,false,false,true], customers:[true,true,true,false,false,true], suppliers:[true,true,true,false,false,true], expenses:[true,true,true,false,true,true], reports:[true,false,false,false,false,true], tax:[true,false,false,false,false,true], settings:[true,false,false,false,false,false], users:[false,false,false,false,false,false], audit:[true,false,false,false,false,false] },
  cashier:    { dashboard:[true,false,false,false,false,false], sales:[true,true,false,false,false,false], purchases:[false,false,false,false,false,false], inventory:[true,false,false,false,false,false], customers:[true,false,false,false,false,false], suppliers:[false,false,false,false,false,false], expenses:[false,false,false,false,false,false], reports:[false,false,false,false,false,false], tax:[false,false,false,false,false,false], settings:[false,false,false,false,false,false], users:[false,false,false,false,false,false], audit:[false,false,false,false,false,false] },
};

// ── HELPER BADGES ──────────────────────────────────────────────────────────────
function RoleBadge({ role, lang }: { role: UserRole; lang: Lang }) {
  const cfg = { owner: { bg: "bg-[#0F2C59]", t: "text-white", ar: "مالك / أدمن", en: "Owner/Admin" }, accountant: { bg: "bg-blue-500", t: "text-white", ar: "محاسب", en: "Accountant" }, cashier: { bg: "bg-slate-500", t: "text-white", ar: "كاشير / مبيعات", en: "Cashier/Sales" } }[role];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}
function RiskBadge({ risk, lang }: { risk: RiskLevel; lang: Lang }) {
  const cfg = { high: { bg: "bg-red-100", t: "text-red-700", ar: "عالي", en: "High" }, medium: { bg: "bg-amber-100", t: "text-amber-700", ar: "متوسط", en: "Medium" }, low: { bg: "bg-slate-100", t: "text-slate-600", ar: "منخفض", en: "Low" } }[risk];
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

// ── SENSITIVE ACTION MODAL ─────────────────────────────────────────────────────
export function SensitiveActionModal({ lang, actionAr, actionEn, prevValue, newValue, dangerous = false, onConfirm, onClose }: {
  lang: Lang; actionAr: string; actionEn: string; prevValue?: string; newValue?: string;
  dangerous?: boolean; onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const isRTL = lang === "ar";
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dangerous ? "bg-red-100" : "bg-amber-100"}`}>{dangerous ? <AlertTriangle size={20} className="text-red-500" /> : <Shield size={20} className="text-amber-500" />}</div>
          <div><div className="font-black text-slate-800 text-sm">{isRTL ? actionAr : actionEn}</div><div className="text-xs text-slate-400">{isRTL ? "إجراء حساس — يتطلب سبباً" : "Sensitive action — reason required"}</div></div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 ms-auto"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          {(prevValue || newValue) && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              {prevValue && <div className="flex justify-between text-sm"><span className="text-slate-400 font-semibold">{isRTL ? "القيمة السابقة" : "Previous"}</span><span className="font-mono font-black text-red-500">{prevValue}</span></div>}
              {newValue && <div className="flex justify-between text-sm"><span className="text-slate-400 font-semibold">{isRTL ? "القيمة الجديدة" : "New Value"}</span><span className="font-mono font-black text-emerald-600">{newValue}</span></div>}
            </div>
          )}
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "سبب هذا الإجراء *" : "Reason for this action *"}</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder={isRTL ? "أدخل سبب واضح للإجراء..." : "Enter a clear reason..."} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" />
          </div>
          {dangerous && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 shrink-0 accent-[#0F2C59]" />
              <span className="text-xs font-bold text-slate-700">{isRTL ? "أفهم أن هذا الإجراء سيتم تسجيله في سجل العمليات." : "I understand this action will be recorded in the audit log."}</span>
            </label>
          )}
          <div className="bg-[#0F2C59]/5 rounded-xl p-2.5 flex items-center gap-2"><Lock size={12} className="text-[#0F2C59]/60 shrink-0" /><span className="text-[10px] font-bold text-slate-500">{isRTL ? "سيتم تسجيل هذا الإجراء في سجل العمليات تلقائياً." : "This action will be automatically logged in the audit log."}</span></div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant={dangerous ? "danger" : "primary"} disabled={!reason.trim() || (dangerous && !confirmed)} onClick={() => onConfirm(reason)} className="flex-1 justify-center"><Check size={14} />{isRTL ? "تأكيد" : "Confirm"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: SETTINGS HOME ──────────────────────────────────────────────────────
export function SettingsHomeScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const isOwner = role === "owner";

  const setupItems = [
    { ar: "شعار الشركة",         en: "Company Logo",       done: false },
    { ar: "رقم TRN",             en: "TRN Added",           done: false },
    { ar: "الختم",               en: "Stamp Uploaded",      done: false },
    { ar: "التوقيع",             en: "Signature Uploaded",  done: false },
    { ar: "ترقيم الفواتير",      en: "Invoice Numbering",   done: true  },
    { ar: "المستخدمون",          en: "Users Configured",    done: true  },
    { ar: "إعدادات الضريبة",     en: "VAT Configured",      done: false },
  ];
  const doneCount = setupItems.filter(i => i.done).length;
  const setupPct = Math.round((doneCount / setupItems.length) * 100);

  const settingCards = [
    { icon: Building2,  ar: "بيانات الشركة",           en: "Company Profile",       desc_ar: "الاسم، الشعار، الختم، TRN، العنوان",           nav: "settings-company"          as TenantScreen, warn: !setupItems[1].done || !setupItems[0].done },
    { icon: Users,      ar: "المستخدمين والصلاحيات",   en: "Users & Permissions",   desc_ar: "إدارة المستخدمين وتخصيص الصلاحيات",             nav: "settings-users"            as TenantScreen, warn: false },
    { icon: Tag,        ar: "ترقيم المستندات",          en: "Document Numbering",    desc_ar: "رقم الفاتورة، إيصال التحصيل، سند المصروف",       nav: "settings-numbering"        as TenantScreen, warn: false },
    { icon: Shield,     ar: "الضريبة VAT",              en: "VAT Settings",          desc_ar: "ضريبة القيمة المضافة، معدل الضريبة، TRN الشركة", nav: "settings-vat"              as TenantScreen, warn: true  },
    { icon: Printer,    ar: "قوالب الطباعة",            en: "Print Templates",       desc_ar: "قوالب الفواتير، الإيصالات، كشوف الحسابات",       nav: "settings-print-templates"  as TenantScreen, warn: false },
    { icon: FileText,   ar: "إعدادات الفواتير",         en: "Invoice & Transaction", desc_ar: "قواعد المبيعات، المشتريات، المخزون، العملاء",     nav: "settings-transactions"     as TenantScreen, warn: false },
    { icon: BarChart2,  ar: "إعدادات التقارير",         en: "Reports Settings",      desc_ar: "صلاحيات التقارير، التصدير، تقرير الأرباح",        nav: "reports"                   as TenantScreen, warn: false },
    { icon: AlertTriangle,ar: "الإجراءات الحساسة",      en: "Sensitive Actions",     desc_ar: "قواعد الإجراءات التي تتطلب سبباً وتسجيلاً",      nav: "settings-sensitive-actions"as TenantScreen, warn: false },
    { icon: Eye,        ar: "سجل العمليات",             en: "Audit Log",             desc_ar: "سجل كامل لجميع الإجراءات الحساسة",               nav: "settings-audit"            as TenantScreen, warn: false },
    { icon: Star,       ar: "الباقة والميزات",          en: "Plan & Features",       desc_ar: "الباقة الحالية، حد المستخدمين، الميزات المتاحة",  nav: "settings-plan"             as TenantScreen, warn: false },
    { icon: Lock,       ar: "إعدادات الأمان",           en: "Security Settings",     desc_ar: "كلمة المرور، الجلسات، قفل الحساب",               nav: "settings-security"         as TenantScreen, warn: false },
  ].filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.ar.includes(search) || c.en.toLowerCase().includes(q) || c.desc_ar.includes(search);
  });

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F2C59]">{isRTL ? "الإعدادات" : "Settings"}</h1>
          <p className="text-xs text-slate-400 font-semibold">Prime Fresh Meat LLC</p>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "ابحث في الإعدادات... (VAT، TRN، الختم، الصلاحيات...)" : "Search settings..."}
            className={`w-full py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
        </div>
      </Card>

      {/* Setup completeness */}
      {!search && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "اكتمال إعدادات الشركة" : "Company Setup Completeness"}</h3>
              <p className="text-xs text-slate-400">{doneCount} / {setupItems.length} {isRTL ? "مكتمل" : "completed"}</p>
            </div>
            <span className={`text-2xl font-black font-mono ${setupPct >= 80 ? "text-emerald-600" : setupPct >= 50 ? "text-amber-500" : "text-red-500"}`}>{setupPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 mb-4"><div className={`h-3 rounded-full transition-all ${setupPct >= 80 ? "bg-emerald-500" : setupPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${setupPct}%` }} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {setupItems.map(item => (
              <div key={item.ar} className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {item.done ? <CheckCircle size={12} /> : <AlertTriangle size={12} className="shrink-0" />}
                {isRTL ? item.ar : item.en}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Warnings */}
      {!search && (
        <div className="space-y-2">
          {[
            [isRTL ? "رقم TRN غير موجود — مطلوب لإصدار الفواتير الضريبية" : "TRN missing — required for tax invoices", "settings-vat"],
            [isRTL ? "الختم غير مرفوع — يظهر في الفواتير والوثائق الرسمية" : "Stamp not uploaded — appears on official documents", "settings-company"],
            [isRTL ? "التوقيع غير مرفوع — مطلوب للوثائق الرسمية" : "Signature not uploaded — required for official documents", "settings-company"],
          ].map(([msg, nav]) => (
            <div key={msg as string} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-amber-700 flex-1">{msg}</span>
              <button onClick={() => onNavigate(nav as TenantScreen)} className="text-xs font-black text-amber-700 hover:underline shrink-0">{isRTL ? "إصلاح" : "Fix"}</button>
            </div>
          ))}
        </div>
      )}

      {/* Setting Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingCards.map((c, i) => {
          const Icon = c.icon;
          const accessible = c.nav === "settings-plan" || c.nav === "settings-security" || isOwner || c.nav.includes("reports");
          return (
            <div key={i} onClick={() => accessible && onNavigate(c.nav)}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col transition-all hover:shadow-md ${accessible ? "cursor-pointer hover:border-[#0F2C59]/30 border-slate-200/80" : "border-slate-200/80 opacity-70"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${c.warn ? "bg-amber-100" : "bg-[#0F2C59]/8"}`}>
                  <Icon size={18} className={c.warn ? "text-amber-600" : "text-[#0F2C59]"} />
                </div>
                <div className="flex items-center gap-1.5">
                  {c.warn && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL ? "يحتاج إعداد" : "Needs Setup"}</span>}
                  {!accessible && <Lock size={12} className="text-slate-400" />}
                </div>
              </div>
              <h3 className="font-black text-slate-800 text-sm mb-1">{isRTL ? c.ar : c.en}</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed flex-1">{c.desc_ar}</p>
              <div className="mt-3">
                {accessible
                  ? <span className="text-xs font-bold text-[#0F2C59] flex items-center gap-1">{isRTL ? "فتح" : "Open"}{isRTL ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}</span>
                  : <span className="text-xs text-slate-400 font-semibold">{isRTL ? "يحتاج صلاحية مالك" : "Owner permission required"}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCREEN: COMPANY PROFILE ────────────────────────────────────────────────────
export function CompanyProfileScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canManage = role === "owner" || role === "accountant";
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [trn, setTrn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [license, setLicense] = useState("");
  const [emirate, setEmirate] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    setLoading(true);
    getTenantSettings()
      .then((s) => {
        setNameAr(s.name_ar ?? "");
        setNameEn(s.name_en ?? "");
        setTrn(s.trn ?? "");
        setPhone(s.phone ?? "");
        setEmail(s.email ?? "");
        setLicense(s.trade_license ?? "");
        setEmirate(s.emirate ?? "");
        setAddress(s.address ?? "");
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ بيانات الشركة" : "Company profile saved");
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      await updateCompanySettings({
        name_ar: nameAr,
        name_en: nameEn,
        trn,
        phone,
        email,
        trade_license: license,
        emirate,
        address,
      });
      toast.success(isRTL ? "تم حفظ بيانات الشركة" : "Company profile saved");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && !canManage && role === "cashier") return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error && !nameAr) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <SettingsHeader title="بيانات الشركة" titleEn="Company Profile" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="primary" disabled={saving} onClick={() => void handleSave()}><Check size={15} />{isRTL ? "حفظ التغييرات" : "Save Changes"}</Btn>
      </SettingsHeader>
      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />

      {/* Identity */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "أ. هوية الشركة" : "A. Company Identity"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "اسم الشركة (عربي) *" : "Arabic Name *"} value={nameAr} onChange={setNameAr} required />
          <FInput label={isRTL ? "اسم الشركة (إنجليزي) *" : "English Name *"} value={nameEn} onChange={setNameEn} required />
          <FInput label={isRTL ? "رقم الرخصة التجارية" : "Trade License #"} value={license} onChange={setLicense} />
          <FInput label="TRN" value={trn} onChange={setTrn} placeholder="100XXXXXXXXXXX" error={!trn ? (isRTL ? "TRN مطلوب للفواتير الضريبية" : "TRN required for tax invoices") : undefined} />
          <FSelect label={isRTL ? "الإمارة" : "Emirate"} value={emirate} onChange={setEmirate} options={[{value:"dubai",label:"دبي"},{value:"abudhabi",label:"أبوظبي"},{value:"sharjah",label:"الشارقة"},{value:"ajman",label:"عجمان"},{value:"rak",label:"رأس الخيمة"}]} />
          <FInput label={isRTL ? "الهاتف *" : "Phone *"} type="tel" value={phone} onChange={setPhone} required />
          <FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={email} onChange={setEmail} />
          <div className="sm:col-span-2"><FInput label={isRTL ? "العنوان" : "Address"} value={address} onChange={setAddress} /></div>
        </div>
      </Card>

      {/* Branding */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ب. الشعار والختم" : "B. Branding"}</h3>
        {!IS_MOCK_MODE ? (
          <ApiUnavailableState lang={lang} messageAr="رفع الشعار والختم والتوقيع غير متاح عبر API حالياً" messageEn="Logo, stamp, and signature upload is not available via API yet" />
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            [isRTL ? "شعار الشركة" : "Company Logo", isRTL ? "لم يتم رفع الشعار بعد" : "Logo not uploaded"],
            [isRTL ? "ختم الشركة" : "Company Stamp", isRTL ? "لم يتم رفع الختم بعد" : "Stamp not uploaded"],
            [isRTL ? "التوقيع المعتمد" : "Authorized Signature", isRTL ? "لم يتم رفع التوقيع بعد" : "Signature not uploaded"],
          ].map(([l, p]) => (
            <div key={l} className="border-2 border-dashed border-red-200 rounded-2xl p-5 text-center bg-red-50/50 cursor-pointer hover:border-red-300 transition-all">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2"><Plus size={16} className="text-red-400" /></div>
              <p className="text-xs font-bold text-red-600">{l}</p>
              <p className="text-[9px] text-red-400 mt-0.5">{p}</p>
            </div>
          ))}
        </div>
        )}
        <div className="mt-4 bg-[#0F2C59]/5 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "الشعار والختم والتوقيع يظهرون في الفواتير، الإيصالات، وكشوف الحساب." : "Logo, stamp and signature appear on invoices, receipts and statements."}</p></div>
      </Card>
    </div>
  );
}

// ── SCREEN: USERS LIST ─────────────────────────────────────────────────────────
export function UsersListScreen({ lang, role, onNavigate, setSelectedUserId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void;
  setSelectedUserId: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const isOwner = role === "owner";
  const [liveUsers, setLiveUsers] = useState<{ id: string; name: string; email: string; role: UserRole; active: boolean; lastLogin: string; customPerms: boolean }[]>([]);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    setLoading(true);
    listTenantUsers()
      .then((rows) => setLiveUsers(rows.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: u.role as UserRole,
        active: u.isActive,
        lastLogin: u.dateJoined,
        customPerms: false,
      }))))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const users = IS_MOCK_MODE ? SETTINGS_USERS : liveUsers;
  const userLimit = 50;
  const limitReached = !IS_MOCK_MODE && users.length >= userLimit;

  if (!IS_MOCK_MODE && role === "cashier") return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error && liveUsers.length === 0) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  const handleToggleActive = async (userId: string, active: boolean) => {
    if (IS_MOCK_MODE) return;
    try {
      if (active) await suspendTenantUser(userId);
      else await reactivateTenantUser(userId);
      const rows = await listTenantUsers();
      setLiveUsers(rows.map((u) => ({
        id: u.id, name: u.fullName, email: u.email, role: u.role as UserRole,
        active: u.isActive, lastLogin: u.dateJoined, customPerms: false,
      })));
      toast.success(isRTL ? "تم تحديث حالة المستخدم" : "User status updated");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="المستخدمين" titleEn="Users" onBack={() => onNavigate("settings")} lang={lang}>
        {isOwner
          ? <Btn variant="primary" disabled={limitReached} onClick={() => onNavigate("settings-user-new")}><Plus size={15} />{isRTL ? "إضافة مستخدم" : "Add User"}</Btn>
          : <PermBtn lang={lang}><Plus size={15} />{isRTL ? "إضافة مستخدم" : "Add User"}</PermBtn>}
      </SettingsHeader>

      {/* Plan limit */}
      <Card className={`p-4 ${limitReached ? "border-red-300 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users size={16} className={limitReached ? "text-red-500" : "text-amber-600"} />
            <span className={`font-black text-sm ${limitReached ? "text-red-700" : "text-amber-700"}`}>
              {isRTL ? `الباقة الحالية تسمح بـ ${userLimit} مستخدمين` : `Current plan allows ${userLimit} users`}
            </span>
          </div>
          <span className={`font-mono font-black text-lg ${limitReached ? "text-red-600" : "text-amber-700"}`}>{users.length} / {userLimit}</span>
        </div>
        <div className="w-full bg-white rounded-full h-2 border border-red-200"><div className={`h-2 rounded-full ${limitReached ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, (users.length / userLimit) * 100)}%` }} /></div>
        {limitReached && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs font-bold text-red-700">{isRTL ? "تم الوصول إلى الحد الأقصى للمستخدمين." : "User limit reached for current plan."}</span>
            <button className="text-xs font-black text-[#0F2C59] hover:underline">{isRTL ? "ترقية الباقة" : "Upgrade Plan"}</button>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[[users.length.toString(),"إجمالي المستخدمين","Total Users","bg-[#0F2C59]"],[users.filter(u=>u.active).length.toString(),"المستخدمون النشطون","Active","bg-emerald-500"],[users.filter(u=>u.role==="owner").length.toString(),"مالك / أدمن","Owners","bg-[#0F2C59]"],[users.filter(u=>u.role==="accountant").length.toString(),"محاسبون","Accountants","bg-blue-500"]].map(([v,ar,en,bg],i)=>(
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}><Users size={16} className="text-white" /></div>
            <div><div className="text-2xl font-black text-[#0F2C59] font-mono">{v}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isRTL ? ar : en}</div></div>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card className="hidden lg:block overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"الاسم":"Name",isRTL?"البريد الإلكتروني":"Email",isRTL?"الدور":"Role",isRTL?"الحالة":"Status",isRTL?"آخر دخول":"Last Login",isRTL?"صلاحيات مخصصة":"Custom Perms",isRTL?"إجراءات":"Actions"].map((h,i)=><th key={i} className={`px-4 py-3 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#0F2C59] flex items-center justify-center text-white font-black text-xs shrink-0">{u.name[0]}</div>
                    <div className="font-bold text-slate-800 text-sm">{u.name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} lang={lang} /></td>
                <td className="px-4 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{u.active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{u.lastLogin}</td>
                <td className="px-4 py-3">{u.customPerms ? <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{isRTL ? "مخصصة" : "Custom"}</span> : <span className="text-[10px] text-slate-400 font-semibold">{isRTL ? "افتراضية" : "Default"}</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {isOwner && <button onClick={() => { setSelectedUserId(u.id); onNavigate("settings-user-permissions"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-all" title={isRTL ? "تخصيص الصلاحيات" : "Customize Permissions"}><Shield size={13} /></button>}
                    {isOwner && <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Pencil size={13} /></button>}
                    {isOwner && u.role !== "owner" && <button type="button" aria-label={isRTL ? "تعليق المستخدم" : "Suspend user"} onClick={() => void handleToggleActive(u.id, u.active)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><Lock size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {SETTINGS_USERS.map(u => (
          <Card key={u.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#0F2C59] flex items-center justify-center text-white font-black text-sm shrink-0">{u.name[0]}</div>
                <div><div className="font-bold text-slate-800">{u.name}</div><div className="text-xs text-slate-400 font-mono">{u.email}</div></div>
              </div>
              <RoleBadge role={u.role} lang={lang} />
            </div>
            <div className="flex gap-2">
              {isOwner && <Btn size="sm" variant="outline" onClick={() => { setSelectedUserId(u.id); onNavigate("settings-user-permissions"); }}><Shield size={13} />{isRTL ? "الصلاحيات" : "Permissions"}</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SCREEN: CREATE USER ────────────────────────────────────────────────────────
export function CreateUserScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("cashier");
  const [pass, setPass] = useState(""); const [confirmPass, setConfirmPass] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const limitReached = IS_MOCK_MODE && SETTINGS_USERS.length >= 3;

  const handleCreate = async () => {
    if (!name || !email || !pass || pass !== confirmPass) return;
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم إضافة المستخدم بنجاح" : "User added successfully");
      onNavigate("settings-users");
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      await createTenantUser({
        full_name: name,
        email,
        password: pass,
        role: userRole,
        force_password_change: forceChange,
      });
      toast.success(isRTL ? "تم إضافة المستخدم بنجاح" : "User added successfully");
      onNavigate("settings-users");
    } catch (e) {
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && role !== "owner") return <PermissionDeniedState lang={lang} />;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <SettingsHeader title="إضافة مستخدم جديد" titleEn="Add New User" onBack={() => onNavigate("settings-users")} lang={lang} />

      {limitReached && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-700">{isRTL ? "لا يمكن إضافة مستخدم جديد لأن الباقة الحالية وصلت للحد المسموح." : "Cannot add a new user — current plan user limit reached."}</p>
          <button className="text-xs font-black text-red-700 hover:underline shrink-0 ms-auto">{isRTL ? "ترقية الباقة" : "Upgrade"}</button>
        </div>
      )}

      <FormErrors lang={lang} fieldErrors={fieldErrors} />
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "الاسم الكامل *" : "Full Name *"} value={name} onChange={setName} required />
          <FInput label={isRTL ? "البريد الإلكتروني *" : "Email Address *"} type="email" value={email} onChange={setEmail} required />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "الدور الوظيفي *" : "Role *"}</label>
          <div className="grid grid-cols-3 gap-2">
            {([["owner", isRTL ? "مالك / أدمن" : "Owner/Admin", "bg-[#0F2C59] text-white"], ["accountant", isRTL ? "محاسب" : "Accountant", "bg-blue-500 text-white"], ["cashier", isRTL ? "كاشير / مبيعات" : "Cashier/Sales", "bg-slate-500 text-white"]] as const).map(([v, l, c]) => (
              <button key={v} onClick={() => setUserRole(v)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${userRole === v ? `${c} border-transparent` : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FInput label={isRTL ? "كلمة المرور المؤقتة *" : "Temporary Password *"} type="password" value={pass} onChange={setPass} required />
          <FInput label={isRTL ? "تأكيد كلمة المرور *" : "Confirm Password *"} type="password" value={confirmPass} onChange={setConfirmPass} error={confirmPass && pass !== confirmPass ? (isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match") : undefined} />
        </div>
        <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
          <div><div className="text-sm font-bold text-slate-700">{isRTL ? "إجبار على تغيير كلمة المرور عند أول دخول" : "Force password change on first login"}</div></div>
          <Toggle on={forceChange} onChange={setForceChange} />
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div><div className="text-sm font-bold text-slate-700">{isRTL ? "تخصيص الصلاحيات لهذا المستخدم" : "Customize permissions for this user"}</div><div className="text-xs text-slate-400">{isRTL ? "إذا لم يتم التخصيص سيتم استخدام صلاحيات الدور الافتراضية" : "Default role permissions will be used if not customized"}</div></div>
            <Toggle on={useCustom} onChange={setUseCustom} />
          </div>
          {useCustom && <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2"><Info size={13} className="text-violet-500 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-violet-700">{isRTL ? "يمكن تخصيص الصلاحيات بعد إنشاء المستخدم من صفحة الصلاحيات." : "You can customize permissions after creating the user from the permissions page."}</p></div>}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3 justify-between">
        <Btn variant="outline" onClick={() => onNavigate("settings-users")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <Btn disabled={limitReached || !name || !email || !pass || pass !== confirmPass || saving} onClick={() => void handleCreate()}><Check size={15} />{isRTL ? "إضافة المستخدم" : "Add User"}</Btn>
      </div>
    </div>
  );
}

// ── SCREEN: USER PERMISSIONS ───────────────────────────────────────────────────
export function UserPermissionsScreen({ lang, role, onNavigate, userId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; userId: string;
}) {
  if (!IS_MOCK_MODE) {
    return (
      <LiveUserPermissionsScreen
        lang={lang}
        role={role}
        onNavigate={onNavigate}
        userId={userId}
        Card={Card}
        Btn={Btn}
        SettingsHeader={SettingsHeader}
        Toggle={Toggle}
        RoleBadge={RoleBadge}
        SensitiveActionModal={SensitiveActionModal}
      />
    );
  }
  const isRTL = lang === "ar";
  const u = SETTINGS_USERS.find(x => x.id === userId) || SETTINGS_USERS[1];
  const [useCustom, setUseCustom] = useState(u.customPerms);
  const [perms, setPerms] = useState<Record<string, boolean[]>>(ROLE_PERMS[u.role]);
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>("sales");

  const PERM_LABELS = [isRTL ? "عرض" : "View", isRTL ? "إنشاء" : "Create", isRTL ? "تعديل" : "Edit", isRTL ? "اعتماد" : "Approve", isRTL ? "إلغاء" : "Cancel", isRTL ? "تصدير" : "Export"];

  const togglePerm = (group: string, idx: number) => {
    setPerms(prev => {
      const updated = [...(prev[group] || [false,false,false,false,false,false])];
      updated[idx] = !updated[idx];
      return { ...prev, [group]: updated };
    });
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <SettingsHeader title={`صلاحيات: ${u.name}`} titleEn={`Permissions: ${u.name}`} onBack={() => onNavigate("settings-users")} lang={lang}>
        <Btn variant="primary" onClick={() => setShowSensitiveModal(true)}><Check size={15} />{isRTL ? "حفظ الصلاحيات" : "Save Permissions"}</Btn>
      </SettingsHeader>

      {/* User header */}
      <Card className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#0F2C59] flex items-center justify-center text-white font-black text-lg shrink-0">{u.name[0]}</div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-800">{u.name}</div>
          <div className="text-xs text-slate-400 font-mono">{u.email}</div>
          <RoleBadge role={u.role} lang={lang} />
        </div>
        <div className="text-end">
          <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "تخصيص الصلاحيات" : "Custom Permissions"}</div>
          <Toggle on={useCustom} onChange={setUseCustom} />
        </div>
      </Card>

      {!useCustom ? (
        <Card className="p-8 text-center">
          <Shield size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-600 text-sm">{isRTL ? "يستخدم هذا المستخدم صلاحيات الدور الافتراضية" : "This user uses default role permissions"}</p>
          <p className="text-xs text-slate-400 mt-1">{isRTL ? "فعّل التخصيص لضبط الصلاحيات بشكل منفرد" : "Enable customization to set individual permissions"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "تعديل صلاحيات المستخدم سيتم تسجيله في سجل العمليات." : "Changing user permissions will be recorded in the audit log."}</p></div>
          {PERM_GROUPS.map(group => {
            const groupPerms = perms[group.key] || [false,false,false,false,false,false];
            const open = expandedGroup === group.key;
            return (
              <Card key={group.key} className="overflow-hidden">
                <button onClick={() => setExpandedGroup(open ? null : group.key)} className="w-full flex items-center justify-between px-5 py-3.5 text-start hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 text-sm">{isRTL ? group.ar : group.en}</span>
                    <span className="text-[10px] font-bold text-slate-400">{groupPerms.filter(Boolean).length}/{PERM_LABELS.length}</span>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PERM_LABELS.map((label, idx) => (
                      <label key={label} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 transition-all ${groupPerms[idx] ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100 hover:border-slate-200"}`}>
                        <input type="checkbox" checked={groupPerms[idx]} onChange={() => togglePerm(group.key, idx)} className="accent-[#0F2C59]" />
                        <span className="text-xs font-bold text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showSensitiveModal && <SensitiveActionModal lang={lang} actionAr="تغيير صلاحيات مستخدم" actionEn="Change User Permissions" prevValue={isRTL ? "صلاحيات الدور الافتراضي" : "Default role permissions"} newValue={isRTL ? "صلاحيات مخصصة" : "Custom permissions"} dangerous onConfirm={(reason) => { toast.success(isRTL ? "تم حفظ صلاحيات المستخدم" : "User permissions saved"); setShowSensitiveModal(false); onNavigate("settings-users"); }} onClose={() => setShowSensitiveModal(false)} />}
    </div>
  );
}

// ── SCREEN: ROLE PERMISSIONS OVERVIEW ─────────────────────────────────────────
export function RolePermissionsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const PERM_COLS = [isRTL ? "عرض" : "View", isRTL ? "إنشاء" : "Create", isRTL ? "تعديل" : "Edit", isRTL ? "اعتماد" : "Approve", isRTL ? "إلغاء" : "Cancel", isRTL ? "تصدير" : "Export"];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="الصلاحيات حسب الدور" titleEn="Role Permissions Overview" onBack={() => onNavigate("settings")} lang={lang} />

      <div className="bg-[#0F2C59]/5 rounded-xl px-4 py-3 flex gap-2"><Info size={14} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "يمكن تعديل الصلاحيات لكل مستخدم بشكل منفصل من ملف المستخدم." : "Permissions can be customized per user from the user profile."}</p></div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className={`px-4 py-3 font-black text-xs text-slate-400 w-32 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "القسم" : "Module"}</th>
                {PERM_COLS.map(h => <th key={h} className="px-2 py-3 font-black text-xs text-slate-400 text-center w-16">{h}</th>)}
                <th className="px-2 py-3 font-black text-xs text-blue-500 text-center">{isRTL ? "مالك" : "Owner"}</th>
                <th className="px-2 py-3 font-black text-xs text-blue-500 text-center">{isRTL ? "محاسب" : "Accountant"}</th>
                <th className="px-2 py-3 font-black text-xs text-blue-500 text-center">{isRTL ? "كاشير" : "Cashier"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERM_GROUPS.map(g => (
                <tr key={g.key} className="hover:bg-slate-50/40">
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{isRTL ? g.ar : g.en}</td>
                  {PERM_COLS.map((_, ci) => <td key={ci} className="px-2 py-2.5 text-center"><div className="w-4 h-4 rounded bg-emerald-500 mx-auto flex items-center justify-center"><Check size={10} className="text-white" /></div></td>)}
                  <td className="px-2 py-2.5 text-center"><div className="w-4 h-4 rounded bg-emerald-500 mx-auto flex items-center justify-center"><Check size={10} className="text-white" /></div></td>
                  <td className="px-2 py-2.5 text-center">{(ROLE_PERMS.accountant[g.key] || [])[0] ? <div className="w-4 h-4 rounded bg-emerald-500 mx-auto flex items-center justify-center"><Check size={10} className="text-white" /></div> : <div className="w-4 h-4 rounded bg-slate-200 mx-auto" />}</td>
                  <td className="px-2 py-2.5 text-center">{(ROLE_PERMS.cashier[g.key] || [])[0] ? <div className="w-4 h-4 rounded bg-emerald-500 mx-auto flex items-center justify-center"><Check size={10} className="text-white" /></div> : <div className="w-4 h-4 rounded bg-slate-200 mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: AUDIT LOG ──────────────────────────────────────────────────────────
export function SettingsAuditScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canView = role === "owner" || role === "accountant";
  const [filterUser, setFilterUser] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");

  if (!canView) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]"><div className="text-center"><Lock size={36} className="text-slate-300 mx-auto mb-3" /><p className="font-bold text-slate-500">{isRTL ? "ليس لديك صلاحية عرض سجل العمليات" : "No permission to view audit log"}</p></div></div>
  );

  const filtered = AUDIT_ENTRIES.filter(e => (filterUser === "all" || e.user === filterUser) && (filterRisk === "all" || e.risk === filterRisk));

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="سجل العمليات" titleEn="Audit Log" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="outline" size="sm"><Download size={13} />{isRTL ? "تصدير" : "Export"}</Btn>
      </SettingsHeader>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل المستخدمين" : "All Users"}</option>
            {SETTINGS_USERS.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل المستويات" : "All Risk Levels"}</option>
            <option value="high">{isRTL ? "عالي" : "High"}</option>
            <option value="medium">{isRTL ? "متوسط" : "Medium"}</option>
            <option value="low">{isRTL ? "منخفض" : "Low"}</option>
          </select>
        </div>
      </Card>

      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"التاريخ والوقت":"Date/Time",isRTL?"المستخدم":"User",isRTL?"القسم":"Module",isRTL?"الإجراء":"Action",isRTL?"المرجع":"Ref",isRTL?"قبل":"Before",isRTL?"بعد":"After",isRTL?"السبب":"Reason",isRTL?"المستوى":"Risk",isRTL?"الحالة":"Status"].map((h,i)=><th key={i} className={`px-3 py-3 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{e.dt}</td>
                  <td className="px-3 py-2.5"><div className="font-bold text-slate-800 text-xs">{e.user}</div><RoleBadge role={e.role as UserRole} lang={lang} /></td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-600">{e.module}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800 text-xs">{e.action}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{e.ref}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-red-400">{e.prev}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-emerald-600">{e.next}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{e.reason}</td>
                  <td className="px-3 py-2.5"><RiskBadge risk={e.risk} lang={lang} /></td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{e.status === "success" ? (isRTL ? "ناجح" : "Success") : (isRTL ? "مرفوض" : "Denied")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="lg:hidden space-y-2">
        {filtered.map((e, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div><div className="font-bold text-slate-800 text-sm">{e.action}</div><div className="text-xs text-slate-400">{e.dt} · {e.user} · {e.module}</div></div>
              <div className="flex flex-col items-end gap-1"><RiskBadge risk={e.risk} lang={lang} /><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{e.status === "success" ? (isRTL ? "ناجح" : "✓") : (isRTL ? "مرفوض" : "✗")}</span></div>
            </div>
            {e.prev !== "—" && <div className="flex gap-2 text-xs"><span className="font-mono text-red-400">{e.prev}</span><span className="text-slate-400">→</span><span className="font-mono text-emerald-600">{e.next}</span></div>}
            {e.reason !== "—" && <div className="text-xs text-slate-400 mt-1">{isRTL ? "السبب:" : "Reason:"} {e.reason}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SCREEN: NUMBERING SETTINGS ─────────────────────────────────────────────────
export function NumberingSettingsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canManage = role === "owner" || role === "accountant";
  const [docs, setDocs] = useState(NUMBERING_DOCS.map(d => ({ ...d, apiId: 0 })));
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    setLoading(true);
    listNumberingSettings()
      .then((rows) => {
        if (rows.length === 0) return;
        setDocs(rows.map((r) => ({
          key: r.document_type,
          ar: r.document_type,
          en: r.document_type,
          prefix: r.prefix,
          next: String(r.next_number),
          reset: r.reset_rule,
          preview: `${r.prefix}-${new Date().getFullYear()}-${r.next_number}`,
          apiId: r.id,
        })));
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const updateDoc = (key: string, field: string, val: string) =>
    setDocs((prev) => prev.map((d) => d.key === key ? { ...d, [field]: val, preview: field === "prefix" ? `${val}-2026-${d.next}` : field === "next" ? `${d.prefix}-2026-${val}` : d.preview } : d));

  const handleSave = async () => {
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ إعدادات الترقيم" : "Numbering settings saved");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        docs.filter((d) => d.apiId).map((d) =>
          updateNumberingSettings(d.apiId, {
            prefix: d.prefix,
            next_number: Number(d.next),
            reset_rule: d.reset,
          }),
        ),
      );
      toast.success(isRTL ? "تم حفظ إعدادات الترقيم" : "Numbering settings saved");
    } catch (e) {
      setError(e);
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && !canManage) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error && docs.every((d) => !d.apiId)) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="إعدادات ترقيم المستندات" titleEn="Document Numbering Settings" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="primary" disabled={saving} onClick={() => void handleSave()}><Check size={15} />{isRTL ? "حفظ الإعدادات" : "Save"}</Btn>
      </SettingsHeader>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-700">{isRTL ? "تغيير الترقيم يؤثر على المستندات الجديدة فقط. يتطلب سبباً وسيتم تسجيله." : "Numbering changes affect new documents only. Requires reason and will be logged."}</p></div>

      <div className="space-y-3">
        {docs.map(doc => (
          <Card key={doc.key} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-sm">{isRTL ? doc.ar : doc.en}</h3>
              <div className="font-mono font-black text-[#22C55E] text-base bg-[#22C55E]/10 px-3 py-1 rounded-xl">{doc.preview}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-600">{isRTL ? "البادئة" : "Prefix"}</label><input value={doc.prefix} onChange={e => updateDoc(doc.key, "prefix", e.target.value)} className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm font-mono bg-white outline-none focus:border-[#0F2C59] text-center" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-600">{isRTL ? "الرقم التالي" : "Next Number"}</label><input value={doc.next} onChange={e => updateDoc(doc.key, "next", e.target.value)} className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm font-mono bg-white outline-none focus:border-[#0F2C59] text-center" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-600">{isRTL ? "إعادة الترقيم" : "Reset Rule"}</label><select value={doc.reset} onChange={e => updateDoc(doc.key, "reset", e.target.value)} className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none"><option value="none">{isRTL ? "لا يتم" : "No reset"}</option><option value="yearly">{isRTL ? "سنوياً" : "Yearly"}</option><option value="monthly">{isRTL ? "شهرياً" : "Monthly"}</option></select></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-600">{isRTL ? "معاينة" : "Preview"}</label><div className="px-2.5 py-2 rounded-lg bg-[#0F2C59]/5 border border-[#0F2C59]/20 text-sm font-mono font-black text-[#0F2C59] text-center">{doc.preview}</div></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SCREEN: VAT SETTINGS ───────────────────────────────────────────────────────
export function VATSettingsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canManage = role === "owner" || role === "accountant";
  const [vatEnabled, setVatEnabled] = useState(true);
  const [rate, setRate] = useState("5");
  const [allowDisableSales, setAllowDisableSales] = useState(true);
  const [warnCustomerTrn, setWarnCustomerTrn] = useState(true);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const previewSubtotal = IS_MOCK_MODE ? 3305.55 : 1000;
  const vatAmt = (previewSubtotal * parseFloat(rate || "0") / 100).toFixed(2);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    setLoading(true);
    getVatSettings()
      .then((s) => {
        setVatEnabled(s.vat_enabled_default);
        setRate(String(s.default_vat_rate ?? "5"));
        setAllowDisableSales(s.allow_vat_disable_sales ?? true);
        setWarnCustomerTrn(s.warn_missing_customer_trn ?? true);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم حفظ إعدادات الضريبة" : "VAT settings saved");
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      await updateVatSettings({
        vat_enabled_default: vatEnabled,
        default_vat_rate: rate,
        allow_vat_disable_sales: allowDisableSales,
        warn_missing_customer_trn: warnCustomerTrn,
      });
      toast.success(isRTL ? "تم حفظ إعدادات الضريبة" : "VAT settings saved");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!IS_MOCK_MODE && !canManage) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error && rate === "5" && !IS_MOCK_MODE) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <SettingsHeader title="إعدادات الضريبة VAT" titleEn="VAT Settings" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="primary" disabled={saving} onClick={() => void handleSave()}><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>
      </SettingsHeader>
      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />

      <Card className="p-5 space-y-4">
        {[
          [vatEnabled, setVatEnabled, isRTL ? "تفعيل الضريبة على القيمة المضافة بشكل افتراضي" : "Enable VAT by default", false],
          [allowDisableSales, setAllowDisableSales, isRTL ? "السماح بإيقاف الضريبة على فاتورة بيع (يتطلب سبباً)" : "Allow disabling VAT on sales invoice (requires reason)", false],
          [warnCustomerTrn, setWarnCustomerTrn, isRTL ? "إظهار تحذيرات TRN العميل المفقود" : "Show missing customer TRN warnings", false],
        ].map(([val, setter, label, locked]: [boolean, (v: boolean) => void, string, boolean]) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm font-bold text-slate-700">{label}</span>
            <Toggle on={val} onChange={setter} disabled={locked} />
          </div>
        ))}
        <div className="pt-2">
          <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "معدل الضريبة الافتراضي" : "Default VAT Rate"}</label>
          <div className="flex items-center gap-3">
            <input type="number" value={rate} onChange={e => setRate(e.target.value)} className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-center bg-white outline-none focus:border-[#0F2C59]" aria-label={isRTL ? "معدل الضريبة" : "VAT rate"} />
            <span className="font-black text-[#0F2C59] text-lg">%</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-3 text-sm">{isRTL ? "معاينة حساب الضريبة (مثال)" : "VAT calculation preview (sample)"}</h3>
        <div className="space-y-2">
          {[[isRTL ? "المبلغ الخاضع للضريبة" : "Taxable Amount", `AED ${previewSubtotal.toLocaleString()}`, "text-slate-700"], [isRTL ? `ضريبة القيمة المضافة ${rate}%` : `VAT ${rate}%`, `AED ${vatAmt}`, "text-[#0F2C59]"], [isRTL ? "الإجمالي الشامل للضريبة" : "Total incl. VAT", `AED ${(previewSubtotal + parseFloat(vatAmt)).toFixed(2)}`, "text-emerald-600 font-black text-lg"]].map(([l, v, c]) => (
            <div key={l as string} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 text-sm"><span className="text-slate-600 font-semibold">{l}</span><span className={`font-mono font-bold ${c}`}>{v}</span></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: SENSITIVE ACTIONS ──────────────────────────────────────────────────
export function SensitiveActionsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [actions, setActions] = useState(SENSITIVE_ACTIONS.map(a => ({ ...a })));

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="قواعد الإجراءات الحساسة" titleEn="Sensitive Action Rules" onBack={() => onNavigate("settings")} lang={lang} />

      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Lock size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "لا يمكن إيقاف سجل العمليات للإجراءات الحساسة. يتم تسجيل كل إجراء تلقائياً." : "Audit logging cannot be disabled for sensitive actions. All actions are automatically logged."}</p></div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL?"الإجراء":"Action",isRTL?"القسم":"Module",isRTL?"مستوى الخطورة":"Risk Level",isRTL?"يتطلب سبباً":"Reason Req.",isRTL?"سجل العمليات":"Audit Log"].map((h,i)=><th key={i} className={`px-4 py-3 font-black text-xs text-slate-400 ${isRTL?"text-right":"text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {actions.map((a, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold text-slate-800 text-sm">{isRTL ? a.ar : a.en}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{a.module(isRTL)}</td>
                  <td className="px-4 py-3"><RiskBadge risk={a.risk} lang={lang} /></td>
                  <td className="px-4 py-3"><Toggle on={a.requireReason} onChange={v => setActions(prev => prev.map((x, j) => j === i ? { ...x, requireReason: v } : x))} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-9 h-5 rounded-full bg-emerald-500 flex items-center cursor-not-allowed"><span className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-4 mx-0.5" /></div>
                      <Lock size={11} className="text-slate-400" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: TRANSACTION SETTINGS ───────────────────────────────────────────────
export function TransactionSettingsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [settings, setSettings] = useState({
    allowSalesDraft: true, allowPriceEdit: false, allowKGOverride: false, reqCancelReason: true,
    allowFreeProduct: false, allowCollectionDiscount: true, reqDiscountReason: true,
    allowPurchaseDraft: true, allowPurchasePriceEdit: false, reqPurchaseCancelReason: true,
    allowManualStock: true, lowStockAlerts: true, blockCreditExceed: true, allowCreditOverride: true,
    reqCreditOverrideReason: true, enableSpecialPrices: true, enableFreeProducts: true,
    trackSupplierBalance: true, enableSupplierPrices: true,
  });
  const tog = (k: keyof typeof settings) => setSettings(p => ({ ...p, [k]: !p[k] }));

  const GROUPS = [
    { title: isRTL ? "إعدادات المبيعات" : "Sales Settings", items: [
      ["allowSalesDraft", isRTL ? "السماح بحفظ المسودة" : "Allow save draft", false],
      ["allowPriceEdit", isRTL ? "السماح بتعديل السعر (بإذن)" : "Allow price edit (by permission)", false],
      ["allowKGOverride", isRTL ? "السماح بتعديل الكيلو يدوياً (بإذن)" : "Allow KG override (by permission)", false],
      ["allowCollectionDiscount", isRTL ? "السماح بخصم عند التحصيل" : "Allow collection discount", false],
      ["reqDiscountReason", isRTL ? "طلب سبب لخصم التحصيل" : "Require reason for collection discount", false],
      ["reqCancelReason", isRTL ? "طلب سبب لإلغاء الفاتورة" : "Require reason for invoice cancellation", false],
    ]},
    { title: isRTL ? "إعدادات المشتريات" : "Purchase Settings", items: [
      ["allowPurchaseDraft", isRTL ? "السماح بحفظ مسودة الشراء" : "Allow purchase draft", false],
      ["allowPurchasePriceEdit", isRTL ? "السماح بتعديل سعر الشراء (بإذن)" : "Allow purchase price edit (by permission)", false],
      ["reqPurchaseCancelReason", isRTL ? "طلب سبب لإلغاء فاتورة الشراء" : "Require reason for purchase cancellation", false],
    ]},
    { title: isRTL ? "إعدادات المخزون" : "Inventory Settings", items: [
      ["allowManualStock", isRTL ? "السماح بالتعديل اليدوي للمخزون" : "Allow manual stock adjustment", false],
      ["lowStockAlerts", isRTL ? "تنبيهات المخزون المنخفض" : "Low stock alerts", false],
    ]},
    { title: isRTL ? "إعدادات العملاء" : "Customer Settings", items: [
      ["blockCreditExceed", isRTL ? "منع الفواتير عند تجاوز الحد الائتماني" : "Block invoices when credit exceeded", false],
      ["allowCreditOverride", isRTL ? "السماح للمالك برفع الحد الائتماني فوراً" : "Allow admin credit override", false],
      ["reqCreditOverrideReason", isRTL ? "طلب سبب لرفع الحد الائتماني" : "Require reason for credit override", false],
      ["enableSpecialPrices", isRTL ? "تفعيل أسعار خاصة للعملاء" : "Enable customer special prices", false],
      ["enableFreeProducts", isRTL ? "تفعيل منتجات مجانية للعملاء" : "Enable free products for customers", false],
    ]},
  ];

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <SettingsHeader title="إعدادات الفواتير والمعاملات" titleEn="Invoice & Transaction Settings" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="primary" onClick={() => toast.success(isRTL ? "تم حفظ الإعدادات" : "Settings saved")}><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>
      </SettingsHeader>

      {/* Locked settings notice */}
      <Card className="p-4 bg-slate-50">
        <div className="flex items-center gap-2 mb-2"><Lock size={14} className="text-slate-500" /><span className="text-sm font-black text-slate-600">{isRTL ? "إعدادات مثبّتة لا يمكن تغييرها" : "Locked settings (cannot be changed)"}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[[isRTL ? "خصم المخزون عند الاعتماد فقط" : "Stock deduction on approval only"], [isRTL ? "المخزون السلبي معطل" : "Negative stock disabled"], [isRTL ? "طريقة التكلفة: FIFO مثبّتة" : "Costing method: FIFO locked"]].map(([l]) => (
            <div key={l} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200">
              <div className="w-4 h-4 rounded bg-slate-300 flex items-center justify-center"><Lock size={9} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-500">{l}</span>
            </div>
          ))}
        </div>
      </Card>

      {GROUPS.map(group => (
        <Card key={group.title} className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{group.title}</h3>
          <div className="space-y-1">
            {group.items.map(([k, l, locked]: any) => (
              <div key={k} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm font-bold text-slate-700">{l}</span>
                <Toggle on={(settings as any)[k]} onChange={() => !locked && tog(k as keyof typeof settings)} disabled={locked} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── SCREEN: PLAN & FEATURES ────────────────────────────────────────────────────
export function PlanFeaturesScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const plan = { name: "Basic", nameAr: "الأساسية", status: "active", renewal: "30/09/2026", userLimit: 3, usersUsed: 3 };

  const features = [
    { ar: "حد المستخدمين",        en: "User Limit",            basic: `${plan.userLimit}`,  pro: "15",  enterprise: "∞",   included: true },
    { ar: "إرسال الفواتير واتساب",en: "WhatsApp Invoices",     basic: "🔒", pro: "✓", enterprise: "✓", included: false },
    { ar: "إرسال كشف الحساب",     en: "Statement WhatsApp",    basic: "🔒", pro: "✓", enterprise: "✓", included: false },
    { ar: "تذكير بالدفع",         en: "Payment Reminders",     basic: "🔒", pro: "✓", enterprise: "✓", included: false },
    { ar: "تقارير متقدمة",        en: "Advanced Reports",      basic: "✓",  pro: "✓", enterprise: "✓", included: true  },
    { ar: "تقرير الأرباح",        en: "Profit Report",         basic: "✓",  pro: "✓", enterprise: "✓", included: true  },
    { ar: "التقرير المخصص",       en: "Custom Report Builder", basic: "✓",  pro: "✓", enterprise: "✓", included: true  },
    { ar: "فروع متعددة",          en: "Multi-Branch",          basic: "🔒", pro: "🔒", enterprise: "✓", included: false },
    { ar: "API Access",            en: "API Access",            basic: "🔒", pro: "🔒", enterprise: "✓", included: false },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="الباقة والميزات" titleEn="Plan & Features" onBack={() => onNavigate("settings")} lang={lang} />

      {/* Current plan */}
      <Card className="p-6 bg-[#0F2C59] text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-black text-white/60 uppercase tracking-widest mb-1">{isRTL ? "الباقة الحالية" : "Current Plan"}</div>
            <div className="text-3xl font-black">{isRTL ? plan.nameAr : plan.name}</div>
            <div className="text-white/70 text-sm mt-1">{isRTL ? `التجديد: ${plan.renewal}` : `Renewal: ${plan.renewal}`}</div>
          </div>
          <div className="text-end">
            <div className="text-xs font-black text-white/60 mb-1">{isRTL ? "المستخدمون" : "Users"}</div>
            <div className={`text-3xl font-black font-mono ${plan.usersUsed >= plan.userLimit ? "text-red-400" : "text-[#22C55E]"}`}>{plan.usersUsed} / {plan.userLimit}</div>
            {plan.usersUsed >= plan.userLimit && <div className="text-red-400 text-xs font-bold mt-0.5">{isRTL ? "وصل للحد الأقصى" : "Limit reached"}</div>}
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="px-4 py-2 bg-[#22C55E] text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all">{isRTL ? "ترقية الباقة" : "Upgrade Plan"}</button>
          <button className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-bold hover:bg-white/20 transition-all">{isRTL ? "تواصل مع الدعم" : "Contact Support"}</button>
        </div>
      </Card>

      {/* Feature comparison table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "مقارنة الميزات" : "Feature Comparison"}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200"><th className={`px-4 py-3 font-black text-xs text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الميزة" : "Feature"}</th><th className="px-4 py-3 text-center font-black text-xs text-slate-400">Basic</th><th className="px-4 py-3 text-center font-black text-xs text-blue-600">Pro</th><th className="px-4 py-3 text-center font-black text-xs text-violet-600">Enterprise</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {features.map((f, i) => (
                <tr key={i} className={`hover:bg-slate-50/60 ${!f.included ? "bg-slate-50/30" : ""}`}>
                  <td className="px-4 py-3 font-bold text-slate-800 text-sm">
                    {isRTL ? f.ar : f.en}
                    {!f.included && <span className="ms-2 text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL ? "ميزة متقدمة" : "Premium"}</span>}
                  </td>
                  {[f.basic, f.pro, f.enterprise].map((v, ci) => (
                    <td key={ci} className="px-4 py-3 text-center"><span className={`text-sm font-bold ${v === "✓" ? "text-emerald-600" : v === "🔒" ? "text-slate-400" : v === "∞" ? "text-violet-600 text-xl" : "text-[#0F2C59]"}`}>{v}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PRINT TEMPLATE SETTINGS ────────────────────────────────────────────
export function PrintTemplatesScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const canManage = role === "owner" || role === "accountant";
  const [templates, setTemplates] = useState<import("@/services/settingsService").PrintTemplateSettingsRow[]>([]);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    setLoading(true);
    listPrintTemplateSettings()
      .then(setTemplates)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const patchTemplate = (id: number, field: string, value: boolean | string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const saveTemplate = async (t: import("@/services/settingsService").PrintTemplateSettingsRow) => {
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم الحفظ" : "Saved");
      return;
    }
    setSavingId(t.id);
    try {
      await updatePrintTemplateSettings(t.id, {
        show_logo: t.show_logo,
        show_stamp: t.show_stamp,
        show_signature: t.show_signature,
        show_trn: t.show_trn,
        show_arabic_labels: t.show_arabic_labels,
        show_english_labels: t.show_english_labels,
        footer_notes: t.footer_notes ?? "",
      });
      toast.success(isRTL ? "تم حفظ قالب الطباعة" : "Print template saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  if (!IS_MOCK_MODE && !canManage) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (!IS_MOCK_MODE && error && templates.length === 0) return <ErrorState lang={lang} error={error} onRetry={() => window.location.reload()} />;
  if (!IS_MOCK_MODE && templates.length === 0) return <EmptyState lang={lang} messageAr="لا توجد قوالب طباعة" messageEn="No print templates configured" />;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <SettingsHeader title="قوالب الطباعة" titleEn="Print Templates" onBack={() => onNavigate("settings")} lang={lang} />
      {templates.map((t) => (
        <Card key={t.id} className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800">{t.template_type}</h3>
            <Btn size="sm" disabled={savingId === t.id} onClick={() => void saveTemplate(t)}><Check size={13} />{isRTL ? "حفظ" : "Save"}</Btn>
          </div>
          {[
            ["show_logo", isRTL ? "إظهار الشعار" : "Show logo"],
            ["show_stamp", isRTL ? "إظهار الختم" : "Show stamp"],
            ["show_signature", isRTL ? "إظهار التوقيع" : "Show signature"],
            ["show_trn", isRTL ? "إظهار TRN" : "Show TRN"],
            ["show_arabic_labels", isRTL ? "تسميات عربية" : "Arabic labels"],
            ["show_english_labels", isRTL ? "تسميات إنجليزية" : "English labels"],
          ].map(([field, label]) => (
            <div key={field} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm font-bold text-slate-700">{label}</span>
              <Toggle on={Boolean(t[field as keyof typeof t])} onChange={(v) => patchTemplate(t.id, field, v)} />
            </div>
          ))}
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">{isRTL ? "نص التذييل" : "Footer notes"}</label>
            <textarea value={t.footer_notes ?? ""} onChange={(e) => patchTemplate(t.id, "footer_notes", e.target.value)} className="w-full rounded-xl border p-3 text-sm min-h-[72px]" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── SCREEN: SECURITY SETTINGS ──────────────────────────────────────────────────
export function SecuritySettingsScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [strongPass, setStrongPass] = useState(true);
  const [minLength, setMinLength] = useState("8");
  const [forceFirst, setForceFirst] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [lockAfterFails, setLockAfterFails] = useState(true);
  const [failAttempts, setFailAttempts] = useState("5");

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5">
      <SettingsHeader title="إعدادات الأمان" titleEn="Security Settings" onBack={() => onNavigate("settings")} lang={lang}>
        <Btn variant="primary" onClick={() => toast.success(isRTL ? "تم حفظ إعدادات الأمان" : "Security settings saved")}><Check size={15} />{isRTL ? "حفظ" : "Save"}</Btn>
      </SettingsHeader>

      <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex gap-2"><Info size={13} className="text-[#0F2C59]/60 shrink-0 mt-0.5" /><p className="text-xs font-semibold text-slate-500">{isRTL ? "تسجيل الدخول عبر البريد الإلكتروني وكلمة المرور فقط. لا يتوفر تسجيل دخول عبر الهاتف." : "Login via email and password only. Phone login is not available."}</p></div>

      <Card className="p-5 space-y-4">
        {[
          [strongPass, setStrongPass, isRTL ? "اشتراط كلمة مرور قوية" : "Require strong password", false],
          [forceFirst, setForceFirst, isRTL ? "إجبار تغيير كلمة المرور عند أول دخول" : "Force password change on first login", false],
          [lockAfterFails, setLockAfterFails, isRTL ? "قفل الحساب بعد محاولات فاشلة" : "Lock account after failed attempts", false],
        ].map(([val, setter, label, locked]: any) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm font-bold text-slate-700">{label}</span>
            <Toggle on={val} onChange={setter} disabled={locked} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">{isRTL ? "الحد الأدنى لطول كلمة المرور" : "Min Password Length"}</label><input type="number" value={minLength} onChange={e => setMinLength(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono bg-white outline-none focus:border-[#0F2C59] text-center" /></div>
          <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">{isRTL ? "مهلة الجلسة (دقيقة)" : "Session Timeout (min)"}</label><input type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono bg-white outline-none focus:border-[#0F2C59] text-center" /></div>
          {lockAfterFails && <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">{isRTL ? "عدد المحاولات الفاشلة قبل القفل" : "Failed Attempts Before Lock"}</label><input type="number" value={failAttempts} onChange={e => setFailAttempts(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono bg-white outline-none focus:border-[#0F2C59] text-center" /></div>}
        </div>
      </Card>

      {/* Active sessions */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "آخر تسجيلات الدخول" : "Recent Logins"}</h3>
        {SETTINGS_USERS.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <div><div className="font-bold text-slate-800 text-sm">{u.name}</div><div className="text-xs text-slate-400 font-mono">{u.lastLogin}</div></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "نشط" : "Active"}</span>
              {role === "owner" && <button className="text-xs font-black text-red-500 hover:underline">{isRTL ? "تسجيل خروج" : "Sign out"}</button>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
