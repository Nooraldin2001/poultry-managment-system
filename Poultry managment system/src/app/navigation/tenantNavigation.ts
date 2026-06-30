// Tenant sidebar navigation config (Arabic-first, English secondary).
// Extracted from App.tsx — keep keys identical so screen routing keeps working.
import type { ElementType } from "react";
import {
  LayoutDashboard, FileText, Tag, ShoppingCart, Package, Users, Truck,
  Wallet, Receipt, BookOpen, Calculator, BarChart2, Shield, Settings,
} from "lucide-react";
import type { TenantScreen } from "@/shared/types/navigation";

export interface TenantNavItem {
  key: TenantScreen;
  icon: ElementType;
  ar: string;
  en: string;
}

export const T_NAV: TenantNavItem[] = [
  { key: "dashboard",   icon: LayoutDashboard, ar: "الرئيسية",                  en: "Dashboard" },
  { key: "sales",       icon: FileText,         ar: "المبيعات",                   en: "Sales" },
  { key: "quotations",  icon: Tag,              ar: "عروض الأسعار",             en: "Quotations" },
  { key: "purchases",   icon: ShoppingCart,     ar: "المشتريات",                 en: "Purchases" },
  { key: "inventory",   icon: Package,          ar: "المخزون",                   en: "Inventory" },
  { key: "products",    icon: Tag,              ar: "المنتجات",                  en: "Products" },
  { key: "customers",   icon: Users,            ar: "العملاء",                   en: "Customers" },
  { key: "suppliers",   icon: Truck,            ar: "الموردين",                  en: "Suppliers" },
  { key: "payments",    icon: Wallet,           ar: "المدفوعات والتحصيلات",    en: "Payments" },
  { key: "expenses",    icon: Receipt,          ar: "المصروفات",                 en: "Expenses" },
  { key: "accounts",    icon: BookOpen,         ar: "الحسابات",                  en: "Accounts" },
  { key: "tax",         icon: Calculator,       ar: "الضريبة",                   en: "Tax" },
  { key: "reports",     icon: BarChart2,        ar: "التقارير",                  en: "Reports" },
  { key: "users",       icon: Shield,           ar: "المستخدمين والصلاحيات",   en: "Users & Permissions" },
  { key: "settings",    icon: Settings,         ar: "الإعدادات",                 en: "Settings" },
];
