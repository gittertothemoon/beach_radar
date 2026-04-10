import { useEffect, useMemo, useRef } from "react";
import { STRINGS } from "../i18n/strings";

type AccountRequiredModalProps = {
  isOpen: boolean;
  beachName: string | null;
  reason?: "favorites" | "reports";
  onClose: () => void;
  onContinue: () => void;
};

const AccountRequiredModal = ({
  isOpen,
  beachName,
  reason = "favorites",
  onClose,
  onContinue,
}: AccountRequiredModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isReportReason = reason === "reports";

  const titleLabel = useMemo(
    () =>
      beachName
        ? `${STRINGS.account.title}: ${beachName}`
        : STRINGS.account.title,
    [beachName],
  );
  const subtitle = isReportReason
    ? STRINGS.account.subtitleReports
    : STRINGS.account.subtitle;
  const requiredMessage = isReportReason
    ? STRINGS.account.requiredForReports
    : STRINGS.account.requiredForFavorites;
  const continueLabel = isReportReason
    ? STRINGS.account.signInAction
    : STRINGS.account.continueToRegister;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 pt-10">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={titleLabel}
        data-testid="auth-required-modal"
        className="w-full max-w-screen-sm rounded-[18px] contrast-guard px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold br-text-primary">
              {STRINGS.account.title}
            </h3>
            <p className="text-sm br-text-secondary">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={STRINGS.actions.close}
            className="br-press rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="mt-4 rounded-[12px] border border-white/15 bg-black/30 px-4 py-3 text-xs br-text-secondary backdrop-blur-sm">
          {requiredMessage}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="br-press w-full rounded-[12px] border border-white/25 bg-black/50 px-4 py-3 text-[14px] font-semibold text-slate-50 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountRequiredModal;
