// Super Admin sidebar navigation config.
// Extracted from App.tsx — keys map to SuperAdminScreen state.
import type { ElementType } from "react";
import {
  LayoutDashboard, Building2, CreditCard, AlertCircle, Package, ClipboardList, Settings,
} from "lucide-react";

export interface SuperAdminNavItem {
  key: string;
  icon: ElementType;
  ar: string;
  en: string;
}

export const SA_NAV: SuperAdminNavItem[] = [
  { key: "dashboard",   icon: LayoutDashboard, ar: "الرئيسية",         en: "Dashboard" },
  { key: "companies",   icon: Building2,       ar: "الشركات",           en: "Companies" },
  { key: "payments",    icon: CreditCard,      ar: "المدفوعات",         en: "Payments" },
  { key: "outstanding", icon: AlertCircle,     ar: "المبالغ المستحقة", en: "Outstanding" },
  { key: "plans",       icon: Package,         ar: "الخطط والأسعار",   en: "Plans & Pricing" },
  { key: "audit-log",   icon: ClipboardList,   ar: "سجل العمليات",     en: "Audit Log" },
  { key: "settings",    icon: Settings,        ar: "الإعدادات",         en: "Settings" },
];
