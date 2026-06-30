// Money + payment related boundary types.

/** A monetary amount in AED (UAE Dirham). Stored as a plain number for now. */
export type MoneyAmount = number;

/** Payment / settlement methods used across sales, purchases and payments. */
export type PaymentMethod = "cash" | "bank" | "credit" | "cheque" | "transfer";
