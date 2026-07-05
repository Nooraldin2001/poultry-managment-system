import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Shield } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import type { TenantScreen } from "@/shared/types";
import type { TenantRole } from "@/shared/types/roles";
import { IS_MOCK_MODE } from "@/services/config";
import { listPermissionCodes, type PermissionCodeRow } from "@/services/permissionsService";
import { getTenantUser, getUserPermissionOverrides, updateUserPermissionOverrides } from "@/services/userService";
import { ApiError } from "@/services/api/errors";
import { useAuth } from "@/state/authStore";
import { canManageUsers } from "@/shared/utils/permissions";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  PermissionDeniedState,
  ApiUnavailableState,
} from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";

const MODULE_ORDER = [
  "products",
  "customers",
  "suppliers",
  "inventory",
  "purchases",
  "sales",
  "payments",
  "quotations",
  "expenses",
  "tax",
  "reports",
  "settings",
  "users",
] as const;

const MODULE_LABELS: Record<string, { ar: string; en: string }> = {
  products: { ar: "المنتجات", en: "Products" },
  customers: { ar: "العملاء", en: "Customers" },
  suppliers: { ar: "الموردين", en: "Suppliers" },
  inventory: { ar: "المخزون", en: "Inventory" },
  purchases: { ar: "المشتريات", en: "Purchases" },
  sales: { ar: "المبيعات", en: "Sales" },
  payments: { ar: "المدفوعات", en: "Payments" },
  quotations: { ar: "عروض الأسعار", en: "Quotations" },
  expenses: { ar: "المصروفات", en: "Expenses" },
  tax: { ar: "الضريبة", en: "Tax" },
  reports: { ar: "التقارير", en: "Reports" },
  settings: { ar: "الإعدادات", en: "Settings" },
  users: { ar: "المستخدمين", en: "Users" },
};

type Props = {
  lang: Lang;
  role: TenantRole;
  onNavigate: (s: TenantScreen) => void;
  userId: string;
  Card: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  Btn: React.ComponentType<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    disabled?: boolean;
    className?: string;
  }>;
  SettingsHeader: React.ComponentType<{
    title: string;
    titleEn: string;
    onBack: () => void;
    lang: Lang;
    children?: React.ReactNode;
  }>;
  Toggle: React.ComponentType<{ on: boolean; onChange: (v: boolean) => void }>;
  RoleBadge: React.ComponentType<{ role: string; lang: Lang }>;
  SensitiveActionModal: React.ComponentType<{
    lang: Lang;
    actionAr: string;
    actionEn: string;
    prevValue: string;
    newValue: string;
    dangerous?: boolean;
    onConfirm: (reason: string) => void;
    onClose: () => void;
  }>;
};

