// Invoice color themes — mirrors backend apps/company_settings/invoice_design.py

export interface InvoiceThemeTokens {
  primary: string;
  secondary: string;
  accent: string;
  headerBg: string;
  titleBg: string;
  tableHeaderBg: string;
  border: string;
  text: string;
  muted: string;
}

export const DEFAULT_COLOR_THEME = "navy_red";

export const COLOR_THEMES: Record<string, InvoiceThemeTokens> = {
  navy_red: {
    primary: "#0F2C59",
    secondary: "#1E4174",
    accent: "#C8102E",
    headerBg: "#0F2C59",
    titleBg: "#C8102E",
    tableHeaderBg: "#0F2C59",
    border: "#D3DCE8",
    text: "#1A2433",
    muted: "#64748B",
  },
  royal_blue: {
    primary: "#1D4ED8",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    headerBg: "#1D4ED8",
    titleBg: "#1E40AF",
    tableHeaderBg: "#1D4ED8",
    border: "#DBEAFE",
    text: "#1E293B",
    muted: "#64748B",
  },
  emerald: {
    primary: "#047857",
    secondary: "#10B981",
    accent: "#B45309",
    headerBg: "#047857",
    titleBg: "#065F46",
    tableHeaderBg: "#047857",
    border: "#D1FAE5",
    text: "#14342B",
    muted: "#64748B",
  },
  charcoal_gold: {
    primary: "#1F2937",
    secondary: "#374151",
    accent: "#B8860B",
    headerBg: "#1F2937",
    titleBg: "#B8860B",
    tableHeaderBg: "#1F2937",
    border: "#E5E7EB",
    text: "#111827",
    muted: "#6B7280",
  },
  teal: {
    primary: "#0F766E",
    secondary: "#14B8A6",
    accent: "#EA580C",
    headerBg: "#0F766E",
    titleBg: "#115E59",
    tableHeaderBg: "#0F766E",
    border: "#CCFBF1",
    text: "#134E4A",
    muted: "#64748B",
  },
  crimson: {
    primary: "#9F1239",
    secondary: "#BE123C",
    accent: "#0F172A",
    headerBg: "#9F1239",
    titleBg: "#881337",
    tableHeaderBg: "#9F1239",
    border: "#FECDD3",
    text: "#33141D",
    muted: "#64748B",
  },
  purple: {
    primary: "#6D28D9",
    secondary: "#8B5CF6",
    accent: "#DB2777",
    headerBg: "#6D28D9",
    titleBg: "#5B21B6",
    tableHeaderBg: "#6D28D9",
    border: "#EDE9FE",
    text: "#2E1065",
    muted: "#64748B",
  },
};

/** Resolve theme tokens with a safe fallback for unknown keys. */
export function resolveTheme(key: string | undefined | null): InvoiceThemeTokens {
  if (key && COLOR_THEMES[key]) return COLOR_THEMES[key];
  return COLOR_THEMES[DEFAULT_COLOR_THEME];
}

/** Bilingual names for the settings UI swatches. */
export const THEME_LABELS: Record<string, [string, string]> = {
  navy_red: ["كحلي وأحمر", "Navy / Red"],
  royal_blue: ["أزرق ملكي", "Royal Blue"],
  emerald: ["زمردي", "Emerald"],
  charcoal_gold: ["فحمي وذهبي", "Charcoal / Gold"],
  teal: ["أزرق مخضر", "Teal"],
  crimson: ["قرمزي", "Crimson"],
  purple: ["بنفسجي", "Purple"],
};
