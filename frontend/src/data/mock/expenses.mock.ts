// Expense mock data for the service boundary.
// NOTE: ExpensesModule screens use their own internal mock data; this
// representative set backs the future API service (see services/).
import type { Expense } from "@/shared/types/tenant";

export const EXPENSES: Expense[] = [
  { id: "EXP-001", category: "رواتب", categoryEn: "Salaries", amount: 18000, date: "2025-01-25", method: "bank", note: "رواتب يناير" },
  { id: "EXP-002", category: "وقود ونقل", categoryEn: "Fuel & Transport", amount: 3200, date: "2025-01-22", method: "cash", note: "" },
  { id: "EXP-003", category: "إيجار", categoryEn: "Rent", amount: 9000, date: "2025-01-01", method: "transfer", note: "إيجار المستودع" },
];
