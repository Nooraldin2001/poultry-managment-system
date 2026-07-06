import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { CompanyAssetUploadField } from "@/features/company/CompanyAssetUploadField";
import type { Lang } from "@/shared/types";
import type { SuperAdminScreen } from "@/shared/types/navigation";
import { LoadingState, ErrorState } from "@/shared/components/ApiStates";
import { FormErrors } from "@/shared/components/FormErrors";
import { IS_MOCK_MODE } from "@/services/config";
import {
  getCompanyByIdLive,
  fetchAdminCompanyLive,
  updateCompanyLive,
  type ApiCompany,
} from "@/services/adminService";
import { ApiError } from "@/services/api/errors";
import { getTenantUrl } from "@/services/tenantUrl";

const RESERVED_SUBDOMAINS = new Set([
  "admin", "www", "api", "static", "media", "demo", "root", "poultryhero",
]);

const EMIRATE_OPTIONS = [
  { value: "", labelEn: "Select Emirate", labelAr: "اختر الإمارة" },
  { value: "dubai", labelEn: "Dubai", labelAr: "دبي" },
  { value: "abudhabi", labelEn: "Abu Dhabi", labelAr: "أبوظبي" },
  { value: "sharjah", labelEn: "Sharjah", labelAr: "الشارقة" },
  { value: "ajman", labelEn: "Ajman", labelAr: "عجمان" },
  { value: "rak", labelEn: "RAK", labelAr: "رأس الخيمة" },
  { value: "uaq", labelEn: "UAQ", labelAr: "أم القيوين" },
  { value: "fujairah", labelEn: "Fujairah", labelAr: "الفجيرة" },
];

const STATUS_OPTIONS = [
  { value: "trial", labelEn: "Trial", labelAr: "تجريبي" },
  { value: "active", labelEn: "Active", labelAr: "نشط" },
  { value: "suspended", labelEn: "Suspended", labelAr: "موقوف" },
];

