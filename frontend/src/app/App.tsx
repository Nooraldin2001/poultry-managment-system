import { useState, useEffect } from "react";
import type { ReactNode, ElementType } from "react";
import {
  LayoutDashboard, Building2, CreditCard, AlertCircle,
  Package, ClipboardList, Settings, Menu, X,
  Plus, Search, Eye, Pencil, Ban, RefreshCw,
  Users, TrendingUp, Calendar, LogOut, Globe,
  Check, ChevronRight, ChevronLeft,
  ExternalLink, DollarSign, Clock,
  CheckCircle, XCircle, AlertTriangle, Info,
  Download, Layers, Star, Crown, Zap, Bell, Lock,
  ShoppingCart, Truck, Receipt, FileText, BookOpen,
  Calculator, Tag, Printer, Wallet,
  BarChart2, ArrowUpRight, ArrowDownRight,
  UserPlus, ChevronDown, Activity, Shield,
  TrendingDown, Scale, Hash, Mail, Terminal
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, Legend
} from "recharts";
import { toast, Toaster } from "sonner";

// ── SHARED TYPES, NAVIGATION & MOCK DATA (extracted — see src/shared, src/app/navigation, src/data) ──
import type {
  Lang, AppMode, TenantRole, TenantScreen, SuperAdminScreen as Screen,
  Company, CompanyStatus, CompanyPlan,
  SProduct, SInvLine, SInvStatus, SInvoice,
  CurrentUser,
} from "@/shared/types";
import { LoadingState, ErrorState, EmptyState, PermissionDeniedState } from "@/shared/components/ApiStates";
import { useAuth } from "@/state/authStore";
import { useAdminCompanies } from "@/hooks/useAdminCompanies";
import { useTenantDashboard, dashboardDateRange } from "@/hooks/useTenantDashboard";
import { useSales, useSaleDetail } from "@/hooks/api/useTenantResources";
import { parseAmount } from "@/services/reportsService";
import { resolveTenantCompany, mapBackendRole } from "@/services/tenantService";
import { buildAdminDashboardSummary, createCompany, createCompanyAdminUser, getCompanyById, listPlans } from "@/services/adminService";
import { getAppHostKind, getTenantSubdomainFromHost, getTenantUrl } from "@/services/tenantUrl";
import { ApiError } from "@/services/api/errors";
import { T_NAV } from "@/app/navigation/tenantNavigation";
import { getFilteredTenantNav, canViewScreen } from "@/app/navigation/permissions";
import { ScreenGuard } from "@/shared/components/ScreenGuard";
import { SA_NAV } from "@/app/navigation/superAdminNavigation";
import { TENANT_TITLES, SUPER_ADMIN_TITLES } from "@/app/navigation/screenTitles";
import { ComingSoonPlaceholder } from "@/shared/components/ComingSoonPlaceholder";
import { ProductionEmptyState, EMPTY_MESSAGES } from "@/shared/components/ProductionEmptyState";
import { IS_MOCK_MODE } from "@/services/config";
import { LiveDocumentReadOnly } from "@/features/documents/LiveDocumentReadOnly";
import { LiveSalesInvoiceScreen } from "@/features/invoices/LiveSalesInvoiceScreen";
import { getSalesPrintPreview, getSalesDetail, approveSale, cancelSale } from "@/services/salesService";
import { LivePrintPreviewScreen } from "@/features/print/LivePrintPreviewScreen";
import { getPurchasePrintPreview } from "@/services/purchaseService";
import {
  ALL_MODULES, COMPANIES, REVENUE_DATA, STATUS_PIE, PAYMENTS_DATA, AUDIT_LOGS, PLANS_DATA, RECENT_ACTIVITY,
  T_PRODUCTS, T_CUSTOMERS, T_SUPPLIERS, T_INVOICES, T_PURCHASES, T_DAILY, T_MONTHLY_PROFIT, T_PAY_PIE, T_NOTIFS,
  S_PRODUCTS, S_CUSTOMERS, S_INVOICES,
} from "@/data/mock";

// Demo-number gate: inline hardcoded sample numbers must render as 0 / empty in
// production (live) mode so the UI never shows fake financial values. In mock
// mode (dev) they keep their illustrative sample values.
const demoNum = (n: number): number => (IS_MOCK_MODE ? n : 0);
// Demo-string gate: inline hardcoded sample text (fake company name, TRN, address,
// phone in settings/invoice-template previews) renders as a neutral fallback in
// production so no fake business identity is shown as real.
const demoStr = (s: string, fallback = ""): string => (IS_MOCK_MODE ? s : fallback);

function openTenantWorkspace(subdomain: string): void {
  window.open(getTenantUrl(subdomain), "_blank", "noopener,noreferrer");
}

