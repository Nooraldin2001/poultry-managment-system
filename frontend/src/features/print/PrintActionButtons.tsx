import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoicePdf } from "./downloadInvoicePdf";
import { triggerPrint } from "./triggerPrint";

export function PrintActionButtons({
  isRTL,
  onBack,
  primaryColor = "#0F2C59",
}: {
  isRTL: boolean;
  onBack?: () => void;
  primaryColor?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const pages = await downloadInvoicePdf();
      toast.success(
        pages > 0
          ? isRTL
            ? `تم تنزيل ملف PDF (${pages} صفحة)`
            : `PDF downloaded (${pages} ${pages === 1 ? "page" : "pages"})`
          : isRTL
            ? "تم تنزيل ملف PDF"
            : "PDF downloaded",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isRTL
            ? "تعذر تنزيل ملف PDF"
            : "Unable to download PDF",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl border text-sm font-bold"
        >
          {isRTL ? "رجوع" : "Back"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
        style={{ background: primaryColor }}
      >
        {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {downloading
          ? (isRTL ? "جارٍ إنشاء PDF..." : "Creating PDF...")
          : (isRTL ? "تنزيل PDF" : "Download PDF")}
      </button>
      <button
        type="button"
        onClick={triggerPrint}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        <Printer size={15} />
        {isRTL ? "طباعة" : "Print"}
      </button>
    </>
  );
}
