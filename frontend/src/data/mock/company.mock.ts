// Super Admin / company-level mock data (extracted verbatim from App.tsx).
import type { Company } from "@/shared/types/tenant";

export const ALL_MODULES = [
  { key: "dashboard", ar: "لوحة التحكم", en: "Dashboard" },
  { key: "sales", ar: "المبيعات", en: "Sales" },
  { key: "purchases", ar: "المشتريات", en: "Purchases" },
  { key: "inventory", ar: "المخزون", en: "Inventory" },
  { key: "customers", ar: "العملاء", en: "Customers" },
  { key: "suppliers", ar: "الموردون", en: "Suppliers" },
  { key: "accounts", ar: "الحسابات", en: "Accounts" },
  { key: "payments", ar: "المدفوعات والمقبوضات", en: "Payments & Receipts" },
  { key: "expenses", ar: "المصروفات", en: "Expenses" },
  { key: "tax", ar: "الضرائب", en: "Tax" },
  { key: "reports", ar: "التقارير", en: "Reports" },
  { key: "settings_mod", ar: "الإعدادات", en: "Settings" },
  { key: "users", ar: "إدارة المستخدمين", en: "User Management" },
];

export const COMPANIES: Company[] = [
  { id: "1", nameAr: "شركة الوطنية للدواجن", nameEn: "Al Wataniyah Poultry", subdomain: "alwataniyah", adminName: "محمد أحمد السعيد", adminPhone: "+971 50 123 4567", adminEmail: "admin@alwataniyah.com", plan: "pro", status: "active", monthlyPrice: 1500, yearlyPrice: 15000, renewalDate: "2025-02-28", outstandingAmount: 0, totalPaid: 18000, lastPaymentDate: "2025-01-28", createdDate: "2024-01-15", emirate: "دبي / Dubai", tradeLicense: "DM-2024-78945", modules: ["dashboard","sales","purchases","inventory","customers","suppliers","accounts","payments","reports","settings_mod","users"] },
  { id: "2", nameAr: "مزارع الخليج للدواجن", nameEn: "Gulf Farms Poultry", subdomain: "gulffarms", adminName: "سعيد الحمدي", adminPhone: "+971 55 987 6543", adminEmail: "saeed@gulffarms.com", plan: "basic", status: "trial", monthlyPrice: 800, yearlyPrice: 8000, renewalDate: "2025-01-31", outstandingAmount: 800, totalPaid: 0, lastPaymentDate: "—", createdDate: "2025-01-01", emirate: "الشارقة / Sharjah", tradeLicense: "SH-2025-11234", modules: ["dashboard","sales","inventory","customers","reports"] },
  { id: "3", nameAr: "الإمارات لتجارة الدواجن", nameEn: "Emirates Poultry Trading", subdomain: "emiratespoultry", adminName: "خالد النعيمي", adminPhone: "+971 50 654 3210", adminEmail: "khaled@emiratespoultry.com", plan: "enterprise", status: "active", monthlyPrice: 3000, yearlyPrice: 30000, renewalDate: "2025-03-15", outstandingAmount: 3000, totalPaid: 36000, lastPaymentDate: "2025-01-10", createdDate: "2023-08-20", emirate: "أبوظبي / Abu Dhabi", tradeLicense: "AD-2023-56789", modules: ALL_MODULES.map(m => m.key) },
  { id: "4", nameAr: "شركة النور للدواجن", nameEn: "Al Noor Poultry Co", subdomain: "alnoor", adminName: "فاطمة علي راشد", adminPhone: "+971 55 123 4321", adminEmail: "fatima@alnoor.ae", plan: "basic", status: "suspended", monthlyPrice: 800, yearlyPrice: 8000, renewalDate: "2024-12-31", outstandingAmount: 1600, totalPaid: 2400, lastPaymentDate: "2024-10-31", createdDate: "2024-05-12", emirate: "عجمان / Ajman", tradeLicense: "AJ-2024-33421", modules: ["dashboard","sales","inventory"] },
  { id: "5", nameAr: "دواجن رأس الخيمة", nameEn: "RAK Poultry", subdomain: "rakpoultry", adminName: "عمر المزروعي", adminPhone: "+971 50 432 1987", adminEmail: "omar@rakpoultry.com", plan: "pro", status: "active", monthlyPrice: 1500, yearlyPrice: 15000, renewalDate: "2025-02-10", outstandingAmount: 1500, totalPaid: 15000, lastPaymentDate: "2024-12-10", createdDate: "2024-02-10", emirate: "رأس الخيمة / RAK", tradeLicense: "RK-2024-78123", modules: ["dashboard","sales","purchases","inventory","customers","accounts","payments","reports","settings_mod"] },
];

export const REVENUE_DATA = [
  { month: "أغسطس", monthEn: "Aug", revenue: 12000, collected: 11500 },
  { month: "سبتمبر", monthEn: "Sep", revenue: 13500, collected: 12000 },
  { month: "أكتوبر", monthEn: "Oct", revenue: 14000, collected: 14000 },
  { month: "نوفمبر", monthEn: "Nov", revenue: 15800, collected: 13200 },
  { month: "ديسمبر", monthEn: "Dec", revenue: 16500, collected: 15500 },
  { month: "يناير", monthEn: "Jan", revenue: 17800, collected: 14800 },
];