function formatTenantHost(subdomain: string): string {
  return getTenantUrl(subdomain).replace(/^https:\/\//, "");
}

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────────
function StatusBadge({ status, lang }: { status: CompanyStatus; lang: Lang }) {
  const cfg = {
    active:    { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", ar: "نشط",    en: "Active" },
    trial:     { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500",   ar: "تجريبي", en: "Trial" },
    suspended: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500",     ar: "موقوف",  en: "Suspended" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {lang === "ar" ? cfg.ar : cfg.en}
    </span>
  );
}

function PlanBadge({ plan, lang }: { plan: CompanyPlan; lang: Lang }) {
  const cfg = {
    basic:      { bg: "bg-slate-100",  text: "text-slate-700",  ar: "أساسية",  en: "Basic" },
    pro:        { bg: "bg-blue-50",    text: "text-blue-700",   ar: "احترافية", en: "Pro" },
    enterprise: { bg: "bg-purple-50", text: "text-purple-700", ar: "مؤسسية",  en: "Enterprise" },
  }[plan];
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

function PaymentBadge({ outstanding, renewalDate, lang }: { outstanding: number; renewalDate: string; lang: Lang }) {
  if (outstanding === 0)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700"><CheckCircle size={11} />{lang === "ar" ? "مدفوع" : "Paid"}</span>;
  return new Date(renewalDate) < new Date()
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700"><AlertCircle size={11} />{lang === "ar" ? "متأخر" : "Overdue"}</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700"><Clock size={11} />{lang === "ar" ? "معلق" : "Pending"}</span>;
}

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

function FInput({ label, placeholder, type = "text", value, onChange, helper, error, required = false }: {
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; helper?: string; error?: string; required?: boolean;
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

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>;
}

function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = false }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${danger ? "bg-red-100" : "bg-[#0F2C59]/10"}`}>
          {danger ? <AlertTriangle size={22} className="text-red-500" /> : <Info size={22} className="text-[#0F2C59]" />}
        </div>
        <h3 className="text-lg font-black text-slate-800 text-center mb-2">{title}</h3>
        <p className="text-slate-500 text-sm text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <Btn variant="outline" onClick={onCancel} className="flex-1 justify-center">إلغاء</Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm} className="flex-1 justify-center">تأكيد</Btn>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ screen, onNavigate, lang, isOpen, onClose, onSwitchToTenant, userName, onLogout }: {
  screen: Screen; onNavigate: (s: Screen) => void; lang: Lang;
  isOpen: boolean; onClose: () => void; onSwitchToTenant?: () => void;
  userName?: string; onLogout?: () => void;
}) {
  const isRTL = lang === "ar";
  const isCompanyRelated = screen === "company-detail" || screen === "create-company";
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 h-full w-72 z-40 flex flex-col transition-transform duration-300 bg-[#0F2C59] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isRTL ? "right-0" : "left-0"} ${isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#22C55E] rounded-2xl flex items-center justify-center shadow-lg"><span className="text-white font-black text-sm">PH</span></div>
            <div>
              <div className="text-white font-black text-base">Poultry Hero</div>
              <div className="text-white/40 text-xs font-medium">{isRTL ? "لوحة السوبر أدمن" : "Super Admin Panel"}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {SA_NAV.map(item => {
            const Icon = item.icon;
            const active = screen === item.key || (isCompanyRelated && item.key === "companies");
            return (
              <button key={item.key} onClick={() => { onNavigate(item.key as Screen); onClose(); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all text-start ${active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/8 hover:text-white"}`}>
                <Icon size={17} className="shrink-0" />
                <span className="flex-1">{isRTL ? item.ar : item.en}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-[#22C55E] flex items-center justify-center text-white font-black text-sm shrink-0">
              {(userName || "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-bold truncate">{userName || (isRTL ? "مستخدم" : "User")}</div>
              <div className="text-white/40 text-xs">Super Admin</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onLogout?.()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/8 text-sm font-semibold transition-all"
          >
            <LogOut size={15} />{isRTL ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </aside>
    </>
  );
}

function TopBar({ title, titleEn, onMenuClick, lang, onLangSwitch }: {
  title: string; titleEn: string; onMenuClick: () => void; lang: Lang; onLangSwitch: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center gap-4">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"><Menu size={20} /></button>
      <h1 className="flex-1 text-lg font-black text-[#0F2C59] truncate">{lang === "ar" ? title : titleEn}</h1>
      <div className="flex items-center gap-2">
        <button onClick={onLangSwitch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          <Globe size={14} />{lang === "ar" ? "English" : "عربي"}
        </button>
        <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
        </button>
      </div>
    </header>
  );
}

// ── SCREEN: LOGIN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, lang, onLangSwitch }: { onLogin: (user: CurrentUser) => void; lang: Lang; onLangSwitch: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRTL = lang === "ar";
  const hostKind = getAppHostKind();
  const isTenantLogin = hostKind === "tenant";
  const tenantSub = getTenantSubdomainFromHost();
  const handleSubmit = async () => {
    if (!email || !password) {
      toast.error(isRTL ? "يرجى إدخال البريد وكلمة المرور" : "Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      onLogin(user);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isRTL
            ? "بيانات الدخول غير صحيحة"
            : "Invalid credentials";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen flex" dir={isRTL ? "rtl" : "ltr"}>
      <div className="hidden lg:flex w-1/2 bg-[#0F2C59] flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/[0.04]" />
          <div className="absolute -bottom-10 -right-16 w-64 h-64 rounded-full bg-white/[0.04]" />
        </div>
        <div className="relative text-center">
          <div className="w-24 h-24 bg-[#22C55E] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-black/40"><span className="text-white font-black text-3xl">PH</span></div>
          <h1 className="text-5xl font-black text-white mb-3">Poultry Hero</h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-xs mx-auto">{isRTL ? "منصة إدارة شركات الدواجن في الإمارات" : "UAE Poultry Companies Management Platform"}</p>
          <div className="mt-12 grid grid-cols-3 gap-3">
            {[{ n: "ERP", ar: "نظام متكامل", en: "Integrated" }, { n: "AED", ar: "محاسبة", en: "Accounting" }, { n: "SaaS", ar: "متعدد الشركات", en: "Multi-tenant" }].map(s => (
              <div key={s.n} className="bg-white/8 rounded-2xl p-4 text-center border border-white/10">
                <div className="text-2xl font-black text-[#22C55E] mb-1">{s.n}</div>
                <div className="text-white/50 text-xs font-semibold">{isRTL ? s.ar : s.en}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-16 bg-[#F8FAFC]">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-10">
            <div className="w-16 h-16 bg-[#0F2C59] rounded-2xl flex items-center justify-center mx-auto mb-3"><span className="text-white font-black text-xl">PH</span></div>
            <h1 className="text-2xl font-black text-[#0F2C59]">Poultry Hero</h1>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-black text-[#0F2C59] mb-1">{isRTL ? "لوحة تحكم Poultry Hero" : "Poultry Hero Control Panel"}</h2>
            <p className="text-slate-400 font-semibold">
              {isTenantLogin
                ? (isRTL ? `تسجيل الدخول — ${tenantSub ?? "الشركة"}` : `Company Sign In — ${tenantSub ?? "workspace"}`)
                : (isRTL ? "تسجيل الدخول للسوبر أدمن" : "Super Admin Sign In")}
            </p>
          </div>
          <div className="space-y-4">
            <FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" placeholder="admin@poultryhero.com" value={email} onChange={setEmail} required />
            <FInput label={isRTL ? "كلمة المرور" : "Password"} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
            <div className={`flex ${isRTL ? "justify-start" : "justify-end"}`}>
              <button className="text-sm text-[#0F2C59] font-bold hover:underline">{isRTL ? "نسيت كلمة المرور؟" : "Forgot password?"}</button>
            </div>
            <Btn size="lg" className="w-full justify-center" disabled={submitting} onClick={() => void handleSubmit()}>
              <Lock size={16} />{submitting ? (isRTL ? "جارٍ الدخول..." : "Signing in...") : (isRTL ? "تسجيل الدخول" : "Sign In")}
            </Btn>
          </div>
          <div className="mt-8 text-center">
            <button onClick={onLangSwitch} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-[#0F2C59] font-semibold">
              <Globe size={14} />{lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantAccessDeniedScreen({
  lang,
  subdomain,
  onGoToWorkspace,
  onLogout,
}: {
  lang: Lang;
  subdomain?: string;
  onGoToWorkspace: () => void;
  onLogout: () => void;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Shield size={32} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-black text-[#0F2C59] mb-2">
          {isRTL ? "ليس لديك صلاحية للوصول إلى لوحة السوبر أدمن" : "You do not have permission to access the Super Admin dashboard"}
        </h2>
        <p className="text-slate-500 font-semibold text-sm mb-6">
          {isRTL
            ? "حسابك مرتبط بشركة. استخدم رابط مساحة عمل الشركة لتسجيل الدخول."
            : "Your account belongs to a company. Use your company workspace URL to sign in."}
        </p>
        {subdomain && (
          <p className="text-xs font-mono text-slate-400 mb-6">{formatTenantHost(subdomain)}</p>
        )}
        <div className="flex flex-col gap-3">
          {subdomain && (
            <Btn onClick={onGoToWorkspace}>
              <ExternalLink size={15} />
              {isRTL ? "الذهاب إلى مساحة عمل الشركة" : "Go to company workspace"}
            </Btn>
          )}
          <Btn variant="outline" onClick={onLogout}>
            <LogOut size={15} />
            {isRTL ? "تسجيل الخروج" : "Sign out"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ── SUPER ADMIN: KPI CARD ──────────────────────────────────────────────────────
function KpiCard({ value, labelAr, labelEn, icon: Icon, iconBg, lang, sub }: {
  value: string; labelAr: string; labelEn: string; icon: ElementType; iconBg: string; lang: Lang; sub?: string;
}) {
  return (
    <Card className="p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}><Icon size={21} className="text-white" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-black text-[#0F2C59] font-mono tracking-tight">{value}</div>
        <div className="text-xs font-bold text-slate-500 mt-0.5">{lang === "ar" ? labelAr : labelEn}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </Card>
  );
}

// ── SCREEN: DASHBOARD ──────────────────────────────────────────────────────────
function DashboardScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: Screen) => void }) {
  const isRTL = lang === "ar";
  const { companies, loading, error, reload } = useAdminCompanies();
  const source = IS_MOCK_MODE ? COMPANIES : companies;
  const adminSummary = IS_MOCK_MODE ? null : buildAdminDashboardSummary(source);
  const outstanding = source.filter(c => c.outstandingAmount > 0);
  const upcoming = source.filter(c => { const d = Math.ceil((new Date(c.renewalDate).getTime() - Date.now()) / 86400000); return d > 0 && d <= 30; });
  const totalCompanies = source.length;
  const activeCompanies = source.filter(c => c.status === "active").length;
  const trialCompanies = source.filter(c => c.status === "trial").length;
  const suspendedCompanies = source.filter(c => c.status === "suspended").length;
  const expectedMonthly = adminSummary?.expectedMonthly ?? source.filter(c => c.status !== "suspended").reduce((s, c) => s + c.monthlyPrice, 0);
  const totalOutstanding = adminSummary?.totalOutstanding ?? outstanding.reduce((s, c) => s + c.outstandingAmount, 0);
  const collectedThisMonth = Math.max(0, expectedMonthly - totalOutstanding);
  const overdueCount = outstanding.filter(c => new Date(c.renewalDate) < new Date()).length;
  const hasData = totalCompanies > 0;
  const statusPieData = IS_MOCK_MODE ? STATUS_PIE : (adminSummary?.statusPie ?? []);
  const revenueData = IS_MOCK_MODE ? REVENUE_DATA : [];
  const recentActivity = IS_MOCK_MODE ? RECENT_ACTIVITY : [];
  const actIcons: Record<string, ReactNode> = { create: <Plus size={13} className="text-emerald-500" />, payment: <DollarSign size={13} className="text-blue-500" />, suspend: <Ban size={13} className="text-red-500" />, renew: <RefreshCw size={13} className="text-amber-500" /> };

  if (!IS_MOCK_MODE && loading) {
    return <div className="p-8"><LoadingState lang={lang} /></div>;
  }
  if (!IS_MOCK_MODE && error) {
    return <div className="p-8"><ErrorState lang={lang} error={error} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      <Card className="p-5">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{isRTL ? "إجراءات سريعة" : "Quick Actions"}</p>
        <div className="flex flex-wrap gap-2.5">
          <Btn onClick={() => onNavigate("create-company")}><Plus size={15} />{isRTL ? "إضافة شركة جديدة" : "Add New Company"}</Btn>
          <Btn variant="secondary" onClick={() => onNavigate("payments")}><DollarSign size={15} />{isRTL ? "تسجيل دفعة" : "Record Payment"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("outstanding")}><AlertCircle size={15} />{isRTL ? "المبالغ المستحقة" : "Outstanding"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("companies")}><Building2 size={15} />{isRTL ? "عرض الشركات" : "View Companies"}</Btn>
        </div>
      </Card>
      {!hasData && (
        <Card className="p-4 bg-slate-50 border-slate-200">
          <EmptyState lang={lang} messageAr={EMPTY_MESSAGES.noCompanies.ar} messageEn={EMPTY_MESSAGES.noCompanies.en} compact />
        </Card>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard value={`${totalCompanies}`}     labelAr="إجمالي الشركات"    labelEn="Total Companies"  icon={Building2}   iconBg="bg-[#0F2C59]"   lang={lang} />
        <KpiCard value={`${activeCompanies}`}    labelAr="الشركات النشطة"    labelEn="Active"           icon={CheckCircle} iconBg="bg-emerald-500" lang={lang} />
        <KpiCard value={`${trialCompanies}`}     labelAr="الشركات التجريبية" labelEn="Trial"            icon={Clock}       iconBg="bg-amber-500"   lang={lang} />
        <KpiCard value={`${suspendedCompanies}`} labelAr="الشركات الموقوفة"  labelEn="Suspended"        icon={Ban}         iconBg="bg-red-500"     lang={lang} />
        <KpiCard value={`${upcoming.length}`}    labelAr="تجديدات قريبة"     labelEn="Renewals"         icon={Calendar}    iconBg="bg-violet-500"  lang={lang} sub={isRTL ? "خلال 30 يوم" : "in 30 days"} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard value={expectedMonthly.toLocaleString()}      labelAr="الإيراد الشهري المتوقع" labelEn="Expected Monthly"  icon={TrendingUp}  iconBg="bg-[#0F2C59]"   lang={lang} sub="AED" />
        <KpiCard value={collectedThisMonth.toLocaleString()}   labelAr="المدفوع هذا الشهر"      labelEn="Collected"         icon={DollarSign}  iconBg="bg-emerald-500" lang={lang} sub="AED" />
        <KpiCard value={totalOutstanding.toLocaleString()}     labelAr="المبالغ المستحقة"        labelEn="Outstanding"       icon={AlertCircle} iconBg="bg-red-500"     lang={lang} sub="AED" />
        <KpiCard value={`${upcoming.length}`} labelAr="تجديدات قريبة" labelEn="Renewals"     icon={Calendar}    iconBg="bg-amber-500"   lang={lang} sub={isRTL ? "خلال 30 يوم" : "in 30 days"} />
        <KpiCard value={`${overdueCount}`}      labelAr="مدفوعات متأخرة"          labelEn="Overdue"           icon={XCircle}     iconBg="bg-rose-600"    lang={lang} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-black text-[#0F2C59] mb-5 text-sm">{isRTL ? "الإيرادات الشهرية (AED)" : "Monthly Revenue (AED)"}</h3>
          {revenueData.length === 0 ? <ProductionEmptyState lang={lang} compact /> : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={revenueData} barSize={20} barGap={4}>
              <CartesianGrid key="sa-bar-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="sa-bar-x" dataKey={isRTL ? "month" : "monthEn"} tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="sa-bar-y" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="sa-bar-tip" contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
              <Bar key="sa-revenue" dataKey="revenue" fill="#0F2C59" radius={[6,6,0,0]} name={isRTL ? "المتوقع" : "Expected"} />
              <Bar key="sa-collected" dataKey="collected" fill="#22C55E" radius={[6,6,0,0]} name={isRTL ? "المحصل" : "Collected"} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "توزيع حالة الشركات" : "Company Status"}</h3>
          {statusPieData.length === 0 ? <ProductionEmptyState lang={lang} compact /> : (<>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie key="sa-status-pie" data={statusPieData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="value" paddingAngle={3}>
                {statusPieData.map((e, i) => <Cell key={`sa-pie-${i}`} fill={e.color} />)}
              </Pie>
              <Tooltip key="sa-pie-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _: string, p: { payload: { name: string; nameEn: string } }) => [v, isRTL ? p.payload.name : p.payload.nameEn]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2.5 mt-3">
            {statusPieData.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} /><span className="font-semibold text-slate-600">{isRTL ? s.name : s.nameEn}</span></div>
                <span className="font-black text-slate-700 font-mono">{s.value}</span>
              </div>
            ))}
          </div>
          </>)}
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "تجديدات قريبة" : "Upcoming Renewals"}</h3>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate("companies")}><Eye size={13} />{isRTL ? "الكل" : "All"}</Btn>
          </div>
          {source.filter(c => c.status !== "suspended").length === 0 ? (
            <ProductionEmptyState lang={lang} compact messageAr={EMPTY_MESSAGES.noRenewals.ar} messageEn={EMPTY_MESSAGES.noRenewals.en} />
          ) : (
          <div className="divide-y divide-slate-50">
            {source.filter(c => c.status !== "suspended").map(c => {
              const days = Math.ceil((new Date(c.renewalDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div><div className="font-bold text-sm text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div><div className="text-xs text-slate-400">{c.renewalDate}</div></div>
                  <div className="text-end"><div className={`text-sm font-black font-mono ${days < 0 ? "text-red-500" : days <= 7 ? "text-amber-500" : "text-slate-600"}`}>{days < 0 ? (isRTL ? "منتهي" : "Expired") : isRTL ? `${days} يوم` : `${days}d`}</div><div className="text-xs text-slate-400">AED {c.monthlyPrice.toLocaleString()}</div></div>
                </div>
              );
            })}
          </div>
          )}
        </Card>
        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "مبالغ مستحقة" : "Outstanding Payments"}</h3>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate("outstanding")}><Eye size={13} />{isRTL ? "الكل" : "All"}</Btn>
          </div>
          {outstanding.length === 0 ? (
            <div className="p-10 text-center"><CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" /><p className="text-emerald-600 font-bold text-sm">{isRTL ? "لا توجد مبالغ مستحقة" : "No outstanding payments"}</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {outstanding.map(c => (
                <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div><div className="font-bold text-sm text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div><StatusBadge status={c.status} lang={lang} /></div>
                  <div className="text-end"><div className="text-sm font-black text-red-500 font-mono">AED {c.outstandingAmount.toLocaleString()}</div><PaymentBadge outstanding={c.outstandingAmount} renewalDate={c.renewalDate} lang={lang} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card>
        <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "النشاط الأخير" : "Recent Activity"}</h3></div>
        {recentActivity.length === 0 ? (
          <ProductionEmptyState lang={lang} compact />
        ) : (
        <div className="divide-y divide-slate-50">
          {recentActivity.map(a => (
            <div key={a.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">{actIcons[a.type]}</div>
              <div className="flex-1 min-w-0"><span className="text-sm font-bold text-slate-700">{isRTL ? a.ar : a.en} </span><span className="text-sm text-slate-400">— {a.company}</span></div>
              <div className="text-xs text-slate-400 shrink-0 font-semibold">{a.time}</div>
            </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}

// ── SCREEN: COMPANIES ──────────────────────────────────────────────────────────
function CompaniesScreen({ lang, onNavigate, onSelectCompany }: {
  lang: Lang; onNavigate: (s: Screen) => void; onSelectCompany: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const { companies, loading, error, reload } = useAdminCompanies();
  const source = IS_MOCK_MODE ? COMPANIES : companies;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const filtered = source.filter(c => {
    const s = search.toLowerCase();
    return (!s || c.nameAr.includes(search) || c.nameEn.toLowerCase().includes(s) || c.subdomain.includes(s)) &&
      (filterStatus === "all" || c.status === filterStatus) && (filterPlan === "all" || c.plan === filterPlan);
  });
  if (!IS_MOCK_MODE && loading) {
    return <div className="p-8"><LoadingState lang={lang} /></div>;
  }
  if (!IS_MOCK_MODE && error) {
    return <div className="p-8"><ErrorState lang={lang} error={error} onRetry={() => void reload()} /></div>;
  }
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? "بحث عن شركة..." : "Search company..."}
              className={`w-full py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="active">{isRTL ? "نشط" : "Active"}</option>
            <option value="trial">{isRTL ? "تجريبي" : "Trial"}</option>
            <option value="suspended">{isRTL ? "موقوف" : "Suspended"}</option>
          </select>
          <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white font-semibold text-slate-600">
            <option value="all">{isRTL ? "كل الخطط" : "All Plans"}</option>
            <option value="basic">{isRTL ? "أساسية" : "Basic"}</option>
            <option value="pro">{isRTL ? "احترافية" : "Pro"}</option>
            <option value="enterprise">{isRTL ? "مؤسسية" : "Enterprise"}</option>
          </select>
          <Btn onClick={() => onNavigate("create-company")}><Plus size={15} />{isRTL ? "إضافة شركة" : "Add Company"}</Btn>
        </div>
      </Card>
      {filtered.length === 0 && (
        <Card className="p-14 text-center"><Building2 size={48} className="text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا توجد شركات" : "No companies found"}</h3><p className="text-slate-400 mb-6 font-semibold">{isRTL ? EMPTY_MESSAGES.noCompanies.ar : EMPTY_MESSAGES.noCompanies.en}</p><Btn onClick={() => onNavigate("create-company")}><Plus size={15} />{isRTL ? "إضافة شركة جديدة" : "Add New Company"}</Btn></Card>
      )}
      {filtered.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {[isRTL ? "الشركة" : "Company", isRTL ? "الخطة" : "Plan", isRTL ? "الحالة" : "Status", isRTL ? "السعر الشهري" : "Monthly", isRTL ? "تاريخ التجديد" : "Renewal", isRTL ? "المستحق" : "Outstanding", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={i} className={`px-5 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4"><div className="font-bold text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div><div className="text-xs text-slate-400 font-mono">{formatTenantHost(c.subdomain)}</div></td>
                    <td className="px-5 py-4"><PlanBadge plan={c.plan} lang={lang} /></td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} lang={lang} /></td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">AED {c.monthlyPrice.toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-500 font-semibold">{c.renewalDate}</td>
                    <td className="px-5 py-4">{c.outstandingAmount > 0 ? <span className="font-mono font-black text-red-500">AED {c.outstandingAmount.toLocaleString()}</span> : <span className="font-bold text-xs text-emerald-500">✓ {isRTL ? "مدفوع" : "Paid"}</span>}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { onSelectCompany(c.id); onNavigate("company-detail"); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#0F2C59] hover:text-white transition-all" title={isRTL ? "عرض" : "View"}><Eye size={14} /></button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all" title={isRTL ? "تعديل" : "Edit"}><Pencil size={14} /></button>
                        <button onClick={() => onNavigate("payments")} className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all" title={isRTL ? "دفعة" : "Payment"}><DollarSign size={14} /></button>
                        {c.status !== "suspended" ? <button onClick={() => setConfirmId(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all" title={isRTL ? "تعليق" : "Suspend"}><Ban size={14} /></button> : <button className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all"><RefreshCw size={14} /></button>}
                        <button onClick={() => openTenantWorkspace(c.subdomain)} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#22C55E] hover:text-white transition-all" title={isRTL ? "فتح مساحة العمل" : "Open workspace"}><ExternalLink size={14} /></button>
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
          {filtered.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between mb-3"><div><div className="font-black text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div><div className="text-xs text-slate-400 font-mono mt-0.5">{formatTenantHost(c.subdomain)}</div></div><StatusBadge status={c.status} lang={lang} /></div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-4">
                <div className="flex items-center gap-1.5"><span className="text-slate-400 font-semibold">{isRTL ? "الخطة" : "Plan"}:</span><PlanBadge plan={c.plan} lang={lang} /></div>
                <div><span className="text-slate-400 font-semibold">{isRTL ? "الشهري" : "Monthly"}:</span> <span className="font-mono font-bold">AED {c.monthlyPrice.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" onClick={() => { onSelectCompany(c.id); onNavigate("company-detail"); }}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
                <Btn size="sm" variant="green" onClick={() => openTenantWorkspace(c.subdomain)}><ExternalLink size={13} />{isRTL ? "فتح" : "Open"}</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmModal open={!!confirmId} title={isRTL ? "تأكيد تعليق الحساب" : "Confirm Suspension"} message={isRTL ? "هل أنت متأكد من تعليق هذه الشركة؟" : "Sure you want to suspend?"} onConfirm={() => { toast.success(isRTL ? "تم تعليق الشركة" : "Company suspended"); setConfirmId(null); }} onCancel={() => setConfirmId(null)} danger />
    </div>
  );
}

// ── SCREEN: COMPANY DETAIL ─────────────────────────────────────────────────────
function CompanyDetailScreen({ companyId, lang, onNavigate }: {
  companyId: string; lang: Lang; onNavigate: (s: Screen) => void;
}) {
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("overview");
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [c, setC] = useState<Company | null>(IS_MOCK_MODE ? (COMPANIES.find(x => x.id === companyId) ?? null) : null);
  const [loading, setLoading] = useState(!IS_MOCK_MODE);
  const tabs = [{ k: "overview", ar: "نظرة عامة", en: "Overview" }, { k: "users", ar: "المستخدمون", en: "Users" }, { k: "subscription", ar: "الاشتراك", en: "Subscription" }, { k: "payments", ar: "المدفوعات", en: "Payments" }, { k: "modules", ar: "الوحدات", en: "Modules" }, { k: "activity", ar: "سجل النشاط", en: "Activity" }];
  const companyPmts = c && IS_MOCK_MODE ? PAYMENTS_DATA.filter(p => p.companyId === c.id) : [];

  useEffect(() => {
    if (IS_MOCK_MODE) {
      setC(COMPANIES.find(x => x.id === companyId) ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getCompanyById(companyId).then(row => {
      if (!cancelled) setC(row);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading) return <div className="p-8"><LoadingState lang={lang} /></div>;
  if (!c) return (
    <div className="p-4 lg:p-8 max-w-screen-xl mx-auto">
      <button onClick={() => onNavigate("companies")} className="mb-4 p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
      <Card className="p-10"><ProductionEmptyState lang={lang} messageAr={EMPTY_MESSAGES.noCompanies.ar} messageEn={EMPTY_MESSAGES.noCompanies.en} /></Card>
    </div>
  );
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("companies")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 mt-0.5">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0"><h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? c.nameAr : c.nameEn}</h2><p className="text-sm text-slate-400 font-mono">{formatTenantHost(c.subdomain)}</p></div>
        <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={c.status} lang={lang} /><PlanBadge plan={c.plan} lang={lang} /></div>
      </div>
      <Card className="p-4 flex flex-wrap gap-2.5">
        <Btn size="sm"><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>
        <Btn size="sm" variant="secondary" onClick={() => onNavigate("payments")}><DollarSign size={13} />{isRTL ? "تسجيل دفعة" : "Record Payment"}</Btn>
        <Btn size="sm" variant="green" onClick={() => openTenantWorkspace(c.subdomain)}><ExternalLink size={13} />{isRTL ? "فتح مساحة العمل" : "Open Workspace"}</Btn>
        <Btn size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(getTenantUrl(c.subdomain)); toast.success(isRTL ? "تم نسخ الرابط" : "URL copied"); }}><Globe size={13} />{isRTL ? "نسخ الرابط" : "Copy URL"}</Btn>
        {c.status !== "suspended" ? <Btn size="sm" variant="danger" onClick={() => setConfirmSuspend(true)}><Ban size={13} />{isRTL ? "تعليق الشركة" : "Suspend"}</Btn> : <Btn size="sm" variant="secondary"><RefreshCw size={13} />{isRTL ? "إعادة تفعيل" : "Reactivate"}</Btn>}
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ ar: "إجمالي المدفوع", en: "Total Paid", v: `AED ${c.totalPaid.toLocaleString()}`, cls: "text-emerald-600" }, { ar: "المبلغ المستحق", en: "Outstanding", v: `AED ${c.outstandingAmount.toLocaleString()}`, cls: c.outstandingAmount > 0 ? "text-red-500" : "text-emerald-600" }, { ar: "تاريخ التجديد", en: "Renewal", v: c.renewalDate, cls: "text-slate-700" }, { ar: "تاريخ الإنشاء", en: "Created", v: c.createdDate, cls: "text-slate-700" }].map(f => (
          <Card key={f.ar} className="p-4 text-center"><div className={`text-lg font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>
        ))}
      </div>
      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {tabs.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{isRTL ? t.ar : t.en}</button>)}
          </div>
        </div>
        <div className="p-5">
          {tab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[{ ar: "اسم الشركة (عربي)", en: "Arabic Name", v: c.nameAr }, { ar: "اسم الشركة (إنجليزي)", en: "English Name", v: c.nameEn }, { ar: "النطاق الفرعي", en: "Subdomain", v: formatTenantHost(c.subdomain) }, { ar: "رابط مساحة العمل", en: "Workspace URL", v: getTenantUrl(c.subdomain) }, { ar: "الإمارة", en: "Emirate", v: c.emirate }, { ar: "رقم الرخصة", en: "Trade License", v: c.tradeLicense }, { ar: "اسم المدير", en: "Admin Name", v: c.adminName }, { ar: "هاتف المدير", en: "Admin Phone", v: c.adminPhone }, { ar: "بريد المدير", en: "Admin Email", v: c.adminEmail }].map(f => (
                <div key={f.ar} className="bg-slate-50 rounded-xl p-3.5"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>
              ))}
            </div>
          )}
          {tab === "subscription" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[{ ar: "الخطة", en: "Plan", v: c.plan }, { ar: "السعر الشهري", en: "Monthly", v: `AED ${c.monthlyPrice.toLocaleString()}` }, { ar: "السعر السنوي", en: "Yearly", v: `AED ${c.yearlyPrice.toLocaleString()}` }, { ar: "تاريخ التجديد", en: "Renewal", v: c.renewalDate }, { ar: "آخر دفعة", en: "Last Payment", v: c.lastPaymentDate }, { ar: "إجمالي المدفوع", en: "Total Paid", v: `AED ${c.totalPaid.toLocaleString()}` }].map(f => (
                  <div key={f.ar} className="bg-slate-50 rounded-xl p-3.5"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-black text-slate-800 font-mono">{f.v}</div></div>
                ))}
              </div>
            </div>
          )}
          {tab === "payments" && (
            <div className="space-y-3">
              {companyPmts.length === 0 ? <div className="text-center py-8"><p className="text-slate-400 font-semibold">{isRTL ? "لم يتم تسجيل أي دفعات بعد" : "No payments recorded yet"}</p></div> : companyPmts.map(p => (
                <div key={p.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div><div className="font-black text-slate-800">AED {p.amount.toLocaleString()}</div><div className="text-sm text-slate-500">{p.period} · {p.date}</div></div>
                  <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full shrink-0">{p.method === "transfer" ? "تحويل" : p.method === "cheque" ? "شيك" : p.method === "cash" ? "نقدي" : "أخرى"}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "modules" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALL_MODULES.map(m => { const on = c.modules.includes(m.key); return <div key={m.key} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 ${on ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}><div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-emerald-500" : "bg-slate-300"}`}>{on && <Check size={11} className="text-white" />}</div><span className={`text-sm font-bold ${on ? "text-emerald-700" : "text-slate-400"}`}>{isRTL ? m.ar : m.en}</span></div>; })}
            </div>
          )}
          {tab === "users" && <div><div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-[#0F2C59] flex items-center justify-center text-white font-black text-sm shrink-0">{c.adminName[0]}</div><div className="flex-1 min-w-0"><div className="font-black text-slate-800">{c.adminName}</div><div className="text-sm text-slate-500">{c.adminEmail}</div></div><span className="text-xs font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full shrink-0">Admin</span></div></div>}
          {tab === "activity" && <div className="space-y-2">{AUDIT_LOGS.slice(0, 5).map(l => <div key={l.id} className="flex gap-3 bg-slate-50 rounded-xl p-3.5"><div className="font-mono text-xs text-slate-400 shrink-0 w-32">{l.timestamp}</div><div><div className="text-sm font-bold text-slate-700">{isRTL ? l.action : l.actionEn}</div><div className="text-xs text-slate-400">{l.details}</div></div></div>)}</div>}
        </div>
      </Card>
      <ConfirmModal open={confirmSuspend} title={isRTL ? "تأكيد تعليق الحساب" : "Confirm Suspension"} message={isRTL ? "هل أنت متأكد من تعليق هذه الشركة؟" : "Sure you want to suspend?"} onConfirm={() => { toast.success(isRTL ? "تم تعليق الشركة" : "Company suspended"); setConfirmSuspend(false); }} onCancel={() => setConfirmSuspend(false)} danger />
    </div>
  );
}

// ── SCREEN: CREATE COMPANY WIZARD ──────────────────────────────────────────────
function CreateCompanyWizard({ lang, onNavigate }: { lang: Lang; onNavigate: (s: Screen) => void }) {
  const isRTL = lang === "ar";
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdSubdomain, setCreatedSubdomain] = useState("");
  const [livePlans, setLivePlans] = useState<{ k: string; ar: string; en: string; p: string }[]>([]);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", tradeNo: "", vatNo: "", emirate: "", address: "", phone: "", email: "", subdomain: "", plan: "basic", status: "trial", monthlyPrice: "800", yearlyPrice: "8000", renewalDate: "", trialEndDate: "", notes: "", adminName: "", adminPhone: "", adminEmail: "", tempPass: "", confirmPass: "", forceChange: true, modules: ["dashboard","sales","inventory","customers","reports","settings_mod"] });
  const u = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const toggleMod = (k: string) => setForm(f => ({ ...f, modules: f.modules.includes(k) ? f.modules.filter(x => x !== k) : [...f.modules, k] }));
  const STEPS = [{ n: 1, ar: "معلومات الشركة", en: "Company Info" }, { n: 2, ar: "رابط الوصول", en: "Tenant Access" }, { n: 3, ar: "خطة الاشتراك", en: "Subscription" }, { n: 4, ar: "مستخدم الأدمن", en: "Admin User" }, { n: 5, ar: "الوحدات", en: "Modules" }, { n: 6, ar: "المراجعة", en: "Review" }];
  const EMIRATES = [{ value: "", label: isRTL ? "اختر الإمارة" : "Select Emirate" }, { value: "dubai", label: isRTL ? "دبي" : "Dubai" }, { value: "abudhabi", label: isRTL ? "أبوظبي" : "Abu Dhabi" }, { value: "sharjah", label: isRTL ? "الشارقة" : "Sharjah" }, { value: "ajman", label: isRTL ? "عجمان" : "Ajman" }, { value: "rak", label: isRTL ? "رأس الخيمة" : "RAK" }, { value: "uaq", label: isRTL ? "أم القيوين" : "UAQ" }, { value: "fujairah", label: isRTL ? "الفجيرة" : "Fujairah" }];

  useEffect(() => {
    if (IS_MOCK_MODE) return;
    void listPlans().then(plans => {
      if (plans.length === 0) return;
      setLivePlans(plans.filter(p => p.is_active).map(p => ({
        k: p.code,
        ar: p.name,
        en: p.name,
        p: String(Math.round(Number(p.monthly_price))),
      })));
      const first = plans.find(p => p.is_active);
      if (first) {
        setForm(f => ({ ...f, plan: first.code, monthlyPrice: String(Math.round(Number(first.monthly_price))) }));
      }
    }).catch(() => { /* keep static fallbacks */ });
  }, []);

  const planOptions = livePlans.length > 0
    ? livePlans
    : [{ k: "basic", ar: "الأساسية", en: "Basic", p: "800" }, { k: "pro", ar: "الاحترافية", en: "Pro", p: "1,500" }, { k: "enterprise", ar: "المؤسسية", en: "Enterprise", p: "3,000" }];

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!form.nameAr.trim() || !form.nameEn.trim() || !form.tradeNo.trim() || !form.emirate || !form.phone.trim() || !form.email.trim()) {
        toast.error(isRTL ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
        return false;
      }
    }
    if (s === 2) {
      if (!form.subdomain.trim()) {
        toast.error(isRTL ? "يرجى إدخال النطاق الفرعي" : "Please enter a subdomain");
        return false;
      }
    }
    if (s === 4) {
      if (!form.adminName.trim() || !form.adminPhone.trim() || !form.adminEmail.trim() || !form.tempPass || !form.confirmPass) {
        toast.error(isRTL ? "يرجى تعبئة بيانات الأدمن" : "Please fill admin user details");
        return false;
      }
      if (form.tempPass !== form.confirmPass) {
        toast.error(isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep(s => s + 1);
  };

  const handleCreate = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) return;
    if (IS_MOCK_MODE) {
      toast.success(isRTL ? "تم إنشاء الشركة بنجاح!" : "Company created!");
      setDone(true);
      return;
    }
    setSubmitting(true);
    try {
      const company = await createCompany({
        name_ar: form.nameAr.trim(),
        name_en: form.nameEn.trim(),
        subdomain: form.subdomain.trim(),
        plan_code: form.plan,
        status: form.status,
        trade_license: form.tradeNo.trim(),
        trn: form.vatNo.trim() || undefined,
        emirate: form.emirate,
        address: form.address.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      await createCompanyAdminUser(company.id, {
        email: form.adminEmail.trim(),
        password: form.tempPass,
        full_name: form.adminName.trim(),
        phone: form.adminPhone.trim(),
      });
      setCreatedSubdomain(form.subdomain.trim());
      toast.success(isRTL ? "تم إنشاء الشركة بنجاح!" : "Company created!");
      setDone(true);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : (isRTL ? "فشل إنشاء الشركة" : "Failed to create company");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div className="p-4 lg:p-8 flex items-center justify-center min-h-[60vh]"><div className="text-center max-w-sm"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div><h2 className="text-2xl font-black text-[#0F2C59] mb-2">{isRTL ? "تم إنشاء الشركة بنجاح!" : "Company Created!"}</h2><p className="text-slate-400 font-semibold mb-4">{isRTL ? "تم إنشاء الشركة والمستخدم الأدمن." : "Company and admin user created."}</p>{createdSubdomain && <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4 mb-6"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? "رابط مساحة العمل:" : "Workspace URL:"}</div><div className="font-mono font-black text-[#0F2C59] text-sm break-all">{getTenantUrl(createdSubdomain)}</div></div>}<div className="flex flex-col gap-3 justify-center">{createdSubdomain && <Btn onClick={() => openTenantWorkspace(createdSubdomain)}><ExternalLink size={15} />{isRTL ? "فتح مساحة العمل" : "Open Workspace"}</Btn>}<Btn variant={createdSubdomain ? "secondary" : "primary"} onClick={() => onNavigate("companies")}><Building2 size={15} />{isRTL ? "عرض الشركات" : "View Companies"}</Btn><Btn variant="secondary" onClick={() => { setStep(1); setDone(false); setCreatedSubdomain(""); }}><Plus size={15} />{isRTL ? "إضافة أخرى" : "Add Another"}</Btn></div></div></div>
  );
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-7 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 min-w-max">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <button onClick={() => step > s.n && setStep(s.n)} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${step === s.n ? "bg-[#0F2C59] text-white shadow-lg" : step > s.n ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                <span className="w-5 h-5 rounded-lg flex items-center justify-center">{step > s.n ? <Check size={12} /> : s.n}</span>
                <span className="hidden sm:inline">{isRTL ? s.ar : s.en}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 rounded-full ${step > s.n ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
      </div>
      <Card className="p-6 lg:p-8">
        {step === 1 && <div><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "معلومات الشركة" : "Company Information"}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FInput label={isRTL ? "اسم الشركة (عربي)" : "Arabic Name"} value={form.nameAr} onChange={v => u("nameAr", v)} placeholder="شركة الدواجن" required /><FInput label={isRTL ? "اسم الشركة (إنجليزي)" : "English Name"} value={form.nameEn} onChange={v => u("nameEn", v)} placeholder="Poultry Co" required /><FInput label={isRTL ? "رقم الرخصة" : "Trade License"} value={form.tradeNo} onChange={v => u("tradeNo", v)} placeholder="DM-2025-XXXXX" required /><FInput label={isRTL ? "رقم الضريبة TRN" : "VAT/TRN"} value={form.vatNo} onChange={v => u("vatNo", v)} /><FSelect label={isRTL ? "الإمارة" : "Emirate"} value={form.emirate} onChange={v => u("emirate", v)} options={EMIRATES} required /><FInput label={isRTL ? "العنوان" : "Address"} value={form.address} onChange={v => u("address", v)} /><FInput label={isRTL ? "الهاتف" : "Phone"} type="tel" value={form.phone} onChange={v => u("phone", v)} placeholder="+971 50 XXX XXXX" required /><FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={form.email} onChange={v => u("email", v)} required /></div></div>}
        {step === 2 && <div className="space-y-5"><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "رابط الوصول للشركة" : "Tenant Access"}</h3><FInput label="Subdomain" value={form.subdomain} onChange={v => u("subdomain", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="company-name" helper={isRTL ? "استخدم حروف إنجليزية صغيرة بدون مسافات" : "Lowercase English, no spaces"} required />{form.subdomain && <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? "رابط الشركة:" : "Company URL:"}</div><div className="font-mono font-black text-[#0F2C59]">{getTenantUrl(form.subdomain)}</div></div>}{form.subdomain === "alnoor" && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2"><XCircle size={15} className="text-red-500 shrink-0" /><span className="text-sm font-bold text-red-600">{isRTL ? "هذا النطاق الفرعي مستخدم بالفعل" : "Subdomain already taken"}</span></div>}</div>}
        {step === 3 && <div className="space-y-5"><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "خطة الاشتراك" : "Subscription Plan"}</h3><div className="grid grid-cols-3 gap-3">{planOptions.map(pl => <button key={pl.k} onClick={() => { u("plan", pl.k); u("monthlyPrice", pl.p.replace(",", "")); }} className={`p-4 rounded-2xl border-2 text-center transition-all ${form.plan === pl.k ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-200"}`}><div className="font-black text-slate-800 text-sm">{isRTL ? pl.ar : pl.en}</div><div className="text-xs text-slate-500 font-mono">AED {pl.p}/mo</div></button>)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FSelect label={isRTL ? "الحالة" : "Status"} value={form.status} onChange={v => u("status", v)} options={[{ value: "trial", label: isRTL ? "تجريبي" : "Trial" }, { value: "active", label: isRTL ? "نشط" : "Active" }, { value: "suspended", label: isRTL ? "موقوف" : "Suspended" }]} /><FInput label={isRTL ? "السعر الشهري (درهم)" : "Monthly Price (AED)"} type="number" value={form.monthlyPrice} onChange={v => u("monthlyPrice", v)} /><FInput label={isRTL ? "تاريخ التجديد" : "Renewal Date"} type="date" value={form.renewalDate} onChange={v => u("renewalDate", v)} />{form.status === "trial" && <FInput label={isRTL ? "تاريخ انتهاء التجربة" : "Trial End Date"} type="date" value={form.trialEndDate} onChange={v => u("trialEndDate", v)} />}</div></div>}
        {step === 4 && <div className="space-y-4"><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "إنشاء مستخدم الأدمن" : "Create Admin User"}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FInput label={isRTL ? "الاسم الكامل" : "Full Name"} value={form.adminName} onChange={v => u("adminName", v)} required /><FInput label={isRTL ? "الهاتف" : "Phone"} type="tel" value={form.adminPhone} onChange={v => u("adminPhone", v)} required /><FInput label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={form.adminEmail} onChange={v => u("adminEmail", v)} required /><div /><FInput label={isRTL ? "كلمة المرور المؤقتة" : "Temp Password"} type="password" value={form.tempPass} onChange={v => u("tempPass", v)} required /><FInput label={isRTL ? "تأكيد كلمة المرور" : "Confirm Password"} type="password" value={form.confirmPass} onChange={v => u("confirmPass", v)} error={form.confirmPass && form.tempPass !== form.confirmPass ? (isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match") : undefined} /></div><div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100"><button onClick={() => u("forceChange", !form.forceChange)} className={`w-12 h-6 rounded-full flex items-center shrink-0 ${form.forceChange ? "bg-[#0F2C59]" : "bg-slate-300"}`}><span className={`w-5 h-5 bg-white rounded-full shadow-sm transition-all mx-0.5 ${form.forceChange ? "translate-x-6" : "translate-x-0"}`} /></button><label className="text-sm font-bold text-slate-700">{isRTL ? "إجبار على تغيير كلمة المرور عند أول دخول" : "Force password change on first login"}</label></div></div>}
        {step === 5 && <div><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "الوحدات المتاحة" : "Enabled Modules"}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{ALL_MODULES.map(m => { const on = form.modules.includes(m.key); return <button key={m.key} onClick={() => toggleMod(m.key)} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-start transition-all ${on ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-200"}`}><div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-[#0F2C59]" : "bg-slate-200"}`}>{on && <Check size={11} className="text-white" />}</div><span className={`text-xs font-bold ${on ? "text-[#0F2C59]" : "text-slate-400"}`}>{isRTL ? m.ar : m.en}</span></button>; })}</div></div>}
        {step === 6 && <div className="space-y-4"><h3 className="text-lg font-black text-[#0F2C59] mb-6">{isRTL ? "مراجعة المعلومات" : "Review"}</h3>{[{ title: isRTL ? "معلومات الشركة" : "Company Info", rows: [[isRTL ? "الاسم بالعربي" : "Arabic", form.nameAr || "—"], [isRTL ? "الاسم بالإنجليزي" : "English", form.nameEn || "—"], [isRTL ? "الإمارة" : "Emirate", form.emirate || "—"], [isRTL ? "الهاتف" : "Phone", form.phone || "—"]] }, { title: isRTL ? "الاشتراك" : "Subscription", rows: [[isRTL ? "الخطة" : "Plan", form.plan], [isRTL ? "الحالة" : "Status", form.status], [isRTL ? "السعر" : "Price", `AED ${parseInt(form.monthlyPrice || "0").toLocaleString()}/mo`]] }, { title: isRTL ? "الأدمن" : "Admin", rows: [[isRTL ? "الاسم" : "Name", form.adminName || "—"], [isRTL ? "البريد" : "Email", form.adminEmail || "—"]] }].map(sec => <div key={sec.title} className="bg-slate-50 rounded-2xl p-4"><div className="font-black text-slate-500 text-xs uppercase tracking-wide mb-3">{sec.title}</div><div className="space-y-2">{sec.rows.map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-400 font-semibold">{k}</span><span className="font-bold text-slate-800">{v}</span></div>)}</div></div>)}</div>}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <Btn variant="outline" onClick={() => step === 1 ? onNavigate("companies") : setStep(s => s - 1)}>{isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}{step === 1 ? (isRTL ? "إلغاء" : "Cancel") : (isRTL ? "رجوع" : "Back")}</Btn>
          {step < 6 ? <Btn onClick={handleNext}>{isRTL ? "التالي" : "Next"}{isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</Btn> : <Btn onClick={() => void handleCreate()} disabled={submitting}><Check size={15} />{submitting ? (isRTL ? "جاري الإنشاء..." : "Creating...") : (isRTL ? "إنشاء الشركة" : "Create Company")}</Btn>}
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PAYMENTS ───────────────────────────────────────────────────────────
function PaymentsScreen({ lang }: { lang: Lang }) {
  const isRTL = lang === "ar";
  const [showModal, setShowModal] = useState(false);
  const [pf, setPf] = useState({ company: "", amount: "", date: "", method: "transfer", from: "", to: "", ref: "", notes: "" });
  const up = (k: string, v: string) => setPf(f => ({ ...f, [k]: v }));
  const selC = COMPANIES.find(c => c.id === pf.company);
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex justify-end"><Btn onClick={() => setShowModal(true)}><Plus size={15} />{isRTL ? "تسجيل دفعة جديدة" : "Record Payment"}</Btn></div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL ? "التاريخ" : "Date", isRTL ? "الشركة" : "Company", isRTL ? "المبلغ" : "Amount", isRTL ? "الطريقة" : "Method", isRTL ? "الفترة" : "Period", isRTL ? "المرجع" : "Reference"].map((h, i) => <th key={i} className={`px-5 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {PAYMENTS_DATA.map(p => <tr key={p.id} className="hover:bg-slate-50/60"><td className="px-5 py-4 font-mono text-xs text-slate-500">{p.date}</td><td className="px-5 py-4 font-bold text-slate-800">{isRTL ? p.company : p.companyEn}</td><td className="px-5 py-4 font-mono font-black text-emerald-600">AED {p.amount.toLocaleString()}</td><td className="px-5 py-4"><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{p.method === "transfer" ? "تحويل" : p.method === "cheque" ? "شيك" : p.method === "cash" ? "نقدي" : "أخرى"}</span></td><td className="px-5 py-4 text-slate-500 font-semibold">{p.period}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">{p.reference || "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100"><h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل دفعة جديدة" : "Record New Payment"}</h3><button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>
            <div className="p-6 space-y-4">
              <FSelect label={isRTL ? "الشركة" : "Company"} value={pf.company} onChange={v => up("company", v)} options={[{ value: "", label: isRTL ? "اختر الشركة" : "Select Company" }, ...COMPANIES.map(c => ({ value: c.id, label: isRTL ? c.nameAr : c.nameEn }))]} required />
              {selC && selC.outstandingAmount > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><span className="text-sm font-black text-amber-700">{isRTL ? "المستحق: " : "Outstanding: "}</span><span className="font-mono font-black text-amber-700">AED {selC.outstandingAmount.toLocaleString()}</span></div>}
              <div className="grid grid-cols-2 gap-4"><FInput label={isRTL ? "المبلغ (درهم)" : "Amount (AED)"} type="number" value={pf.amount} onChange={v => up("amount", v)} required /><FInput label={isRTL ? "تاريخ الدفع" : "Date"} type="date" value={pf.date} onChange={v => up("date", v)} required /></div>
              <FSelect label={isRTL ? "طريقة الدفع" : "Method"} value={pf.method} onChange={v => up("method", v)} options={[{ value: "transfer", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cash", label: isRTL ? "نقدي" : "Cash" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
              <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference"} value={pf.ref} onChange={v => up("ref", v)} />
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end"><Btn variant="outline" onClick={() => setShowModal(false)}>{isRTL ? "إلغاء" : "Cancel"}</Btn><Btn onClick={() => { toast.success(isRTL ? "تم تسجيل الدفعة" : "Payment recorded"); setShowModal(false); }}><Check size={15} />{isRTL ? "تسجيل" : "Record"}</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN: OUTSTANDING ────────────────────────────────────────────────────────
function OutstandingScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: Screen) => void }) {
  const isRTL = lang === "ar";
  const outstanding = COMPANIES.filter(c => c.outstandingAmount > 0);
  const totalOut = outstanding.reduce((s, c) => s + c.outstandingAmount, 0);
  const overdue = outstanding.filter(c => new Date(c.renewalDate) < new Date());
  if (outstanding.length === 0) return <div className="p-8 flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle size={38} className="text-emerald-500" /></div><h2 className="text-xl font-black text-emerald-700 mb-2">{isRTL ? "لا توجد مبالغ مستحقة" : "No Outstanding"}</h2></div></div>;
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard value={`AED ${totalOut.toLocaleString()}`} labelAr="إجمالي المستحق" labelEn="Total Outstanding" icon={AlertCircle} iconBg="bg-red-500" lang={lang} />
        <KpiCard value={`${overdue.length}`} labelAr="شركات متأخرة" labelEn="Overdue" icon={XCircle} iconBg="bg-rose-600" lang={lang} />
        <KpiCard value={`${outstanding.length - overdue.length}`} labelAr="دفع قريب" labelEn="Due Soon" icon={Clock} iconBg="bg-amber-500" lang={lang} />
        <KpiCard value={`${COMPANIES.filter(c => c.status === "suspended").length}`} labelAr="موقوف للدفع" labelEn="Suspended" icon={Ban} iconBg="bg-slate-600" lang={lang} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL ? "الشركة" : "Company", isRTL ? "الخطة" : "Plan", isRTL ? "تاريخ التجديد" : "Renewal", isRTL ? "المتوقع" : "Expected", isRTL ? "المدفوع" : "Paid", isRTL ? "المستحق" : "Outstanding", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => <th key={i} className={`px-5 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {outstanding.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4"><div className="font-bold text-slate-800">{isRTL ? c.nameAr : c.nameEn}</div><div className="text-xs text-slate-400">{c.adminPhone}</div></td>
                  <td className="px-5 py-4"><PlanBadge plan={c.plan} lang={lang} /></td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{c.renewalDate}</td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-600">AED {c.monthlyPrice.toLocaleString()}</td>
                  <td className="px-5 py-4 font-mono font-bold text-emerald-600">AED {(c.monthlyPrice - c.outstandingAmount).toLocaleString()}</td>
                  <td className="px-5 py-4 font-mono font-black text-red-500">AED {c.outstandingAmount.toLocaleString()}</td>
                  <td className="px-5 py-4"><StatusBadge status={c.status} lang={lang} /></td>
                  <td className="px-5 py-4"><button onClick={() => onNavigate("payments")} className="text-xs px-2.5 py-1 bg-[#0F2C59] text-white rounded-lg font-bold hover:bg-[#162f5f]">{isRTL ? "دفعة" : "Pay"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SCREEN: PLANS ──────────────────────────────────────────────────────────────
function PlansScreen({ lang }: { lang: Lang }) {
  const isRTL = lang === "ar";
  const planIcons = { basic: Star, pro: Zap, enterprise: Crown };
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS_DATA.map(pl => {
          const Icon = planIcons[pl.key as keyof typeof planIcons];
          return (
            <div key={pl.key} className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative ${pl.key === "pro" ? "border-[#0F2C59] shadow-xl shadow-[#0F2C59]/10" : "border-slate-200 shadow-sm"}`}>
              {pl.key === "pro" && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="text-xs font-black bg-[#0F2C59] text-white px-3 py-1 rounded-full">{isRTL ? "الأكثر شيوعاً" : "Most Popular"}</span></div>}
              <div className="flex items-center gap-3 mb-4"><div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${pl.key === "basic" ? "bg-slate-100" : pl.key === "pro" ? "bg-[#0F2C59]" : "bg-violet-600"}`}><Icon size={19} className={pl.key === "basic" ? "text-slate-600" : "text-white"} /></div><div><h3 className="font-black text-slate-800">{isRTL ? pl.nameAr : pl.nameEn}</h3><p className="text-xs text-slate-400 font-semibold">{isRTL ? pl.descAr : pl.descEn}</p></div></div>
              <div className="mb-4"><div className="text-3xl font-black text-[#0F2C59] font-mono">{pl.monthlyPrice.toLocaleString()}</div><div className="text-sm text-slate-400 font-semibold">{isRTL ? "درهم / شهر" : "AED / month"}</div></div>
              <div className="space-y-1.5 mb-4 flex-1">{pl.modules.slice(0, 6).map(k => { const m = ALL_MODULES.find(x => x.key === k); return m ? <div key={k} className="flex items-center gap-2 text-sm text-slate-600"><Check size={13} className="text-emerald-500 shrink-0" />{isRTL ? m.ar : m.en}</div> : null; })}{pl.modules.length > 6 && <div className="text-xs text-slate-400 font-semibold ps-5">+{pl.modules.length - 6} {isRTL ? "أخرى" : "more"}</div>}</div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100"><span className="text-sm font-bold text-slate-500">{isRTL ? "الحالة" : "Status"}</span><div className={`w-10 h-[22px] rounded-full flex items-center ${pl.active ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all mx-0.5 ${pl.active ? "translate-x-5" : "translate-x-0"}`} /></div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCREEN: AUDIT LOG ──────────────────────────────────────────────────────────
function AuditLogScreen({ lang }: { lang: Lang }) {
  const isRTL = lang === "ar";
  const actIcon: Record<string, ReactNode> = { "تسجيل دفعة": <DollarSign size={13} className="text-emerald-500" />, "إنشاء شركة": <Plus size={13} className="text-blue-500" />, "تعليق حساب": <Ban size={13} className="text-red-500" />, "تغيير الخطة": <RefreshCw size={13} className="text-amber-500" />, "إنشاء مستخدم أدمن": <Users size={13} className="text-violet-500" /> };
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200">{[isRTL ? "التاريخ" : "Date", isRTL ? "المستخدم" : "User", isRTL ? "الإجراء" : "Action", isRTL ? "الشركة" : "Company", isRTL ? "التفاصيل" : "Details", "IP"].map((h, i) => <th key={i} className={`px-5 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {AUDIT_LOGS.map(l => <tr key={l.id} className="hover:bg-slate-50/60"><td className="px-5 py-4 font-mono text-xs text-slate-400">{l.timestamp}</td><td className="px-5 py-4 font-bold text-slate-700 text-xs">{l.user}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">{actIcon[l.action] || <Info size={13} className="text-slate-400" />}</div><span className="font-bold">{isRTL ? l.action : l.actionEn}</span></div></td><td className="px-5 py-4 text-slate-600 font-semibold">{l.company}</td><td className="px-5 py-4 text-xs text-slate-400">{l.details}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">{l.ip}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: SALES INVOICE DATA & TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Sales-invoice data & types extracted to:
//   src/shared/types/documents.ts  (SProduct, SInvLine, SInvStatus, SInvoice)
//   src/data/mock/{products,customers,sales}.mock.ts  (S_PRODUCTS, S_CUSTOMERS, S_INVOICES)

// ── INVOICE STATUS BADGE ───────────────────────────────────────────────────────
function SInvStatusBadge({ status, lang }: { status: SInvStatus; lang: Lang }) {
  const cfg = {
    draft:     { bg: "bg-slate-100",   t: "text-slate-600",   ar: "مسودة",           en: "Draft" },
    approved:  { bg: "bg-blue-50",     t: "text-blue-700",    ar: "معتمدة",           en: "Approved" },
    partial:   { bg: "bg-amber-50",    t: "text-amber-700",   ar: "مدفوعة جزئياً",  en: "Partial" },
    paid:      { bg: "bg-emerald-50",  t: "text-emerald-700", ar: "مدفوعة",           en: "Paid" },
    cancelled: { bg: "bg-red-50",      t: "text-red-700",     ar: "ملغاة",            en: "Cancelled" },
    adjusted:  { bg: "bg-violet-50",   t: "text-violet-700",  ar: "مُعدَّلة",        en: "Adjusted" },
  }[status];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

/// ── PHASE 3 ENHANCEMENTS ──────────────────────────────────────────────────────

// Amber/red/green badge for modified invoice fields
function AuditBadge({ type, lang }: { type: "price" | "kg" | "vat" | "discount"; lang: Lang }) {
  const cfg = {
    price:    { bg: "bg-amber-100",  t: "text-amber-700",  ar: "تم تعديل السعر",       en: "Price modified" },
    kg:       { bg: "bg-amber-100",  t: "text-amber-700",  ar: "تم تعديل الكيلو",       en: "KG overridden" },
    vat:      { bg: "bg-red-100",    t: "text-red-700",    ar: "تم تعديل الضريبة",      en: "VAT modified" },
    discount: { bg: "bg-violet-100", t: "text-violet-700", ar: "تم تطبيق خصم تحصيل",   en: "Discount applied" },
  }[type];
  return <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{lang === "ar" ? cfg.ar : cfg.en}</span>;
}

// Disabled button that shows a permission tooltip on hover
function PermBtn({ children, lang, soon = false }: { children: ReactNode; lang: Lang; soon?: boolean }) {
  const msg = lang === "ar" ? "ليس لديك صلاحية لتنفيذ هذا الإجراء" : "You do not have permission for this action";
  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-2 font-bold rounded-xl border px-3 py-1.5 text-xs cursor-not-allowed select-none ${soon ? "bg-slate-50 text-slate-400 border-slate-200 opacity-70" : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"}`}>
        {children}
        {soon && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{lang === "ar" ? "قريباً" : "Soon"}</span>}
      </div>
      <div className={`absolute bottom-full mb-2 ${lang === "ar" ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-30 pointer-events-none shadow-xl leading-snug max-w-56 text-center`}>
        {msg}
        <span className={`absolute top-full ${lang === "ar" ? "left-4" : "right-4"} border-4 border-transparent border-t-[#0F2C59]`} />
      </div>
    </div>
  );
}

// Invoice numbering settings modal
function InvoiceNumberingModal({ lang, onClose, role }: { lang: Lang; onClose: () => void; role: TenantRole }) {
  const isRTL = lang === "ar";
  const canChange = role === "owner";
  const [prefix, setPrefix] = useState("INV");
  const [nextSeq, setNextSeq] = useState("00046");
  const [resetRule, setResetRule] = useState("none");
  const [draftNum, setDraftNum] = useState("temp");
  const [approvalNum, setApprovalNum] = useState("on-approval");
  const year = new Date().getFullYear();
  const preview = `${prefix || "INV"}-${year}-${nextSeq || "00001"}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "إعدادات ترقيم فواتير البيع" : "Sales Invoice Numbering Settings"}</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{isRTL ? "تؤثر على الفواتير الجديدة فقط" : "Affects new invoices only"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Live preview */}
          <div className="bg-[#0F2C59]/5 border border-[#0F2C59]/20 rounded-2xl p-4 text-center">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{isRTL ? "معاينة الرقم التالي" : "Next Number Preview"}</div>
            <div className="text-3xl font-black text-[#0F2C59] font-mono tracking-tight">{preview}</div>
          </div>

          {!canChange && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <Info size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-amber-700">{isRTL ? "ليس لديك صلاحية تعديل إعدادات الترقيم" : "You do not have permission to change numbering settings"}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FInput label={isRTL ? "بادئة الرقم" : "Prefix"} value={prefix} onChange={setPrefix} placeholder="INV" />
            <FInput label={isRTL ? "الرقم التالي" : "Next Sequence"} value={nextSeq} onChange={setNextSeq} placeholder="00001" />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "إعادة الترقيم" : "Reset Rule"}</label>
            <div className="space-y-2">
              {[["none", isRTL ? "لا يتم إعادة الترقيم" : "No reset"], ["monthly", isRTL ? "شهرياً" : "Monthly reset"], ["yearly", isRTL ? "سنوياً" : "Yearly reset"]].map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${resetRule === v ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-200 hover:border-slate-300"}`}>
                  <input type="radio" value={v} checked={resetRule === v} onChange={() => setResetRule(v)} className="accent-[#0F2C59]" />
                  <span className="text-sm font-bold text-slate-700">{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "ترقيم المسودات" : "Draft Numbering"}</label>
            <div className="grid grid-cols-2 gap-2">
              {[["temp", isRTL ? "رقم مؤقت للمسودة" : "Temporary draft number"], ["seq", isRTL ? "نفس تسلسل الفواتير" : "Same invoice sequence"]].map(([v, l]) => (
                <button key={v} onClick={() => setDraftNum(v)} className={`p-3 rounded-xl border-2 text-start text-xs font-bold transition-all ${draftNum === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">{isRTL ? "ترقيم الفواتير المعتمدة" : "Approved Invoice Numbering"}</label>
            <div className="grid grid-cols-2 gap-2">
              {[["on-approval", isRTL ? "يُولَّد عند الاعتماد فقط" : "Generate on approval only"], ["keep-draft", isRTL ? "الاحتفاظ برقم المسودة بعد الاعتماد" : "Keep draft number after approval"]].map(([v, l]) => (
                <button key={v} onClick={() => setApprovalNum(v)} className={`p-3 rounded-xl border-2 text-start text-xs font-bold transition-all ${approvalNum === v ? "border-[#0F2C59] bg-[#0F2C59]/5 text-[#0F2C59]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-amber-700">{isRTL ? "تغيير الترقيم قد يؤثر على الفواتير الجديدة فقط." : "Numbering changes affect new invoices only."}</span>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
          {canChange && <Btn onClick={() => { toast.success(isRTL ? "تم حفظ إعدادات الترقيم" : "Numbering settings saved"); onClose(); }}><Check size={14} />{isRTL ? "حفظ الإعدادات" : "Save Settings"}</Btn>}
        </div>
      </div>
    </div>
  );
}

// Print template settings side panel
function PrintTemplatePanel({ lang, onClose, role }: { lang: Lang; onClose: () => void; role: TenantRole }) {
  const isRTL = lang === "ar";
  const canChange = role === "owner";
  const [showAr, setShowAr] = useState(true);
  const [showEn, setShowEn] = useState(true);
  const [reqSig, setReqSig] = useState(true);
  const [showWords, setShowWords] = useState(true);
  const [footer, setFooter] = useState(isRTL ? "شكراً لتعاملكم معنا" : "Thank you for your business");

  const warnings = [
    { ar: "رقم TRN غير موجود في الإعدادات", en: "TRN not configured in settings" },
    { ar: "الختم غير مرفوع", en: "Company stamp not uploaded" },
    { ar: "التوقيع غير مرفوع", en: "Signature not uploaded" },
  ];

  const toggles: [boolean, (v: boolean) => void, string, string][] = [
    [showAr, setShowAr, isRTL ? "عرض التسميات العربية" : "Show Arabic labels", ""],
    [showEn, setShowEn, isRTL ? "عرض التسميات الإنجليزية" : "Show English labels", ""],
    [reqSig, setReqSig, isRTL ? "مطلوب توقيع المستلم" : "Require receiver signature", ""],
    [showWords, setShowWords, isRTL ? "عرض المبلغ كتابةً" : "Show amount in words", ""],
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className={`w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-[#0F2C59] text-base">{isRTL ? "إعدادات قالب الفاتورة" : "Invoice Template Settings"}</h3>
            <p className="text-xs text-slate-400 font-semibold">{isRTL ? "تُطبَّق على جميع مطبوعات الفاتورة" : "Applied to all invoice prints"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Warnings */}
          <div className="space-y-2">
            {warnings.map(w => (
              <div key={w.ar} className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <span className="text-xs font-bold text-red-700 flex-1">{isRTL ? w.ar : w.en}</span>
                <button className="text-xs font-black text-red-600 hover:underline shrink-0">{isRTL ? "إضافة" : "Add"}</button>
              </div>
            ))}
          </div>

          {/* Company info */}
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{isRTL ? "معلومات الشركة" : "Company Info"}</p>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center cursor-pointer hover:border-[#0F2C59]/30 transition-all">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-1.5"><Plus size={16} className="text-slate-400" /></div>
              <p className="text-xs font-bold text-slate-500">{isRTL ? "رفع شعار الشركة" : "Upload Company Logo"}</p>
              <p className="text-[10px] text-slate-400">PNG, SVG — 200×80px</p>
            </div>
            <FInput label={isRTL ? "اسم الشركة (عربي)" : "Arabic Company Name"} value={demoStr("شركة الوطنية للدواجن")} onChange={() => {}} />
            <FInput label={isRTL ? "اسم الشركة (إنجليزي)" : "English Company Name"} value={demoStr("Al Wataniyah Poultry Co LLC")} onChange={() => {}} />
            <FInput label="TRN" value={demoStr("100345678901203")} onChange={() => {}} />
            <FInput label={isRTL ? "العنوان" : "Address"} value={demoStr(isRTL ? "المنطقة الصناعية، الشارع 12، دبي" : "Industrial Area, St 12, Dubai")} onChange={() => {}} />
            <FInput label={isRTL ? "الهاتف" : "Phone"} value={demoStr("+971 50 123 4567")} onChange={() => {}} />
          </div>

          {/* Stamp + Signature */}
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{isRTL ? "الختم والتوقيع" : "Stamp & Signature"}</p>
            <div className="grid grid-cols-2 gap-3">
              {[isRTL ? "رفع الختم" : "Upload Stamp", isRTL ? "رفع التوقيع" : "Upload Signature"].map(l => (
                <div key={l} className="border-2 border-dashed border-red-200 rounded-xl p-4 text-center cursor-pointer hover:border-red-300 transition-all bg-red-50/50">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-1"><Plus size={13} className="text-red-400" /></div>
                  <p className="text-[10px] font-bold text-red-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{isRTL ? "خيارات الطباعة" : "Print Options"}</p>
            {toggles.map(([val, setter, label]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <button onClick={() => setter(!val)} className={`w-10 h-[22px] rounded-full flex items-center transition-all shrink-0 ${val ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
                  <span className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-all ${val ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Footer notes */}
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات تذييل الفاتورة" : "Invoice Footer Notes"}</label>
            <textarea value={footer} onChange={e => setFooter(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" />
          </div>

          {!canChange && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <Info size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-amber-700">{isRTL ? "ليس لديك صلاحية تعديل إعدادات القالب" : "No permission to edit template settings"}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex gap-3 shrink-0">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "إغلاق" : "Close"}</Btn>
          {canChange && <Btn className="flex-1 justify-center" onClick={() => { toast.success(isRTL ? "تم حفظ إعدادات القالب" : "Template settings saved"); onClose(); }}><Check size={14} />{isRTL ? "حفظ" : "Save"}</Btn>}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: SALES LIST ─────────────────────────────────────────────────────────
function SalesListScreen({ lang, role, onNavigate, setSelectedSalesId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; setSelectedSalesId?: (id: string) => void;
}) {
  const isRTL = lang === "ar";
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCollect, setShowCollect] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState<string | null>(null);
  const [showNumbering, setShowNumbering] = useState(false);

  const { items: saleRows, loading, error, forbidden, reload } = useSales(
    search ? { search } : undefined,
    async () =>
      S_INVOICES.map((inv) => ({
        id: inv.id,
        number: inv.id,
        customer: inv.customer,
        customerId: "",
        date: inv.date,
        status: inv.status,
        paymentStatus: inv.status,
        subtotal: inv.total ?? 0,
        vat: 0,
        total: inv.total ?? 0,
        paid: inv.paid ?? 0,
        balance: inv.remaining ?? 0,
      })),
  );

  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void reload()} />;

  const displayInvoices = saleRows.map((row) => {
    const mock = S_INVOICES.find((i) => i.id === row.number || i.id === row.id);
    if (mock && IS_MOCK_MODE) return { ...mock, recordId: row.id };
    return {
      id: row.number,
      recordId: row.id,
      customer: row.customer,
      customerEn: row.customer,
      customerId: row.customerId,
      date: row.date,
      cartons: 0,
      kg: 0,
      subtotal: row.subtotal,
      vat: row.vat,
      total: row.total,
      paid: row.paid,
      remaining: row.balance,
      status: row.status as SInvStatus,
      method: "credit",
      user: "",
    };
  });

  const filtered = displayInvoices.filter(inv => {
    const s = search.toLowerCase();
    return (!s || inv.id.toLowerCase().includes(s) || inv.customer.includes(search) || inv.customerEn.toLowerCase().includes(s)) &&
      (filterStatus === "all" || inv.status === filterStatus);
  });

  const openDetail = (recordId: string) => {
    setSelectedSalesId?.(recordId);
    onNavigate("sales-detail");
  };
  const openEdit = (recordId: string) => {
    setSelectedSalesId?.(recordId);
    onNavigate("sales-new");
  };
  const openPreview = (recordId: string) => {
    setSelectedSalesId?.(recordId);
    onNavigate("sales-preview");
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setShowNumbering(true)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#0F2C59] transition-colors">
          <Settings size={13} />{isRTL ? "إعدادات ترقيم الفواتير" : "Invoice Numbering Settings"}
        </button>
        <Btn variant="green" onClick={() => { setSelectedSalesId?.(""); onNavigate("sales-new"); }}><Plus size={15} />{isRTL ? "فاتورة بيع جديدة" : "New Sales Invoice"}</Btn>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث بالرقم أو العميل..." : "Search by number or customer..."}
              className={`w-full py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F2C59] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-slate-600 focus:outline-none">
            <option value="all">{isRTL ? "كل الحالات" : "All Status"}</option>
            <option value="draft">{isRTL ? "مسودة" : "Draft"}</option>
            <option value="approved">{isRTL ? "معتمدة" : "Approved"}</option>
            <option value="partial">{isRTL ? "مدفوعة جزئياً" : "Partial"}</option>
            <option value="paid">{isRTL ? "مدفوعة" : "Paid"}</option>
            <option value="cancelled">{isRTL ? "ملغاة" : "Cancelled"}</option>
            <option value="adjusted">{isRTL ? "مُعدَّلة" : "Adjusted"}</option>
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
                  {[isRTL ? "رقم الفاتورة" : "Invoice #", isRTL ? "التاريخ" : "Date", isRTL ? "العميل" : "Customer", isRTL ? "الكراتين" : "Cartons", "KG", isRTL ? "الإجمالي" : "Total", isRTL ? "المدفوع" : "Paid", isRTL ? "المتبقي" : "Remaining", isRTL ? "الحالة" : "Status", isRTL ? "إجراءات" : "Actions"].map((h, i) => (
                    <th key={`sh-${i}`} className={`px-4 py-3.5 font-black text-xs uppercase tracking-wide text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3"><div className="font-mono font-bold text-[#0F2C59] text-xs">{inv.id}</div><div className="text-xs text-slate-400">{inv.user}</div></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.date}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{isRTL ? inv.customer : inv.customerEn}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{inv.cartons || "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{inv.kg ? `${inv.kg}` : "—"}</td>
                    <td className="px-4 py-3 font-mono font-black text-[#0F2C59]">{inv.total ? `AED ${inv.total.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">{inv.paid ? `AED ${inv.paid.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">{inv.remaining > 0 ? <span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span> : inv.status !== "draft" && inv.status !== "cancelled" ? <span className="text-emerald-500 font-bold text-xs">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3"><SInvStatusBadge status={inv.status} lang={lang} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {inv.status === "draft" && <button onClick={() => openEdit((inv as { recordId?: string }).recordId ?? inv.id)} className="text-xs px-2 py-1 bg-[#0F2C59] text-white rounded-lg font-bold hover:bg-[#162f5f]">{isRTL ? "تعديل" : "Edit"}</button>}
                        {(inv.status === "approved" || inv.status === "partial") && <button onClick={() => setShowCollect(inv.id)} className="text-xs px-2 py-1 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600">{isRTL ? "تحصيل" : "Collect"}</button>}
                        <button onClick={() => openDetail((inv as { recordId?: string }).recordId ?? inv.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0F2C59] transition-all" title={isRTL ? "عرض" : "View"}><Eye size={13} /></button>
                        <button onClick={() => openPreview((inv as { recordId?: string }).recordId ?? inv.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all" title={isRTL ? "طباعة" : "Print"}><Printer size={13} /></button>
                        {(inv.status === "approved" || inv.status === "partial") && role === "owner" && <button onClick={() => setShowCancel(inv.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all" title={isRTL ? "إلغاء" : "Cancel"}><Ban size={13} /></button>}
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
          {filtered.map(inv => (
            <Card key={inv.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-mono font-bold text-[#0F2C59] text-sm">{inv.id}</div><div className="font-bold text-slate-800 text-sm mt-0.5">{isRTL ? inv.customer : inv.customerEn}</div></div>
                <SInvStatusBadge status={inv.status} lang={lang} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center my-3">
                <div className="bg-slate-50 rounded-xl p-2"><div className="font-mono font-black text-[#0F2C59] text-sm">{inv.total ? `${inv.total.toLocaleString()}` : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "الإجمالي" : "Total"}</div></div>
                <div className="bg-emerald-50 rounded-xl p-2"><div className="font-mono font-black text-emerald-600 text-sm">{inv.paid ? `${inv.paid.toLocaleString()}` : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "المدفوع" : "Paid"}</div></div>
                <div className={`rounded-xl p-2 ${inv.remaining > 0 ? "bg-red-50" : "bg-slate-50"}`}><div className={`font-mono font-black text-sm ${inv.remaining > 0 ? "text-red-500" : "text-slate-300"}`}>{inv.remaining > 0 ? inv.remaining.toLocaleString() : "—"}</div><div className="text-[10px] text-slate-400 font-bold">{isRTL ? "المتبقي" : "Remaining"}</div></div>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" onClick={() => openDetail((inv as { recordId?: string }).recordId ?? inv.id)}><Eye size={13} />{isRTL ? "عرض" : "View"}</Btn>
                {inv.status === "draft" && <Btn size="sm" variant="primary" onClick={() => openEdit((inv as { recordId?: string }).recordId ?? inv.id)}><Pencil size={13} />{isRTL ? "تعديل" : "Edit"}</Btn>}
                {(inv.status === "approved" || inv.status === "partial") && <Btn size="sm" variant="green" onClick={() => setShowCollect(inv.id)}><Wallet size={13} />{isRTL ? "تحصيل" : "Collect"}</Btn>}
                <Btn size="sm" variant="ghost" onClick={() => openPreview((inv as { recordId?: string }).recordId ?? inv.id)}><Printer size={13} /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="p-14 text-center">
          <FileText size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-500 mb-2">{isRTL ? "لا توجد فواتير بيع بعد" : "No sales invoices yet"}</h3>
          <Btn variant="green" onClick={() => onNavigate("sales-new")}><Plus size={15} />{isRTL ? "فاتورة بيع جديدة" : "New Sales Invoice"}</Btn>
        </Card>
      )}

      {showCollect && <SalesCollectModal lang={lang} invoiceId={showCollect} onClose={() => setShowCollect(null)} />}
      {showCancel && <CancelInvoiceModal lang={lang} invoiceId={showCancel} onClose={() => setShowCancel(null)} />}
      {showNumbering && <InvoiceNumberingModal lang={lang} role={role} onClose={() => setShowNumbering(false)} />}
    </div>
  );
}

// ── SCREEN: NEW SALES INVOICE ─────────────────────────────────────────────────
function SalesNewScreen({ lang, role, onNavigate, salesId, onSaved }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; salesId?: string; onSaved?: (id: string) => void;
}) {
  if (!IS_MOCK_MODE) {
    return (
      <LiveSalesInvoiceScreen
        lang={lang}
        role={role}
        onNavigate={onNavigate}
        invoiceId={salesId ?? null}
        onSaved={onSaved}
      />
    );
  }
  const isRTL = lang === "ar";
  const canEditPrice = role === "owner";
  const canApprove = role === "owner" || role === "accountant";

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<SInvLine[]>([]);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [payMethod, setPayMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [flowState, setFlowState] = useState<"form" | "confirm" | "success">("form");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [showNumbering, setShowNumberingNew] = useState(false);

  const customer = S_CUSTOMERS.find(c => c.id === customerId);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const vatAmt = vatEnabled ? Math.round(subtotal * 5) / 100 : 0;
  const grandTotal = subtotal + vatAmt;
  const paid = parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, grandTotal - paid);
  const totalCartons = lines.filter(l => !S_PRODUCTS.find(p => p.id === l.productId)?.isPart).reduce((s, l) => s + l.cartons, 0);
  const totalPcs = lines.filter(l => !S_PRODUCTS.find(p => p.id === l.productId)?.isPart).reduce((s, l) => s + l.pcs, 0);
  const totalKg = lines.reduce((s, l) => s + l.kg, 0);
  const hasStockIssue = lines.some(l => { const p = S_PRODUCTS.find(x => x.id === l.productId); return p && !p.isPart && l.cartons > p.stock; });

  const addLine = (productId: string) => {
    const prod = S_PRODUCTS.find(p => p.id === productId);
    if (!prod) return;
    setLines(prev => [...prev, { id: Date.now().toString(), productId, cartons: 0, pcs: 0, kg: 0, priceKg: prod.priceKg, amount: 0, kgOverride: false, priceOverride: false }]);
    setSelectedProduct("");
  };

  const updateLine = (id: string, field: string, value: number | boolean) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [field]: value };
      const prod = S_PRODUCTS.find(p => p.id === l.productId)!;
      if (field === "cartons" && !prod.isPart && !u.kgOverride) {
        u.pcs = (value as number) * prod.ppc;
        u.kg = Math.round((value as number) * prod.ppc * prod.g / 100) / 10;
      }
      if (field === "pcs" && !prod.isPart && !u.kgOverride) {
        u.kg = Math.round((value as number) * prod.g / 100) / 10;
      }
      u.amount = Math.round(u.kg * u.priceKg * 100) / 100;
      return u;
    }));
  };

  if (flowState === "success") return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div>
        <h2 className="text-2xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم اعتماد الفاتورة بنجاح!" : "Invoice Approved!"}</h2>
        <div className="font-mono text-slate-400 mb-6 font-bold">INV-2025-0087</div>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-slate-50 rounded-2xl p-3 text-center"><div className="text-lg font-black font-mono text-[#0F2C59]">AED {grandTotal.toFixed(2)}</div><div className="text-xs text-slate-400 font-bold">{isRTL ? "الإجمالي" : "Total"}</div></div>
          <div className={`rounded-2xl p-3 text-center ${remaining > 0 ? "bg-amber-50" : "bg-emerald-50"}`}><div className={`text-lg font-black font-mono ${remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>{remaining > 0 ? `AED ${remaining.toFixed(2)}` : (isRTL ? "مدفوع ✓" : "Paid ✓")}</div><div className="text-xs text-slate-400 font-bold">{isRTL ? "المتبقي" : "Remaining"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn size="sm" variant="primary" onClick={() => onNavigate("sales-preview")} className="justify-center"><Printer size={13} />{isRTL ? "طباعة الفاتورة" : "Print"}</Btn>
          {remaining > 0 && <Btn size="sm" variant="green" className="justify-center"><Wallet size={13} />{isRTL ? "تسجيل تحصيل" : "Collect"}</Btn>}
          <Btn size="sm" variant="secondary" onClick={() => { setLines([]); setCustomerId(""); setAmountPaid(""); setFlowState("form"); }} className="justify-center"><Plus size={13} />{isRTL ? "فاتورة جديدة" : "New Invoice"}</Btn>
          <Btn size="sm" variant="outline" onClick={() => onNavigate("sales-list")} className="justify-center"><FileText size={13} />{isRTL ? "قائمة الفواتير" : "Invoice List"}</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3 lg:p-6 max-w-screen-xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("sales-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#0F2C59]">{isRTL ? "فاتورة بيع جديدة" : "New Sales Invoice"}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap"><span className="font-mono text-xs text-slate-400">INV-2025-0087</span><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{isRTL ? "مسودة" : "Draft"}</span><span className="text-xs text-slate-400">· {new Date().toLocaleDateString(isRTL ? "ar-AE" : "en-AE")}</span></div>
        </div>
        <button onClick={() => setShowNumberingNew(true)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#0F2C59] transition-colors">
          <Settings size={13} />{isRTL ? "إعدادات الترقيم" : "Numbering Settings"}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* LEFT */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Customer */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "العميل" : "Customer"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "اختر العميل" : "Select Customer"} <span className="text-red-500">*</span></label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#0F2C59] outline-none font-semibold text-slate-700">
                  <option value="">{isRTL ? "— اختر العميل —" : "— Select Customer —"}</option>
                  {S_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name : c.nameEn}</option>)}
                </select>
              </div>
              {customer && (
                <div className="space-y-2">
                  {customer.balance > 0 && (
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold ${customer.overdue ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                      <AlertTriangle size={14} className="shrink-0" />
                      {isRTL ? `على العميل مبلغ مستحق: AED ${customer.balance.toLocaleString()}` : `Outstanding balance: AED ${customer.balance.toLocaleString()}`}
                      {customer.overdue && <span className="font-bold text-xs opacity-80"> — {isRTL ? "متأخر" : "Overdue"}</span>}
                    </div>
                  )}
                  {customer.balance > customer.creditLimit * 0.9 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-300 text-sm font-bold text-red-700">
                      <XCircle size={14} className="shrink-0" />{isRTL ? "تحذير: العميل تجاوز الحد الائتماني" : "Warning: Customer exceeded credit limit"}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3">
                    <div><div className="text-xs text-slate-400 font-bold">{isRTL ? "الهاتف" : "Phone"}</div><div className="text-xs font-bold text-slate-700">{customer.phone}</div></div>
                    <div><div className="text-xs text-slate-400 font-bold">{isRTL ? "الحد الائتماني" : "Credit Limit"}</div><div className="text-xs font-mono font-bold text-slate-700">AED {customer.creditLimit.toLocaleString()}</div></div>
                    {customer.trn && <div><div className="text-xs text-slate-400 font-bold">TRN</div><div className="text-xs font-mono font-bold text-slate-700">{customer.trn}</div></div>}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Items */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "المنتجات" : "Products"}</h3>
              <select value={selectedProduct} onChange={e => { if (e.target.value) addLine(e.target.value); setSelectedProduct(""); }}
                className="px-3 py-1.5 rounded-xl border border-[#0F2C59]/20 text-sm bg-white font-bold text-[#0F2C59] focus:border-[#0F2C59] outline-none cursor-pointer">
                <option value="">{isRTL ? "+ إضافة منتج" : "+ Add Product"}</option>
                <optgroup label={isRTL ? "أوزان الدجاج" : "Chicken Weights"}>
                  {S_PRODUCTS.filter(p => !p.isPart).map(p => <option key={p.id} value={p.id}>{p.name} — AED {p.priceKg}/KG ({isRTL ? "متوفر:" : "Stock:"} {p.stock})</option>)}
                </optgroup>
                <optgroup label={isRTL ? "الأجزاء" : "Parts"}>
                  {S_PRODUCTS.filter(p => p.isPart).map(p => <option key={p.id} value={p.id}>{isRTL ? p.nameAr : p.name} — AED {p.priceKg}/KG</option>)}
                </optgroup>
              </select>
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <Package size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 font-semibold text-sm">{isRTL ? "أضف منتجاً للبدء" : "Add a product to start"}</p>
              </div>
            ) : (
              <>
                {/* Desktop header */}
                <div className="hidden lg:grid gap-2 px-2 pb-2 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wide" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                  <span>{isRTL ? "المنتج" : "Product"}</span>
                  <span className="text-center">{isRTL ? "كرتون" : "Ct"}</span>
                  <span className="text-center">{isRTL ? "حبة" : "Pcs"}</span>
                  <span className="text-center">KG</span>
                  <span className="text-center">{isRTL ? "سعر KG" : "Price/KG"}</span>
                  <span className="text-center">{isRTL ? "المبلغ" : "Amount"}</span>
                  <span />
                </div>
                <div className="space-y-2 mt-2">
                  {lines.map(line => {
                    const prod = S_PRODUCTS.find(p => p.id === line.productId)!;
                    const stockOk = prod.isPart || line.cartons <= prod.stock;
                    const stockLow = !prod.isPart && prod.stock < 200;
                    return (
                      <div key={line.id} className={`rounded-2xl border-2 p-3 transition-all ${!stockOk ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50/50"}`}>
                        {/* Desktop row */}
                        <div className="hidden lg:grid gap-2 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto" }}>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {!prod.isPart && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${!stockOk ? "bg-red-100 text-red-700" : stockLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{!stockOk ? (isRTL ? "غير كافٍ" : "Insufficient") : stockLow ? (isRTL ? `منخفض: ${prod.stock}` : `Low: ${prod.stock}`) : (isRTL ? `${prod.stock} متوفر` : `${prod.stock} in stock`)}</span>}
                              {line.priceOverride && <AuditBadge type="price" lang={lang} />}
                              {line.kgOverride && <AuditBadge type="kg" lang={lang} />}
                              {!canEditPrice && !prod.isPart && <span className="text-[10px] text-slate-400">{isRTL ? "سعر القائمة" : "List price"}</span>}
                            </div>
                          </div>
                          <input type="number" min="0" value={line.cartons || ""} onChange={e => updateLine(line.id, "cartons", parseFloat(e.target.value) || 0)} disabled={prod.isPart} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none disabled:bg-slate-100 disabled:text-slate-300 bg-white" />
                          <input type="number" min="0" value={line.pcs || ""} onChange={e => updateLine(line.id, "pcs", parseFloat(e.target.value) || 0)} disabled={prod.isPart} placeholder="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none disabled:bg-slate-100 disabled:text-slate-300 bg-white" />
                          <input type="number" min="0" step="0.1" value={line.kg || ""} onChange={e => { updateLine(line.id, "kgOverride", true); updateLine(line.id, "kg", parseFloat(e.target.value) || 0); }} placeholder="0.0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none bg-white" />
                          <input type="number" min="0" step="0.01" value={line.priceKg || ""} onChange={e => { updateLine(line.id, "priceOverride", true); updateLine(line.id, "priceKg", parseFloat(e.target.value) || 0); }} disabled={!canEditPrice} className={`w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm font-mono focus:border-[#0F2C59] outline-none ${!canEditPrice ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`} />
                          <div className="text-center font-mono font-black text-[#0F2C59] text-sm">{line.amount > 0 ? line.amount.toFixed(2) : "—"}</div>
                          <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><X size={14} /></button>
                        </div>
                        {/* Mobile card */}
                        <div className="lg:hidden space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm text-slate-800">{isRTL ? prod.nameAr : prod.name}</div>
                            <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))} className="p-1 rounded-lg text-slate-300 hover:text-red-500"><X size={14} /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {!prod.isPart && <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{isRTL ? "كرتون" : "Ct"}</label><input type="number" min="0" value={line.cartons || ""} onChange={e => updateLine(line.id, "cartons", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div>}
                            <div><label className="text-[10px] font-bold text-slate-400 block mb-1">KG</label><input type="number" step="0.1" value={line.kg || ""} onChange={e => updateLine(line.id, "kg", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-slate-200 text-center text-sm font-mono bg-white" /></div>
                          </div>
                          <div className={`text-end font-mono font-black text-[#0F2C59] text-sm`}>{line.amount > 0 ? `AED ${line.amount.toFixed(2)}` : "—"}</div>
                        </div>
                        {!stockOk && <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertTriangle size={12} />{isRTL ? "الكمية المطلوبة أكبر من المخزون المتاح" : "Requested quantity exceeds available stock"}</div>}
                      </div>
                    );
                  })}
                </div>
                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-3">
                  {[[totalCartons, isRTL ? "كرتون" : "Cartons"], [totalPcs, isRTL ? "حبة" : "Pieces"], [`${totalKg.toFixed(1)} KG`, isRTL ? "إجمالي الكيلو" : "Total KG"]].map(([v, l]) => (
                    <div key={l as string} className="text-center"><div className="text-xl font-black font-mono text-[#0F2C59]">{v}</div><div className="text-xs text-slate-400 font-bold">{l}</div></div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملاحظات" : "Notes"}</h3>
            <div className="space-y-3">
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات الفاتورة" : "Invoice Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
            </div>
          </Card>
        </div>

        {/* RIGHT — Summary panel */}
        <div className="lg:w-80 xl:w-96 space-y-4 shrink-0">
          <Card className="p-5 lg:sticky lg:top-20">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص الفاتورة" : "Invoice Summary"}</h3>
            {/* VAT */}
            <div className="flex items-center justify-between py-2 mb-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-600">{isRTL ? "ضريبة القيمة المضافة 5%" : "VAT 5%"}</span>
              <button onClick={() => setVatEnabled(v => !v)} className={`w-10 h-[22px] rounded-full flex items-center transition-all ${vatEnabled ? "bg-[#0F2C59]" : "bg-slate-300"}`}>
                <span className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all mx-0.5 ${vatEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {/* Amounts */}
            <div className="space-y-2 mb-4">
              {[
                [isRTL ? "الإجمالي قبل الضريبة" : "Subtotal", `AED ${subtotal.toFixed(2)}`, "text-slate-700"],
                [isRTL ? "الضريبة 5%" : "VAT 5%", vatEnabled ? `AED ${vatAmt.toFixed(2)}` : "—", "text-slate-500"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-semibold">{l}</span><span className={`font-mono font-bold ${c}`}>{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="font-black text-[#0F2C59]">{isRTL ? "الإجمالي النهائي" : "Grand Total"}</span>
                <span className="font-mono font-black text-[#0F2C59] text-lg">AED {grandTotal.toFixed(2)}</span>
              </div>
            </div>
            {/* Payment method */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
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
              {grandTotal > 0 && (
                <div className={`flex items-center justify-between text-sm p-2.5 rounded-xl ${remaining > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                  <span className={`font-bold ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{isRTL ? "المتبقي" : "Remaining"}</span>
                  <span className={`font-mono font-black ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>AED {remaining.toFixed(2)}</span>
                </div>
              )}
            </div>
            {/* Company TRN info */}
            <div className="mt-3 bg-[#0F2C59]/5 border border-[#0F2C59]/15 rounded-xl p-3 flex items-center gap-2">
              <Info size={14} className="text-[#0F2C59]/60 shrink-0" />
              <span className="text-xs font-bold text-[#0F2C59]/70">{demoStr("TRN: 100345678901203")}</span>
            </div>
            {/* Stock issue */}
            {hasStockIssue && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-red-700">{isRTL ? "تعذّر الاعتماد: بعض الكميات تتجاوز المخزون المتاح" : "Cannot approve: some quantities exceed available stock"}</span>
              </div>
            )}
            {!canApprove && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                <Info size={14} className="text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-700">{isRTL ? "ليس لديك صلاحية اعتماد الفواتير" : "You do not have invoice approval permission"}</span>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap gap-3 justify-between shadow-lg z-10">
        <Btn variant="outline" onClick={() => onNavigate("sales-list")}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={() => toast.success(isRTL ? "تم حفظ المسودة ✓" : "Draft saved ✓")}>{isRTL ? "حفظ كمسودة" : "Save Draft"}</Btn>
          <Btn variant="outline" onClick={() => onNavigate("sales-preview")}><Eye size={14} />{isRTL ? "معاينة" : "Preview"}</Btn>
          <Btn variant="green" disabled={!customerId || lines.length === 0 || hasStockIssue || !canApprove} onClick={() => setFlowState("confirm")}><Check size={14} />{isRTL ? "اعتماد الفاتورة" : "Approve Invoice"}</Btn>
        </div>
      </div>

      {/* Approve confirmation modal */}
      {flowState === "confirm" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#0F2C59] mb-1">{isRTL ? "تأكيد اعتماد الفاتورة" : "Confirm Invoice Approval"}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{isRTL ? "هل تريد اعتماد الفاتورة؟ بعد الاعتماد سيتم خصم الكميات من المخزون وتحديث حساب العميل." : "After approval, quantities will be deducted from stock and customer balance updated."}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-2xl p-4">
                {[[totalCartons, isRTL ? "كرتون" : "Cartons"], [totalPcs, isRTL ? "حبة" : "Pieces"], [`${totalKg.toFixed(1)} KG`, isRTL ? "الكيلو" : "Weight"]].map(([v, l]) => (
                  <div key={l as string} className="text-center"><div className="text-xl font-black text-[#0F2C59] font-mono">{v}</div><div className="text-xs text-slate-400 font-bold">{l}</div></div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  [isRTL ? "الإجمالي النهائي" : "Grand Total", `AED ${grandTotal.toFixed(2)}`, "text-[#0F2C59]"],
                  [isRTL ? "المدفوع الآن" : "Paid Now", `AED ${paid.toFixed(2)}`, "text-emerald-600"],
                  [isRTL ? "المتبقي على العميل" : "Customer Remaining", `AED ${remaining.toFixed(2)}`, remaining > 0 ? "text-red-500" : "text-emerald-600"],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between text-sm"><span className="font-semibold text-slate-500">{l}</span><span className={`font-mono font-black ${c}`}>{v}</span></div>
                ))}
              </div>
              {lines.length > 0 && (
                <div className="bg-[#0F2C59]/5 rounded-xl p-3">
                  <div className="text-xs font-black text-slate-500 mb-2">{isRTL ? "خصم المخزون:" : "Stock Deduction:"}</div>
                  {lines.slice(0, 5).map(l => { const p = S_PRODUCTS.find(x => x.id === l.productId); return p ? <div key={l.id} className="text-xs text-slate-600 font-semibold py-0.5">{isRTL ? p.nameAr : p.name}: {l.cartons > 0 ? `${l.cartons} ${isRTL ? "كرتون" : "Ct"}, ` : ""}{l.kg} KG</div> : null; })}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <Btn variant="outline" onClick={() => setFlowState("form")} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
              <Btn variant="green" onClick={() => { toast.success(isRTL ? "تم اعتماد الفاتورة بنجاح!" : "Invoice approved!"); setFlowState("success"); }} className="flex-1 justify-center"><Check size={15} />{isRTL ? "تأكيد الاعتماد" : "Confirm Approval"}</Btn>
            </div>
          </div>
        </div>
      )}
      {showNumbering && <InvoiceNumberingModal lang={lang} role={role} onClose={() => setShowNumberingNew(false)} />}
    </div>
  );
}

// ── SCREEN: INVOICE PREVIEW / PRINT ───────────────────────────────────────────
function SalesDetailLiveRouter({ lang, role, onNavigate, salesId, canApprove }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; salesId: string; canApprove: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void getSalesDetail(salesId)
      .then((d) => {
        if (!cancelled) setStatus(d?.invoice.status ?? "draft");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [salesId]);

  if (checking) return <LoadingState lang={lang} />;
  if (status === "draft") {
    return (
      <LiveSalesInvoiceScreen
        lang={lang}
        role={role}
        onNavigate={onNavigate}
        invoiceId={salesId}
      />
    );
  }

  return (
    <LiveDocumentReadOnly
      lang={lang}
      onNavigate={onNavigate}
      backScreen="sales-list"
      titleAr="فاتورة بيع"
      titleEn="Sales Invoice"
      printScreen="sales-preview"
      canApprove={canApprove}
      canCancel={canApprove}
      loadDetail={async () => {
        const detail = await getSalesDetail(salesId);
        if (!detail) return null;
        const inv = detail.invoice;
        return {
          id: inv.id,
          number: inv.number,
          status: inv.status,
          date: inv.date,
          partyName: inv.customer,
          subtotal: inv.subtotal,
          vat: inv.vat,
          total: inv.total,
          paid: inv.paid,
          balance: inv.balance,
          lines: detail.lines.map((l) => ({
            id: l.id,
            label: l.productName,
            qty: l.qty,
            unit: l.unit,
            price: l.price,
            total: l.total,
          })),
        };
      }}
      onApprove={async () => { await approveSale(salesId, ""); }}
      onCancel={async (reason) => { await cancelSale(salesId, reason); }}
    />
  );
}

function SalesPreviewScreen({ lang, onNavigate, role, salesId }: {
  lang: Lang; onNavigate: (s: TenantScreen) => void; role?: TenantRole; salesId?: string;
}) {
  if (!IS_MOCK_MODE && salesId) {
    return (
      <LivePrintPreviewScreen
        lang={lang}
        onNavigate={onNavigate}
        backScreen="sales-list"
        titleAr="فاتورة ضريبية"
        titleEn="Tax Invoice"
        loadPreview={() => getSalesPrintPreview(salesId)}
      />
    );
  }
  const isRTL = lang === "ar";
  const [showTemplate, setShowTemplate] = useState(false);
  const sampleLines = [
    { p: "1100 GRAM", pAr: "1100 جرام", ct: 2, pcs: 20, kg: 22,   price: 14.75, amount: 324.50 },
    { p: "1200 GRAM", pAr: "1200 جرام", ct: 2, pcs: 20, kg: 24,   price: 14.75, amount: 354.00 },
    { p: "1250 GRAM", pAr: "1250 جرام", ct: 2, pcs: 20, kg: 25,   price: 14.75, amount: 368.75 },
    { p: "1300 GRAM", pAr: "1300 جرام", ct: 4, pcs: 40, kg: 52,   price: 14.75, amount: 767.00 },
    { p: "Liver",     pAr: "كبدة",      ct: 0, pcs: 0,  kg: 13,   price: 4.00,  amount: 52.00 },
    { p: "Gizzard",   pAr: "قانصة",     ct: 0, pcs: 0,  kg: 5,    price: 4.00,  amount: 20.00 },
  ];
  const subtotal = 1906.25; const vat = 95.31; const grandTotal = 2001.56;
  const tCt = 10; const tPcs = 100; const tKg = 141;

  return (
    <div className="p-4 lg:p-8 max-w-screen-lg mx-auto">
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => onNavigate("sales-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1" />
        <Btn variant="primary" onClick={() => window.print()}><Printer size={15} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn variant="secondary"><Download size={15} />PDF</Btn>
        <Btn variant="outline"><span className="text-emerald-600 text-base">📱</span>WhatsApp</Btn>
        <Btn variant="outline"><Mail size={14} />{isRTL ? "بريد" : "Email"}</Btn>
        <button onClick={() => setShowTemplate(true)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#0F2C59] border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
          <Settings size={13} />{isRTL ? "إعدادات قالب الطباعة" : "Print Template Settings"}
        </button>
      </div>
      {showTemplate && <PrintTemplatePanel lang={lang} role={role || "owner"} onClose={() => setShowTemplate(false)} />}

      {/* Document */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0F2C59] text-white p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-2xl font-black">{demoStr("شركة الوطنية للدواجن", isRTL ? "اسم الشركة" : "Company Name")}</div>
              <div className="text-base font-bold text-white/75">{demoStr("Al Wataniyah Poultry Company LLC")}</div>
              <div className="text-sm text-white/55 mt-2">{demoStr(isRTL ? "المنطقة الصناعية، الشارع 12، دبي — UAE" : "Industrial Area, Street 12, Dubai — UAE")}</div>
              <div className="text-sm text-white/55">{demoStr("+971 50 123 4567 | TRN: 100345678901203")}</div>
            </div>
            <div className="text-end">
              <div className="text-2xl font-black text-[#22C55E] leading-tight">TAX INVOICE</div>
              <div className="text-xl font-black text-white/75">فاتورة ضريبية</div>
              <div className="mt-3 space-y-0.5">
                <div className="text-sm font-bold text-white/70">{isRTL ? "رقم الفاتورة:" : "Invoice #:"} <span className="font-mono text-[#22C55E] font-black">{demoStr("INV-2025-0086", "—")}</span></div>
                <div className="text-sm font-bold text-white/70">{isRTL ? "التاريخ:" : "Date:"} <span className="font-mono text-white">{demoStr("2025-01-28", "—")}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1.5">{isRTL ? "فاتورة إلى / Bill To" : "Bill To / فاتورة إلى"}</div>
            <div className="font-black text-slate-800 text-lg">{demoStr("مطعم الخليج", isRTL ? "اسم العميل" : "Customer Name")}</div>
            <div className="font-bold text-slate-500">{demoStr("Al Khalij Restaurant")}</div>
            <div className="text-sm text-slate-400 mt-1">{demoStr("+971 50 123 4567")}</div>
          </div>
          <div className={isRTL ? "" : "text-right"}>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mb-1.5">{isRTL ? "TRN العميل" : "Customer TRN"}</div>
            <div className="font-mono text-slate-400 text-sm">—</div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wide mt-2 mb-1.5">{isRTL ? "نوع الدفع" : "Payment Type"}</div>
            <span className="text-sm font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">{isRTL ? "كاش / Cash" : "Cash / كاش"}</span>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0F2C59] text-white">
                {[["المنتج","Product"],["Ct","كرتون"],["Pcs","حبة"],["Kg","كيلو"],["Price/KG","سعر"],["Amount AED","المبلغ"]].map(([en,ar],i) => (
                  <th key={`ph-${i}`} className="px-3 py-2.5 text-center font-bold text-xs border border-[#0F2C59]/20 whitespace-nowrap">
                    <div>{isRTL ? ar : en}</div><div className="text-white/60 font-normal text-[10px]">{isRTL ? en : ar}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleLines.map((l, i) => (
                <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} border-b border-slate-200`}>
                  <td className="px-3 py-2.5 font-bold text-slate-800 text-center">{isRTL ? l.pAr : l.p} {!isRTL ? `/ ${l.pAr}` : `/ ${l.p}`}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.ct || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.pcs || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-700 font-bold">{l.kg}</td>
                  <td className="px-3 py-2.5 font-mono text-center text-slate-600">{l.price.toFixed(2)}</td>
                  <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{l.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-[#0F2C59]/8 border-t-2 border-[#0F2C59]">
                <td className="px-3 py-2.5 font-black text-center text-slate-700">{isRTL ? "الإجمالي / Total" : "Total / الإجمالي"}</td>
                <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{tCt}</td>
                <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{tPcs}</td>
                <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{tKg}</td>
                <td />
                <td className="px-3 py-2.5 font-mono font-black text-center text-[#0F2C59]">{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals + Signatures */}
        <div className="px-6 pb-8">
          <div className="flex justify-end mb-5">
            <div className="w-72 border-2 border-[#0F2C59] rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-200">
                {[
                  [isRTL ? "الإجمالي قبل الضريبة / Subtotal" : "Subtotal / الإجمالي قبل الضريبة", subtotal.toFixed(2), "text-slate-700 bg-slate-50"],
                  [isRTL ? "ضريبة 5% / VAT" : "VAT 5% / ضريبة", vat.toFixed(2), "text-slate-700 bg-slate-50"],
                ].map(([l, v, c]) => (
                  <div key={l} className={`flex justify-between px-4 py-2 text-sm ${c}`}>
                    <span className="font-semibold text-slate-600">{l}</span>
                    <span className="font-mono font-bold">AED {v}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-[#0F2C59] items-center">
                  <span className="font-black text-white text-sm">{isRTL ? "الإجمالي النهائي / Grand Total" : "Grand Total / الإجمالي النهائي"}</span>
                  <span className="font-mono font-black text-[#22C55E] text-lg">AED {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 mb-6 text-sm">
            <span className="font-black text-slate-400 text-xs">{isRTL ? "المبلغ كتابةً: " : "Amount in Words: "}</span>
            <span className="font-bold text-slate-700">Two Thousand One Dirham and Fifty-Six Fils Only — ألفان وواحد درهم وستة وخمسون فلساً فقط</span>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="border-t-2 border-slate-300 pt-4 text-center">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wide">{isRTL ? "توقيع المستلم / Receiver Signature" : "Receiver Signature / توقيع المستلم"}</div>
              <div className="h-14" />
            </div>
            <div className="border-t-2 border-slate-300 pt-4 text-center">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wide">{isRTL ? "ختم الشركة / Company Stamp" : "Company Stamp / ختم الشركة"}</div>
              <div className="h-14 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-dashed border-[#0F2C59]/20 flex items-center justify-center">
                  <span className="text-[9px] font-black text-[#0F2C59]/25 text-center leading-tight">STAMP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: INVOICE DETAIL ─────────────────────────────────────────────────────
function SalesDetailScreen({ lang, role, onNavigate, salesId }: {
  lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void; salesId?: string;
}) {
  const canApprove = role === "owner" || role === "accountant";
  if (!IS_MOCK_MODE) {
    if (!salesId) {
      return <EmptyState lang={lang} messageAr="اختر فاتورة من القائمة" messageEn="Select an invoice from the list" />;
    }
    return (
      <SalesDetailLiveRouter
        lang={lang}
        role={role}
        onNavigate={onNavigate}
        salesId={salesId}
        canApprove={canApprove}
      />
    );
  }
  const isRTL = lang === "ar";
  const [tab, setTab] = useState("invoice");
  const [showCollect, setShowCollect] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const inv = S_INVOICES[1]; // partial payment invoice for demo

  const detailTabs = [
    { k: "invoice", ar: "الفاتورة", en: "Invoice" },
    { k: "payments", ar: "المدفوعات", en: "Payments" },
    { k: "adjustments", ar: "تعديلات التحصيل", en: "Adjustments" },
    { k: "inventory", ar: "حركة المخزون", en: "Inventory" },
    { k: "audit", ar: "سجل العمليات", en: "Audit Log" },
  ];

  const detailLines = [
    { p: "1100 GRAM / 1100 جرام", ct: 2, pcs: 20, kg: 22,   amount: 324.50 },
    { p: "1200 GRAM / 1200 جرام", ct: 2, pcs: 20, kg: 24,   amount: 354.00 },
    { p: "1300 GRAM / 1300 جرام", ct: 4, pcs: 40, kg: 52,   amount: 767.00 },
    { p: "كبدة / Liver",          ct: 0, pcs: 0,  kg: 13,   amount: 52.00 },
    { p: "قانصة / Gizzard",       ct: 0, pcs: 0,  kg: 5,    amount: 20.00 },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => onNavigate("sales-list")} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0 mt-0.5">{isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#0F2C59]">{inv.id}</h2>
            <SInvStatusBadge status={inv.status} lang={lang} />
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{isRTL ? inv.customer : inv.customerEn} · {inv.date} · {inv.user}</div>
        </div>
      </div>

      {/* Actions */}
      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Btn size="sm" variant="primary" onClick={() => onNavigate("sales-preview")}><Printer size={13} />{isRTL ? "طباعة" : "Print"}</Btn>
        <Btn size="sm" variant="green" onClick={() => setShowCollect(true)}><Wallet size={13} />{isRTL ? "تسجيل تحصيل" : "Record Collection"}</Btn>
        <Btn size="sm" variant="outline" onClick={() => setShowAdjust(true)}><Tag size={13} />{isRTL ? "خصم عند التحصيل" : "Collection Discount"}</Btn>
        <Btn size="sm" variant="outline"><FileText size={13} />{isRTL ? "تكرار الفاتورة" : "Duplicate"}</Btn>
        {/* Tax Credit Note — coming soon */}
        <div className="relative group">
          <button className="inline-flex items-center gap-1.5 font-bold rounded-xl border px-3 py-1.5 text-xs bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-70 select-none">
            <Calculator size={13} />
            {isRTL ? "إشعار دائن ضريبي" : "Tax Credit Note"}
            <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{isRTL ? "قريباً" : "Soon"}</span>
          </button>
          <div className={`absolute bottom-full mb-2 ${isRTL ? "left-0" : "right-0"} bg-[#0F2C59] text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none shadow-xl leading-snug max-w-60 text-center`}>
            {isRTL ? "سيتم استخدامه لاحقاً عند الحاجة لتعديل فاتورة ضريبية معتمدة أو تخفيض قيمتها." : "Used to adjust or reduce an approved tax invoice value for VAT purposes."}
            <span className={`absolute top-full ${isRTL ? "left-4" : "right-4"} border-4 border-transparent border-t-[#0F2C59]`} />
          </div>
        </div>
        {role === "owner"
          ? <Btn size="sm" variant="danger" onClick={() => setShowCancel(true)}><Ban size={13} />{isRTL ? "إلغاء الفاتورة" : "Cancel Invoice"}</Btn>
          : <PermBtn lang={lang}><Ban size={13} />{isRTL ? "إلغاء الفاتورة" : "Cancel Invoice"}</PermBtn>}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ ar: "الإجمالي النهائي", en: "Grand Total", v: `AED ${inv.total.toLocaleString()}`, cls: "text-[#0F2C59]" }, { ar: "المدفوع", en: "Paid", v: `AED ${inv.paid.toLocaleString()}`, cls: "text-emerald-600" }, { ar: "المتبقي", en: "Remaining", v: `AED ${inv.remaining.toLocaleString()}`, cls: inv.remaining > 0 ? "text-red-500" : "text-emerald-600" }, { ar: "إجمالي الكيلو", en: "Total KG", v: `${inv.kg} KG`, cls: "text-slate-700" }].map(f => (
          <Card key={f.ar} className="p-4 text-center"><div className={`text-lg font-black font-mono ${f.cls}`}>{f.v}</div><div className="text-xs font-bold text-slate-400 mt-1">{isRTL ? f.ar : f.en}</div></Card>
        ))}
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-slate-100 px-2 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {detailTabs.map(t => <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-3.5 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${tab === t.k ? "border-[#0F2C59] text-[#0F2C59]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{isRTL ? t.ar : t.en}</button>)}
          </div>
        </div>
        <div className="p-5">
          {tab === "invoice" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[{ ar: "العميل", en: "Customer", v: isRTL ? inv.customer : inv.customerEn }, { ar: "التاريخ", en: "Date", v: inv.date }, { ar: "طريقة الدفع", en: "Method", v: inv.method === "credit" ? (isRTL ? "آجل" : "Credit") : inv.method === "bank" ? (isRTL ? "بنكي" : "Bank") : (isRTL ? "كاش" : "Cash") }, { ar: "الكراتين", en: "Cartons", v: `${inv.cartons}` }, { ar: "الكيلو", en: "KG", v: `${inv.kg} KG` }, { ar: "أُنشئ بواسطة", en: "Created By", v: inv.user }].map(f => (
                  <div key={f.ar} className="bg-slate-50 rounded-xl p-3"><div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? f.ar : f.en}</div><div className="font-bold text-slate-800 text-sm">{f.v}</div></div>
                ))}
              </div>
              <div className="bg-[#0F2C59]/5 rounded-2xl p-4 space-y-1">
                <div className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">{isRTL ? "المنتجات" : "Products"}</div>
                {detailLines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/60 last:border-0">
                    <span className="font-bold text-slate-700">{l.p}</span>
                    <div className="flex items-center gap-4 text-slate-500">
                      {l.ct > 0 && <span className="font-mono">{l.ct} Ct</span>}
                      <span className="font-mono">{l.kg} KG</span>
                      <span className="font-mono font-black text-[#0F2C59]">AED {l.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "payments" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-amber-500 shrink-0" />
                <div><div className="font-black text-amber-700">{isRTL ? "مدفوع جزئياً" : "Partially Paid"}</div><div className="text-sm text-amber-600">{isRTL ? `المتبقي: AED ${inv.remaining.toLocaleString()}` : `Remaining: AED ${inv.remaining.toLocaleString()}`}</div></div>
                <Btn size="sm" variant="green" onClick={() => setShowCollect(true)} className={`${isRTL ? "mr-auto" : "ml-auto"}`}><Wallet size={13} />{isRTL ? "تحصيل" : "Collect"}</Btn>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <div><div className="font-bold text-slate-800">AED {inv.paid.toLocaleString()}</div><div className="text-xs text-slate-400">{inv.date} · {isRTL ? "جزئي" : "Partial"}</div></div>
                <SInvStatusBadge status="partial" lang={lang} />
              </div>
            </div>
          )}
          {tab === "adjustments" && (
            <div className="space-y-4">
              {/* Explanation: 3 adjustment types */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Card 1: Collection Discount — available */}
                <div className="border-2 border-[#0F2C59]/20 rounded-2xl p-4 bg-[#0F2C59]/3 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-[#0F2C59]/10 rounded-xl flex items-center justify-center shrink-0"><Tag size={16} className="text-[#0F2C59]" /></div>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{isRTL ? "متاح" : "Available"}</span>
                  </div>
                  <h4 className="font-black text-[#0F2C59] text-sm mb-1">{isRTL ? "خصم عند التحصيل" : "Collection Discount"}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2 flex-1">{isRTL ? "يقلل رصيد العميل فقط ولا يغير كميات المخزون داخل الفاتورة المعتمدة." : "Reduces customer balance only. Does not change approved invoice stock quantities."}</p>
                  <div className="space-y-0.5 mb-3">
                    {[isRTL ? "دجاج نافق" : "Dead chicken", isRTL ? "خصم تجاري" : "Commercial discount", isRTL ? "تسوية مع العميل" : "Customer settlement", isRTL ? "فرق وزن" : "Weight difference"].map(u => (
                      <div key={u} className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />{u}</div>
                    ))}
                  </div>
                  <Btn size="sm" variant="primary" className="w-full justify-center mt-auto" onClick={() => setShowAdjust(true)}><Plus size={12} />{isRTL ? "إضافة خصم عند التحصيل" : "Add Collection Discount"}</Btn>
                </div>
                {/* Card 2: Sales Return — soon */}
                <div className="border-2 border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><RefreshCw size={16} className="text-slate-400" /></div>
                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{isRTL ? "قريباً" : "Coming soon"}</span>
                  </div>
                  <h4 className="font-black text-slate-400 text-sm mb-1">{isRTL ? "مرتجع مبيعات" : "Sales Return"}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1 mb-3">{isRTL ? "يستخدم عند رجوع بضاعة فعلية من العميل ويجب أن يؤثر على المخزون." : "Used when actual goods return from customer. Affects inventory stock."}</p>
                  <div className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 border border-slate-200 rounded-xl px-3 py-1.5 cursor-not-allowed opacity-60 w-full">
                    <Plus size={12} />{isRTL ? "إنشاء مرتجع" : "Create Return"}
                  </div>
                </div>
                {/* Card 3: Tax Credit Note — soon */}
                <div className="border-2 border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><Calculator size={16} className="text-slate-400" /></div>
                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{isRTL ? "قريباً" : "Coming soon"}</span>
                  </div>
                  <h4 className="font-black text-slate-400 text-sm mb-1">{isRTL ? "إشعار دائن ضريبي" : "Tax Credit Note"}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1 mb-3">{isRTL ? "يستخدم عند تعديل أو تخفيض فاتورة ضريبية معتمدة لأغراض الضريبة." : "Used to adjust or reduce an approved tax invoice for VAT purposes."}</p>
                  <div className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 border border-slate-200 rounded-xl px-3 py-1.5 cursor-not-allowed opacity-60 w-full">
                    <Plus size={12} />{isRTL ? "إنشاء إشعار دائن" : "Create Credit Note"}
                  </div>
                </div>
              </div>
              {/* Recorded adjustments (empty) */}
              <div className="text-center py-5 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 font-semibold text-sm">{isRTL ? "لا توجد تعديلات تحصيل مسجلة بعد" : "No collection adjustments recorded yet"}</p>
              </div>
            </div>
          )}
          {tab === "inventory" && (
            <div className="space-y-2">
              {detailLines.map((l, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                  <span className="font-bold text-sm text-slate-700">{l.p}</span>
                  <span className="font-mono font-black text-red-600 text-sm">−{l.ct > 0 ? `${l.ct}Ct, ` : ""}{l.kg} KG</span>
                </div>
              ))}
              <div className="bg-slate-50 rounded-xl p-3 text-center mt-3">
                <div className="text-sm font-bold text-slate-500">{isRTL ? "تم خصم المخزون بعد الاعتماد" : "Stock deducted after approval"}</div>
                <div className="text-xs text-slate-400 mt-0.5">{inv.date} · {inv.user}</div>
              </div>
            </div>
          )}
          {tab === "audit" && (
            <div className="space-y-2">
              {[
                { t: `${inv.date} 15:45`, a: isRTL ? "تم تطبيق خصم عند التحصيل" : "Collection Discount Applied",  u: "أحمد (مالك)",   prev: `AED ${inv.remaining.toLocaleString()}`, next: "AED 4,760", reason: isRTL ? "فرق وزن" : "Weight difference", dot: "bg-amber-500" },
                { t: `${inv.date} 14:30`, a: isRTL ? "اعتماد الفاتورة" : "Invoice Approved",                       u: "أحمد (مالك)",   prev: isRTL ? "مسودة" : "Draft", next: isRTL ? "معتمدة" : "Approved", reason: "", dot: "bg-emerald-500" },
                { t: `${inv.date} 13:55`, a: isRTL ? "تم تعديل سعر المنتج" : "Product Price Modified",             u: "محمد (كاشير)", prev: "14.50 AED/KG", next: "14.75 AED/KG", reason: isRTL ? "سعر خاص للعميل" : "Special customer price", dot: "bg-amber-500" },
                { t: `${inv.date} 13:42`, a: isRTL ? "تم تعديل الكيلو يدوياً" : "KG Overridden Manually",         u: "محمد (كاشير)", prev: "51.5 KG", next: "52 KG", reason: isRTL ? "قياس فعلي" : "Actual measurement", dot: "bg-amber-500" },
                { t: `${inv.date} 13:20`, a: isRTL ? "تم تغيير الضريبة" : "VAT Changed",                          u: "أحمد (مالك)",   prev: "0%", next: "5%", reason: isRTL ? "تفعيل ضريبة القيمة المضافة" : "VAT enabled", dot: "bg-red-500" },
                { t: `${inv.date} 13:10`, a: isRTL ? "تم فتح إعدادات قالب الطباعة" : "Print Template Settings Opened", u: "أحمد (مالك)", prev: "", next: "", reason: "", dot: "bg-slate-400" },
                { t: `${inv.date} 13:00`, a: isRTL ? "إنشاء الفاتورة" : "Invoice Created",                         u: "محمد (كاشير)", prev: "", next: isRTL ? "مسودة" : "Draft", reason: "", dot: "bg-emerald-500" },
              ].map((e, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} />
                      <span className="text-sm font-bold text-slate-700">{e.a}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-400 shrink-0">{e.t}</span>
                  </div>
                  <div className="text-xs text-slate-400 ms-4 mb-1.5">{e.u}</div>
                  {(e.prev || e.next || e.reason) && (
                    <div className="flex items-center gap-2 flex-wrap ms-4">
                      {e.prev && <span className="text-[10px] font-mono bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg">{isRTL ? "قبل:" : "Before:"} {e.prev}</span>}
                      {e.next && <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-lg">{isRTL ? "بعد:" : "After:"} {e.next}</span>}
                      {e.reason && <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg">{isRTL ? "السبب:" : "Reason:"} {e.reason}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showCollect && <SalesCollectModal lang={lang} invoiceId={inv.id} onClose={() => setShowCollect(false)} />}
      {showAdjust && <SalesAdjustModal lang={lang} invoiceId={inv.id} onClose={() => setShowAdjust(false)} />}
      {showCancel && <CancelInvoiceModal lang={lang} invoiceId={inv.id} onClose={() => setShowCancel(false)} />}
    </div>
  );
}

// ── MODAL: RECORD COLLECTION ───────────────────────────────────────────────────
function SalesCollectModal({ lang, invoiceId, onClose }: { lang: Lang; invoiceId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const inv = S_INVOICES.find(i => i.id === invoiceId) || S_INVOICES[1];
  const [amount, setAmount] = useState(String(inv.remaining));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState("2025-01-28");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);

  if (success) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-500" /></div>
        <h3 className="text-xl font-black text-[#0F2C59] mb-1">{isRTL ? "تم تسجيل التحصيل!" : "Collection Recorded!"}</h3>
        <p className="text-slate-400 font-semibold mb-6 font-mono">AED {parseFloat(amount || "0").toLocaleString()}</p>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" className="flex-1 justify-center"><Printer size={13} />{isRTL ? "طباعة إيصال" : "Print Receipt"}</Btn>
          <Btn variant="outline" size="sm" className="flex-1 justify-center" onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Btn>
        </div>
      </div>
    </div>
  );

  const afterRemaining = Math.max(0, inv.remaining - (parseFloat(amount) || 0));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "تسجيل تحصيل" : "Record Collection"}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Invoice info */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "الفاتورة" : "Invoice"}</span><span className="font-mono font-bold text-[#0F2C59]">{inv.id}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "العميل" : "Customer"}</span><span className="font-bold text-slate-800">{isRTL ? inv.customer : inv.customerEn}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "الإجمالي" : "Grand Total"}</span><span className="font-mono font-black text-[#0F2C59]">AED {inv.total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-semibold">{isRTL ? "المدفوع سابقاً" : "Previously Paid"}</span><span className="font-mono font-bold text-emerald-600">AED {inv.paid.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-black text-red-600">{isRTL ? "المتبقي الحالي" : "Current Outstanding"}</span><span className="font-mono font-black text-red-500">AED {inv.remaining.toLocaleString()}</span></div>
          </div>
          <FInput label={isRTL ? "المبلغ المُحصَّل (AED)" : "Amount Collected (AED)"} type="number" value={amount} onChange={setAmount} required />
          <FSelect label={isRTL ? "طريقة الدفع" : "Payment Method"} value={method} onChange={setMethod} options={[{ value: "cash", label: isRTL ? "كاش" : "Cash" }, { value: "bank", label: isRTL ? "تحويل بنكي" : "Bank Transfer" }, { value: "cheque", label: isRTL ? "شيك" : "Cheque" }, { value: "other", label: isRTL ? "أخرى" : "Other" }]} />
          <FInput label={isRTL ? "تاريخ التحصيل" : "Date"} type="date" value={date} onChange={setDate} />
          <FInput label={isRTL ? "رقم المرجع (اختياري)" : "Reference (Optional)"} value={ref} onChange={setRef} />
          {parseFloat(amount) > 0 && (
            <div className={`rounded-xl p-3 border ${afterRemaining === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className={`text-sm font-bold ${afterRemaining === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {isRTL ? `المتبقي بعد التحصيل: AED ${afterRemaining.toLocaleString()}` : `Remaining after collection: AED ${afterRemaining.toLocaleString()}`}
                {afterRemaining === 0 && (isRTL ? " ✓ مدفوعة بالكامل" : " ✓ Fully paid")}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="green" onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error(isRTL ? "يرجى إدخال المبلغ" : "Enter amount"); return; } setSuccess(true); }}><Check size={15} />{isRTL ? "تسجيل التحصيل" : "Record Collection"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: COLLECTION DISCOUNT ─────────────────────────────────────────────────
function SalesAdjustModal({ lang, invoiceId, onClose }: { lang: Lang; invoiceId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const inv = S_INVOICES.find(i => i.id === invoiceId) || S_INVOICES[1];
  const [reason, setReason] = useState(""); const [amount, setAmount] = useState(""); const [notes, setNotes] = useState("");
  const disc = parseFloat(amount) || 0;
  const after = Math.max(0, inv.remaining - disc);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mt-8 mb-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-[#0F2C59]">{isRTL ? "خصم عند التحصيل" : "Collection Discount"}</h3><p className="text-xs text-slate-400 font-mono">{invoiceId}</p></div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-700 leading-relaxed">{isRTL ? "هذا الخصم سيؤثر على رصيد العميل فقط ولن يغير كميات المخزون في الفاتورة المعتمدة." : "This discount affects customer balance only. Approved invoice stock quantities remain unchanged."}</p>
          </div>
          <FSelect label={isRTL ? "سبب الخصم" : "Discount Reason"} value={reason} onChange={setReason} required options={[
            { value: "", label: isRTL ? "اختر السبب" : "Select Reason" },
            { value: "dead", label: isRTL ? "دجاج نافق" : "Dead Chicken" },
            { value: "commercial", label: isRTL ? "خصم تجاري" : "Commercial Discount" },
            { value: "settlement", label: isRTL ? "تسوية مع العميل" : "Customer Settlement" },
            { value: "weight", label: isRTL ? "فرق وزن" : "Weight Difference" },
            { value: "owner", label: isRTL ? "قرار من صاحب الشركة" : "Owner Decision" },
            { value: "other", label: isRTL ? "سبب آخر" : "Other" },
          ]} />
          <FInput label={isRTL ? "مبلغ الخصم (AED)" : "Discount Amount (AED)"} type="number" value={amount} onChange={setAmount} required />
          <div><label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]" /></div>
          {disc > 0 && (
            <div className="bg-[#0F2C59]/5 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-black text-slate-500 mb-2">{isRTL ? "قبل وبعد التعديل" : "Before & After"}</div>
              {[
                [isRTL ? "إجمالي الفاتورة" : "Invoice Total", `AED ${inv.total.toLocaleString()}`, "text-slate-700"],
                [isRTL ? "المستحق قبل الخصم" : "Outstanding Before", `AED ${inv.remaining.toLocaleString()}`, "text-red-500"],
                [isRTL ? "الخصم" : "Discount", `−AED ${disc.toLocaleString()}`, "text-amber-600"],
                [isRTL ? "المستحق بعد الخصم" : "Outstanding After", `AED ${after.toLocaleString()}`, after === 0 ? "text-emerald-600" : "text-red-500"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex justify-between text-sm"><span className="font-semibold text-slate-500">{l}</span><span className={`font-mono font-black ${c}`}>{v}</span></div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
          <Btn variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Btn>
          <Btn variant="danger" onClick={() => { if (!reason || !amount) { toast.error(isRTL ? "يرجى إكمال جميع الحقول" : "Please fill all fields"); return; } toast.success(isRTL ? "تم تسجيل الخصم" : "Discount recorded"); onClose(); }}><Check size={15} />{isRTL ? "تطبيق الخصم" : "Apply Discount"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: CANCEL INVOICE ──────────────────────────────────────────────────────
function CancelInvoiceModal({ lang, invoiceId, onClose }: { lang: Lang; invoiceId: string; onClose: () => void }) {
  const isRTL = lang === "ar";
  const [reason, setReason] = useState(""); const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-red-600 mb-0.5">{isRTL ? "إلغاء الفاتورة" : "Cancel Invoice"}</h3>
          <p className="text-xs text-slate-400 font-mono">{invoiceId}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
            {[isRTL ? "ستُعاد الكميات إلى المخزون تلقائياً" : "Stock will be automatically returned", isRTL ? "سيتم تعديل رصيد العميل" : "Customer balance will be updated", isRTL ? "لا يمكن التراجع عن الإلغاء" : "This action cannot be undone"].map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-bold text-red-600"><XCircle size={12} className="shrink-0" />{w}</div>
            ))}
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "سبب الإلغاء *" : "Cancellation Reason *"}</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder={isRTL ? "أدخل سبب الإلغاء..." : "Enter reason..."} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 shrink-0" />
            <span className="text-sm font-bold text-slate-700">{isRTL ? "أفهم أن إلغاء الفاتورة سيعيد الكمية إلى المخزون ويعدل حساب العميل." : "I understand that cancellation will return stock and update customer balance."}</span>
          </label>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Btn variant="outline" onClick={onClose} className="flex-1 justify-center">{isRTL ? "رجوع" : "Back"}</Btn>
          <Btn variant="danger" disabled={!reason.trim() || !confirmed} onClick={() => { toast.success(isRTL ? "تم إلغاء الفاتورة" : "Invoice cancelled"); onClose(); }} className="flex-1 justify-center"><Ban size={14} />{isRTL ? "تأكيد الإلغاء" : "Confirm Cancel"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — imported from PurchaseModule.tsx to keep App.tsx under 500 KB
// ═══════════════════════════════════════════════════════════════════════════════
import { PurchListScreen, PurchNewScreen, PurchDetailScreen, PurchPreviewScreen, SupplierPayModal, CancelPurchModal } from "./PurchaseModule";
import { InventoryOverviewScreen, ProductDetailScreen as InvProductDetailScreen, StockAdjustModal, StocktakingScreen, LowStockScreen, MovementScreen, ValuationScreen, InventorySettingsPanel } from "./InventoryModule";
import { CustomersListScreen, CreateCustomerScreen, CustomerProfileScreen, CustomerCollectModal, CustomerStatementScreen, CreditOverrideModal } from "./CustomerModule";
import { SuppliersListScreen, CreateSupplierScreen, SupplierProfileScreen, SupplierStatementScreen } from "./SupplierModule";
import { ExpensesOverviewScreen, ExpensesListScreen, RecurringExpensesScreen, ExpenseDetailScreen, ExpenseVoucherScreen, ExpensesReportScreen, AddExpenseModal } from "./ExpensesModule";
import { ReportsHomeScreen, DailySummaryReport, SalesReportScreen, PurchaseReportScreen, InventoryReportScreen, CustomerReportScreen, SupplierReportScreen, TaxReportScreen, ProfitReportScreen, StatementsScreen, ReportBuilderScreen } from "./ReportsModule";
import { SettingsHomeScreen, CompanyProfileScreen, UsersListScreen, CreateUserScreen, UserPermissionsScreen, RolePermissionsScreen, SensitiveActionsScreen, SettingsAuditScreen, NumberingSettingsScreen, VATSettingsScreen, PrintTemplatesScreen, TransactionSettingsScreen, PlanFeaturesScreen, SecuritySettingsScreen } from "./SettingsModule";
import { QuotationsListScreen, NewQuotationScreen, QuotationDetailScreen, QuotationPreviewScreen, ConvertQuotationScreen, QuotationAnalyticsScreen } from "./QuotationsModule";
import { ProductsListScreen, AddProductScreen, ProductDetailScreen, ProductCategoriesScreen, BulkProductSetupScreen, ByProductsSetupScreen, ProductImportExportScreen, ProductSettingsPanel } from "./ProductModule";
import { PaymentsOverviewScreen, PaymentMovementsScreen, CustomerCollectionModal as PayCollectModal, SupplierPaymentModal as PaySupplierModal, CustomerRefundScreen, SupplierRefundScreen, ReceiptPreviewScreen, PaymentMethodSummaryScreen, CashBankAccountsScreen, PaymentsReportScreen } from "./PaymentsModule";
import { TaxDashboardScreen, SalesVATReportScreen, PurchaseVATReportScreen, NetVATScreen, TaxWarningsScreen, VATAuditScreen, TaxCreditNotesScreen, NonTaxableInvoicesScreen, TaxSettingsPanel, TaxExportPreviewScreen } from "./TaxModule";

// ═══════════════════════════════════════════════════════════════════════════════
// TENANT DASHBOARD — PHASE 2
// ═══════════════════════════════════════════════════════════════════════════════

function TenantSidebar({ screen, onNavigate, lang, isOpen, onClose, company, role, permissions }: {
  screen: TenantScreen; onNavigate: (s: TenantScreen) => void; lang: Lang;
  isOpen: boolean; onClose: () => void; company: Company; role: TenantRole; permissions: string[];
}) {
  const isRTL = lang === "ar";
  const visibleNav = getFilteredTenantNav(permissions, role);
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 h-full w-72 z-40 flex flex-col transition-transform duration-300 bg-[#0F2C59] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isRTL ? "right-0" : "left-0"} ${isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}`}>
        {/* Company brand */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#22C55E] rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <span className="text-white font-black text-sm">{company.nameAr[0]}</span>
            </div>
            <div className="min-w-0">
              <div className="text-white font-black text-sm leading-tight truncate">{isRTL ? company.nameAr : company.nameEn}</div>
              <div className="text-white/40 text-xs font-medium">{formatTenantHost(company.subdomain)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
              {company.status === "trial" ? (isRTL ? "تجريبي" : "Trial") : company.status === "active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Suspended")}
            </span>
            <span className="text-xs text-white/40 font-semibold">{isRTL ? "Poultry Hero" : "Poultry Hero"}</span>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = screen === item.key;
            return (
              <button key={item.key} onClick={() => { onNavigate(item.key); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-start ${active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/8 hover:text-white"}`}>
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{isRTL ? item.ar : item.en}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />}
              </button>
            );
          })}
        </nav>
        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center text-white font-black text-xs shrink-0">م</div>
            <div className="min-w-0">
              <div className="text-white text-xs font-bold truncate">{company.adminName}</div>
              <div className="text-white/40 text-xs">{role === "owner" ? (isRTL ? "المالك" : "Owner") : role === "accountant" ? (isRTL ? "محاسب" : "Accountant") : (isRTL ? "كاشير" : "Cashier")}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function TenantTopBar({ lang, onLangSwitch, onMenuClick, role, onRoleChange, onNotificationsClick, notifCount, company, onBack, onQAClick }: {
  lang: Lang; onLangSwitch: () => void; onMenuClick: () => void;
  role: TenantRole; onRoleChange: (r: TenantRole) => void;
  onNotificationsClick: () => void; notifCount: number; company: Company; onBack?: () => void;
  onQAClick: () => void;
}) {
  const isRTL = lang === "ar";
  const today = new Date().toLocaleDateString(isRTL ? "ar-AE" : "en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-3 lg:px-6 h-16 flex items-center gap-3">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"><Menu size={20} /></button>
      {/* Company */}
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="w-8 h-8 bg-[#0F2C59] rounded-xl flex items-center justify-center"><span className="text-white font-black text-xs">{company.nameAr[0]}</span></div>
        <div>
          <div className="text-sm font-black text-[#0F2C59] leading-tight">{isRTL ? company.nameAr : company.nameEn}</div>
          <div className="text-xs text-slate-400">{today}</div>
        </div>
      </div>
      <div className="flex-1" />
      {/* Role switcher (mock dev only) */}
      {IS_MOCK_MODE && (
      <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1">
        {([["owner", isRTL ? "المالك" : "Owner"], ["accountant", isRTL ? "محاسب" : "Accountant"], ["cashier", isRTL ? "كاشير" : "Cashier"]] as [TenantRole, string][]).map(([r, l]) => (
          <button key={r} onClick={() => onRoleChange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${role === r ? "bg-[#0F2C59] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      )}
      {/* Back to admin */}
      {onBack && (
      <button type="button" onClick={onBack} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-[#0F2C59] transition-all">
        <ChevronLeft size={13} className={isRTL ? "rotate-180" : ""} />
        {isRTL ? "لوحة الأدمن" : "Admin Panel"}
      </button>
      )}
      <button onClick={onLangSwitch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
        <Globe size={14} />{lang === "ar" ? "EN" : "ع"}
      </button>
      <button onClick={onNotificationsClick} className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100">
        <Bell size={18} />
        {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{notifCount}</span>}
      </button>
      <button onClick={onQAClick} title="QA Summary (Dev)" className="hidden lg:flex p-2 rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors">
        <Terminal size={15} />
      </button>
    </header>
  );
}

// Tenant Badge helpers
function InvBadge({ status, lang }: { status: "paid" | "partial" | "unpaid"; lang: Lang }) {
  const c = { paid: { bg: "bg-emerald-50", t: "text-emerald-700", ar: "مدفوع", en: "Paid" }, partial: { bg: "bg-amber-50", t: "text-amber-700", ar: "جزئي", en: "Partial" }, unpaid: { bg: "bg-red-50", t: "text-red-700", ar: "غير مدفوع", en: "Unpaid" } }[status];
  return <span className={`text-xs font-black px-2 py-0.5 rounded-full ${c.bg} ${c.t}`}>{lang === "ar" ? c.ar : c.en}</span>;
}
function PayMBadge({ method, lang }: { method: string; lang: Lang }) {
  const c: Record<string, { bg: string; t: string; ar: string; en: string }> = { cash: { bg: "bg-emerald-50", t: "text-emerald-700", ar: "كاش", en: "Cash" }, bank: { bg: "bg-blue-50", t: "text-blue-700", ar: "بنكي", en: "Bank" }, credit: { bg: "bg-amber-50", t: "text-amber-700", ar: "آجل", en: "Credit" } };
  const d = c[method] || { bg: "bg-slate-50", t: "text-slate-700", ar: method, en: method };
  return <span className={`text-xs font-black px-2 py-0.5 rounded-full ${d.bg} ${d.t}`}>{lang === "ar" ? d.ar : d.en}</span>;
}

// Tenant KPI Card
function TKpi({ value, labelAr, labelEn, sub, icon: Icon, iconBg, lang, formula, warn }: {
  value: string; labelAr: string; labelEn: string; sub?: string;
  icon: ElementType; iconBg: string; lang: Lang; formula?: string; warn?: boolean;
}) {
  const isRTL = lang === "ar";
  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm p-5 group relative transition-all hover:shadow-md ${warn ? "border-amber-200" : "border-slate-200/80"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg}`}><Icon size={20} className="text-white" /></div>
        {formula && <div className="text-slate-300 cursor-help group-hover:text-slate-400 transition-colors"><Info size={14} /></div>}
      </div>
      <div className="text-2xl font-black text-[#0F2C59] font-mono tracking-tight">{value}</div>
      <div className="text-xs font-bold text-slate-500 mt-1">{isRTL ? labelAr : labelEn}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {formula && (
        <div className="absolute bottom-full mb-2 start-0 end-0 bg-[#0F2C59] text-white text-xs p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-2xl pointer-events-none leading-relaxed">
          {formula}
        </div>
      )}
    </div>
  );
}

// ── TENANT DASHBOARD SCREEN ────────────────────────────────────────────────────
function TenantDashboardScreen({ lang, role, onNavigate }: { lang: Lang; role: TenantRole; onNavigate: (s: TenantScreen) => void }) {
  const isRTL = lang === "ar";
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "month">("month");
  const range = dashboardDateRange(dateFilter);
  const { summary, loading, error, reload } = useTenantDashboard(range);
  const live = !IS_MOCK_MODE && summary;
  const isOwner = role === "owner";
  const isAccountant = role === "accountant";
  const isCashier = role === "cashier";
  const showFinancials = !isCashier;
  const showProfit = isOwner;

  const lowStock = IS_MOCK_MODE ? T_PRODUCTS.filter(p => p.cartons < p.minStock) : [];
  const totalCustomer = live ? parseAmount(summary.customer_receivables) : T_CUSTOMERS.reduce((s, c) => s + c.balance, 0);
  const totalSupplier = live ? parseAmount(summary.supplier_payables) : T_SUPPLIERS.reduce((s, c) => s + c.balance, 0);
  const totalCartons = live ? parseAmount(summary.inventory_kg) : T_PRODUCTS.reduce((s, p) => s + p.cartons, 0);
  const totalWeight = live ? parseAmount(summary.inventory_kg) : T_PRODUCTS.reduce((s, p) => s + p.weightKg, 0);
  const lowStockCount = live ? (summary.low_stock_count ?? 0) : lowStock.length;
  const todaySales = live ? parseAmount(summary.total_sales) : demoNum(18450);
  const todayPurchases = live ? parseAmount(summary.total_purchases) : demoNum(11200);
  const todayExpenses = live ? parseAmount(summary.total_expenses) : demoNum(850);
  const monthlySales = live ? parseAmount(summary.total_sales) : demoNum(425000);
  const monthlyPurchases = live ? parseAmount(summary.total_purchases) : demoNum(298000);
  const monthlyExpenses = live ? parseAmount(summary.total_expenses) : demoNum(34000);
  const monthlyProfit = live ? parseAmount(summary.net_profit_foundation) : demoNum(93000);
  const todayProfit = live ? parseAmount(summary.net_profit_foundation) : (todaySales - todayPurchases - todayExpenses);
  const salesTarget = 20000;
  const salesPct = salesTarget > 0 ? Math.min(100, Math.round((todaySales / salesTarget) * 100)) : 0;
  const chartDaily = live && summary.sales_trend?.length
    ? summary.sales_trend.map((p) => ({
        day: p.date,
        dayEn: p.date,
        sales: parseAmount(p.sales),
        purchases: 0,
      }))
    : IS_MOCK_MODE ? T_DAILY : [];
  const chartProfit = live && summary.sales_trend?.length
    ? summary.sales_trend.map((p) => ({
        month: p.date,
        monthEn: p.date,
        profit: parseAmount(p.gross_profit),
      }))
    : IS_MOCK_MODE ? T_MONTHLY_PROFIT : [];
  const payPie = IS_MOCK_MODE ? T_PAY_PIE : [];

  const quickActions: { ar: string; en: string; icon: ElementType; color: string; nav?: TenantScreen }[] = [
    { ar: "عرض سعر جديد",      en: "New Quotation",     icon: Tag,          color: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200", nav: "quotations-new" },
    { ar: "فاتورة شراء جديدة", en: "New Purchase",      icon: ShoppingCart, color: "bg-[#0F2C59]/8 text-[#0F2C59] hover:bg-[#0F2C59]/15 border-[#0F2C59]/15", nav: "purchases-new" },
    { ar: "تسجيل تحصيل",       en: "Collect Payment",   icon: Wallet,       color: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100", nav: "payments" },
    { ar: "تسجيل دفعة لمورد",  en: "Pay Supplier",      icon: Truck,        color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100", nav: "payments" },
    { ar: "إضافة مصروف",        en: "Add Expense",       icon: Receipt,      color: "bg-red-50 text-red-600 hover:bg-red-100 border-red-100", nav: "expenses" },
    { ar: "إضافة عميل",         en: "Add Customer",      icon: UserPlus,     color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100", nav: "customers-create" },
    { ar: "إضافة مورد",         en: "Add Supplier",      icon: Truck,        color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100", nav: "suppliers-new" },
    { ar: "عرض المخزون",        en: "View Inventory",    icon: Package,      color: "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100", nav: "inventory" },
    { ar: "طباعة تقرير اليوم", en: "Print Daily Report", icon: Printer,     color: "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200", nav: "reports-daily" },
  ];

  const reports = [
    { ar: "تقرير المبيعات", en: "Sales Report", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { ar: "تقرير المشتريات", en: "Purchases Report", icon: ShoppingCart, color: "text-blue-600 bg-blue-50" },
    { ar: "تقرير المخزون", en: "Inventory Report", icon: Package, color: "text-violet-600 bg-violet-50" },
    { ar: "كشف حساب عميل", en: "Customer Statement", icon: Users, color: "text-amber-600 bg-amber-50" },
    { ar: "كشف حساب مورد", en: "Supplier Statement", icon: Truck, color: "text-orange-600 bg-orange-50" },
    { ar: "تقرير المصروفات", en: "Expenses Report", icon: Receipt, color: "text-red-600 bg-red-50" },
    { ar: "تقرير الضريبة", en: "Tax Report", icon: Calculator, color: "text-slate-600 bg-slate-100" },
    { ar: "تقرير صافي الربح", en: "Profit Report", icon: BarChart2, color: "text-[#0F2C59] bg-[#0F2C59]/8" },
    { ar: "تقرير اليوم", en: "Daily Report", icon: Calendar, color: "text-emerald-700 bg-emerald-100" },
  ];

  return (
    <div className="p-3 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">

      {!IS_MOCK_MODE && loading && <LoadingState lang={lang} compact />}
      {!IS_MOCK_MODE && error && !loading && (
        <Card className="p-4"><ErrorState lang={lang} error={error} onRetry={() => void reload()} compact /></Card>
      )}

      {/* Date filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["today", "اليوم", "Today"], ["yesterday", "أمس", "Yesterday"], ["week", "هذا الأسبوع", "This Week"], ["month", "هذا الشهر", "This Month"]] as [typeof dateFilter, string, string][]).map(([k, ar, en]) => (
          <button key={k} onClick={() => setDateFilter(k)} className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${dateFilter === k ? "bg-[#0F2C59] text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
            {isRTL ? ar : en}
          </button>
        ))}
        <input type="date" className={`px-3 py-1.5 rounded-xl text-sm border border-slate-200 focus:border-[#0F2C59] outline-none font-semibold text-slate-600 bg-white ${isRTL ? "ms-auto" : "ml-auto"}`} />
      </div>

      {/* Alert banners */}
      <div className="space-y-2">
        {lowStockCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={17} className="text-amber-500 shrink-0" />
            <span className="text-sm font-bold text-amber-700 flex-1">{isRTL ? `تنبيه: ${lowStockCount} منتجات منخفضة في المخزون` : `Alert: ${lowStockCount} products low in stock`}</span>
            <button onClick={() => onNavigate("inventory")} className="text-xs font-black text-amber-700 bg-amber-200 px-3 py-1 rounded-lg hover:bg-amber-300 transition-all shrink-0">{isRTL ? "عرض" : "View"}</button>
          </div>
        )}
        {IS_MOCK_MODE && T_CUSTOMERS.filter(c => c.overdue).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertCircle size={17} className="text-red-500 shrink-0" />
            <span className="text-sm font-bold text-red-700 flex-1">{isRTL ? `${T_CUSTOMERS.filter(c => c.overdue).length} عملاء لديهم مبالغ متأخرة` : `${T_CUSTOMERS.filter(c => c.overdue).length} customers have overdue balances`}</span>
            <button onClick={() => onNavigate("customers")} className="text-xs font-black text-red-700 bg-red-200 px-3 py-1 rounded-lg hover:bg-red-300 transition-all shrink-0">{isRTL ? "تحصيل" : "Collect"}</button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{isRTL ? "إجراءات سريعة" : "Quick Actions"}</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2.5">
          {/* Featured: New Sale */}
          <button onClick={() => onNavigate("sales-new")} className="col-span-3 sm:col-span-4 lg:col-span-2 bg-[#22C55E] text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200/60">
            <FileText size={30} />
            <span className="font-black text-base text-center leading-tight">{isRTL ? "فاتورة بيع جديدة" : "New Sale Invoice"}</span>
          </button>
          {/* Other actions */}
          {quickActions.map((a: { ar: string; en: string; icon: ElementType; color: string; nav?: TenantScreen }) => {
            const Icon = a.icon;
            return (
              <button key={a.ar} onClick={() => a.nav && onNavigate(a.nav)} className={`${a.color} rounded-2xl p-3 flex flex-col items-center gap-2 transition-all active:scale-[0.98] border`}>
                <Icon size={20} />
                <span className="text-[10px] font-black text-center leading-tight">{isRTL ? a.ar : a.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today KPIs */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{isRTL ? "أرقام اليوم" : "Today's Numbers"}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TKpi value={`AED ${todaySales.toLocaleString()}`} labelAr="مبيعات اليوم" labelEn="Today's Sales" icon={TrendingUp} iconBg="bg-emerald-500" lang={lang} />
          {showFinancials && <TKpi value={`AED ${todayPurchases.toLocaleString()}`} labelAr="مشتريات اليوم" labelEn="Today's Purchases" icon={ShoppingCart} iconBg="bg-[#0F2C59]" lang={lang} />}
          {showFinancials && <div onClick={() => onNavigate("expenses")} className="cursor-pointer"><TKpi value={`AED ${todayExpenses.toLocaleString()}`} labelAr="مصروفات اليوم" labelEn="Today's Expenses" icon={Receipt} iconBg="bg-amber-500" lang={lang} warn={todayExpenses > 1000} /></div>}
          {showProfit && <TKpi value={`AED ${todayProfit.toLocaleString()}`} labelAr="صافي ربح اليوم" labelEn="Today's Net Profit" icon={Activity} iconBg="bg-emerald-600" lang={lang} formula={isRTL ? "صافي ربح اليوم = مبيعات اليوم - مشتريات اليوم - مصروفات اليوم" : "Net Profit = Sales - Purchases - Expenses"} />}
          {isCashier && !IS_MOCK_MODE && live && <TKpi value={`${summary.sales_trend?.length ?? 0}`} labelAr="فواتير الفترة" labelEn="Period Invoices" icon={FileText} iconBg="bg-violet-500" lang={lang} />}
          {isCashier && IS_MOCK_MODE && <TKpi value={`${demoNum(3)}`} labelAr="فواتير اليوم" labelEn="Today's Invoices" icon={FileText} iconBg="bg-violet-500" lang={lang} />}
        </div>
      </div>

      {/* Monthly KPIs — hidden for cashier */}
      {showFinancials && (
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{isRTL ? "أرقام الشهر" : "Monthly Numbers"}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TKpi value={monthlySales.toLocaleString()} labelAr="مبيعات الشهر" labelEn="Monthly Sales" sub="AED" icon={TrendingUp} iconBg="bg-emerald-500" lang={lang} />
            <TKpi value={monthlyPurchases.toLocaleString()} labelAr="مشتريات الشهر" labelEn="Monthly Purchases" sub="AED" icon={ShoppingCart} iconBg="bg-[#0F2C59]" lang={lang} />
            <TKpi value={monthlyExpenses.toLocaleString()} labelAr="مصروفات الشهر" labelEn="Monthly Expenses" sub="AED" icon={Receipt} iconBg="bg-amber-500" lang={lang} />
            {showProfit && <TKpi value={monthlyProfit.toLocaleString()} labelAr="صافي ربح الشهر" labelEn="Monthly Net Profit" sub="AED" icon={Activity} iconBg="bg-emerald-600" lang={lang} formula={isRTL ? "صافي ربح الشهر = مجموع أرباح الأيام - مصروفات الشهر" : "Monthly Profit = Daily profits sum - Monthly expenses"} />}
          </div>
        </div>
      )}

      {/* Balance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showFinancials && <div onClick={() => onNavigate("customers")} className="cursor-pointer"><TKpi value={`AED ${totalCustomer.toLocaleString()}`} labelAr="العملاء المديونين" labelEn="Customer Receivables" sub={IS_MOCK_MODE ? `${T_CUSTOMERS.length} ${isRTL ? "عميل" : "customers"}` : undefined} icon={Users} iconBg="bg-red-500" lang={lang} warn /></div>}
        {showFinancials && <div onClick={() => onNavigate("suppliers")} className="cursor-pointer"><TKpi value={`AED ${totalSupplier.toLocaleString()}`} labelAr="مستحقات الموردين" labelEn="Supplier Payables" sub={IS_MOCK_MODE ? `${T_SUPPLIERS.length} ${isRTL ? "مورد" : "suppliers"}` : undefined} icon={Truck} iconBg="bg-amber-500" lang={lang} warn /></div>}
        <TKpi value={`${totalCartons.toLocaleString()}`} labelAr="المخزون المتاح" labelEn="Available Stock" sub={isRTL ? "كرتونة" : "cartons"} icon={Package} iconBg="bg-violet-500" lang={lang} />
        <TKpi value={`${lowStockCount}`} labelAr="منتجات منخفضة" labelEn="Low Stock Products" sub={isRTL ? "تحتاج تجديد" : "need restocking"} icon={AlertTriangle} iconBg="bg-red-400" lang={lang} warn={lowStockCount > 0} />
      </div>

      {/* Charts */}
      {showFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Line chart */}
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-black text-[#0F2C59] mb-1 text-sm">{isRTL ? "المبيعات والمشتريات — آخر 7 أيام" : "Sales vs Purchases — Last 7 Days"}</h3>
            <p className="text-xs text-slate-400 mb-4">{isRTL ? "بالدرهم الإماراتي" : "in AED"}</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartDaily}>
                <CartesianGrid key="t-line-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis key="t-line-x" dataKey={isRTL ? "day" : "dayEn"} tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
                <YAxis key="t-line-y" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip key="t-line-tip" contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, ""]} />
                <Line key="t-sales-line" type="monotone" dataKey="sales" stroke="#22C55E" strokeWidth={2.5} dot={false} name={isRTL ? "المبيعات" : "Sales"} />
                <Line key="t-purchases-line" type="monotone" dataKey="purchases" stroke="#0F2C59" strokeWidth={2.5} dot={false} strokeDasharray="5 5" name={isRTL ? "المشتريات" : "Purchases"} />
                <Legend key="t-line-legend" iconType="line" formatter={(v) => <span style={{ fontFamily: "Cairo", fontSize: 12, color: "#64748b" }}>{v}</span>} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          {/* Payment method donut */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-1 text-sm">{isRTL ? "طرق الدفع" : "Payment Methods"}</h3>
            <p className="text-xs text-slate-400 mb-3">{isRTL ? "مبيعات اليوم" : "Today's sales"}</p>
            <ResponsiveContainer width="100%" height={140}>
              {payPie.length === 0 ? (
                <ProductionEmptyState lang={lang} compact />
              ) : (
              <PieChart>
                <Pie key="t-pay-pie" data={payPie} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>
                  {payPie.map((e, i) => <Cell key={`t-pie-${i}`} fill={e.color} />)}
                </Pie>
                <Tooltip key="t-pay-tip" contentStyle={{ borderRadius: 10, border: "none", fontFamily: "Cairo" }} formatter={(v: number, _: string, p: { payload: { name: string; nameEn: string } }) => [`${v}%`, isRTL ? p.payload.name : p.payload.nameEn]} />
              </PieChart>
              )}
            </ResponsiveContainer>
            {payPie.length > 0 && (
            <div className="space-y-2 mt-1">
              {payPie.map(s => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="font-semibold text-slate-600">{isRTL ? s.name : s.nameEn}</span></div>
                  <span className="font-black text-slate-700">{s.value}%</span>
                </div>
              ))}
            </div>
            )}
          </Card>
        </div>
      )}

      {/* Monthly profit chart */}
      {showProfit && (
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-5 text-sm">{isRTL ? "صافي الربح الشهري (AED)" : "Monthly Net Profit (AED)"}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartProfit} barSize={32}>
              <CartesianGrid key="t-prof-grid" strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis key="t-prof-x" dataKey={isRTL ? "month" : "monthEn"} tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis key="t-prof-y" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip key="t-prof-tip" contentStyle={{ borderRadius: 12, border: "none", fontFamily: "Cairo" }} formatter={(v: number) => [`AED ${v.toLocaleString()}`, isRTL ? "صافي الربح" : "Net Profit"]} />
              <Bar key="t-profit-bar" dataKey="profit" fill="#22C55E" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Business Health */}
      <Card className="p-5">
        <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "حالة العمل اليوم" : "Today's Business Health"}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Sales progress */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">{isRTL ? "هدف المبيعات" : "Sales Target"}</span>
              <span className={`text-xs font-black ${salesPct >= 90 ? "text-emerald-600" : salesPct >= 60 ? "text-amber-600" : "text-red-500"}`}>{salesPct}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2"><div className={`h-2.5 rounded-full transition-all ${salesPct >= 90 ? "bg-emerald-500" : salesPct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${salesPct}%` }} /></div>
            <div className="text-xs text-slate-400">{isRTL ? `${todaySales.toLocaleString()} / ${salesTarget.toLocaleString()} AED` : `AED ${todaySales.toLocaleString()} / ${salesTarget.toLocaleString()}`}</div>
          </div>
          {/* Profit */}
          {showProfit && <div className={`rounded-2xl p-4 ${todayProfit > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "حالة الربح" : "Profit Status"}</div>
            <div className={`text-lg font-black font-mono ${todayProfit > 0 ? "text-emerald-700" : "text-red-600"}`}>AED {todayProfit.toLocaleString()}</div>
            <div className={`text-xs font-bold mt-1 flex items-center gap-1 ${todayProfit > 0 ? "text-emerald-600" : "text-red-600"}`}>{todayProfit > 0 ? <><ArrowUpRight size={12} />{isRTL ? "ربح إيجابي" : "Positive profit"}</> : <><ArrowDownRight size={12} />{isRTL ? "خسارة" : "Loss"}</>}</div>
          </div>}
          {/* Inventory */}
          <div className={`rounded-2xl p-4 ${lowStockCount === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "حالة المخزون" : "Inventory Status"}</div>
            <div className={`text-lg font-black ${lowStockCount === 0 ? "text-emerald-700" : "text-amber-700"}`}>{lowStockCount === 0 ? (isRTL ? "جيدة ✓" : "Good ✓") : `${lowStockCount} ${isRTL ? "منخفض" : "Low"}`}</div>
            <div className="text-xs text-slate-500 mt-1">{isRTL ? `${totalCartons.toLocaleString()} كرتونة متوفرة` : `${totalCartons.toLocaleString()} cartons available`}</div>
          </div>
          {/* Customer overdue */}
          {showFinancials && <div className={`rounded-2xl p-4 ${T_CUSTOMERS.filter(c => c.overdue).length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "مدفوعات العملاء" : "Customer Payments"}</div>
            <div className={`text-lg font-black ${T_CUSTOMERS.filter(c => c.overdue).length === 0 ? "text-emerald-700" : "text-red-700"}`}>{T_CUSTOMERS.filter(c => c.overdue).length} {isRTL ? "متأخر" : "Overdue"}</div>
            <div className="text-xs text-red-500 font-bold mt-1">AED {T_CUSTOMERS.filter(c => c.overdue).reduce((s, c) => s + c.balance, 0).toLocaleString()}</div>
          </div>}
          {/* Tax */}
          {showFinancials && <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-500 mb-1">{isRTL ? "ضريبة الفترة" : "VAT (period)"}</div>
            <div className="text-lg font-black text-[#0F2C59] font-mono">
              AED {live && summary.tax_net_vat_estimate != null ? parseAmount(summary.tax_net_vat_estimate).toLocaleString() : demoNum(2125).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">{isRTL ? `مبيعات: ${demoNum(2975).toLocaleString()} | مشتريات: ${demoNum(850).toLocaleString()}` : `Sales: ${demoNum(2975).toLocaleString()} | Purchases: ${demoNum(850).toLocaleString()}`}</div>
          </div>}
        </div>
      </Card>

      {/* Sales + Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Summary */}
        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "مبيعات اليوم" : "Today's Sales"}</h3>
            <button onClick={() => onNavigate("sales")} className="text-xs font-black text-[#0F2C59] hover:underline">{isRTL ? "عرض الكل" : "View All"}</button>
          </div>
          {/* Summary row */}
          <div className="px-5 py-3 grid grid-cols-4 gap-2 border-b border-slate-50">
            {[[todaySales.toLocaleString(), isRTL ? "إجمالي المبيعات" : "Total Sales", "text-emerald-600"], ["3", isRTL ? "عدد الفواتير" : "Invoices", "text-[#0F2C59]"], ["10,050", isRTL ? "نقدي + بنكي" : "Cash + Bank", "text-blue-600"], ["8,400", isRTL ? "آجل" : "Credit", "text-amber-600"]].map(([v, l, c], i) => (
              <div key={i} className="text-center"><div className={`text-base font-black font-mono ${c}`}>AED {v}</div><div className="text-[10px] text-slate-400 font-bold leading-tight mt-0.5">{l}</div></div>
            ))}
          </div>
          {/* Invoices table */}
          <div className="divide-y divide-slate-50">
            {T_INVOICES.map(inv => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-400">{inv.id}</span>
                    <span className="font-bold text-sm text-slate-800">{isRTL ? inv.customer : inv.customerEn}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{inv.cartons} {isRTL ? "كرتونة" : "cartons"} · {inv.weightKg} {isRTL ? "كيلو" : "kg"}</div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-mono font-black text-sm text-[#0F2C59]">AED {inv.total.toLocaleString()}</div>
                  <div className="flex items-center gap-1.5 mt-0.5"><PayMBadge method={inv.method} lang={lang} /><InvBadge status={inv.status} lang={lang} /></div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Eye size={13} /></button>
                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Printer size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Customer Balances */}
        {showFinancials && (
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "أرصدة العملاء" : "Customer Balances"}</h3>
              <span className="text-xs font-black text-red-500">AED {totalCustomer.toLocaleString()}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {T_CUSTOMERS.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{isRTL ? c.name : c.nameEn}</div>
                    {c.overdue && <span className="text-xs font-bold text-red-500">{isRTL ? `متأخر ${c.days} يوم` : `${c.days}d overdue`}</span>}
                  </div>
                  <div className="text-end shrink-0">
                    <div className={`font-mono font-black text-sm ${c.overdue ? "text-red-500" : "text-amber-600"}`}>AED {c.balance.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4">
              <Btn variant="green" size="sm" className="w-full justify-center"><Wallet size={14} />{isRTL ? "تسجيل تحصيل" : "Record Collection"}</Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Purchases + Supplier */}
      {showFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "مشتريات اليوم" : "Today's Purchases"}</h3>
              <button onClick={() => onNavigate("purchases")} className="text-xs font-black text-[#0F2C59] hover:underline">{isRTL ? "عرض الكل" : "View All"}</button>
            </div>
            <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-slate-50">
              {[[todayPurchases.toLocaleString(), isRTL ? "إجمالي المشتريات" : "Total Purchases", "text-[#0F2C59]"], ["2", isRTL ? "عدد الفواتير" : "Invoices", "text-slate-600"], ["2,800", isRTL ? "نقدي + بنكي" : "Cash + Bank", "text-blue-600"]].map(([v, l, c], i) => (
                <div key={i} className="text-center"><div className={`text-base font-black font-mono ${c}`}>AED {v}</div><div className="text-[10px] text-slate-400 font-bold mt-0.5">{l}</div></div>
              ))}
            </div>
            <div className="divide-y divide-slate-50">
              {T_PURCHASES.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-400">{p.id}</span><span className="font-bold text-sm text-slate-800">{isRTL ? p.supplier : p.supplierEn}</span></div>
                    <div className="text-xs text-slate-400">{p.cartons} {isRTL ? "كرتونة" : "cartons"} · {p.weightKg} {isRTL ? "كيلو" : "kg"}</div>
                  </div>
                  <div className="text-end shrink-0"><div className="font-mono font-black text-sm text-[#0F2C59]">AED {p.total.toLocaleString()}</div><PayMBadge method={p.method} lang={lang} /></div>
                </div>
              ))}
            </div>
          </Card>
          {/* Supplier Balances */}
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "أرصدة الموردين" : "Supplier Balances"}</h3>
              <span className="text-xs font-black text-amber-600">AED {totalSupplier.toLocaleString()}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {T_SUPPLIERS.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{isRTL ? s.name : s.nameEn}</div>
                    <div className={`text-xs font-bold ${s.overdue ? "text-red-500" : "text-slate-400"}`}>{isRTL ? `استحقاق: ${s.due}` : `Due: ${s.due}`}{s.overdue && (isRTL ? " ⚠ متأخر" : " ⚠ Overdue")}</div>
                  </div>
                  <div className={`font-mono font-black text-sm shrink-0 ${s.overdue ? "text-red-500" : "text-amber-600"}`}>AED {s.balance.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="p-4"><Btn variant="secondary" size="sm" className="w-full justify-center"><Truck size={14} />{isRTL ? "دفع لمورد" : "Pay Supplier"}</Btn></div>
          </Card>
        </div>
      )}

      {/* Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص المخزون" : "Inventory Summary"}</h3>
          {/* Stock bars */}
          <div className="space-y-3 mb-5">
            {T_PRODUCTS.map(p => {
              const pct = Math.min(100, Math.round((p.cartons / (p.minStock * 3)) * 100));
              const isLow = p.cartons < p.minStock;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-bold ${isLow ? "text-red-600" : "text-slate-700"}`}>{isRTL ? p.name : p.nameEn}{isLow && " ⚠"}</span>
                    <span className={`font-mono font-black ${isLow ? "text-red-500" : "text-slate-600"}`}>{p.cartons.toLocaleString()} {isRTL ? "كرتونة" : "crt"}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className={`h-2 rounded-full ${isLow ? "bg-red-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-2xl p-3">
            {[[totalCartons.toLocaleString(), isRTL ? "إجمالي الكراتين" : "Total Cartons"], [(totalCartons * 10).toLocaleString(), isRTL ? "إجمالي الحبات" : "Total Pieces"], [Math.round(totalWeight).toLocaleString(), isRTL ? "إجمالي الوزن KG" : "Total Weight KG"]].map(([v, l]) => (
              <div key={l} className="text-center"><div className="text-base font-black font-mono text-[#0F2C59]">{v}</div><div className="text-[10px] text-slate-400 font-bold leading-tight mt-0.5">{l}</div></div>
            ))}
          </div>
        </Card>

        {/* Expenses */}
        {showFinancials && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "مصروفات اليوم" : "Today's Expenses"}</h3>
              <span className="font-mono font-black text-red-500 text-sm">AED {todayExpenses.toLocaleString()}</span>
            </div>
            <div className="space-y-2.5 mb-5">
              {[{ ar: "مصاريف سيارات", en: "Vehicles", amt: demoNum(350), icon: Truck }, { ar: "مصاريف عمال", en: "Labor", amt: demoNum(300), icon: Users }, { ar: "مصاريف تشغيل", en: "Operations", amt: demoNum(120), icon: Settings }, { ar: "مصروفات متنوعة", en: "Misc", amt: demoNum(80), icon: Tag }].map(e => {
                const Icon = e.icon;
                return (
                  <div key={e.ar} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center shrink-0"><Icon size={14} className="text-red-400" /></div>
                    <div className="flex-1"><div className="text-sm font-bold text-slate-700">{isRTL ? e.ar : e.en}</div></div>
                    <div className="font-mono font-black text-sm text-red-500">AED {e.amt.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Btn size="sm" variant="danger" className="flex-1 justify-center"><Plus size={13} />{isRTL ? "إضافة مصروف" : "Add Expense"}</Btn>
              <Btn size="sm" variant="outline" onClick={() => onNavigate("expenses")}><Eye size={13} />{isRTL ? "عرض الكل" : "View All"}</Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Tax + Reports */}
      {showFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Tax */}
          {!isCashier && (
            <Card className="p-5">
              <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "ملخص الضريبة — هذا الشهر" : "Tax Summary — This Month"}</h3>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[[`AED ${demoNum(2975).toLocaleString()}`, isRTL ? "ضريبة المبيعات" : "Sales VAT", "text-[#0F2C59]"], [`AED ${demoNum(850).toLocaleString()}`, isRTL ? "ضريبة المشتريات" : "Purchase VAT", "text-emerald-600"], [`AED ${demoNum(2125).toLocaleString()}`, isRTL ? "صافي الضريبة" : "Net VAT", "text-amber-600"]].map(([v, l, c]) => (
                  <div key={l} className="bg-slate-50 rounded-2xl p-3 text-center">
                    <div className={`text-base font-black font-mono ${c}`}>{v}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-1 leading-tight">{l}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-emerald-700">{demoStr(isRTL ? "ضريبة القيمة المضافة مفعّلة — TRN: 100345678901203" : "VAT Enabled — TRN: 100345678901203", isRTL ? "ضريبة القيمة المضافة" : "VAT")}</span>
              </div>
              <Btn size="sm" variant="secondary" className="w-full justify-center" onClick={() => onNavigate("tax")}><Calculator size={14} />{isRTL ? "تقرير الضريبة" : "Tax Report"}</Btn>
            </Card>
          )}
          {/* Reports */}
          <Card className="p-5">
            <h3 className="font-black text-[#0F2C59] mb-4 text-sm">{isRTL ? "التقارير" : "Reports"}</h3>
            <div className="grid grid-cols-3 gap-2">
              {reports.map(r => {
                const Icon = r.icon;
                return (
                  <button key={r.ar} onClick={() => onNavigate("reports")} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 text-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${r.color}`}><Icon size={17} /></div>
                    <span className="text-[10px] font-bold text-slate-600 leading-tight">{isRTL ? r.ar : r.en}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── ACCOUNTS COMING SOON ────────────────────────────────────────────────────────
function AccountsComingSoonScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: string) => void }) {
  const isRTL = lang === "ar";
  const items = [
    { ar: "كشف الحسابات العامة",       en: "General Ledger",          icon: "📒" },
    { ar: "حسابات العملاء المجمعة",    en: "Consolidated AR",         icon: "👥" },
    { ar: "حسابات الموردين المجمعة",   en: "Consolidated AP",         icon: "🏭" },
    { ar: "أرصدة البنوك والصناديق",    en: "Bank & Cash Balances",    icon: "🏦" },
    { ar: "تسويات الحسابات",           en: "Account Reconciliation",  icon: "⚖️" },
    { ar: "قيود اليومية",              en: "Journal Entries",         icon: "📋" },
  ];
  return (
    <div className={`p-6 md:p-8 max-w-2xl mx-auto ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#0F2C59]/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen size={28} className="text-[#0F2C59]" />
        </div>
        <h1 className="text-2xl font-black text-[#0F2C59] mb-2">{isRTL ? "الحسابات" : "Accounts"}</h1>
        <p className="text-slate-500 max-w-md mx-auto text-sm">{isRTL ? "مركز الحسابات المحاسبية المتكاملة قيد التطوير وسيتضمن دفتر الأستاذ العام وكشوف الحسابات الشاملة." : "The full accounting center including general ledger and consolidated statements is under development."}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {items.map((item, i) => (
          <div key={`acc-item-${i}`} className="bg-white rounded-xl border border-dashed border-slate-200 p-4 flex items-center gap-3 opacity-70">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-600">{isRTL ? item.ar : item.en}</p>
              <span className="text-xs bg-[#0F2C59]/8 text-[#0F2C59] px-2 py-0.5 rounded-full font-medium">{isRTL ? "قريباً" : "Coming Soon"}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">{isRTL ? "في الوقت الحالي يمكنك استخدام كشوف حسابات العملاء والموردين من ملفاتهم المباشرة، وتقارير الأرباح من التقارير." : "For now, use customer and supplier statements from their profiles, and profit reports from the Reports module."}</p>
      </div>
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => onNavigate("customers")} className="flex items-center gap-1.5 px-4 py-2 bg-[#0F2C59] text-white rounded-lg text-sm hover:bg-[#0F2C59]/90">
          <Users size={13} />{isRTL ? "كشوف العملاء" : "Customer Statements"}
        </button>
        <button onClick={() => onNavigate("reports")} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
          <BarChart2 size={13} />{isRTL ? "التقارير" : "Reports"}
        </button>
      </div>
    </div>
  );
}

// ── QA SUMMARY SCREEN ───────────────────────────────────────────────────────────
function QASummaryScreen({ lang, onNavigate }: { lang: Lang; onNavigate: (s: string) => void }) {
  const isRTL = lang === "ar";
  const modules = [
    { name: "Super Admin Dashboard",      status: "complete",  screens: 8,  notes: "Companies, plans, analytics, billing, support" },
    { name: "Tenant Dashboard",           status: "complete",  screens: 1,  notes: "KPIs, quick actions (10), charts, alerts" },
    { name: "Sales Invoice Workflow",     status: "complete",  screens: 6,  notes: "List, new, detail, preview, cancel, collect" },
    { name: "Quotations Workflow",        status: "complete",  screens: 6,  notes: "List, new, detail, preview, convert, analytics" },
    { name: "Purchase Invoice Workflow",  status: "complete",  screens: 6,  notes: "List, new, detail, preview, costing, pay" },
    { name: "Inventory Management",       status: "complete",  screens: 7,  notes: "Overview, product, stocktaking, alerts, movement, valuation" },
    { name: "Product Master",             status: "complete",  screens: 8,  notes: "List, add, detail, categories, bulk, byproducts, import" },
    { name: "Customers Workflow",         status: "complete",  screens: 6,  notes: "List, create, profile, statement, collect, credit override" },
    { name: "Suppliers Workflow",         status: "complete",  screens: 5,  notes: "List, create, profile, statement, pay" },
    { name: "Payments & Receipts",        status: "complete",  screens: 9,  notes: "Overview, movements, collect, pay, refund, receipt, method, cash, report" },
    { name: "Expenses Management",        status: "complete",  screens: 6,  notes: "Overview, list, recurring, detail, voucher, report" },
    { name: "Reports & Analytics",        status: "complete",  screens: 11, notes: "Home, daily, sales, purchases, inventory, customers, suppliers, tax, profit, statements, builder" },
    { name: "Tax Management (VAT)",       status: "complete",  screens: 10, notes: "Dashboard, sales VAT, purchase VAT, net, warnings, audit, credit notes (placeholder), non-taxable, settings, export" },
    { name: "Settings & Users",           status: "complete",  screens: 14, notes: "Home, company, users, roles, permissions, sensitive, audit, numbering, VAT, print, transactions, plan, security" },
    { name: "Accounts Center",            status: "placeholder", screens: 1, notes: "Coming soon — general ledger, AP/AR, journal entries" },
  ];
  const fixes = [
    { issue: "ProductDetailScreen duplicate identifier (InventoryModule + ProductModule)", fix: "Aliased as InvProductDetailScreen" },
    { issue: "SupplierPayModal duplicate identifier (PurchaseModule + SupplierModule)", fix: "Removed SupplierModule import from App.tsx" },
    { issue: "Duplicate TENANT_TITLES keys (inventory, quotations)", fix: "Removed stale entries via Python line removal" },
    { issue: "Quick actions missing فاتورة بيع جديدة / إضافة مورد / nav props", fix: "Added all 10 quick actions with correct nav targets" },
    { issue: "Accounts screen had no renderer (silently missing)", fix: "Added AccountsComingSoonScreen with guided placeholder" },
    { issue: "recharts duplicate Cell/Bar/Line key warnings", fix: "All recharts children now use unique prefixed string keys" },
    { issue: "Mail icon not imported in SalesPreviewScreen", fix: "Added Mail to lucide-react imports" },
    { issue: "Tax screens missing from not-included guard", fix: "All 10 tax screens added to guard list" },
  ];
  const placeholders = [
    "accounts — Full accounting / general ledger (next major phase)",
    "tax-credit-notes — Tax credit note full workflow",
    "reports-builder — Advanced custom report builder",
    "payments-supplier-refund — Supplier refund form",
    "Multi-branch support (Super Admin feature)",
    "WhatsApp integration (Premium feature lock in place)",
    "API access panel (Premium placeholder)",
  ];

  const statusColor = (s: string) => s === "complete" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  const totalScreens = modules.reduce((a, m) => a + m.screens, 0);

  return (
    <div className={`p-4 md:p-6 space-y-5 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className={`flex items-start justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0F2C59] rounded-xl flex items-center justify-center">
            <Terminal size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0F2C59]">Poultry Hero — UI QA Summary</h1>
            <p className="text-xs text-slate-400">Internal developer reference · Final Phase · June 2026</p>
          </div>
        </div>
        <button onClick={() => onNavigate("dashboard")} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200">
          ← {isRTL ? "الرئيسية" : "Dashboard"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Modules", value: String(modules.length), color: "bg-[#0F2C59]/8 text-[#0F2C59]" },
          { label: "Total Screens", value: String(totalScreens), color: "bg-emerald-50 text-emerald-700" },
          { label: "Complete", value: String(modules.filter(m => m.status === "complete").length), color: "bg-emerald-50 text-emerald-700" },
          { label: "Placeholders", value: String(placeholders.length), color: "bg-amber-50 text-amber-700" },
        ].map((s, i) => (
          <div key={`qa-stat-${i}`} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Modules table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 font-semibold text-sm text-[#0F2C59]">Module Status</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Module", "Status", "Screens", "Notes"].map((h, i) =>
                  <th key={`qa-h-${i}`} className="px-3 py-2.5 text-xs font-medium text-slate-500 text-left whitespace-nowrap">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {modules.map((m, i) => (
                <tr key={`qa-mod-${i}`} className={`border-t border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{m.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(m.status)}`}>
                      {m.status === "complete" ? "✓ Complete" : "⏳ Placeholder"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 font-mono">{m.screens}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[260px]">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixes applied */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 font-semibold text-sm text-emerald-700">✓ Issues Fixed This Build</div>
        <div className="divide-y divide-slate-50">
          {fixes.map((f, i) => (
            <div key={`qa-fix-${i}`} className="px-4 py-3 grid md:grid-cols-2 gap-1">
              <p className="text-xs text-red-600"><span className="font-medium">Issue: </span>{f.issue}</p>
              <p className="text-xs text-emerald-700"><span className="font-medium">Fix: </span>{f.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Remaining placeholders */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 font-semibold text-sm text-amber-700">⏳ Remaining Placeholders</div>
        <ul className="divide-y divide-slate-50">
          {placeholders.map((p, i) => (
            <li key={`qa-ph-${i}`} className="px-4 py-2.5 text-xs text-slate-600 flex items-start gap-2">
              <span className="text-amber-400 mt-0.5 shrink-0">→</span>{p}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended next step */}
      <div className="bg-[#0F2C59] rounded-xl p-4 text-white">
        <p className="text-sm font-bold mb-2">🚀 Recommended Next Development Step</p>
        <p className="text-xs text-white/80">Extract all module TSX files to Cursor/VS Code. Begin backend integration with Supabase: start with Products, Customers, Sales Invoices tables. Use the existing mock data shapes as the API contract. Priority order: Auth → Products → Customers → Sales → Purchases → Payments → Tax → Reports.</p>
      </div>
    </div>
  );
}

// ── TENANT NOTIFICATIONS PANEL ─────────────────────────────────────────────────
function NotificationsPanel({ lang, isOpen, onClose }: { lang: Lang; isOpen: boolean; onClose: () => void }) {
  const isRTL = lang === "ar";
  const typeStyle = { warning: { bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle size={15} className="text-amber-500" /> }, danger: { bg: "bg-red-50 border-red-200", icon: <AlertCircle size={15} className="text-red-500" /> }, info: { bg: "bg-blue-50 border-blue-200", icon: <Info size={15} className="text-blue-500" /> } };
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`fixed top-16 ${isRTL ? "left-4" : "right-4"} z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "التنبيهات" : "Notifications"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={15} /></button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {T_NOTIFS.map(n => {
            const s = typeStyle[n.type as keyof typeof typeStyle];
            return (
              <div key={n.id} className={`px-4 py-3 border-s-4 ${s.bg}`}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{s.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-snug">{isRTL ? n.ar : n.en}</p>
                    {n.nav && <button className="text-xs font-black text-[#0F2C59] mt-1 hover:underline">{isRTL ? "اتخاذ إجراء" : "Take action"} →</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── TENANT APP SHELL ───────────────────────────────────────────────────────────
function TenantApp({ companyId, lang, onLangSwitch, onBack }: {
  companyId: string; lang: Lang; onLangSwitch: () => void; onBack?: () => void;
}) {
  const { user, isSuperAdmin, permissions } = useAuth();
  const { companies } = useAdminCompanies();
  const [tScreen, setTScreen] = useState<TenantScreen>("dashboard");
  const [role, setRole] = useState<TenantRole>(user ? mapBackendRole(user.role) : "owner");
  useEffect(() => {
    if (user) setRole(mapBackendRole(user.role));
  }, [user]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [invProductId, setInvProductId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [selectedSettingsUserId, setSelectedSettingsUserId] = useState("");
  const [selectedQuotId, setSelectedQuotId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSalesId, setSelectedSalesId] = useState("");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const isRTL = lang === "ar";
  const company = IS_MOCK_MODE
    ? (COMPANIES.find(c => c.id === companyId) ?? null)
    : resolveTenantCompany(user, companyId, companies);
  // Tenant navigation boundary: screens declare `onNavigate: (s: string) => void`,
  // so wrap the typed setter once here instead of casting at every call site.
  const navTenant = (s: string) => setTScreen(s as TenantScreen);

  // TENANT_TITLES extracted to src/app/navigation/screenTitles.ts

  if (!company) return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-[#F8FAFC] p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        {onBack && (
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[#0F2C59] hover:underline">{isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}{isRTL ? "العودة" : "Back"}</button>
        )}
        <Card className="p-10"><ProductionEmptyState lang={lang} messageAr={EMPTY_MESSAGES.noData.ar} messageEn={EMPTY_MESSAGES.noData.en} /></Card>
      </div>
    </div>
  );

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`flex h-screen overflow-hidden bg-[#F8FAFC] ${isRTL ? "flex-row-reverse" : ""}`}>
      <TenantSidebar screen={tScreen} onNavigate={navTenant} lang={lang} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} company={company} role={role} permissions={permissions} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TenantTopBar lang={lang} onLangSwitch={onLangSwitch} onMenuClick={() => setSidebarOpen(true)} role={role} onRoleChange={setRole} onNotificationsClick={() => setShowNotif(v => !v)} notifCount={T_NOTIFS.length} company={company} onBack={onBack} onQAClick={() => setTScreen("qa-summary")} />
        <main className="flex-1 overflow-y-auto relative">
          {!canViewScreen(tScreen, permissions, role) ? (
            <PermissionDeniedState lang={lang} />
          ) : (
          <>
          {tScreen === "dashboard"    && <TenantDashboardScreen lang={lang} role={role} onNavigate={navTenant} />}
          {(tScreen === "sales" || tScreen === "sales-list") && <SalesListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedSalesId={setSelectedSalesId} />}
          {tScreen === "sales-new"    && <SalesNewScreen lang={lang} role={role} onNavigate={navTenant} salesId={selectedSalesId || undefined} onSaved={setSelectedSalesId} />}
          {tScreen === "sales-preview"&& <SalesPreviewScreen lang={lang} onNavigate={navTenant} role={role} salesId={selectedSalesId || undefined} />}
          {tScreen === "sales-detail" && <SalesDetailScreen lang={lang} role={role} onNavigate={navTenant} salesId={selectedSalesId || undefined} />}
          {(tScreen === "purchases" || tScreen === "purchases-list") && <PurchListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedPurchaseId={setSelectedPurchaseId} />}
          {tScreen === "purchases-new"     && <PurchNewScreen lang={lang} role={role} onNavigate={navTenant} purchaseId={selectedPurchaseId || undefined} onSaved={setSelectedPurchaseId} />}
          {tScreen === "purchases-preview" && (
            !IS_MOCK_MODE && selectedPurchaseId ? (
              <LivePrintPreviewScreen
                lang={lang}
                onNavigate={navTenant}
                backScreen="purchases-list"
                titleAr="فاتورة شراء"
                titleEn="Purchase Invoice"
                loadPreview={() => getPurchasePrintPreview(selectedPurchaseId)}
              />
            ) : (
              <PurchPreviewScreen lang={lang} onNavigate={navTenant} role={role} />
            )
          )}
          {tScreen === "purchases-detail"  && <PurchDetailScreen lang={lang} role={role} onNavigate={navTenant} purchaseId={selectedPurchaseId || undefined} />}
          {tScreen === "customers"          && <CustomersListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedCustomer={setSelectedCustomerId} />}
          {tScreen === "customers-create"  && <CreateCustomerScreen lang={lang} role={role} onNavigate={navTenant} setSelectedCustomer={setSelectedCustomerId} />}
          {tScreen === "customers-profile" && <CustomerProfileScreen lang={lang} role={role} onNavigate={navTenant} customerId={selectedCustomerId} />}
          {tScreen === "customers-statement"&& <CustomerStatementScreen lang={lang} customerId={selectedCustomerId} onNavigate={navTenant} />}
          {tScreen === "payments"                  && <PaymentsOverviewScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "payments-movements"       && <PaymentMovementsScreen lang={lang} role={role} onNavigate={navTenant} setSelectedReceiptId={setSelectedReceiptId} />}
          {tScreen === "payments-customer-refund" && <CustomerRefundScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "payments-supplier-refund" && <SupplierRefundScreen lang={lang} onNavigate={navTenant} />}
          {tScreen === "payment-receipt-detail"   && <ReceiptPreviewScreen lang={lang} onNavigate={navTenant} receiptId={selectedReceiptId} />}
          {tScreen === "payment-receipt-preview"  && <ReceiptPreviewScreen lang={lang} onNavigate={navTenant} receiptId={selectedReceiptId} />}
          {tScreen === "payments-method-summary"  && <PaymentMethodSummaryScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "payments-cash-bank"       && <CashBankAccountsScreen lang={lang} onNavigate={navTenant} />}
          {tScreen === "payments-report"          && <PaymentsReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax"                      && <TaxDashboardScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-sales"                && <SalesVATReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-purchases"            && <PurchaseVATReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-net"                  && <NetVATScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-warnings"             && <TaxWarningsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-audit"                && <VATAuditScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-credit-notes"         && <TaxCreditNotesScreen lang={lang} onNavigate={navTenant} />}
          {tScreen === "tax-non-taxable"          && <NonTaxableInvoicesScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-settings"             && <TaxSettingsPanel lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "tax-export-preview"       && <TaxExportPreviewScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "accounts"               && <AccountsComingSoonScreen lang={lang} onNavigate={navTenant} />}
          {tScreen === "qa-summary"             && <QASummaryScreen lang={lang} onNavigate={navTenant} />}
          {tScreen === "products"               && <ProductsListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedProductId={setSelectedProductId} />}
          {tScreen === "products-new"           && <AddProductScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "products-edit"          && <AddProductScreen lang={lang} role={role} onNavigate={navTenant} productId={selectedProductId} />}
          {tScreen === "product-detail"         && <ProductDetailScreen lang={lang} role={role} onNavigate={navTenant} productId={selectedProductId} />}
          {tScreen === "product-categories"     && <ProductCategoriesScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "products-bulk-setup"    && <BulkProductSetupScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "products-byproducts"    && <ByProductsSetupScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "products-import-export" && <ProductImportExportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "quotations"          && <QuotationsListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedQuotId={setSelectedQuotId} />}
          {tScreen === "quotations-new"      && <NewQuotationScreen lang={lang} role={role} onNavigate={navTenant} onConvertedToSales={(id) => { setSelectedSalesId(id); setTScreen("sales-detail"); }} />}
          {tScreen === "quotation-detail"    && <QuotationDetailScreen lang={lang} role={role} onNavigate={navTenant} quotId={selectedQuotId} onConvertedToSales={(id) => { setSelectedSalesId(id); setTScreen("sales-detail"); }} />}
          {tScreen === "quotation-preview"   && <QuotationPreviewScreen lang={lang} onNavigate={navTenant} quotId={selectedQuotId} />}
          {tScreen === "quotation-convert"   && <ConvertQuotationScreen lang={lang} role={role} onNavigate={navTenant} quotId={selectedQuotId} />}
          {tScreen === "quotation-analytics" && <QuotationAnalyticsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "users"                       && <UsersListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedUserId={setSelectedSettingsUserId} />}
          {tScreen === "settings"                    && <SettingsHomeScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-company"            && <CompanyProfileScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-users"              && <UsersListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedUserId={setSelectedSettingsUserId} />}
          {tScreen === "settings-user-new"           && <CreateUserScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-user-permissions"   && <UserPermissionsScreen lang={lang} role={role} onNavigate={navTenant} userId={selectedSettingsUserId} />}
          {tScreen === "settings-roles"              && <RolePermissionsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-sensitive-actions"  && <SensitiveActionsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-audit"              && <SettingsAuditScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-numbering"          && <NumberingSettingsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-vat"                && <VATSettingsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-print-templates"    && <PrintTemplatesScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-transactions"       && <TransactionSettingsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-plan"               && <PlanFeaturesScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "settings-security"           && <SecuritySettingsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports"             && <ReportsHomeScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-daily"      && <DailySummaryReport lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-sales"      && <SalesReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-purchases"  && <PurchaseReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-inventory"  && <InventoryReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-customers"  && <CustomerReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-suppliers"  && <SupplierReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-tax"        && <TaxReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-profit"     && <ProfitReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-statements" && <StatementsScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "reports-builder"    && <ReportBuilderScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "expenses"           && <ExpensesOverviewScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "expenses-list"      && <ExpensesListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedExpense={setSelectedExpenseId} />}
          {tScreen === "expenses-recurring" && <RecurringExpensesScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "expenses-report"    && <ExpensesReportScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "expense-detail"     && <ExpenseDetailScreen lang={lang} role={role} onNavigate={navTenant} expenseId={selectedExpenseId} />}
          {tScreen === "expense-voucher"    && <ExpenseVoucherScreen lang={lang} onNavigate={navTenant} expenseId={selectedExpenseId} />}
          {tScreen === "suppliers"          && <SuppliersListScreen lang={lang} role={role} onNavigate={navTenant} setSelectedSupplier={setSelectedSupplierId} />}
          {tScreen === "suppliers-new"     && <CreateSupplierScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "supplier-profile"  && <SupplierProfileScreen lang={lang} role={role} onNavigate={navTenant} supplierId={selectedSupplierId} />}
          {tScreen === "supplier-statement"&& <SupplierStatementScreen lang={lang} supplierId={selectedSupplierId} onNavigate={navTenant} />}
          {(tScreen === "inventory") && <InventoryOverviewScreen lang={lang} role={role} onNavigate={navTenant} selectedProductId={invProductId} setSelectedProductId={setInvProductId} />}
          {tScreen === "inventory-product"    && <InvProductDetailScreen lang={lang} role={role} onNavigate={navTenant} productId={invProductId} />}
          {tScreen === "inventory-stocktaking"&& <StocktakingScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "inventory-alerts"     && <LowStockScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "inventory-movement"   && <MovementScreen lang={lang} role={role} onNavigate={navTenant} />}
          {tScreen === "inventory-valuation"  && <ValuationScreen lang={lang} role={role} onNavigate={navTenant} />}
          {!["dashboard","sales","sales-list","sales-new","sales-preview","sales-detail","purchases","purchases-list","purchases-new","purchases-preview","purchases-detail","inventory","inventory-product","inventory-stocktaking","inventory-alerts","inventory-movement","inventory-valuation","customers","customers-create","customers-profile","customers-statement","suppliers","suppliers-new","supplier-profile","supplier-statement","expenses","expenses-list","expenses-recurring","expenses-report","expense-detail","expense-voucher","payments","payments-movements","payments-customer-collection","payments-supplier-payment","payments-customer-refund","payment-receipt-detail","payment-receipt-preview","payments-method-summary","payments-cash-bank","payments-report","tax","tax-sales","tax-purchases","tax-net","tax-warnings","tax-audit","tax-credit-notes","tax-non-taxable","tax-settings","tax-export-preview","accounts","qa-summary","products","products-new","product-detail","product-categories","products-bulk-setup","products-byproducts","products-import-export","quotations","quotations-new","quotation-detail","quotation-preview","quotation-convert","quotation-analytics","reports","reports-daily","reports-sales","reports-purchases","reports-inventory","reports-customers","reports-suppliers","reports-tax","reports-profit","reports-statements","reports-builder","settings","settings-company","settings-users","settings-user-new","settings-user-permissions","settings-roles","settings-sensitive-actions","settings-audit","settings-numbering","settings-vat","settings-print-templates","settings-transactions","settings-plan","settings-security","users"].includes(tScreen) && (
            <ComingSoonPlaceholder screen={tScreen} isRTL={isRTL} onBackToDashboard={() => setTScreen("dashboard")} />
          )}
          </>
          )}
        </main>
        {/* Mobile bottom nav */}
        <div className={`lg:hidden bg-white border-t border-slate-200 flex items-center justify-around px-1 py-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {[{ key: "dashboard" as TenantScreen, icon: LayoutDashboard, ar: "الرئيسية", en: "Home" }, { key: "sales-list" as TenantScreen, icon: FileText, ar: "المبيعات", en: "Sales" }, { key: "inventory" as TenantScreen, icon: Package, ar: "المخزون", en: "Inventory" }, { key: "customers" as TenantScreen, icon: Users, ar: "العملاء", en: "Customers" }].map(item => {
            const Icon = item.icon;
            const active = tScreen === item.key || (item.key === "sales-list" && tScreen.startsWith("sales")) || (item.key === "inventory" && tScreen.startsWith("inventory")) || (item.key === "customers" && tScreen.startsWith("customers")) || (item.key === "suppliers" && (tScreen === "suppliers" || tScreen === "suppliers-new" || tScreen === "supplier-profile" || tScreen === "supplier-statement"));
            return <button key={item.key} onClick={() => setTScreen(item.key)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${active ? "text-[#0F2C59] bg-[#0F2C59]/8" : "text-slate-400"}`}><Icon size={19} /><span className="text-[10px] font-black">{lang === "ar" ? item.ar : item.en}</span></button>;
          })}
        </div>
        {/* Mobile sticky FAB */}
        <div className={`lg:hidden fixed bottom-20 ${isRTL ? "left-4" : "right-4"} z-20`}>
          <button className="w-14 h-14 bg-[#22C55E] rounded-full shadow-2xl shadow-emerald-300/50 flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-all">
            <Plus size={26} className="text-white" />
          </button>
        </div>
        <NotificationsPanel lang={lang} isOpen={showNotif} onClose={() => setShowNotif(false)} />
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const [mode, setMode] = useState<AppMode>("superadmin");
  const [screen, setScreen] = useState<Screen>("login");
  const [lang, setLang] = useState<Lang>("ar");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("1");
  const [tenantCompanyId, setTenantCompanyId] = useState("1");
  const [tenantAccessDenied, setTenantAccessDenied] = useState(false);

  const isRTL = lang === "ar";
  const switchLang = () => setLang(l => l === "ar" ? "en" : "ar");
  const navigate = (s: Screen) => { setScreen(s); setSidebarOpen(false); };

  const handleLogin = (loggedIn: CurrentUser) => {
    const hostKind = getAppHostKind();
    if (loggedIn.is_superuser) {
      setTenantAccessDenied(false);
      setMode("superadmin");
      navigate("dashboard");
      return;
    }
    if (!loggedIn.company) return;

    if (hostKind === "superadmin") {
      setTenantAccessDenied(true);
      return;
    }

    if (hostKind === "tenant") {
      const sub = getTenantSubdomainFromHost();
      if (sub && loggedIn.company.subdomain !== sub) {
        toast.error(isRTL ? "ليس لديك صلاحية للوصول إلى هذه الشركة" : "You do not have access to this company workspace");
        void logout();
        return;
      }
    }

    if (hostKind === "root" && !IS_MOCK_MODE) {
      window.location.assign(getTenantUrl(loggedIn.company.subdomain));
      return;
    }

    setTenantCompanyId(String(loggedIn.company.id));
    setMode("tenant");
    setTenantAccessDenied(false);
  };

  const handleLogout = async () => {
    await logout();
    setMode("superadmin");
    setScreen("login");
    setTenantAccessDenied(false);
  };

  useEffect(() => {
    if (IS_MOCK_MODE || loading) return;
    if (!user) {
      setScreen("login");
      setTenantAccessDenied(false);
      return;
    }
    if (!user.is_superuser && user.company) {
      const hostKind = getAppHostKind();
      if (hostKind === "superadmin") {
        setTenantAccessDenied(true);
        return;
      }
      if (hostKind === "tenant") {
        const sub = getTenantSubdomainFromHost();
        if (sub && user.company.subdomain !== sub) {
          toast.error(isRTL ? "ليس لديك صلاحية للوصول إلى هذه الشركة" : "You do not have access to this company workspace");
          void logout();
          return;
        }
      }
      setTenantCompanyId(String(user.company.id));
      setMode("tenant");
      setTenantAccessDenied(false);
    } else if (user.is_superuser && mode !== "tenant") {
      setTenantAccessDenied(false);
      setMode("superadmin");
      if (screen === "login") setScreen("dashboard");
    }
  }, [user, loading, IS_MOCK_MODE]);

  if (!IS_MOCK_MODE && loading) {
    return (
      <>
        <Toaster position={isRTL ? "top-right" : "top-left"} richColors />
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" dir={isRTL ? "rtl" : "ltr"}>
          <LoadingState lang={lang} />
        </div>
      </>
    );
  }

  if (!IS_MOCK_MODE && tenantAccessDenied && user && !user.is_superuser && user.company) {
    return (
      <>
        <Toaster position={isRTL ? "top-right" : "top-left"} richColors />
        <TenantAccessDeniedScreen
          lang={lang}
          subdomain={user.company.subdomain}
          onGoToWorkspace={() => openTenantWorkspace(user.company!.subdomain)}
          onLogout={() => void handleLogout()}
        />
      </>
    );
  }

  if (mode === "tenant" && (IS_MOCK_MODE || user)) return (
    <>
      <Toaster position={isRTL ? "top-right" : "top-left"} richColors />
      <TenantApp
        companyId={tenantCompanyId}
        lang={lang}
        onLangSwitch={switchLang}
        onBack={isSuperAdmin ? () => setMode("superadmin") : undefined}
      />
    </>
  );

  if (screen === "login" || (!IS_MOCK_MODE && !user)) return (
    <>
      <Toaster position={isRTL ? "top-right" : "top-left"} richColors />
      <LoginScreen onLogin={handleLogin} lang={lang} onLangSwitch={switchLang} />
    </>
  );

  const titles = SUPER_ADMIN_TITLES;
  const [titleAr, titleEn] = titles[screen] || ["", ""];

  return (
    <>
      <Toaster position={isRTL ? "top-right" : "top-left"} richColors />
      <div dir={isRTL ? "rtl" : "ltr"} className={`flex h-screen overflow-hidden bg-[#F8FAFC] ${isRTL ? "flex-row-reverse" : ""}`}>
        <Sidebar
          screen={screen}
          onNavigate={navigate}
          lang={lang}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userName={user?.full_name}
          onLogout={() => void handleLogout()}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar title={titleAr} titleEn={titleEn} onMenuClick={() => setSidebarOpen(true)} lang={lang} onLangSwitch={switchLang} />
          <main className="flex-1 overflow-y-auto">
            {screen === "dashboard"      && <DashboardScreen lang={lang} onNavigate={navigate} />}
            {screen === "companies"      && <CompaniesScreen lang={lang} onNavigate={navigate} onSelectCompany={setSelectedCompany} />}
            {screen === "company-detail" && <CompanyDetailScreen companyId={selectedCompany} lang={lang} onNavigate={navigate} />}
            {screen === "create-company" && <CreateCompanyWizard lang={lang} onNavigate={navigate} />}
            {screen === "payments"       && <PaymentsScreen lang={lang} />}
            {screen === "outstanding"    && <OutstandingScreen lang={lang} onNavigate={navigate} />}
            {screen === "plans"          && <PlansScreen lang={lang} />}
            {screen === "audit-log"      && <AuditLogScreen lang={lang} />}
            {screen === "settings"       && <div className="p-12 text-center"><Settings size={48} className="text-slate-200 mx-auto mb-4" /><p className="text-slate-400 font-bold">{isRTL ? "قيد التطوير" : "Coming soon"}</p></div>}
          </main>
          {/* Mobile bottom nav */}
          <div className={`lg:hidden bg-white border-t border-slate-200 flex items-center justify-around px-1 py-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            {[{ key: "dashboard" as Screen, icon: LayoutDashboard, ar: "الرئيسية", en: "Home" }, { key: "companies" as Screen, icon: Building2, ar: "الشركات", en: "Companies" }, { key: "payments" as Screen, icon: CreditCard, ar: "المدفوعات", en: "Payments" }, { key: "outstanding" as Screen, icon: AlertCircle, ar: "المستحق", en: "Outstanding" }].map(item => {
              const Icon = item.icon;
              const active = screen === item.key;
              return <button key={item.key} onClick={() => navigate(item.key)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${active ? "text-[#0F2C59] bg-[#0F2C59]/8" : "text-slate-400"}`}><Icon size={19} /><span className="text-[10px] font-black">{lang === "ar" ? item.ar : item.en}</span></button>;
            })}
          </div>
        </div>
      </div>
    </>
  );
}
