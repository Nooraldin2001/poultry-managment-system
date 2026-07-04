import { toast } from "sonner";
import { ApiError } from "@/services/api/errors";

/**
 * Live-mode create/edit rule: never toast success before the API resolves.
 * Call from screen handlers after validation passes and IS_MOCK_MODE is false.
 */
export async function submitLiveResource<T>(opts: {
  lang: "ar" | "en";
  saving: boolean;
  setSaving: (v: boolean) => void;
  setSaveError: (e: unknown) => void;
  setFieldErrors: (e: Record<string, string[]>) => void;
  run: () => Promise<T>;
  successMessageAr: string;
  successMessageEn: string;
  failureMessageAr?: string;
  failureMessageEn?: string;
}): Promise<T | null> {
  if (opts.saving) return null;
  opts.setSaveError(null);
  opts.setFieldErrors({});
  opts.setSaving(true);
  try {
    const result = await opts.run();
    toast.success(opts.lang === "ar" ? opts.successMessageAr : opts.successMessageEn);
    return result;
  } catch (err) {
    opts.setSaveError(err);
    if (err instanceof ApiError) opts.setFieldErrors(err.fieldErrors);
    const fallbackAr = opts.failureMessageAr ?? "فشل الحفظ";
    const fallbackEn = opts.failureMessageEn ?? "Save failed";
    toast.error(err instanceof ApiError ? err.message : opts.lang === "ar" ? fallbackAr : fallbackEn);
    return null;
  } finally {
    opts.setSaving(false);
  }
}
