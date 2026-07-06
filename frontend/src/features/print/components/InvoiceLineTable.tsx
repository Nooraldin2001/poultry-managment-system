import type { InvoiceTemplateProps } from "../types";

/** Dense invoice line table with theme-colored header. */
export function InvoiceLineTable({
  lang,
  lines,
  branding,
  theme,
  headerStyle = "solid",
}: Pick<InvoiceTemplateProps, "lang" | "lines" | "branding" | "theme"> & {
  headerStyle?: "solid" | "underline";
}) {
  const isRTL = lang === "ar";
  const bilingual = branding.show_bilingual_labels;
  const label = (ar: string, en: string) => (bilingual ? `${ar} / ${en}` : isRTL ? ar : en);

  const thBase = "py-1.5 px-2 text-[11px] font-black whitespace-nowrap";
  const thStyle =
    headerStyle === "solid"
      ? { background: theme.tableHeaderBg, color: "#FFFFFF" }
      : { color: theme.primary, borderBottom: `2px solid ${theme.primary}` };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[480px] print-line-table">
        <thead>
          <tr>
            <th className={`${thBase} ${isRTL ? "text-right" : "text-left"}`} style={thStyle}>
              {label("البند", "Item")}
            </th>
            <th className={`${thBase} text-center`} style={thStyle}>
              {label("الكمية", "Qty")}
            </th>
            <th className={`${thBase} text-center`} style={thStyle}>
              {label("الوحدة", "Unit")}
            </th>
            <th className={`${thBase} text-center`} style={thStyle}>
              {label("السعر", "Price")}
            </th>
            <th className={`${thBase} ${isRTL ? "text-left" : "text-right"}`} style={thStyle}>
              {label("الإجمالي", "Total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${theme.border}`,
                background: i % 2 === 1 ? "#FAFBFC" : "transparent",
              }}
            >
              <td className="py-1.5 px-2 font-semibold" style={{ color: theme.text }}>{line.label}</td>
              <td className="py-1.5 px-2 font-mono text-xs text-center">{line.qty ?? "—"}</td>
              <td className="py-1.5 px-2 text-xs text-center" style={{ color: theme.muted }}>{line.unit || "—"}</td>
              <td className="py-1.5 px-2 font-mono text-xs text-center">{line.price ?? "—"}</td>
              <td className={`py-1.5 px-2 font-mono font-bold ${isRTL ? "text-left" : "text-right"}`} style={{ color: theme.text }}>
                {line.total ?? "—"}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-xs" style={{ color: theme.muted }}>
                {isRTL ? "لا توجد بنود" : "No lines"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
