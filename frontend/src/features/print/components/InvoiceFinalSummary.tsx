import type { InvoiceTemplateProps } from "../types";
import { InvoiceFooterBranding } from "./InvoiceFooterBranding";
import { InvoiceTotals } from "./InvoiceTotals";

/** Keep all financial totals, payment details, and signatures as one print unit. */
export function InvoiceFinalSummary(props: InvoiceTemplateProps) {
  return (
    <section className="invoice-final-summary">
      <InvoiceTotals {...props} />
      <InvoiceFooterBranding {...props} />
    </section>
  );
}
