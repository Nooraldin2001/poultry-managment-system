import type { Company } from "@/shared/types/tenant";
import type { ItemResponse, ListResponse } from "@/services/api/types";
import { COMPANIES } from "@/data/mock/company.mock";
import { mockDelay } from "./mockDelay";

export function listCompanies(): ListResponse<Company> {
  return mockDelay(COMPANIES);
}

export function getCompanyById(id: string): ItemResponse<Company> {
  return mockDelay(COMPANIES.find((c) => c.id === id) ?? null);
}
