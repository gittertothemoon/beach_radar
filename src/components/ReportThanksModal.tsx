import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/it";

type ReportThanksModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onShare: () => void;
};

const ReportThanksModal = ({
  isOpen,
  onClose,
  onShare,
}: ReportThanksModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;
    const focusables = container.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusables[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.report.thanksPrompt}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[22px] border border-white/15 bg-black/40 px-6 py-5 text-sm text-slate-100 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -right-24 -top-20 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="relative z-10 flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-100">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold">
              {STRINGS.report.thanksPrompt}
            </div>
            <div className="mt-1 text-[12px] text-slate-300">
              {STRINGS.report.thanksSubtitle}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="br-press rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-[12px] font-semibold text-slate-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.close}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="br-press rounded-full border border-white/25 bg-black/50 px-4 py-1.5 text-[12px] font-semibold text-slate-50 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.share}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportThanksModal;
