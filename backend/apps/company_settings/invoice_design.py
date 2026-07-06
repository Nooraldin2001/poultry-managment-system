"""Invoice design catalog: template keys + color themes shared by API and previews."""

from django.db import models


class InvoiceTemplateKey(models.TextChoices):
    CLASSIC = "classic", "Classic"
    MODERN = "modern", "Modern"
    BILINGUAL = "bilingual", "Bilingual"
    FIRSTVIEW_STYLE = "firstview_style", "FirstView Style"


class InvoiceColorTheme(models.TextChoices):
    NAVY_RED = "navy_red", "Navy / Red"
    ROYAL_BLUE = "royal_blue", "Royal Blue"
    EMERALD = "emerald", "Emerald"
    CHARCOAL_GOLD = "charcoal_gold", "Charcoal / Gold"
    TEAL = "teal", "Teal"
    CRIMSON = "crimson", "Crimson"
    PURPLE = "purple", "Purple"


DEFAULT_TEMPLATE_KEY = InvoiceTemplateKey.FIRSTVIEW_STYLE
DEFAULT_COLOR_THEME = InvoiceColorTheme.NAVY_RED

# Color tokens per theme. The frontend keeps a mirrored copy for rendering;
# the catalog endpoint exposes these so external clients/PDF workers can match.
COLOR_THEME_TOKENS = {
    InvoiceColorTheme.NAVY_RED: {
        "primary": "#0F2C59",
        "secondary": "#1E4174",
        "accent": "#C8102E",
        "headerBg": "#0F2C59",
        "titleBg": "#C8102E",
        "tableHeaderBg": "#0F2C59",
        "border": "#D3DCE8",
        "text": "#1A2433",
        "muted": "#64748B",
    },
    InvoiceColorTheme.ROYAL_BLUE: {
        "primary": "#1D4ED8",
        "secondary": "#3B82F6",
        "accent": "#F59E0B",
        "headerBg": "#1D4ED8",
        "titleBg": "#1E40AF",
        "tableHeaderBg": "#1D4ED8",
        "border": "#DBEAFE",
        "text": "#1E293B",
        "muted": "#64748B",
    },
    InvoiceColorTheme.EMERALD: {
        "primary": "#047857",
        "secondary": "#10B981",
        "accent": "#B45309",
        "headerBg": "#047857",
        "titleBg": "#065F46",
        "tableHeaderBg": "#047857",
        "border": "#D1FAE5",
        "text": "#14342B",
        "muted": "#64748B",
    },
    InvoiceColorTheme.CHARCOAL_GOLD: {
        "primary": "#1F2937",
        "secondary": "#374151",
        "accent": "#B8860B",
        "headerBg": "#1F2937",
        "titleBg": "#B8860B",
        "tableHeaderBg": "#1F2937",
        "border": "#E5E7EB",
        "text": "#111827",
        "muted": "#6B7280",
    },
    InvoiceColorTheme.TEAL: {
        "primary": "#0F766E",
        "secondary": "#14B8A6",
        "accent": "#EA580C",
        "headerBg": "#0F766E",
        "titleBg": "#115E59",
        "tableHeaderBg": "#0F766E",
        "border": "#CCFBF1",
        "text": "#134E4A",
        "muted": "#64748B",
    },
    InvoiceColorTheme.CRIMSON: {
        "primary": "#9F1239",
        "secondary": "#BE123C",
        "accent": "#0F172A",
        "headerBg": "#9F1239",
        "titleBg": "#881337",
        "tableHeaderBg": "#9F1239",
        "border": "#FECDD3",
        "text": "#33141D",
        "muted": "#64748B",
    },
    InvoiceColorTheme.PURPLE: {
        "primary": "#6D28D9",
        "secondary": "#8B5CF6",
        "accent": "#DB2777",
        "headerBg": "#6D28D9",
        "titleBg": "#5B21B6",
        "tableHeaderBg": "#6D28D9",
        "border": "#EDE9FE",
        "text": "#2E1065",
        "muted": "#64748B",
    },
}

TEMPLATE_CATALOG = [
    {
        "key": InvoiceTemplateKey.CLASSIC,
        "name_ar": "كلاسيكي",
        "name_en": "Classic",
        "description_ar": "تصميم بسيط تقليدي بدون ألوان قوية",
        "description_en": "Simple traditional layout with minimal color",
    },
    {
        "key": InvoiceTemplateKey.MODERN,
        "name_ar": "عصري",
        "name_en": "Modern",
        "description_ar": "رأس ملون عريض وجدول حديث",
        "description_en": "Bold colored header with a modern table",
    },
    {
        "key": InvoiceTemplateKey.BILINGUAL,
        "name_ar": "ثنائي اللغة",
        "name_en": "Bilingual",
        "description_ar": "تسميات عربية وإنجليزية جنباً إلى جنب",
        "description_en": "Arabic and English labels side by side",
    },
    {
        "key": InvoiceTemplateKey.FIRSTVIEW_STYLE,
        "name_ar": "النمط الرسمي",
        "name_en": "Official Style",
        "description_ar": "رأس داكن، شريط عنوان ملون، شعار وختم وتوقيع — مطابق للفاتورة الرسمية",
        "description_en": "Dark branded header, colored title strip, logo/stamp/signature — official tax invoice style",
    },
]

THEME_CATALOG = [
    {
        "key": key,
        "name_ar": name_ar,
        "name_en": name_en,
        "tokens": COLOR_THEME_TOKENS[key],
    }
    for key, name_ar, name_en in [
        (InvoiceColorTheme.NAVY_RED, "كحلي وأحمر", "Navy / Red"),
        (InvoiceColorTheme.ROYAL_BLUE, "أزرق ملكي", "Royal Blue"),
        (InvoiceColorTheme.EMERALD, "زمردي", "Emerald"),
        (InvoiceColorTheme.CHARCOAL_GOLD, "فحمي وذهبي", "Charcoal / Gold"),
        (InvoiceColorTheme.TEAL, "أزرق مخضر", "Teal"),
        (InvoiceColorTheme.CRIMSON, "قرمزي", "Crimson"),
        (InvoiceColorTheme.PURPLE, "بنفسجي", "Purple"),
    ]
]
