import type { InvoiceLineDraft } from "./types";

/** Quantity basis for line subtotal based on price_type. */
export function lineQuantityBasis(line: InvoiceLineDraft): number {
  switch (line.priceType) {
    case "carton":
      return line.cartons;
    case "piece":
      return line.pieces;
    case "kg":
    default:
      return line.kg;
  }
}

export function applyLineTotals(line: InvoiceLineDraft): InvoiceLineDraft {
  const lineSubtotal = lineQuantityBasis(line) * line.unitPrice;
  return { ...line, lineSubtotal, lineTotal: lineSubtotal };
}
