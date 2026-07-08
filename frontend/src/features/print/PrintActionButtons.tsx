import { Printer } from "lucide-react";
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
        onClick={triggerPrint}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
        style={{ background: primaryColor }}
      >
        <Printer size={15} />
        {isRTL ? "طباعة / حفظ PDF" : "Print / Save PDF"}
      </button>
    </>
  );
}
