import type { Lang } from "@/shared/types";
import type { InvoiceThemeTokens } from "./theme";

export interface PrintLineRow {
  label: string;
  qty?: string;
  unit?: string;
  price?: string;
  total?: string;
}

export interface InvoiceBranding {
  template_key: string;
  color_theme: string;
  show_logo: boolean;
  show_stamp: boolean;
  show_signature: boolean;
  show_company_trn: boolean;
  show_company_phone: boolean;
  show_customer_trn: boolean;
  show_supplier_trn: boolean;
  show_bilingual_labels: boolean;
}

export const DEFAULT_BRANDING: InvoiceBranding = {
  template_key: "firstview_style",
  color_theme: "navy_red",
  show_logo: true,
  show_stamp: true,
  show_signature: true,
  show_company_trn: true,
  show_company_phone: true,
  show_customer_trn: true,
  show_supplier_trn: true,
  show_bilingual_labels: true,
};

export interface InvoiceCompanyIdentity {
  name_ar: string;
  name_en: string;
  trn: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
}

export interface InvoicePartyIdentity {
  name: string;
  trn: string;
  phone: string;
  address: string;
}

export interface InvoiceTemplateProps {
  lang: Lang;
  titleAr: string;
  titleEn: string;
  company: InvoiceCompanyIdentity;
  party: InvoicePartyIdentity;
  partyKind: "customer" | "supplier";
  meta: { label: string; value: string }[];
  lines: PrintLineRow[];
  totals: { label: string; value: string }[];
  notes?: string;
  branding: InvoiceBranding;
  theme: InvoiceThemeTokens;
}

export function parseBranding(raw: unknown): InvoiceBranding {
  if (!raw || typeof raw !== "object") return DEFAULT_BRANDING;
  const b = raw as Record<string, unknown>;
  return {
    template_key: typeof b.template_key === "string" ? b.template_key : DEFAULT_BRANDING.template_key,
    color_theme: typeof b.color_theme === "string" ? b.color_theme : DEFAULT_BRANDING.color_theme,
    show_logo: b.show_logo !== false,
    show_stamp: b.show_stamp !== false,
    show_signature: b.show_signature !== false,
    show_company_trn: b.show_company_trn !== false,
    show_company_phone: b.show_company_phone !== false,
    show_customer_trn: b.show_customer_trn !== false,
    show_supplier_trn: b.show_supplier_trn !== false,
    show_bilingual_labels: b.show_bilingual_labels !== false,
  };
}

export function parseCompanyIdentity(raw: unknown): InvoiceCompanyIdentity {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v).trim());
  const url = (v: unknown) => (v ? String(v) : null);
  return {
    name_ar: str(c.name_ar),
    name_en: str(c.name_en),
    trn: str(c.trn),
    phone: str(c.phone),
    email: str(c.email),
    address: str(c.address),
    logo_url: url(c.logo_url),
    stamp_url: url(c.stamp_url),
    signature_url: url(c.signature_url),
  };
}

export function parsePartyIdentity(raw: unknown): InvoicePartyIdentity {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v).trim());
  return {
    name: str(p.name_ar ?? p.name ?? p.customer_name ?? p.supplier_name),
    trn: str(p.trn),
    phone: str(p.phone),
    address: str(p.address),
  };
}
