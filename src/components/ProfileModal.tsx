import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/it";

type ProfileModalProps = {
  isOpen: boolean;
  name: string | null;
  email: string;
  favoriteBeaches: {
    id: string;
    name: string;
    region: string;
  }[];
  deleting: boolean;
  onClose: () => void;
  onSelectFavorite: (beachId: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

const ProfileModal = ({
  isOpen,
  name,
  email,
  favoriteBeaches,
  deleting,
  onClose,
  onSelectFavorite,
  onSignOut,
  onDeleteAccount,
}: ProfileModalProps) => {
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
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/78 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.account.profileTitle}
        className="w-full max-w-[420px] overflow-hidden rounded-[20px] border border-white/18 bg-[rgba(7,10,14,0.96)] px-5 pb-5 pt-4 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.82)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-semibold br-text-primary">
            {STRINGS.account.profileTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="br-press rounded-full border border-white/25 bg-black/85 px-3 py-1 text-[11px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.actions.close}
          </button>
        </div>

        <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] br-text-tertiary">
            {STRINGS.account.signedInAs}
          </div>
          {name ? (
            <div className="mt-1 text-[14px] font-semibold br-text-primary">{name}</div>
          ) : null}
          <div className="truncate text-[13px] br-text-secondary">{email}</div>
        </div>

        <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-100/90">
              {STRINGS.account.profileFavoritesTitle}
            </div>
            <div className="text-[11px] font-semibold text-amber-100/80">
              {favoriteBeaches.length}
            </div>
          </div>
          {favoriteBeaches.length > 0 ? (
            <div
              data-testid="favorites-list"
              className="mt-2 max-h-[220px] overflow-y-auto rounded-[10px] border border-white/12 bg-black/35"
            >
              {favoriteBeaches.map((beach) => (
                <button
                  type="button"
                  key={beach.id}
                  onClick={() => onSelectFavorite(beach.id)}
                  aria-label={`${STRINGS.account.profileOpenFavoriteAction}: ${beach.name}`}
                  className="br-press flex w-full items-center justify-between border-b border-white/8 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-[-1px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold br-text-primary">
                      {beach.name}
                    </div>
                    <div className="truncate text-[11px] br-text-tertiary">
                      {beach.region}
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className="ml-3 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300/55 bg-amber-400/20 text-[10px] text-amber-100"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="currentColor"
                    >
                      <path d="M12 2.7l2.8 5.67 6.25.91-4.53 4.42 1.07 6.24L12 17.06 6.4 19.94l1.07-6.24-4.53-4.42 6.25-.91L12 2.7z" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[12px] br-text-tertiary">
              {STRINGS.account.profileFavoritesEmpty}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={onSignOut}
            className="br-press w-full rounded-[11px] border border-white/24 bg-black/88 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          >
            {STRINGS.account.signOutAction}
          </button>

          <div className="rounded-[11px] border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
            {STRINGS.account.deleteAccountHint}
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={onDeleteAccount}
            className="br-press w-full rounded-[11px] border border-rose-300/45 bg-rose-500/20 px-3 py-2.5 text-[13px] font-semibold text-rose-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-rose-300/70 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting
              ? STRINGS.account.deletingAccountAction
              : STRINGS.account.deleteAccountAction}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
