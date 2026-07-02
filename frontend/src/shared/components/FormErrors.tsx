import type { Lang } from "@/shared/types";
import { ApiError } from "@/services/api/errors";
import type { ValidationErrors } from "@/services/crud/types";

export function FormErrors({
  lang,
  error,
  fieldErrors,
}: {
  lang: Lang;
  error?: unknown;
  fieldErrors?: ValidationErrors;
}) {
  const isRTL = lang === "ar";
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : null;
  const fields = fieldErrors ?? (error instanceof ApiError ? error.fieldErrors : {});
  const entries = Object.entries(fields).filter(([, msgs]) => msgs?.length);

  if (!message && !entries.length) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm space-y-2">
      {message && <p className="font-bold text-red-700">{message}</p>}
      {entries.length > 0 && (
        <ul className={`text-red-600 ${isRTL ? "pe-4" : "ps-4"} list-disc space-y-1`}>
          {entries.flatMap(([field, msgs]) =>
            msgs.map((m) => (
              <li key={`${field}-${m}`}>
                <span className="font-semibold">{field}:</span> {m}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-bold text-red-600 mt-1">{message}</p>;
}
