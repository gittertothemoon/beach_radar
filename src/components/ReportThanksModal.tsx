import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/it";

type ReportThanksModalProps = {
  isOpen: boolean;
  awardedPoints?: number;
  newBalance?: number | null;
  onClose: () => void;
  onShare: () => void;
};

const ReportThanksModal = ({
  isOpen,
  awardedPoints,
  newBalance,
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

  const hasReward = typeof awardedPoints === "number" && awardedPoints > 0;

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
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/20">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">
              {STRINGS.report.thanksPrompt}
            </div>
            <div className="mt-1 text-[12px] text-slate-300">
              {STRINGS.report.thanksSubtitle}
            </div>
          </div>
        </div>

        {hasReward ? (
          <div className="relative z-10 mt-4 rounded-[14px] border border-emerald-300/25 bg-emerald-500/12 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/25 text-emerald-200">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l2.9 6.26 6.1.55-4.5 3.93 1.38 6.26L12 15.77l-5.88 3.23 1.38-6.26L3 8.81l6.1-.55L12 2z" />
                  </svg>
                </span>
                <span className="text-[14px] font-semibold text-emerald-100">
                  {STRINGS.account.reportThanksPointsEarned(awardedPoints)}
                </span>
              </div>
              {typeof newBalance === "number" ? (
                <span className="text-[12px] font-semibold text-emerald-200/70">
                  {STRINGS.account.reportThanksNewBalance(newBalance)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

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
