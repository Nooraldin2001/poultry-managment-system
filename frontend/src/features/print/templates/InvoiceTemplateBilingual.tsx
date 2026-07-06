import type { InvoiceTemplateProps } from "../types";
import { InvoiceHeader } from "../components/InvoiceHeader";
import { InvoicePartyInfo } from "../components/InvoicePartyInfo";
import { InvoiceLineTable } from "../components/InvoiceLineTable";
import { InvoiceTotals } from "../components/InvoiceTotals";
import { InvoiceFooterBranding } from "../components/InvoiceFooterBranding";

/**
 * Bilingual layout: forces Arabic/English side-by-side labels everywhere,
 * regardless of the tenant's bilingual toggle.
 */
export function InvoiceTemplateBilingual(props: InvoiceTemplateProps) {
  const bilingualProps: InvoiceTemplateProps = {
    ...props,
    branding: { ...props.branding, show_bilingual_labels: true },
  };
  return (
    <div>
      <InvoiceHeader {...bilingualProps} variant="banded" />
      <InvoicePartyInfo {...bilingualProps} />
      <InvoiceLineTable {...bilingualProps} headerStyle="solid" />
      <InvoiceTotals {...bilingualProps} />
      <InvoiceFooterBranding {...bilingualProps} />
    </div>
  );
}
