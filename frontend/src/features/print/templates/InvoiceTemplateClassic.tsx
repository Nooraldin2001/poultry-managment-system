import type { InvoiceTemplateProps } from "../types";
import { InvoiceHeader } from "../components/InvoiceHeader";
import { InvoicePartyInfo } from "../components/InvoicePartyInfo";
import { InvoiceLineTable } from "../components/InvoiceLineTable";
import { InvoiceTotals } from "../components/InvoiceTotals";
import { InvoiceFooterBranding } from "../components/InvoiceFooterBranding";

/** Traditional minimal layout: plain header, underlined table header. */
export function InvoiceTemplateClassic(props: InvoiceTemplateProps) {
  return (
    <div>
      <InvoiceHeader {...props} variant="plain" />
      <InvoicePartyInfo {...props} />
      <InvoiceLineTable {...props} headerStyle="underline" />
      <InvoiceTotals {...props} />
      <InvoiceFooterBranding {...props} />
    </div>
  );
}
