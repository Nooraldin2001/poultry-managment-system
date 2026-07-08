import { Printer } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";
import { resolveTemplate } from "./templateRegistry";

/**
 * Renders the tenant-selected invoice template inside the printable
 * A4 paper container, with a screen-only Back / Print action bar.
 */
export function InvoiceTemplateRenderer({
  data,
  onBack,
}: {
  data: InvoiceTemplateProps;
  onBack?: () => void;
}) {
  const isRTL = data.lang === "ar";
  const Template = resolveTemplate(data.branding.template_key);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap no-print">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl border text-sm font-bold"
          >
            {isRTL ? "رجوع" : "Back"}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
          style={{ background: data.theme.primary }}
        >
          <Printer size={15} />
          {isRTL ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="bg-white border rounded-2xl p-5 print:border-0 print:shadow-none print:rounded-none print-preview-doc invoice-page"
        style={{ borderColor: data.theme.border }}
      >
        <Template {...data} />
      </div>
    </div>
  );
}
