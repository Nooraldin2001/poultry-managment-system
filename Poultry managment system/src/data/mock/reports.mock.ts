// Reports / chart mock data (extracted verbatim from App.tsx).

/** Daily sales vs purchases (current week). */
export const T_DAILY = [
  { day: "الأحد",    dayEn: "Sun", sales: 15200, purchases: 9800  },
  { day: "الاثنين", dayEn: "Mon", sales: 18300, purchases: 12100 },
  { day: "الثلاثاء",dayEn: "Tue", sales: 14800, purchases: 10200 },
  { day: "الأربعاء",dayEn: "Wed", sales: 21500, purchases: 14300 },
  { day: "الخميس",  dayEn: "Thu", sales: 16700, purchases: 11500 },
  { day: "الجمعة",  dayEn: "Fri", sales: 19200, purchases: 13100 },
  { day: "اليوم",   dayEn: "Today", sales: 18450, purchases: 11200 },
];

/** Monthly net profit trend. */
export const T_MONTHLY_PROFIT = [
  { month: "أغسطس", monthEn: "Aug", profit: 78000 },
  { month: "سبتمبر",monthEn: "Sep", profit: 82000 },
  { month: "أكتوبر",monthEn: "Oct", profit: 88000 },
  { month: "نوفمبر",monthEn: "Nov", profit: 75000 },
  { month: "ديسمبر",monthEn: "Dec", profit: 91000 },
  { month: "يناير", monthEn: "Jan", profit: 93000 },
];

/** Payment-method split (pie). */
export const T_PAY_PIE = [
  { name: "كاش", nameEn: "Cash", value: 45, color: "#22C55E" },
  { name: "بنكي", nameEn: "Bank", value: 35, color: "#0F2C59" },
  { name: "آجل",  nameEn: "Credit", value: 20, color: "#F59E0B" },
];
