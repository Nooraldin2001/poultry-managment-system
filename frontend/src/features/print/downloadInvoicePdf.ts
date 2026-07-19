const PDF_DOCUMENT_ID = "invoice-pdf-document";

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

export async function downloadInvoicePdf(): Promise<number> {
  const documentElement = document.getElementById(PDF_DOCUMENT_ID);
  if (!(documentElement instanceof HTMLElement)) {
    throw new Error("Invoice document is not ready.");
  }

  await waitForPrintAssets(documentElement);
  const filename = safeFilename(documentElement.dataset.pdfFilename ?? "invoice");
  const { default: html2pdf } = await import("html2pdf.js");

  documentElement.classList.add("pdf-export-active");
  try {
    const options = {
      margin: [6, 7, 7, 7] as [number, number, number, number],
      filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: Math.ceil((196 * 96) / 25.4),
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".invoice-final-summary", ".signature-section", "tr"],
      },
    };
    const worker = html2pdf().set(options).from(documentElement).toPdf();
    const pdf = await worker.get("pdf") as {
      internal?: { getNumberOfPages?: () => number };
    };
    const pages = pdf.internal?.getNumberOfPages?.() ?? 0;
    await worker.save(filename);
    return pages;
  } finally {
    documentElement.classList.remove("pdf-export-active");
  }
}

export { PDF_DOCUMENT_ID };