export function LiveUserPermissionsScreen({
  lang,
  role,
  onNavigate,
  userId,
  Card,
  Btn,
  SettingsHeader,
  Toggle,
  RoleBadge,
  SensitiveActionModal,
}: Props) {
  const isRTL = lang === "ar";
  const { user: currentUser, permissions } = useAuth();
  const canManage = canManageUsers(role, permissions);

  const [catalog, setCatalog] = useState<PermissionCodeRow[]>([]);
  const [user, setUser] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [forbidden, setForbidden] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>("sales");
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [lockoutWarning, setLockoutWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (IS_MOCK_MODE) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    setUnavailable(false);
    try {
      const [codes, u, permState] = await Promise.all([
        listPermissionCodes(),
        getTenantUser(userId),
        getUserPermissionOverrides(userId),
      ]);
      setCatalog(codes);
      if (u) setUser({ fullName: u.fullName, email: u.email, role: u.role });
      const map: Record<string, boolean> = { ...permState.overrides };
      // When no explicit overrides exist, seed checkboxes from effective permissions.
      if (Object.keys(map).length === 0 && Object.keys(permState.effective).length > 0) {
        for (const [code, allowed] of Object.entries(permState.effective)) {
          map[code] = allowed;
        }
      }
      setOverrides(map);
      setUseCustom(Object.keys(permState.overrides).length > 0);
      if (codes.length === 0) setUnavailable(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiError && (e.status === 404 || e.status === 501)) setUnavailable(true);
      else setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionCodeRow[]>();
    for (const code of catalog) {
      const g = code.group || code.code.split(".")[0] || "other";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(code);
    }
    const ordered: { key: string; ar: string; en: string; codes: PermissionCodeRow[] }[] = [];
    for (const key of MODULE_ORDER) {
      const codes = groups.get(key);
      if (codes?.length) {
        ordered.push({
          key,
          ar: MODULE_LABELS[key]?.ar ?? key,
          en: MODULE_LABELS[key]?.en ?? key,
          codes,
        });
      }
    }
    for (const [key, codes] of groups) {
      if (!MODULE_ORDER.includes(key as (typeof MODULE_ORDER)[number])) {
        ordered.push({ key, ar: key, en: key, codes });
      }
    }
    return ordered;
  }, [catalog]);

  const togglePerm = (code: string, allowed: boolean) => {
    setOverrides((prev) => ({ ...prev, [code]: allowed }));
    if (
      currentUser?.id != null && String(currentUser.id) === userId &&
      (code.startsWith("users.") || code === "settings.manage")
    ) {
      setLockoutWarning(
        isRTL
          ? "تحذير: إزالة صلاحيات إدارة المستخدمين قد يمنعك من إدارة النظام لاحقاً."
          : "Warning: Removing user-management permissions may lock you out of admin features.",
      );
    }
  };

  const save = async (reason: string) => {
    if (!canManage) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const permissions = useCustom
        ? Object.entries(overrides).map(([code, allowed]) => ({ code, allowed }))
        : [];
      await updateUserPermissionOverrides(userId, permissions, reason);
      toast.success(isRTL ? "تم حفظ صلاحيات المستخدم" : "User permissions saved");
      setShowSensitiveModal(false);
      onNavigate("settings-users");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : isRTL ? "فشل الحفظ" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return <PermissionDeniedState lang={lang} />;
  if (loading) return <LoadingState lang={lang} />;
  if (forbidden) return <PermissionDeniedState lang={lang} />;
  if (unavailable) return <ApiUnavailableState lang={lang} />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void load()} />;
  if (!user) return <EmptyState lang={lang} messageAr="المستخدم غير موجود" messageEn="User not found" />;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <SettingsHeader
        title={`صلاحيات: ${user.fullName}`}
        titleEn={`Permissions: ${user.fullName}`}
        onBack={() => onNavigate("settings-users")}
        lang={lang}
      >
        <Btn variant="primary" disabled={saving} onClick={() => setShowSensitiveModal(true)}>
          <Check size={15} />
          {isRTL ? "حفظ الصلاحيات" : "Save Permissions"}
        </Btn>
      </SettingsHeader>

      <Card className="p-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full bg-[#0F2C59] flex items-center justify-center text-white font-black text-lg shrink-0"
          aria-hidden
        >
          {user.fullName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-800">{user.fullName}</div>
          <div className="text-xs text-slate-400 font-mono">{user.email}</div>
          <RoleBadge role={user.role} lang={lang} />
        </div>
        <div className="text-end">
          <div className="text-xs font-bold text-slate-500 mb-1" id="custom-perms-label">
            {isRTL ? "تخصيص الصلاحيات" : "Custom Permissions"}
          </div>
          <Toggle on={useCustom} onChange={setUseCustom} />
        </div>
      </Card>

      <FormErrors lang={lang} fieldErrors={fieldErrors} />

      {lockoutWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2" role="alert">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs font-bold text-amber-700">{lockoutWarning}</p>
        </div>
      )}

      {!useCustom ? (
        <Card className="p-8 text-center">
          <Shield size={32} className="text-slate-300 mx-auto mb-2" aria-hidden />
          <p className="font-bold text-slate-600 text-sm">
            {isRTL ? "يستخدم هذا المستخدم صلاحيات الدور الافتراضية" : "This user uses default role permissions"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isRTL ? "فعّل التخصيص لضبط الصلاحيات بشكل منفرد" : "Enable customization to set individual permissions"}
          </p>
        </Card>
      ) : grouped.length === 0 ? (
        <EmptyState lang={lang} messageAr="لا توجد صلاحيات في الكتالوج" messageEn="No permissions in catalog" />
      ) : (
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs font-bold text-amber-700">
              {isRTL ? "تعديل صلاحيات المستخدم سيتم تسجيله في سجل العمليات." : "Changing user permissions will be recorded in the audit log."}
            </p>
          </div>
          {grouped.map((group) => {
            const open = expandedGroup === group.key;
            const allowedCount = group.codes.filter((c) => overrides[c.code] !== false).length;
            return (
              <Card key={group.key} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpandedGroup(open ? null : group.key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-start hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 text-sm">{isRTL ? group.ar : group.en}</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {allowedCount}/{group.codes.length}
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {open && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.codes.map((perm) => {
                      const checked = overrides[perm.code] !== false;
                      const label = perm.action || perm.code.split(".").slice(1).join(".");
                      return (
                        <label
                          key={perm.code}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 transition-all ${checked ? "border-[#0F2C59] bg-[#0F2C59]/5" : "border-slate-100 hover:border-slate-200"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(perm.code, !checked)}
                            className="accent-[#0F2C59]"
                            aria-label={`${isRTL ? group.ar : group.en}: ${label}`}
                          />
                          <span className="text-xs font-bold text-slate-700">
                            {label}
                            {perm.isSensitive && (
                              <span className="ms-1 text-[9px] text-amber-600">({isRTL ? "حساس" : "sensitive"})</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showSensitiveModal && (
        <SensitiveActionModal
          lang={lang}
          actionAr="تغيير صلاحيات مستخدم"
          actionEn="Change User Permissions"
          prevValue={isRTL ? "صلاحيات الدور الافتراضي" : "Default role permissions"}
          newValue={isRTL ? "صلاحيات مخصصة" : "Custom permissions"}
          dangerous
          onConfirm={(reason) => void save(reason)}
          onClose={() => setShowSensitiveModal(false)}
        />
      )}
    </div>
  );
}
