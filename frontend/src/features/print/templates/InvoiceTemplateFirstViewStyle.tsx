import type { InvoiceTemplateProps } from "../types";
import { InvoiceHeader } from "../components/InvoiceHeader";
import { InvoicePartyInfo } from "../components/InvoicePartyInfo";
import { InvoiceLineTable } from "../components/InvoiceLineTable";
import { InvoiceTotals } from "../components/InvoiceTotals";
import { InvoiceFooterBranding } from "../components/InvoiceFooterBranding";

/**
 * Official style inspired by the client's printed tax invoice:
 * dark navy header band with centered bilingual company name, logo block,
 * colored (red) title strip, TRN row, boxed customer/meta details,
 * dense colored-header table, totals with stamp, signature footer.
 */
export function InvoiceTemplateFirstViewStyle(props: InvoiceTemplateProps) {
  return (
    <div>
      <InvoiceHeader {...props} variant="banded" />
      <InvoicePartyInfo {...props} />
      <InvoiceLineTable {...props} headerStyle="solid" />
      <InvoiceTotals {...props} />
      <InvoiceFooterBranding {...props} />
    </div>
  );
}
