import type { ComponentType } from "react";
import type { InvoiceTemplateProps } from "./types";
import { InvoiceTemplateClassic } from "./templates/InvoiceTemplateClassic";
import { InvoiceTemplateModern } from "./templates/InvoiceTemplateModern";
import { InvoiceTemplateBilingual } from "./templates/InvoiceTemplateBilingual";
import { InvoiceTemplateFirstViewStyle } from "./templates/InvoiceTemplateFirstViewStyle";

export const DEFAULT_TEMPLATE_KEY = "firstview_style";

export const INVOICE_TEMPLATES: Record<string, ComponentType<InvoiceTemplateProps>> = {
  classic: InvoiceTemplateClassic,
  modern: InvoiceTemplateModern,
  bilingual: InvoiceTemplateBilingual,
  firstview_style: InvoiceTemplateFirstViewStyle,
};

/** Resolve a template component with a safe fallback for unknown keys. */
export function resolveTemplate(key: string | undefined | null): ComponentType<InvoiceTemplateProps> {
  if (key && INVOICE_TEMPLATES[key]) return INVOICE_TEMPLATES[key];
  return INVOICE_TEMPLATES[DEFAULT_TEMPLATE_KEY];
}

/** Bilingual names for the settings UI. */
export const TEMPLATE_LABELS: Record<string, [string, string]> = {
  classic: ["كلاسيكي", "Classic"],
  modern: ["عصري", "Modern"],
  bilingual: ["ثنائي اللغة", "Bilingual"],
  firstview_style: ["النمط الرسمي", "Official Style"],
};
