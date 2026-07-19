import type { InvoiceTemplateProps } from "../types";
import { InvoiceHeader } from "../components/InvoiceHeader";
import { InvoicePartyInfo } from "../components/InvoicePartyInfo";
import { InvoiceLineTable } from "../components/InvoiceLineTable";
import { InvoiceFinalSummary } from "../components/InvoiceFinalSummary";

/** Bold solid-color header with side title, modern table. */
export function InvoiceTemplateModern(props: InvoiceTemplateProps) {
  return (
    <div>
      <InvoiceHeader {...props} variant="solid" />
      <InvoicePartyInfo {...props} />
      <InvoiceLineTable {...props} headerStyle="solid" />
      <InvoiceFinalSummary {...props} />
    </div>
  );
}
