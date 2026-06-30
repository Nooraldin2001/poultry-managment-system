// Customer mock data (extracted verbatim from App.tsx).

/** Tenant dashboard customer summary rows. */
export const T_CUSTOMERS = [
  { id: "c1", name: "مطعم الخليج",           nameEn: "Al Khalij Restaurant",   balance: 12500, overdue: true,  days: 14, creditLimit: 20000 },
  { id: "c2", name: "سوبر ماركت المدينة",   nameEn: "Al Madina Supermarket",  balance: 8200,  overdue: false, days: 5,  creditLimit: 15000 },
  { id: "c3", name: "مطبخ الإمارات",         nameEn: "Emirates Kitchen",       balance: 4800,  overdue: true,  days: 21, creditLimit: 10000 },
];

/** Sales-workflow customers (with TRN). */
export const S_CUSTOMERS = [
  { id: "sc1", name: "مطعم الخليج",         nameEn: "Al Khalij Restaurant",  phone: "+971 50 123 4567", balance: 12500, creditLimit: 20000, overdue: true,  trn: "" },
  { id: "sc2", name: "سوبر ماركت المدينة", nameEn: "Al Madina Supermarket", phone: "+971 55 987 6543", balance: 8200,  creditLimit: 15000, overdue: false, trn: "100123456700003" },
  { id: "sc3", name: "مطبخ الإمارات",       nameEn: "Emirates Kitchen",      phone: "+971 50 654 3210", balance: 4800,  creditLimit: 10000, overdue: true,  trn: "" },
  { id: "sc4", name: "Prime Fresh Meat LLC", nameEn: "Prime Fresh Meat LLC",  phone: "+971 54 321 6789", balance: 0,     creditLimit: 50000, overdue: false, trn: "100987654300001" },
];
