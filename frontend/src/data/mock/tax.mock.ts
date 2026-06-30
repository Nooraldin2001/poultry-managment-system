// Tax / VAT mock summary for the service boundary.
// NOTE: TaxModule screens use their own internal mock data; this
// representative summary backs the future API service (see services/).

export interface TaxSummary {
  salesVat: number;
  purchaseVat: number;
  netVat: number;
  trnWarnings: number;
  taxableSalesInvoices: number;
  taxablePurchaseInvoices: number;
}

export const TAX_SUMMARY: TaxSummary = {
  salesVat: 21250,
  purchaseVat: 14900,
  netVat: 6350,
  trnWarnings: 5,
  taxableSalesInvoices: 86,
  taxablePurchaseInvoices: 62,
};