function subdomainPatternOk(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

interface Props {
  companyId: string;
  lang: Lang;
  onNavigate: (screen: SuperAdminScreen) => void;
  onSaved?: () => void;
}

export function AdminCompanyEditScreen({ companyId, lang, onNavigate, onSaved }: Props) {
  const isRTL = lang === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [originalSubdomain, setOriginalSubdomain] = useState("");
  const [showSubdomainConfirm, setShowSubdomainConfirm] = useState(false);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tradeLicense, setTradeLicense] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [emirate, setEmirate] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [trn, setTrn] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState<Partial<Record<"logo" | "stamp" | "signature", File | null>>>({});

  const applyApiCompany = useCallback((row: ApiCompany) => {
    setNameAr(row.name_ar ?? "");
    setNameEn(row.name_en ?? "");
    setSubdomain(row.subdomain ?? "");
    setOriginalSubdomain(row.subdomain ?? "");
    setTradeLicense(row.trade_license ?? "");
    setLicenseExpiry(row.license_expiry_date ? String(row.license_expiry_date).slice(0, 10) : "");
    setEmirate(row.emirate ?? "");
    setAddress(row.address ?? "");
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setManagerName(row.manager_name ?? "");
    setManagerPhone(row.manager_phone ?? "");
    setManagerEmail(row.manager_email ?? "");
    setTrn(row.trn ?? "");
    setStatus(row.status ?? "active");
    setNotes(row.notes ?? "");
    setLogoUrl(row.logo_url ?? null);
    setStampUrl(row.stamp_url ?? null);
    setSignatureUrl(row.signature_url ?? null);
    setPendingAssets({});
  }, []);

  const load = useCallback(() => {
    if (IS_MOCK_MODE) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchAdminCompanyLive(companyId)
      .then((row) => {
        if (!row) {
          setError(new ApiError("Company not found", { status: 404 }));
          return;
        }
        applyApiCompany(row);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [applyApiCompany, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const tenantUrl = useMemo(() => getTenantUrl(subdomain), [subdomain]);
  const subdomainChanged = subdomain !== originalSubdomain && subdomain.length > 0;

  const localSubdomainError = useMemo(() => {
    if (!subdomain) return isRTL ? "النطاق الفرعي مطلوب" : "Subdomain is required";
    if (!subdomainPatternOk(subdomain)) {
      return isRTL
        ? "حروف إنجليزية صغيرة وأرقام وشرطة فقط"
        : "Lowercase letters, numbers, and hyphens only";
    }
    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return isRTL ? "هذا النطاق محجوز" : "This subdomain is reserved";
    }
    return "";
  }, [isRTL, subdomain]);

  const buildPayload = (): FormData => {
    const form = new FormData();
    form.append("name_ar", nameAr.trim());
    form.append("name_en", nameEn.trim());
    form.append("subdomain", subdomain.trim().toLowerCase());
    form.append("status", status);
    form.append("trade_license", tradeLicense);
    if (licenseExpiry) form.append("license_expiry_date", licenseExpiry);
    form.append("emirate", emirate);
    form.append("address", address);
    form.append("phone", phone);
    form.append("email", email);
    form.append("manager_name", managerName);
    form.append("manager_phone", managerPhone);
    form.append("manager_email", managerEmail);
    form.append("trn", trn);
    form.append("notes", notes);
    for (const [key, file] of Object.entries(pendingAssets)) {
      if (file === null) form.append(key, "");
      else if (file instanceof File) form.append(key, file);
    }
    return form;
  };

  const submitSave = async () => {
    if (IS_MOCK_MODE) return;
    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      const updated = await updateCompanyLive(companyId, buildPayload());
      applyApiCompany(updated);
      setOriginalSubdomain(updated.subdomain);
      onSaved?.();
      toast.success(isRTL ? "تم حفظ بيانات الشركة" : "Company details saved");
      onNavigate("company-detail");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      toast.error(e instanceof ApiError ? e.message : (isRTL ? "فشل الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
      setShowSubdomainConfirm(false);
    }
  };

  const handleSave = () => {
    if (!nameAr.trim() || !nameEn.trim()) {
      toast.error(isRTL ? "اسم الشركة مطلوب" : "Company name is required");
      return;
    }
    if (localSubdomainError) {
      toast.error(localSubdomainError);
      return;
    }
    if (subdomainChanged) {
      setShowSubdomainConfirm(true);
      return;
    }
    void submitSave();
  };

  if (IS_MOCK_MODE) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isRTL ? "تعديل الشركة غير متاح في وضع العرض التجريبي" : "Company edit is disabled in mock mode"}
      </div>
    );
  }

  if (loading) return <div className="p-8"><LoadingState lang={lang} /></div>;
  if (error && !nameEn) {
    return (
      <div className="p-8">
        <ErrorState lang={lang} error={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onNavigate("company-detail")}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
        >
          {isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <div>
          <h2 className="text-xl font-black text-[#0F2C59]">
            {isRTL ? "تعديل بيانات الشركة" : "Edit Company Details"}
          </h2>
          <p className="text-sm text-slate-400 font-mono mt-1">{tenantUrl.replace(/^https:\/\//, "")}</p>
        </div>
      </div>

      <FormErrors lang={lang} error={error} fieldErrors={fieldErrors} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <h3 className="font-black text-[#0F2C59] text-sm">
          {isRTL ? "هوية الشركة والفواتير" : "Company Identity & Invoice Branding"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isRTL ? "اسم الشركة بالعربي" : "Arabic Company Name"} value={nameAr} onChange={setNameAr} required error={fieldErrors.name_ar?.[0]} />
          <Field label={isRTL ? "اسم الشركة بالإنجليزي" : "English Company Name"} value={nameEn} onChange={setNameEn} required error={fieldErrors.name_en?.[0]} />
          <Field
            label={isRTL ? "النطاق الفرعي" : "Subdomain"}
            value={subdomain}
            onChange={(v) => setSubdomain(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            required
            error={fieldErrors.subdomain?.[0] || localSubdomainError || undefined}
            helper={isRTL ? "سيغيّر رابط مساحة العمل" : "Changes the tenant workspace URL"}
          />
          <div className="sm:col-span-2 rounded-xl bg-[#0F2C59]/5 border border-[#0F2C59]/15 p-4">
            <div className="text-xs font-bold text-slate-400 mb-1">{isRTL ? "معاينة رابط المستأجر" : "Tenant URL preview"}</div>
            <div className="font-mono font-black text-[#0F2C59] text-sm break-all">{tenantUrl}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <SmallBtn onClick={() => window.open(tenantUrl, "_blank", "noopener,noreferrer")}>
                <ExternalLink size={13} />{isRTL ? "فتح الرابط" : "Open tenant URL"}
              </SmallBtn>
              <SmallBtn onClick={() => { void navigator.clipboard?.writeText(tenantUrl); toast.success(isRTL ? "تم نسخ الرابط" : "URL copied"); }}>
                <Copy size={13} />{isRTL ? "نسخ الرابط" : "Copy tenant URL"}
              </SmallBtn>
            </div>
          </div>
          <Field label={isRTL ? "رقم الرخصة التجارية" : "Trade License Number"} value={tradeLicense} onChange={setTradeLicense} error={fieldErrors.trade_license?.[0]} />
          <Field label={isRTL ? "تاريخ انتهاء الرخصة" : "License Expiry Date"} type="date" value={licenseExpiry} onChange={setLicenseExpiry} error={fieldErrors.license_expiry_date?.[0]} />
          <SelectField label={isRTL ? "الإمارة" : "Emirate"} value={emirate} onChange={setEmirate} options={EMIRATE_OPTIONS} lang={lang} />
          <div className="sm:col-span-2">
            <Field label={isRTL ? "العنوان" : "Address"} value={address} onChange={setAddress} error={fieldErrors.address?.[0]} />
          </div>
          <Field label={isRTL ? "هاتف الشركة" : "Phone"} value={phone} onChange={setPhone} error={fieldErrors.phone?.[0]} />
          <Field label={isRTL ? "البريد الإلكتروني" : "Email"} type="email" value={email} onChange={setEmail} error={fieldErrors.email?.[0]} />
          <Field label={isRTL ? "اسم المدير" : "Manager Name"} value={managerName} onChange={setManagerName} error={fieldErrors.manager_name?.[0]} />
          <Field label={isRTL ? "هاتف المدير" : "Manager Phone"} value={managerPhone} onChange={setManagerPhone} error={fieldErrors.manager_phone?.[0]} />
          <Field label={isRTL ? "بريد المدير" : "Manager Email"} type="email" value={managerEmail} onChange={setManagerEmail} error={fieldErrors.manager_email?.[0]} />
          <Field label={isRTL ? "الرقم الضريبي TRN" : "TRN"} value={trn} onChange={setTrn} placeholder="100XXXXXXXXXXX" error={fieldErrors.trn?.[0]} />
          <SelectField label={isRTL ? "الحالة" : "Status"} value={status} onChange={setStatus} options={STATUS_OPTIONS} lang={lang} />
          <div className="sm:col-span-2">
            <label className="text-sm font-bold text-slate-700 block mb-1.5">{isRTL ? "ملاحظات" : "Notes"}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0F2C59]"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <h3 className="font-black text-[#0F2C59] text-sm">{isRTL ? "شعار الشركة · ختم الشركة · توقيع المفوض" : "Company Logo · Company Stamp · Authorized Signature"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CompanyAssetUploadField
            lang={lang}
            label={isRTL ? "شعار الشركة" : "Company Logo"}
            url={logoUrl}
            disabled={saving}
            onUpload={async (file) => { setPendingAssets((p) => ({ ...p, logo: file })); setLogoUrl(URL.createObjectURL(file)); }}
            onRemove={async () => { setPendingAssets((p) => ({ ...p, logo: null })); setLogoUrl(null); }}
          />
          <CompanyAssetUploadField
            lang={lang}
            label={isRTL ? "ختم الشركة" : "Company Stamp"}
            url={stampUrl}
            disabled={saving}
            onUpload={async (file) => { setPendingAssets((p) => ({ ...p, stamp: file })); setStampUrl(URL.createObjectURL(file)); }}
            onRemove={async () => { setPendingAssets((p) => ({ ...p, stamp: null })); setStampUrl(null); }}
          />
          <CompanyAssetUploadField
            lang={lang}
            label={isRTL ? "التوقيع المعتمد" : "Authorized Signature"}
            url={signatureUrl}
            disabled={saving}
            onUpload={async (file) => { setPendingAssets((p) => ({ ...p, signature: file })); setSignatureUrl(URL.createObjectURL(file)); }}
            onRemove={async () => { setPendingAssets((p) => ({ ...p, signature: null })); setSignatureUrl(null); }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <button
          type="button"
          onClick={() => onNavigate("company-detail")}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          disabled={saving}
        >
          {isRTL ? "إلغاء" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold hover:bg-[#162f5f] disabled:opacity-50"
        >
          <Check size={14} className="inline me-1" />
          {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ التغييرات" : "Save Changes")}
        </button>
      </div>

      {showSubdomainConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800 text-center mb-2">
              {isRTL ? "تغيير النطاق الفرعي" : "Subdomain change"}
            </h3>
            <p className="text-slate-500 text-sm text-center mb-4">
              {isRTL
                ? "تغيير النطاق الفرعي سيغيّر رابط الشركة."
                : "Changing the subdomain will change the company URL."}
            </p>
            <div className="space-y-2 text-sm font-mono bg-slate-50 rounded-xl p-3 mb-6">
              <div><span className="text-slate-400">{isRTL ? "الرابط القديم:" : "Old URL:"}</span> {getTenantUrl(originalSubdomain)}</div>
              <div><span className="text-slate-400">{isRTL ? "الرابط الجديد:" : "New URL:"}</span> {tenantUrl}</div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSubdomainConfirm(false)} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm">
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
              <button type="button" onClick={() => void submitSave()} disabled={saving} className="flex-1 py-2 rounded-xl bg-[#0F2C59] text-white font-bold text-sm disabled:opacity-50">
                {isRTL ? "تأكيد الحفظ" : "Confirm save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, helper, error, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  required?: boolean; helper?: string; error?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">
        {label}{required && <span className="text-red-500 ms-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-[#0F2C59]"}`}
      />
      {helper && !error && <p className="text-xs text-slate-400">{helper}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options, lang, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; labelEn: string; labelAr: string }[]; lang: Lang; required?: boolean;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-slate-700">
        {label}{required && <span className="text-red-500 ms-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-[#0F2C59]"
      >
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>{isRTL ? o.labelAr : o.labelEn}</option>
        ))}
      </select>
    </div>
  );
}

function SmallBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
      {children}
    </button>
  );
}
