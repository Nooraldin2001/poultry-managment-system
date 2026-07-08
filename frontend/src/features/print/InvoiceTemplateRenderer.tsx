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

  return (
    <PrintA4Shell
      dir={isRTL ? "rtl" : "ltr"}
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
