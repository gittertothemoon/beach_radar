import { STRINGS } from "../i18n/it";
import type { AccountRewardsSummary } from "../lib/rewards";
import type { ActiveBadge } from "../lib/activeBadge";
import BadgeIcon from "./BadgeIcon";

type RewardsSheetProps = {
  rewards: AccountRewardsSummary | null;
  rewardsLoading: boolean;
  redeemingBadgeCode: string | null;
  activeBadge: ActiveBadge | null;
  accountEmail: string | null;
  onRedeemBadge: (badgeCode: string) => void;
  onEquipBadge: (badge: ActiveBadge) => void;
  onOpenSignIn: () => void;
};

const RewardsSheet = ({
  rewards,
  rewardsLoading,
  redeemingBadgeCode,
  activeBadge,
  accountEmail,
  onRedeemBadge,
  onEquipBadge,
  onOpenSignIn,
}: RewardsSheetProps) => {
  const nextUnowned = rewards?.badges
    .filter((b) => !b.owned)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const progressNeeded =
    nextUnowned && rewards ? nextUnowned.pointsCost - rewards.balance : null;

  if (!accountEmail) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/12 text-amber-200">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-semibold br-text-primary">{STRINGS.account.rewardsLoginTitle}</div>
          <div className="mt-1 text-[12px] br-text-tertiary">{STRINGS.account.rewardsLoginSubtitle}</div>
        </div>
        <button
          type="button"
          onClick={onOpenSignIn}
          className="br-press rounded-full border border-amber-300/50 bg-amber-500/18 px-5 py-2 text-[13px] font-semibold text-amber-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300/60"
        >
          {STRINGS.account.signInAction}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">

      {/* ── Points balance ── */}
      <div className="rounded-[14px] border border-emerald-200/25 bg-emerald-500/10 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100/90">
            {STRINGS.account.pointsBalanceTitle}
          </div>
          <div className="text-[11px] text-emerald-100/60">
            {rewardsLoading ? STRINGS.account.rewardsLoading : STRINGS.account.rewardsReady}
          </div>
        </div>
        <div className="mt-1.5 flex items-end gap-2">
          <span className="text-[40px] font-bold leading-none text-emerald-50">
            {rewards ? rewards.balance : "--"}
          </span>
          <span className="mb-1 text-[16px] font-semibold text-emerald-200/70">pt</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-100/75">
          {rewards
            ? STRINGS.account.reportPointsHint(rewards.reportPoints)
            : STRINGS.account.rewardsUnavailable}
        </div>
        {progressNeeded !== null && progressNeeded > 0 ? (
          <div className="mt-1.5 text-[11px] text-emerald-200/60">
            {STRINGS.account.storeProgressHint(progressNeeded)}
          </div>
        ) : null}
      </div>

      {/* ── Badge store ── */}
      <div className="rounded-[14px] border border-white/12 bg-black/30 px-4 py-3.5">
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
          <div className="mt-3 grid grid-cols-2 gap-2.5">
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
                      : "border-white/10 bg-black/35",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-1">
                    <BadgeIcon
                      icon={badge.icon}
                      size={28}
                      className={
                        badge.owned
                          ? isActive ? "text-amber-200" : "text-emerald-200"
                          : "text-slate-500"
                      }
                    />
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
                          className="br-press w-full rounded-full border border-white/20 bg-white/8 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-amber-300/40 hover:text-amber-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
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
                        {isRedeeming ? STRINGS.account.badgeRedeemingAction : STRINGS.account.badgeRedeemAction}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : rewards ? (
          <div className="mt-3 text-[12px] br-text-tertiary">{STRINGS.account.badgeStoreEmpty}</div>
        ) : null}
      </div>

      {/* ── Coupon section ── */}
      <div className="rounded-[14px] border border-dashed border-white/15 bg-black/20 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
            <path d="M21 5H3a1 1 0 0 0-1 1v4a2 2 0 0 1 0 4v4a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-4a2 2 0 0 1 0-4V6a1 1 0 0 0-1-1Z" />
            <line x1="9" y1="5" x2="9" y2="19" strokeDasharray="2 2" />
          </svg>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {STRINGS.account.couponStoreTitle}
          </div>
          <span className="rounded-full border border-slate-600/50 bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
            Prossimamente
          </span>
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {STRINGS.account.couponComingSoon}
        </div>
      </div>

    </div>
  );
};

export default RewardsSheet;
