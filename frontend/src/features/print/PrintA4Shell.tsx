import type { ReactNode } from "react";
import { PDF_DOCUMENT_ID } from "./downloadInvoicePdf";
import "./print-a4.css";

export function PrintA4Shell({
  children,
  actions,
  dir,
  pdfFilename = "invoice",
  pageClassName = "",
}: {
  children: ReactNode;
  actions?: ReactNode;
  dir?: "rtl" | "ltr";
  pdfFilename?: string;
  /** Extra classes on the A4 page (e.g. border color from theme). */
  pageClassName?: string;
}) {
  return (
    <div className="print-shell">
      {actions ? <div className="print-actions no-print">{actions}</div> : null}
      <article
        id={PDF_DOCUMENT_ID}
        data-pdf-filename={pdfFilename}
        dir={dir}
        className={`invoice-a4-page print-preview-doc invoice-page ${pageClassName}`.trim()}
      >
        {children}
      </article>
    </div>
  );
}
