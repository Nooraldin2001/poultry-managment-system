// Common primitive/UI types shared across the Poultry Hero frontend.
// These are frontend + API-boundary types, NOT backend (Django) models.

/** UI language. Arabic is the default (RTL). */
export type Language = "ar" | "en";

/** Legacy alias used throughout the imported Figma Make code. */
export type Lang = Language;

/** Generic semantic colour used by status badges across screens. */
export type StatusBadgeType =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

/** A bilingual label tuple: [arabic, english]. */
export type BilingualLabel = [string, string];
