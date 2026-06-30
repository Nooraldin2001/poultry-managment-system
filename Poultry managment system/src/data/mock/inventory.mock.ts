// Inventory mock data for the service boundary.
// NOTE: the InventoryModule screens currently use their own internal mock data;
// this representative set backs the future API service (see services/).
import type { InventoryItem } from "@/shared/types/tenant";

export const INVENTORY_ITEMS: InventoryItem[] = [
  { id: "ip900",  name: "دجاج 900 جرام",  nameEn: "Chicken 900g",  cartons: 450, pieces: 4500, weightKg: 4050, minStock: 200, priceKg: 13.5 },
  { id: "ip1000", name: "دجاج 1000 جرام", nameEn: "Chicken 1000g", cartons: 180, pieces: 1800, weightKg: 1800, minStock: 300, priceKg: 14.0 },
  { id: "ip1100", name: "دجاج 1100 جرام", nameEn: "Chicken 1100g", cartons: 350, pieces: 3500, weightKg: 3850, minStock: 200, priceKg: 14.5 },
  { id: "ip1200", name: "دجاج 1200 جرام", nameEn: "Chicken 1200g", cartons: 420, pieces: 4200, weightKg: 5040, minStock: 200, priceKg: 15.0 },
];
