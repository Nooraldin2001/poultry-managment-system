import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, History, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/shared/types";
import { ApiError } from "@/services/api/errors";
import {
  getModuleResetCatalog,
  getModuleResetHistory,
  moduleResetConfirm,
  moduleResetDryRun,
  type ModuleResetCatalogItem,
  type ModuleResetDryRunResponse,
  type ModuleResetHistoryItem,
} from "@/services/adminService";

interface AdminModuleResetPanelProps {
  companyId: string;
  companySubdomain: string;
  lang: Lang;
  onResetComplete?: () => void;
}

function dangerBadge(level: string, lang: Lang) {
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    low: { cls: "bg-slate-100 text-slate-600", ar: "منخفض", en: "Low" },
    medium: { cls: "bg-amber-100 text-amber-700", ar: "متوسط", en: "Medium" },
    high: { cls: "bg-orange-100 text-orange-700", ar: "مرتفع", en: "High" },
    critical: { cls: "bg-red-100 text-red-700", ar: "حرج", en: "Critical" },
  };
  const row = map[level] ?? map.high;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.cls}`}>
      {lang === "ar" ? row.ar : row.en}
    </span>
  );
}

export function AdminModuleResetPanel({
  companyId,
  companySubdomain,
  lang,
  onResetComplete,
}: AdminModuleResetPanelProps) {
  const isRTL = lang === "ar";
  const [modules, setModules] = useState<ModuleResetCatalogItem[]>([]);
  const [backupWarning, setBackupWarning] = useState({ ar: "", en: "" });
  const [selectedModule, setSelectedModule] = useState("");
  const [preview, setPreview] = useState<ModuleResetDryRunResponse | null>(null);
  const [history, setHistory] = useState<ModuleResetHistoryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successSummary, setSuccessSummary] = useState<Record<string, number> | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const data = await getModuleResetCatalog(companyId);
      setModules(data.modules);
      setBackupWarning({ ar: data.backup_warning_ar, en: data.backup_warning_en });
      if (!selectedModule && data.modules.length > 0) {
        setSelectedModule(data.modules[0].key);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل تحميل الأقسام" : "Failed to load modules"));
    } finally {
      setLoadingCatalog(false);
    }
  }, [companyId, isRTL, selectedModule]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getModuleResetHistory(companyId);
      setHistory(data.history);
    } catch {
      /* history is optional in UI */
    }
  }, [companyId]);

  useEffect(() => {
    void loadCatalog();
    void loadHistory();
  }, [loadCatalog, loadHistory]);

  const selectedMeta = useMemo(
    () => modules.find(m => m.key === selectedModule),
    [modules, selectedModule],
  );

  const requiredText = preview?.required_confirmation_text ?? "";
  const canConfirm =
    preview?.can_reset &&
    reason.trim().length > 0 &&
    confirmationText.trim() === requiredText &&
    backupConfirmed;

  const handlePreview = async () => {
    if (!selectedModule) return;
    setPreviewing(true);
    setPreview(null);
    setSuccessSummary(null);
    setConfirmOpen(false);
    try {
      const data = await moduleResetDryRun(companyId, selectedModule);
      setPreview(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشلت المعاينة" : "Preview failed"));
    } finally {
      setPreviewing(false);
    }
  };

  const jumpToModule = (moduleKey: string) => {
    setSelectedModule(moduleKey);
    setPreview(null);
    setSuccessSummary(null);
    setConfirmOpen(false);
  };

  const blockingMessages = preview
    ? (isRTL && preview.blocking_dependencies_ar?.length
        ? preview.blocking_dependencies_ar
        : preview.blocking_dependencies)
    : [];

  const orderLabels = (preview?.required_reset_order ?? []).map((key, idx) => {
    const meta = modules.find(m => m.key === key);
    const label = meta ? (isRTL ? meta.label_ar : meta.label_en) : key;
    return { key, label, step: idx + 1 };
  });

  const handleConfirm = async () => {
    if (!preview || !canConfirm) return;
    setConfirming(true);
    try {
      const result = await moduleResetConfirm(companyId, {
        module: selectedModule,
        confirmation_text: confirmationText.trim(),
        reason: reason.trim(),
        dry_run_token: preview.dry_run_token,
        backup_confirmed: backupConfirmed,
      });
      setSuccessSummary(result.deleted_counts);
      setConfirmOpen(false);
      setReason("");
      setConfirmationText("");
      setBackupConfirmed(false);
      setPreview(null);
      toast.success(isRTL ? "تم تصفير بيانات القسم" : "Module data reset completed");
      void loadHistory();
      onResetComplete?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (isRTL ? "فشل التأكيد" : "Confirm failed"));
    } finally {
      setConfirming(false);
    }
  };

  if (loadingCatalog) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-semibold">{isRTL ? "جاري التحميل..." : "Loading..."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/80 p-4 flex gap-3">
        <ShieldAlert size={22} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-black text-red-800 text-sm">
            {isRTL ? "منطقة خطرة" : "Danger Zone"}
          </h4>
          <p className="text-sm text-red-700/90 mt-1 leading-relaxed">
            {isRTL ? backupWarning.ar : backupWarning.en}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-700 block">
            {isRTL ? "اختر القسم" : "Select Module"}
          </label>
          <select
            value={selectedModule}
            onChange={e => { setSelectedModule(e.target.value); setPreview(null); setSuccessSummary(null); }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-red-400"
          >
            {modules.map(m => (
              <option key={m.key} value={m.key}>
                {isRTL ? m.label_ar : m.label_en}
              </option>
            ))}
          </select>
          {selectedMeta && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                {isRTL ? selectedMeta.description_ar : selectedMeta.description_en}
              </p>
              {dangerBadge(selectedMeta.danger_level, lang)}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={!selectedModule || previewing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {previewing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {isRTL ? "معاينة قبل الحذف" : "Preview Before Delete"}
          </button>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 min-h-[200px]">
          {!preview && !successSummary && (
            <p className="text-sm text-slate-400 text-center py-8">
              {isRTL ? "اختر قسماً ثم اضغط معاينة لعرض السجلات المتأثرة" : "Select a module and preview to see affected records"}
            </p>
          )}

          {preview && (
            <div className="space-y-3">
              {!preview.can_reset ? (
                <div className="rounded-xl bg-red-100 border-2 border-red-300 p-4">
                  <div className="flex items-center gap-2 text-red-900 font-black text-sm mb-3">
                    <AlertTriangle size={16} />
                    {isRTL ? "لا يمكن تنفيذ التصفير الآن" : "Reset is blocked"}
                  </div>
                  <ul className="text-sm text-red-800 space-y-1.5 list-disc ps-5 mb-4">
                    {blockingMessages.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {orderLabels.length > 0 && (
                    <div className="border-t border-red-200 pt-3">
                      <p className="text-xs font-bold text-red-900 mb-2">
                        {isRTL
                          ? "قم بتصفير الأقسام التالية بالترتيب:"
                          : "Reset these modules in order:"}
                      </p>
                      <ol className="space-y-1.5">
                        {orderLabels.map(row => (
                          <li key={row.key} className="flex items-center gap-2">
                            <span className="text-xs font-black text-red-700 w-5">{row.step}.</span>
                            <button
                              type="button"
                              onClick={() => jumpToModule(row.key)}
                              className="text-sm font-bold text-red-800 underline underline-offset-2 hover:text-red-950"
                            >
                              {row.label}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {Object.entries(preview.affected_counts).length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 mb-2">
                        {isRTL ? "السجلات المتأثرة" : "Affected Records"}
                      </h5>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(preview.affected_counts).map(([k, v]) => (
                          <div key={k} className="bg-white rounded-lg px-2.5 py-2 border border-slate-100">
                            <div className="text-lg font-black text-slate-800 font-mono">{v}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{k}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.side_effects.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 mb-1">
                        {isRTL ? "التأثيرات الجانبية" : "Side Effects"}
                      </h5>
                      <ul className="text-xs text-slate-600 space-y-1 list-disc ps-4">
                        {preview.side_effects.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setConfirmOpen(true); setConfirmationText(""); setReason(""); setBackupConfirmed(false); }}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700"
                  >
                    {isRTL ? "تأكيد التصفير" : "Confirm Reset"}
                  </button>
                </>
              )}
            </div>
          )}

          {successSummary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                <CheckCircle size={18} />
                {isRTL ? "تم التصفير بنجاح" : "Reset completed successfully"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(successSummary).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-lg px-2.5 py-2 border border-emerald-100">
                    <div className="text-lg font-black text-emerald-700 font-mono">{v}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-3">
            <History size={15} />
            {isRTL ? "سجل التصفير" : "Reset History"}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.slice(0, 10).map(row => (
              <div key={row.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex justify-between gap-2">
                <span className="font-mono text-slate-500">{row.created_at?.slice(0, 19) ?? "—"}</span>
                <span className="font-bold text-slate-700">{row.module ?? row.action}</span>
                <span className="text-slate-500 truncate max-w-[40%]">{row.reason || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmOpen && preview?.can_reset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-red-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <h3 className="text-lg font-black text-red-800 text-center mb-2">
              {isRTL ? "تأكيد التصفير" : "Confirm Reset"}
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4 font-mono break-all">
              {requiredText}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">
                  {isRTL ? "سبب الحذف" : "Reason"} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400"
                  placeholder={isRTL ? "مثال: طلب العميل حذف بيانات خاطئة" : "e.g. Client requested wrong data removal"}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">
                  {isRTL ? "اكتب نص التأكيد" : "Type Confirmation Text"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={e => setConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:border-red-400"
                  placeholder={requiredText}
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  onChange={e => setBackupConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {isRTL
                    ? "أؤكد وجود نسخة احتياطية من قاعدة البيانات"
                    : "I confirm a database backup exists"}
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
              >
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canConfirm || confirming}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {confirming && <Loader2 size={14} className="animate-spin" />}
                {isRTL ? "تأكيد التصفير" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
