// Product mock data (extracted verbatim from App.tsx).
import type { SProduct } from "@/shared/types/documents";

/** Tenant dashboard product summary rows. */
export const T_PRODUCTS = [
  { id: "p1", name: "دجاج 900 جرام",     nameEn: "Chicken 900g",     cartons: 450, pieces: 4500, weightKg: 4050, minStock: 200, priceKg: 13.5 },
  { id: "p2", name: "دجاج 1000 جرام",    nameEn: "Chicken 1000g",    cartons: 180, pieces: 1800, weightKg: 1800, minStock: 300, priceKg: 14.0 },
  { id: "p3", name: "دجاج 1100 جرام",    nameEn: "Chicken 1100g",    cartons: 350, pieces: 3500, weightKg: 3850, minStock: 200, priceKg: 14.5 },
  { id: "p4", name: "دجاج 1200 جرام",    nameEn: "Chicken 1200g",    cartons: 420, pieces: 4200, weightKg: 5040, minStock: 200, priceKg: 15.0 },
  { id: "p5", name: "دجاج متحرك الوزن", nameEn: "Variable Weight",  cartons: 200, pieces: 2000, weightKg: 2200, minStock: 250, priceKg: 13.0 },
];

/** Full weight-grade catalogue + by-products used by the sales workflow. */
export const S_PRODUCTS: SProduct[] = [
  { id: "w500",  name: "500 GRAM",  nameAr: "500 جرام",  g: 500,  ppc: 20, priceKg: 12.50, stock: 280 },
  { id: "w550",  name: "550 GRAM",  nameAr: "550 جرام",  g: 550,  ppc: 20, priceKg: 12.75, stock: 240 },
  { id: "w600",  name: "600 GRAM",  nameAr: "600 جرام",  g: 600,  ppc: 20, priceKg: 13.00, stock: 190 },
  { id: "w650",  name: "650 GRAM",  nameAr: "650 جرام",  g: 650,  ppc: 20, priceKg: 13.25, stock: 210 },
  { id: "w700",  name: "700 GRAM",  nameAr: "700 جرام",  g: 700,  ppc: 16, priceKg: 13.25, stock: 175 },
  { id: "w750",  name: "750 GRAM",  nameAr: "750 جرام",  g: 750,  ppc: 16, priceKg: 13.50, stock: 260 },
  { id: "w800",  name: "800 GRAM",  nameAr: "800 جرام",  g: 800,  ppc: 16, priceKg: 13.50, stock: 300 },
  { id: "w850",  name: "850 GRAM",  nameAr: "850 جرام",  g: 850,  ppc: 16, priceKg: 13.75, stock: 320 },
  { id: "w900",  name: "900 GRAM",  nameAr: "900 جرام",  g: 900,  ppc: 10, priceKg: 13.75, stock: 450 },
  { id: "w950",  name: "950 GRAM",  nameAr: "950 جرام",  g: 950,  ppc: 10, priceKg: 14.00, stock: 280 },
  { id: "w1000", name: "1000 GRAM", nameAr: "1000 جرام", g: 1000, ppc: 10, priceKg: 14.00, stock: 180 },
  { id: "w1050", name: "1050 GRAM", nameAr: "1050 جرام", g: 1050, ppc: 10, priceKg: 14.25, stock: 340 },
  { id: "w1100", name: "1100 GRAM", nameAr: "1100 جرام", g: 1100, ppc: 10, priceKg: 14.50, stock: 350 },
  { id: "w1150", name: "1150 GRAM", nameAr: "1150 جرام", g: 1150, ppc: 10, priceKg: 14.50, stock: 290 },
  { id: "w1200", name: "1200 GRAM", nameAr: "1200 جرام", g: 1200, ppc: 10, priceKg: 14.75, stock: 420 },
  { id: "w1250", name: "1250 GRAM", nameAr: "1250 جرام", g: 1250, ppc: 10, priceKg: 14.75, stock: 380 },
  { id: "w1300", name: "1300 GRAM", nameAr: "1300 جرام", g: 1300, ppc: 10, priceKg: 15.00, stock: 410 },
  { id: "w1350", name: "1350 GRAM", nameAr: "1350 جرام", g: 1350, ppc: 10, priceKg: 15.00, stock: 300 },
  { id: "w1400", name: "1400 GRAM", nameAr: "1400 جرام", g: 1400, ppc: 10, priceKg: 15.25, stock: 270 },
  { id: "w1450", name: "1450 GRAM", nameAr: "1450 جرام", g: 1450, ppc: 10, priceKg: 15.25, stock: 220 },
  { id: "w1500", name: "1500 GRAM", nameAr: "1500 جرام", g: 1500, ppc: 10, priceKg: 15.50, stock: 190 },
  { id: "w1550", name: "1550 GRAM", nameAr: "1550 جرام", g: 1550, ppc: 10, priceKg: 15.50, stock: 200, variable: true },
  { id: "w1600", name: "1600 GRAM", nameAr: "1600 جرام", g: 1600, ppc: 10, priceKg: 15.75, stock: 150, variable: true },
  { id: "w1650", name: "1650 GRAM", nameAr: "1650 جرام", g: 1650, ppc: 10, priceKg: 15.75, stock: 120, variable: true },
  { id: "w1700", name: "1700 GRAM", nameAr: "1700 جرام", g: 1700, ppc: 10, priceKg: 16.00, stock: 100, variable: true },
  { id: "liver",   name: "Liver",   nameAr: "كبدة",  g: 0, ppc: 0, priceKg: 4.00,  stock: 500, isPart: true },
  { id: "gizzard", name: "Gizzard", nameAr: "قانصة", g: 0, ppc: 0, priceKg: 4.00,  stock: 400, isPart: true },
  { id: "heart",   name: "Heart",   nameAr: "قلب",   g: 0, ppc: 0, priceKg: 5.00,  stock: 300, isPart: true },
  { id: "breast",  name: "Breast",  nameAr: "صدور",  g: 0, ppc: 0, priceKg: 22.00, stock: 200, isPart: true },
  { id: "leg",     name: "Leg",     nameAr: "أرجل",  g: 0, ppc: 0, priceKg: 18.00, stock: 250, isPart: true },
  { id: "wings",   name: "Wings",   nameAr: "أجنحة", g: 0, ppc: 0, priceKg: 14.00, stock: 180, isPart: true },
  { id: "bone",    name: "Bone",    nameAr: "عظام",  g: 0, ppc: 0, priceKg: 3.00,  stock: 600, isPart: true },
];