export const STATUS_PIE = [
  { name: "نشط", nameEn: "Active", value: 3, color: "#22C55E" },
  { name: "تجريبي", nameEn: "Trial", value: 1, color: "#F59E0B" },
  { name: "موقوف", nameEn: "Suspended", value: 1, color: "#EF4444" },
];

export const PAYMENTS_DATA = [
  { id: "P1", companyId: "1", company: "شركة الوطنية للدواجن", companyEn: "Al Wataniyah Poultry", amount: 1500, method: "transfer", date: "2025-01-28", period: "يناير 2025", reference: "TRF-20250128-001", notes: "دفعة يناير", recordedBy: "أحمد السوبر أدمن" },
  { id: "P2", companyId: "3", company: "الإمارات لتجارة الدواجن", companyEn: "Emirates Poultry Trading", amount: 3000, method: "cheque", date: "2025-01-10", period: "يناير 2025", reference: "CHQ-456789", notes: "", recordedBy: "أحمد السوبر أدمن" },
  { id: "P3", companyId: "4", company: "شركة النور للدواجن", companyEn: "Al Noor Poultry Co", amount: 800, method: "cash", date: "2024-10-31", period: "أكتوبر 2024", reference: "CSH-001", notes: "دفعة جزئية", recordedBy: "أحمد السوبر أدمن" },
  { id: "P4", companyId: "1", company: "شركة الوطنية للدواجن", companyEn: "Al Wataniyah Poultry", amount: 1500, method: "transfer", date: "2024-12-28", period: "ديسمبر 2024", reference: "TRF-20241228-002", notes: "", recordedBy: "أحمد السوبر أدمن" },
  { id: "P5", companyId: "5", company: "دواجن رأس الخيمة", companyEn: "RAK Poultry", amount: 1500, method: "transfer", date: "2024-12-10", period: "ديسمبر 2024", reference: "TRF-20241210-001", notes: "", recordedBy: "أحمد السوبر أدمن" },
];

export const AUDIT_LOGS = [
  { id: "A1", timestamp: "2025-01-28 10:34", user: "أحمد (Super Admin)", action: "تسجيل دفعة", actionEn: "Payment Recorded", company: "الوطنية للدواجن", details: "1,500 درهم — يناير 2025", ip: "192.168.1.10" },
  { id: "A2", timestamp: "2025-01-15 14:20", user: "أحمد (Super Admin)", action: "إنشاء شركة", actionEn: "Company Created", company: "مزارع الخليج", details: "خطة أساسية — تجريبي 30 يوم", ip: "192.168.1.10" },
  { id: "A3", timestamp: "2024-12-15 09:15", user: "أحمد (Super Admin)", action: "تعليق حساب", actionEn: "Account Suspended", company: "شركة النور للدواجن", details: "سبب: تأخر في الدفع", ip: "192.168.1.10" },
  { id: "A4", timestamp: "2024-12-01 11:00", user: "أحمد (Super Admin)", action: "تغيير الخطة", actionEn: "Plan Changed", company: "الإمارات للدواجن", details: "Pro → Enterprise", ip: "192.168.1.10" },
  { id: "A5", timestamp: "2024-11-20 16:45", user: "أحمد (Super Admin)", action: "إنشاء مستخدم أدمن", actionEn: "Admin Created", company: "دواجن رأس الخيمة", details: "عمر المزروعي", ip: "192.168.1.10" },
];

export const PLANS_DATA = [
  { key: "basic", nameAr: "الأساسية", nameEn: "Basic", monthlyPrice: 800, yearlyPrice: 8000, maxUsers: 5, descAr: "مناسب للشركات الصغيرة", descEn: "For small companies", active: true, modules: ["dashboard","sales","inventory","customers","reports","settings_mod"] },
  { key: "pro", nameAr: "الاحترافية", nameEn: "Pro", monthlyPrice: 1500, yearlyPrice: 15000, maxUsers: 15, descAr: "للشركات المتوسطة والنامية", descEn: "For medium & growing companies", active: true, modules: ["dashboard","sales","purchases","inventory","customers","suppliers","accounts","payments","reports","settings_mod","users"] },
  { key: "enterprise", nameAr: "المؤسسية", nameEn: "Enterprise", monthlyPrice: 3000, yearlyPrice: 30000, maxUsers: 999, descAr: "للشركات الكبيرة — جميع الميزات", descEn: "Large enterprises — all features", active: true, modules: ALL_MODULES.map(m => m.key) },
];

export const RECENT_ACTIVITY = [
  { id: "1", ar: "تم إنشاء شركة جديدة", en: "New company created", company: "مزارع الخليج", time: "منذ ساعتين", type: "create" },
  { id: "2", ar: "تم تسجيل دفعة", en: "Payment recorded", company: "الوطنية للدواجن", time: "منذ 5 ساعات", type: "payment" },
  { id: "3", ar: "تم تعليق حساب", en: "Account suspended", company: "شركة النور", time: "منذ يومين", type: "suspend" },
  { id: "4", ar: "تجديد اشتراك", en: "Subscription renewed", company: "دواجن رأس الخيمة", time: "منذ 3 أيام", type: "renew" },
];
