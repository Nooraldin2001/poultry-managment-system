// Invoice color themes — mirrors backend apps/company_settings/invoice_design.py

export type InvoiceTheme = {
  key: string;
  labelAr: string;
  labelEn: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  headerBg: string;
  titleBg: string;
  tableHeaderBg: string;
  summaryRowBg?: string;
  summaryRowText?: string;
  border: string;
  text: string;
  muted: string;
};

/** Token shape used by print template components (subset of InvoiceTheme). */
export interface InvoiceThemeTokens {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  headerBg: string;
  titleBg: string;
  tableHeaderBg: string;
  summaryRowBg?: string;
  summaryRowText?: string;
  border: string;
  text: string;
  muted: string;
}

export const DEFAULT_COLOR_THEME = "navy_red";

const THEME_LABELS_MAP: Record<string, [string, string]> = {
  navy_red: ["كحلي وأحمر", "Navy Red"],
  royal_blue: ["أزرق ملكي", "Royal Blue"],
  emerald: ["زمردي", "Emerald"],
  charcoal_gold: ["فحمي وذهبي", "Charcoal / Gold"],
  teal: ["أزرق مخضر", "Teal"],
  crimson: ["قرمزي", "Crimson"],
  purple: ["بنفسجي", "Purple"],
};

const BASE_THEMES: Record<string, Omit<InvoiceTheme, "key" | "labelAr" | "labelEn">> = {
  navy_red: {
    primary: "#0F2C59",
    secondary: "#1E4174",
    accent: "#C8102E",
    bg: "#FFFFFF",
    headerBg: "#0F2C59",
    titleBg: "#C8102E",
    tableHeaderBg: "#0F2C59",
    summaryRowBg: "#0F2C59",
    summaryRowText: "#FFFFFF",
    border: "#D3DCE8",
    text: "#1A2433",
    muted: "#64748B",
  },
  royal_blue: {
    primary: "#1D4ED8",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    bg: "#FFFFFF",
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
    bg: "#FFFFFF",
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
    bg: "#FFFFFF",
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
    bg: "#FFFFFF",
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
    bg: "#FFFFFF",
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
    bg: "#FFFFFF",
    headerBg: "#6D28D9",
    titleBg: "#5B21B6",
    tableHeaderBg: "#6D28D9",
    border: "#EDE9FE",
    text: "#2E1065",
    muted: "#64748B",
  },
};

function buildTheme(key: string): InvoiceTheme {
  const base = BASE_THEMES[key] ?? BASE_THEMES[DEFAULT_COLOR_THEME];
  const [labelAr, labelEn] = THEME_LABELS_MAP[key] ?? [key, key];
  return { key, labelAr, labelEn, ...base };
}

export const DEFAULT_INVOICE_THEME: InvoiceTheme = buildTheme(DEFAULT_COLOR_THEME);

export const INVOICE_THEMES: Record<string, InvoiceTheme> = Object.fromEntries(
  Object.keys(BASE_THEMES).map((key) => [key, buildTheme(key)]),
);

/** Legacy alias — print components consume token fields including `bg`. */
export const COLOR_THEMES: Record<string, InvoiceThemeTokens> = INVOICE_THEMES;

/** Resolve full theme with labels; never returns undefined. */
export function getInvoiceTheme(themeKey?: string | null): InvoiceTheme {
  if (!themeKey) return DEFAULT_INVOICE_THEME;
  return INVOICE_THEMES[themeKey] ?? DEFAULT_INVOICE_THEME;
}

/** Resolve theme tokens with a safe fallback for unknown keys. */
export function resolveTheme(key: string | undefined | null): InvoiceThemeTokens {
  return getInvoiceTheme(key);
}

/** Summary row colors — follows template theme, never hardcoded blue. */
export function summaryRowColors(theme: InvoiceThemeTokens): { bg: string; text: string } {
  return {
    bg: theme.summaryRowBg ?? theme.tableHeaderBg ?? theme.primary,
    text: theme.summaryRowText ?? "#FFFFFF",
  };
}

/** Bilingual names for the settings UI swatches. */
export const THEME_LABELS: Record<string, [string, string]> = THEME_LABELS_MAP;
