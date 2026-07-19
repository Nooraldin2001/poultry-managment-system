const PDF_DOCUMENT_ID = "invoice-pdf-document";
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MAX_SINGLE_PAGE_LAYOUT_WIDTH_MM = 250;
// Full-bleed export: content spans the entire A4 width with no page margins.
const CONTENT_WIDTH_MM = A4_WIDTH_MM;

function safeFilename(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100);
  return `${cleaned || "invoice"}.pdf`;
}

async function waitForPrintAssets(root: HTMLElement): Promise<void> {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }
    }),
  );
}

function createExportClone(source: HTMLElement): { host: HTMLElement; clone: HTMLElement } {
  const host = document.createElement("div");
  host.setAttribute("data-invoice-pdf-host", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${A4_WIDTH_MM}mm`,
    "padding:0",
    "margin:0",
    "background:#ffffff",
    "overflow:visible",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.classList.add("pdf-export-active");
  clone.style.width = `${CONTENT_WIDTH_MM}mm`;
  clone.style.maxWidth = "none";
  clone.style.minHeight = "auto";
  clone.style.margin = "0";
  clone.style.padding = "0";
  clone.style.boxShadow = "none";
  clone.style.border = "0";
  clone.style.borderRadius = "0";
  clone.style.transform = "none";
  clone.style.overflow = "visible";
  clone.style.background = "#ffffff";

  host.appendChild(clone);
  document.body.appendChild(host);
  return { host, clone };
}

/**
 * Render a near-fitting invoice on one A4 page, like the browser's "fit to
 * printable area" behavior. Widening the off-screen layout makes html2pdf
 * scale it uniformly back to 210mm, without stretching text or adding margins.
 * The cap keeps text readable; larger invoices retain normal pagination.
 */
function fitCloneToSinglePage(host: HTMLElement, clone: HTMLElement): boolean {
  const targetHeightMm = A4_HEIGHT_MM - 1;
  let layoutWidthMm = CONTENT_WIDTH_MM;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    host.style.width = `${layoutWidthMm}mm`;
    clone.style.setProperty("--pdf-export-layout-width", `${layoutWidthMm}mm`);
    void clone.offsetHeight;

    const renderedWidth = clone.getBoundingClientRect().width;
    const outputHeightMm = renderedWidth > 0
      ? (clone.scrollHeight / renderedWidth) * A4_WIDTH_MM
      : Number.POSITIVE_INFINITY;

    if (outputHeightMm <= targetHeightMm) {
      clone.classList.add("pdf-export-single-page");
      return true;
    }

    const requiredWidthMm = layoutWidthMm * (outputHeightMm / targetHeightMm) * 1.01;
    const nextWidthMm = Math.min(MAX_SINGLE_PAGE_LAYOUT_WIDTH_MM, requiredWidthMm);
    if (nextWidthMm <= layoutWidthMm + 0.5) break;
    layoutWidthMm = nextWidthMm;
  }

  // Keep the normal A4-width layout when readable one-page fitting is not possible.
  host.style.width = `${CONTENT_WIDTH_MM}mm`;
  clone.style.setProperty("--pdf-export-layout-width", `${CONTENT_WIDTH_MM}mm`);
  void clone.offsetHeight;
  return false;
}

export async function downloadInvoicePdf(): Promise<number> {
  const documentElement = document.getElementById(PDF_DOCUMENT_ID);
  if (!(documentElement instanceof HTMLElement)) {
    throw new Error("Invoice document is not ready.");
  }

  await waitForPrintAssets(documentElement);
  const filename = safeFilename(documentElement.dataset.pdfFilename ?? "invoice");
  const { default: html2pdf } = await import("html2pdf.js");
  const { host, clone } = createExportClone(documentElement);

  try {
    await waitForPrintAssets(clone);
    // Prefer one page when the whole invoice fits without excessive shrinking.
    fitCloneToSinglePage(host, clone);

    const options = {
      margin: [0, 0, 0, 0] as [number, number, number, number],
      filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.ceil(clone.scrollWidth),
        windowHeight: Math.ceil(clone.scrollHeight),
        onclone: (_doc: Document, el: HTMLElement) => {
          el.classList.add("pdf-export-active");
          el.style.overflow = "visible";
          el.querySelectorAll<HTMLElement>("*").forEach((node) => {
            node.style.overflow = "visible";
            // html2canvas draws glyphs one-by-one when letter-spacing is set,
            // which destroys Arabic contextual joining. Force normal spacing.
            node.style.letterSpacing = "normal";
          });
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".invoice-header", ".invoice-title-strip", ".invoice-final-summary", ".invoice-total-row", "tr"],
      },
    };

    const worker = html2pdf().set(options).from(clone).toPdf();
    const pdf = (await worker.get("pdf")) as {
      internal?: { getNumberOfPages?: () => number };
    };
    const pages = pdf.internal?.getNumberOfPages?.() ?? 0;
    await worker.save(filename);
    return pages;
  } finally {
    host.remove();
  }
}

export { PDF_DOCUMENT_ID };
