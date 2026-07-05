import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { Lang } from "@/shared/types";

type Props = {
  lang: Lang;
  messageAr?: string;
  messageEn?: string;
  onRetry?: () => void;
  onBack?: () => void;
  children: ReactNode;
};

type State = { error: Error | null };

export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ModuleErrorBoundary]", error, info.componentStack);
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      const isRTL = this.props.lang === "ar";
      const title = isRTL
        ? (this.props.messageAr ?? "حدث خطأ أثناء تحميل المبيعات")
        : (this.props.messageEn ?? "Something went wrong while loading Sales");
      return (
        <div className="p-4 lg:p-8 max-w-screen-xl mx-auto min-h-[40vh] flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-black text-[#0F2C59]">{title}</h2>
            <p className="text-sm text-slate-500">
              {isRTL ? "يرجى المحاولة مرة أخرى أو العودة للرئيسية." : "Please try again or return to the dashboard."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-xl bg-[#0F2C59] text-white text-sm font-bold hover:bg-[#162f5f]"
              >
                {isRTL ? "إعادة المحاولة" : "Retry"}
              </button>
              {this.props.onBack && (
                <button
                  type="button"
                  onClick={this.props.onBack}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  {isRTL ? "العودة للرئيسية" : "Back to dashboard"}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
