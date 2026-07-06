import type { InvoiceTemplateProps } from "../types";

/** Customer/supplier block + invoice meta (number, date) in one row. */
export function InvoicePartyInfo({
  lang,
  party,
  partyKind,
  meta,
  branding,
  theme,
}: Pick<InvoiceTemplateProps, "lang" | "party" | "partyKind" | "meta" | "branding" | "theme">) {
  const isRTL = lang === "ar";
  const bilingual = branding.show_bilingual_labels;
  const showPartyTrn =
    partyKind === "supplier" ? branding.show_supplier_trn : branding.show_customer_trn;

  const partyLabel =
    partyKind === "supplier"
      ? bilingual ? "المورد / Supplier" : isRTL ? "المورد" : "Supplier"
      : bilingual ? "العميل / Customer" : isRTL ? "العميل" : "Customer";
  const trnLabel =
    partyKind === "supplier"
      ? bilingual ? "الرقم الضريبي للمورد / Supplier TRN" : isRTL ? "الرقم الضريبي للمورد" : "Supplier TRN"
      : bilingual ? "الرقم الضريبي TRN / Customer TRN" : isRTL ? "الرقم الضريبي للعميل" : "Customer TRN";

  return (
    <div
      className={`flex flex-wrap gap-3 mb-4 text-sm ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
    >
      <div
        className="flex-1 min-w-[200px] rounded-lg p-3"
        style={{ border: `1px solid ${theme.border}` }}
      >
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: theme.muted }}>
          {partyLabel}
        </p>
        <p className="font-black mt-0.5" style={{ color: theme.text }}>{party.name || "—"}</p>
        {party.phone && (
          <p className="text-xs mt-0.5" style={{ color: theme.muted }} dir="ltr">{party.phone}</p>
        )}
        {party.address && (
          <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{party.address}</p>
        )}
        {showPartyTrn && (
          <p className="text-xs font-mono mt-1" style={{ color: theme.text }}>
            {trnLabel}: <span className="font-bold">{party.trn || "—"}</span>
          </p>
        )}
      </div>
      {meta.length > 0 && (
        <div
          className="min-w-[180px] rounded-lg p-3 space-y-1"
          style={{ border: `1px solid ${theme.border}` }}
        >
          {meta.map((m) => (
            <div key={m.label} className="flex justify-between gap-3 text-xs">
              <span className="font-bold" style={{ color: theme.muted }}>{m.label}</span>
              <span className="font-mono font-bold" style={{ color: theme.text }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
