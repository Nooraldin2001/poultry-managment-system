import type { InventoryItem } from "@/shared/types/tenant";
import type { ListResponse } from "@/services/api/types";
import { INVENTORY_ITEMS } from "@/data/mock/inventory.mock";
import { mockDelay } from "./mockDelay";

export function listInventoryItems(): ListResponse<InventoryItem> {
  return mockDelay(INVENTORY_ITEMS);
}
