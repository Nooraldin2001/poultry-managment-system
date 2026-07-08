import type { ReactNode } from "react";
import "./print-a4.css";

export function PrintA4Shell({
  children,
  actions,
  dir,
  pageClassName = "",
}: {
  children: ReactNode;
  actions?: ReactNode;
  dir?: "rtl" | "ltr";
  /** Extra classes on the A4 page (e.g. border color from theme). */
  pageClassName?: string;
}) {
  return (
    <div className="print-shell">
      {actions ? <div className="print-actions no-print">{actions}</div> : null}
      <article
        dir={dir}
        className={`invoice-a4-page print-preview-doc invoice-page ${pageClassName}`.trim()}
      >
        {children}
      </article>
    </div>
  );
}
