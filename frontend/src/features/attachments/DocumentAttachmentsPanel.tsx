import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import type { Lang } from "@/shared/types";
import {
  listExpenseAttachments,
  listPurchaseAttachments,
  uploadExpenseAttachment,
  uploadPurchaseAttachment,
  type DocumentAttachmentRow,
} from "@/services/attachmentService";
import { ApiError } from "@/services/api/errors";
import {
  ApiUnavailableState,
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "@/shared/components/ApiStates";

const MAX_MB = 10;
const ALLOWED_HINT = "PDF, JPG, PNG — max 10 MB";

type DocKind = "purchase" | "expense";

export function DocumentAttachmentsPanel({ lang, docKind, docId }: { lang: Lang; docKind: DocKind; docId: string }) {
  const isRTL = lang === "ar";
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DocumentAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [forbidden, setForbidden] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setUnavailable(false);
    try {
      const data = docKind === "purchase" ? await listPurchaseAttachments(docId) : await listExpenseAttachments(docId);
      setRows(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiError && (e.status === 404 || e.status === 501)) setUnavailable(true);
      else setError(e);
    } finally {
      setLoading(false);
    }
  }, [docId, docKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | null) => {
    if (!file || !docId) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(isRTL ? `الحد الأقصى ${MAX_MB} ميجابايت` : `Max ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const updated = docKind === "purchase" ? await uploadPurchaseAttachment(docId, file) : await uploadExpenseAttachment(docId, file);
      setRows(updated);
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : isRTL ? "فشل الرفع" : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (loading) return <LoadingState lang={lang} compact />;
  if (forbidden) return <PermissionDeniedState lang={lang} compact />;
  if (unavailable) return <ApiUnavailableState lang={lang} compact />;
  if (error) return <ErrorState lang={lang} error={error} onRetry={() => void load()} compact />;

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-[#0F2C59]/30 transition-colors" role="region" aria-label={isRTL ? "رفع مرفق" : "Upload attachment"}>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" className="sr-only" id={`attach-${docKind}-${docId}`} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} disabled={uploading} />
        <label htmlFor={`attach-${docKind}-${docId}`} className="cursor-pointer block">
          {uploading ? <Loader2 className="text-[#0F2C59] mx-auto mb-2 animate-spin" size={24} aria-hidden /> : <Upload className="text-slate-300 mx-auto mb-2" size={24} aria-hidden />}
          <p className="font-bold text-slate-600 text-sm">{isRTL ? "رفع مرفق" : "Upload attachment"}</p>
          <p className="text-xs text-slate-400 mt-1">{ALLOWED_HINT}</p>
        </label>
      </div>
      {uploadError && <p className="text-xs font-bold text-red-600" role="alert">{uploadError}</p>}
      {rows.length === 0 ? <EmptyState lang={lang} compact messageAr="لا توجد مرفقات" messageEn="No attachments" /> : (
        <ul className="space-y-2" aria-label={isRTL ? "المرفقات" : "Attachments"}>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-sm truncate">{r.fileName}</div>
                <div className="text-xs text-slate-400">{r.fileType ?? ""}{r.uploadedAt ? ` · ${r.uploadedAt}` : ""}</div>
              </div>
              {r.fileUrl && (
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2 rounded-lg text-[#0F2C59] hover:bg-[#0F2C59]/10" aria-label={isRTL ? `فتح ${r.fileName}` : `Open ${r.fileName}`}>
                  <Download size={16} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
