import { IS_MOCK_MODE } from "@/services/config";
import { request } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";

export interface CompanySettings {
  id: number;
  name_ar: string;
  name_en: string;
  trade_license?: string;
  trn?: string;
  emirate?: string;
  address?: string;
  phone?: string;
  email?: string;
  subdomain?: string;
  status?: string;
  active_user_count?: number;
  logo_url?: string | null;
  stamp_url?: string | null;
  signature_url?: string | null;
}

export type CompanyAssetKind = "logo" | "stamp" | "signature";

export interface VatSettings {
  id: number;
  vat_enabled_default: boolean;
  default_vat_rate: string;
  allow_vat_disable_sales?: boolean;
  allow_vat_disable_purchase?: boolean;
  require_reason_for_vat_change?: boolean;
  warn_missing_customer_trn?: boolean;
  warn_missing_supplier_trn?: boolean;
}

export interface NumberingSettingsRow {
  id: number;
  document_type: string;
  prefix: string;
  next_number: number;
  number_length: number;
  reset_rule: string;
  active: boolean;
}

export interface PrintTemplateSettingsRow {
  id: number;
  template_type: string;
  show_logo: boolean;
  show_stamp: boolean;
  show_signature: boolean;
  show_trn: boolean;
  show_arabic_labels: boolean;
  show_english_labels: boolean;
  show_amount_in_words?: boolean;
  footer_notes?: string;
  receiver_signature_required?: boolean;
  paper_size?: string;
}

export async function getTenantSettings(): Promise<CompanySettings> {
  if (IS_MOCK_MODE) throw new Error("Mock mode");
  return request<CompanySettings>(ENDPOINTS.tenant.settings);
}

export async function updateCompanySettings(payload: Record<string, unknown>): Promise<CompanySettings> {
  return request<CompanySettings>(ENDPOINTS.tenant.settingsCompany, { method: "PATCH", body: payload });
}

/** Upload or remove (pass null) a company identity asset via multipart PATCH. */
export async function updateCompanyAsset(
  kind: CompanyAssetKind,
  file: File | null,
): Promise<CompanySettings> {
  const form = new FormData();
  form.append(kind, file ?? "");
  return request<CompanySettings>(ENDPOINTS.tenant.settingsCompany, { method: "PATCH", body: form });
}

export async function getVatSettings(): Promise<VatSettings> {
  if (IS_MOCK_MODE) throw new Error("Mock mode");
  return request<VatSettings>(ENDPOINTS.tenant.settingsVat);
}

export async function updateVatSettings(payload: Record<string, unknown>): Promise<VatSettings> {
  return request<VatSettings>(ENDPOINTS.tenant.settingsVat, { method: "PATCH", body: payload });
}

export async function listNumberingSettings(): Promise<NumberingSettingsRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: NumberingSettingsRow[] } | NumberingSettingsRow[]>(
    ENDPOINTS.tenant.settingsNumbering,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function updateNumberingSettings(
  id: string | number,
  payload: Record<string, unknown>,
): Promise<NumberingSettingsRow> {
  return request<NumberingSettingsRow>(ENDPOINTS.tenant.settingsNumberingItem(id), {
    method: "PATCH",
    body: payload,
  });
}

export async function listPrintTemplateSettings(): Promise<PrintTemplateSettingsRow[]> {
  if (IS_MOCK_MODE) return [];
  const data = await request<{ results?: PrintTemplateSettingsRow[] } | PrintTemplateSettingsRow[]>(
    ENDPOINTS.tenant.settingsPrintTemplates,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function updatePrintTemplateSettings(
  id: string | number,
  payload: Record<string, unknown>,
): Promise<PrintTemplateSettingsRow> {
  return request<PrintTemplateSettingsRow>(ENDPOINTS.tenant.settingsPrintTemplate(id), {
    method: "PATCH",
    body: payload,
  });
}
