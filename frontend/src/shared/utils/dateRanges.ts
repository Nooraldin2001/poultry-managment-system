/** Current calendar month as YYYY-MM-DD (inclusive start/end). */
export function getDefaultTaxDateRange(): { date_from: string; date_to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const format = (d: Date) => d.toISOString().slice(0, 10);
  return { date_from: format(start), date_to: format(end) };
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current calendar month for account statements. */
export function getDefaultStatementDateRange(): { date_from: string; date_to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const format = (d: Date) => d.toISOString().slice(0, 10);
  return { date_from: format(start), date_to: format(end) };
}

/** Last N days including today, for trend charts. */
export function lastNDaysIso(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
