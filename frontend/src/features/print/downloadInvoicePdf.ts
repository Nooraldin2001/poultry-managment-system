const PDF_DOCUMENT_ID = "invoice-pdf-document";
const A4_WIDTH_MM = 210;
const CONTENT_WIDTH_MM = 194;

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
    // Force layout so html2canvas measures the fixed A4 clone, not the viewport.
    void clone.offsetHeight;

    const options = {
      // Extra bottom margin prevents signature labels from being sliced.
      margin: [8, 8, 12, 8] as [number, number, number, number],
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
