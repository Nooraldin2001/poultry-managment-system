import type { InvoiceTemplateProps } from "./types";
import { resolveTemplate } from "./templateRegistry";
import { PrintA4Shell } from "./PrintA4Shell";
import { PrintActionButtons } from "./PrintActionButtons";

/**
 * Renders the tenant-selected invoice template inside a fixed A4 page shell.
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
  const documentNumber =
    data.meta.find((item) => /number|invoice|الرقم/i.test(item.label))?.value ??
    data.meta[0]?.value ??
    "invoice";

  return (
    <PrintA4Shell
      dir={isRTL ? "rtl" : "ltr"}
      pdfFilename={`invoice-${documentNumber}`}
      pageClassName="border border-slate-200 print:border-0"
      actions={
        <PrintActionButtons
          isRTL={isRTL}
          onBack={onBack}
          primaryColor={data.theme.primary}
        />
      }
    >
      <Template {...data} />
    </PrintA4Shell>
  );
}
