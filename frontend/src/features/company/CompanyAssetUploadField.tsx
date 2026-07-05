import { useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Trash2 } from "lucide-react";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export type CompanyAssetKind = "logo" | "stamp" | "signature";

export function validateCompanyImageFile(
  file: File,
  lang: "ar" | "en",
): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return lang === "ar"
      ? "الصيغ المسموحة: PNG, JPG, WEBP"
      : "Allowed formats: PNG, JPG, WEBP";
  }
  if (file.size > MAX_BYTES) {
    return lang === "ar"
      ? "الحد الأقصى لحجم الملف 2 ميغابايت"
      : "Maximum file size is 2 MB";
  }
  return null;
}

export function CompanyAssetUploadField({
  lang,
  label,
  hint,
  url,
  disabled = false,
  onUpload,
  onRemove,
  maxHeightClass = "max-h-20",
}: {
  lang: "ar" | "en";
  label: string;
  hint?: string;
  url?: string | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  maxHeightClass?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const pick = () => {
    if (!disabled && !busy) inputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validateCompanyImageFile(file, lang);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    setBroken(false);
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!onRemove || disabled || busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await onRemove();
      setBroken(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <p className="text-xs font-bold text-slate-600 mb-2">{label}</p>
      {url && !broken ? (
        <div className="flex flex-col items-center gap-2">
          <img
            src={url}
            alt=""
            className={`${maxHeightClass} max-w-full object-contain mx-auto print-preview-asset`}
            onError={() => setBroken(true)}
          />
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={pick}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {busy
                ? lang === "ar"
                  ? "جاري الرفع..."
                  : "Uploading..."
                : lang === "ar"
                  ? "استبدال"
                  : "Replace"}
            </button>
            {onRemove && (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void handleRemove()}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={12} />
                {lang === "ar" ? "إزالة" : "Remove"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={pick}
          className="w-full py-6 flex flex-col items-center gap-2 text-slate-400 hover:text-[#0F2C59] hover:border-[#0F2C59]/30 transition-all disabled:opacity-50"
        >
          <ImagePlus size={22} />
          <span className="text-xs font-bold">
            {busy
              ? lang === "ar"
                ? "جاري الرفع..."
                : "Uploading..."
              : lang === "ar"
                ? "رفع صورة"
                : "Upload image"}
          </span>
          {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
        </button>
      )}
      {localError && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
          <AlertTriangle size={11} />
          {localError}
        </p>
      )}
    </div>
  );
}

/** Compact invoice header preview for admin company identity tab. */
export function InvoiceBrandingPreview({
  lang,
  nameAr,
  nameEn,
  trn,
  logoUrl,
  stampUrl,
  signatureUrl,
}: {
  lang: "ar" | "en";
  nameAr: string;
  nameEn: string;
  trn?: string;
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
}) {
  const isRTL = lang === "ar";
  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white">
      <p className="text-xs font-bold text-slate-400 mb-3">
        {isRTL ? "معاينة رأس الفاتورة" : "Invoice header preview"}
      </p>
      <div
        className={`flex gap-4 items-start ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-auto object-contain shrink-0 print-preview-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-[#0F2C59]">
            {isRTL ? "فاتورة ضريبية" : "Tax Invoice"}
          </h4>
          {nameAr && (
            <p className="text-xs font-bold text-slate-700 mt-1">{nameAr}</p>
          )}
          {nameEn && (
            <p className="text-[11px] font-semibold text-slate-500">{nameEn}</p>
          )}
          {trn ? (
            <p className="text-[11px] font-mono text-slate-600 mt-1">
              TRN: {trn}
            </p>
          ) : (
            <p className="text-[10px] text-amber-600 mt-1">
              {isRTL ? "TRN غير مُدخل" : "TRN not set"}
            </p>
          )}
        </div>
      </div>
      {(stampUrl || signatureUrl) && (
        <div
          className={`mt-4 flex gap-6 items-end ${isRTL ? "flex-row-reverse justify-start" : "justify-end"}`}
        >
          {stampUrl && (
            <img
              src={stampUrl}
              alt=""
              className="max-w-[120px] max-h-16 object-contain print-preview-stamp"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {signatureUrl && (
            <img
              src={signatureUrl}
              alt=""
              className="max-w-[140px] max-h-14 object-contain print-preview-signature"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
