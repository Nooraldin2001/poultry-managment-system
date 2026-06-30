// Sales-invoice mock data (extracted verbatim from App.tsx).
import type { SInvoice } from "@/shared/types/documents";

/** Tenant dashboard recent sales summary rows. */
export const T_INVOICES = [
  { id: "INV-2025-0081", customer: "مطعم الخليج",         customerEn: "Al Khalij Restaurant",  cartons: 50,  weightKg: 450,  total: 5850, paid: 5850, remaining: 0,    method: "cash",   status: "paid"    as const },
  { id: "INV-2025-0082", customer: "سوبر ماركت المدينة", customerEn: "Al Madina Supermarket", cartons: 80,  weightKg: 800,  total: 8400, paid: 4200, remaining: 4200, method: "credit", status: "partial" as const },
  { id: "INV-2025-0083", customer: "مطبخ الإمارات",       customerEn: "Emirates Kitchen",      cartons: 40,  weightKg: 400,  total: 4200, paid: 4200, remaining: 0,    method: "bank",   status: "paid"    as const },
];

/** Full sales-invoice list used by the sales workflow. */
export const S_INVOICES: SInvoice[] = [
  { id: "INV-2025-0086", date: "2025-01-28", customerId: "sc1", customer: "مطعم الخليج",         customerEn: "Al Khalij Restaurant",  cartons: 10, kg: 126,  subtotal: 1906.25, vat: 95.31,  total: 2001.56, paid: 2001.56, remaining: 0,       method: "cash",   status: "paid",      user: "محمد (كاشير)" },
  { id: "INV-2025-0085", date: "2025-01-28", customerId: "sc2", customer: "سوبر ماركت المدينة", customerEn: "Al Madina Supermarket", cartons: 80, kg: 800,  subtotal: 11200,   vat: 560,    total: 11760,   paid: 5000,    remaining: 6760,    method: "credit", status: "partial",   user: "محمد (كاشير)" },
  { id: "INV-2025-0084", date: "2025-01-27", customerId: "sc3", customer: "مطبخ الإمارات",       customerEn: "Emirates Kitchen",      cartons: 40, kg: 400,  subtotal: 5800,    vat: 290,    total: 6090,    paid: 6090,    remaining: 0,       method: "bank",   status: "paid",      user: "أحمد (مالك)" },
  { id: "INV-2025-0083", date: "2025-01-27", customerId: "sc1", customer: "مطعم الخليج",         customerEn: "Al Khalij Restaurant",  cartons: 20, kg: 200,  subtotal: 2950,    vat: 147.50, total: 3097.50, paid: 0,       remaining: 3097.50, method: "credit", status: "approved",  user: "محمد (كاشير)" },
  { id: "INV-2025-0082", date: "2025-01-26", customerId: "sc2", customer: "سوبر ماركت المدينة", customerEn: "Al Madina Supermarket", cartons: 0,  kg: 0,    subtotal: 0,       vat: 0,      total: 0,       paid: 0,       remaining: 0,       method: "cash",   status: "draft",     user: "محمد (كاشير)" },
  { id: "INV-2025-0080", date: "2025-01-25", customerId: "sc3", customer: "مطبخ الإمارات",       customerEn: "Emirates Kitchen",      cartons: 60, kg: 620,  subtotal: 8990,    vat: 449.50, total: 9439.50, paid: 9439.50, remaining: 0,       method: "bank",   status: "adjusted",  user: "أحمد (مالك)" },
  { id: "INV-2025-0075", date: "2025-01-20", customerId: "sc1", customer: "مطعم الخليج",         customerEn: "Al Khalij Restaurant",  cartons: 30, kg: 320,  subtotal: 4680,    vat: 234,    total: 4914,    paid: 4914,    remaining: 0,       method: "cash",   status: "cancelled", user: "أحمد (مالك)" },
];
