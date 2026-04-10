import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/it";
import type { AccountRewardsSummary } from "../lib/rewards";
import type { ActiveBadge } from "../lib/activeBadge";

type ProfileModalProps = {
  isOpen: boolean;
  name: string | null;
  email: string;
  favoriteBeaches: {
    id: string;
    name: string;
    region: string;
  }[];
  rewards: AccountRewardsSummary | null;
  rewardsLoading: boolean;
  redeemingBadgeCode: string | null;
  activeBadge: ActiveBadge | null;
  deleting: boolean;
  onClose: () => void;
  onSelectFavorite: (beachId: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onRedeemBadge: (badgeCode: string) => void;
  onEquipBadge: (badge: ActiveBadge) => void;
};

const BADGE_ICONS: Record<string, string> = {
  eye: "👁️",
  shield: "🛡️",
  wave: "🌊",
  beach: "🏖️",
  lighthouse: "⛯",
  sun: "☀️",
};

function badgeIcon(icon: string): string {
  return BADGE_ICONS[icon] ?? "🏅";
}

const ProfileModal = ({
  isOpen,
  name,
  email,
  favoriteBeaches,
  rewards,
  rewardsLoading,
  redeemingBadgeCode,
  activeBadge,
  deleting,
  onClose,
  onSelectFavorite,
  onSignOut,
  onDeleteAccount,
  onRedeemBadge,
  onEquipBadge,
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

  // Progress toward cheapest unowned badge
  const nextUnowned = rewards?.badges
    .filter((b) => !b.owned)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const progressNeeded =
    nextUnowned && rewards ? nextUnowned.pointsCost - rewards.balance : null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/78 px-0 pb-0 sm:items-center sm:px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.account.profileTitle}
        className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-t-[24px] border border-white/18 bg-[rgba(7,10,14,0.96)] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.82)] sm:rounded-[20px]"
        style={{ maxHeight: "calc(90 * var(--svh, 1vh))" }}
      >
        {/* Scrollable body — min-h-0 ensures it shrinks inside flex parent */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[env(safe-area-inset-bottom,16px)] pt-4">

          {/* Header */}
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

          {/* Account info */}
          <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] br-text-tertiary">
              {STRINGS.account.signedInAs}
            </div>
            {name ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="text-[14px] font-semibold br-text-primary">{name}</div>
                {activeBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-0.5">
                    <span className="text-[13px] leading-none">{badgeIcon(activeBadge.icon)}</span>
                    <span className="text-[10px] font-semibold text-amber-200/90">{activeBadge.name}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="truncate text-[13px] br-text-secondary">{email}</div>
          </div>

          {/* ── Points balance ── */}
          <div className="mt-3 rounded-[12px] border border-emerald-200/25 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100/90">
                {STRINGS.account.pointsBalanceTitle}
              </div>
              <div className="text-[11px] text-emerald-100/60">
                {rewardsLoading
                  ? STRINGS.account.rewardsLoading
                  : STRINGS.account.rewardsReady}
              </div>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-emerald-50">
                {rewards ? rewards.balance : "--"}
              </span>
              <span className="mb-0.5 text-[14px] font-semibold text-emerald-200/70">pt</span>
            </div>
            <div className="mt-1.5 text-[11px] text-emerald-100/75">
              {rewards
                ? STRINGS.account.reportPointsHint(rewards.reportPoints)
                : STRINGS.account.rewardsUnavailable}
            </div>
            {progressNeeded !== null && progressNeeded > 0 ? (
              <div className="mt-2 text-[11px] text-emerald-200/60">
                {STRINGS.account.storeProgressHint(progressNeeded)}
              </div>
            ) : null}
          </div>

          {/* ── Badge store ── */}
          <div className="mt-3 rounded-[12px] border border-white/15 bg-black/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-100/80">
                {STRINGS.account.badgeStoreTitle}
              </div>
              {rewards ? (
                <div className="text-[11px] text-slate-400">
                  {rewards.ownedBadgesCount}/{rewards.badges.length}
                </div>
              ) : null}
            </div>

            {rewards?.badges?.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {rewards.badges.map((badge) => {
                  const isRedeeming = redeemingBadgeCode === badge.code;
                  const redeemDisabled = isRedeeming || !badge.redeemable;
                  const isActive = activeBadge?.code === badge.code;
                  return (
                    <div
                      key={badge.code}
                      className={[
                        "flex flex-col rounded-[12px] border p-3 transition-colors",
                        badge.owned
                          ? isActive
                            ? "border-amber-300/45 bg-amber-500/12"
                            : "border-emerald-300/30 bg-emerald-500/10"
                          : "border-white/10 bg-black/40",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          aria-hidden="true"
                          className="text-[22px] leading-none"
                        >
                          {badgeIcon(badge.icon)}
                        </span>
                        {badge.owned ? (
                          isActive ? (
                            <span className="mt-0.5 rounded-full border border-amber-300/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                              {STRINGS.account.badgeEquippedLabel}
                            </span>
                          ) : (
                            <span className="mt-0.5 rounded-full border border-emerald-300/35 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                              {STRINGS.account.badgeOwned}
                            </span>
                          )
                        ) : (
                          <span className="mt-0.5 rounded-full border border-amber-300/30 bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200/80">
                            {badge.pointsCost} pt
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[12px] font-semibold leading-tight br-text-primary">
                        {badge.name}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug br-text-tertiary">
                        {badge.description}
                      </div>
                      {badge.owned ? (
                        !isActive ? (
                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={() => onEquipBadge({ code: badge.code, icon: badge.icon, name: badge.name })}
                              className="br-press w-full rounded-full border border-white/20 bg-white/8 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 hover:border-amber-300/40 hover:text-amber-100"
                            >
                              {STRINGS.account.badgeEquipAction}
                            </button>
                          </div>
                        ) : null
                      ) : (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            disabled={redeemDisabled}
                            onClick={() => onRedeemBadge(badge.code)}
                            className={[
                              "br-press w-full rounded-full py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1",
                              badge.redeemable
                                ? "border border-amber-300/50 bg-amber-500/20 text-amber-50"
                                : "border border-white/10 bg-black/30 text-slate-500",
                              redeemDisabled ? "cursor-not-allowed opacity-55" : "",
                            ].join(" ")}
                          >
                            {isRedeeming
                              ? STRINGS.account.badgeRedeemingAction
                              : STRINGS.account.badgeRedeemAction}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : rewards ? (
              <div className="mt-3 text-[12px] br-text-tertiary">
                {STRINGS.account.badgeStoreEmpty}
              </div>
            ) : null}
          </div>

          {/* ── Coupon section ── */}
          <div className="mt-3 rounded-[12px] border border-dashed border-white/15 bg-black/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[18px]">🎟️</span>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {STRINGS.account.couponStoreTitle}
              </div>
              <span className="rounded-full border border-slate-500/40 bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                Prossimamente
              </span>
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {STRINGS.account.couponComingSoon}
            </div>
          </div>

          {/* ── Favorites ── */}
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
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
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

          {/* ── Actions ── */}
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
    </div>
  );
};

export default ProfileModal;
