export type InvoiceKind = "sales" | "purchase" | "quotation";

export type PriceType = "kg" | "piece" | "carton" | "tray";

export interface InvoiceLineDraft {
  id: string;
  serverId?: string;
  productId: string;
  productName?: string;
  cartons: number;
  pieces: number;
  kg: number;
  unitPrice: number;
  priceType: PriceType;
  vatRate: number;
  lineSubtotal: number;
  lineTotal: number;
  notes?: string;
}

export interface InvoiceHeaderDraft {
  partyId: string;
  invoiceDate: string;
  dueDate?: string;
  paymentMethod: string;
  amountPaid: number;
  notes: string;
  vatEnabled: boolean;
  supplierInvoiceNumber?: string;
  validUntil?: string;
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
}
