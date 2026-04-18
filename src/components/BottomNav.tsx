import { memo, useEffect, useRef } from "react";
import { STRINGS } from "../i18n/strings";
import { useLanguageRefresh } from "../i18n/useLanguageRefresh";

type BottomSheetSection = "map" | "profile" | "chatbot" | "rewards";

type BottomNavProps = {
  activeSection: BottomSheetSection;
  accountEmail: string | null;
  onChange: (section: BottomSheetSection) => void;
  onHeightChange?: (height: number) => void;
  rewardsBadgeDot?: boolean;
};

const navItemClass = (active: boolean) =>
  `br-press relative flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-180 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
    active
      ? "border border-white/38 bg-[linear-gradient(180deg,rgba(186,230,253,0.28),rgba(125,211,252,0.16))] text-slate-50 shadow-[0_8px_18px_rgba(2,6,23,0.24)]"
      : "border border-transparent text-slate-100/82 hover:border-white/20 hover:bg-white/8"
  }`;

const navIconClass = (active: boolean) =>
  `h-[19px] w-[19px] shrink-0 transition-all duration-180 ${
    active ? "opacity-100 scale-100" : "opacity-80 scale-[0.95]"
  }`;

const MapIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={navIconClass(active)}
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? 2.1 : 1.95}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20.4s4.9-4.2 4.9-8.3a4.9 4.9 0 1 0-9.8 0c0 4.1 4.9 8.3 4.9 8.3Z" />
    <circle cx="12" cy="12" r="1.65" fill="currentColor" stroke="none" className={active ? "opacity-90" : "opacity-65"} />
  </svg>
);

const ChatbotIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={navIconClass(active)}
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? 2.05 : 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7.2 6.2h9.6A2.2 2.2 0 0 1 19 8.4v6A2.2 2.2 0 0 1 16.8 16.6h-4.1L9 19v-2.4H7.2A2.2 2.2 0 0 1 5 14.4v-6a2.2 2.2 0 0 1 2.2-2.2Z" />
    <circle cx="9.9" cy="11.4" r="0.95" fill="currentColor" stroke="none" className={active ? "opacity-90" : "opacity-65"} />
    <circle cx="14.1" cy="11.4" r="0.95" fill="currentColor" stroke="none" className={active ? "opacity-90" : "opacity-65"} />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={navIconClass(active)}
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? 2.05 : 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8.2" r="2.9" />
    <path d="M6.5 18.3c1.2-2.5 3-3.8 5.5-3.8 2.5 0 4.3 1.3 5.5 3.8" />
  </svg>
);

const RewardsIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={navIconClass(active)}
    fill={active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={active ? 0 : 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const BottomNavComponent = ({
  activeSection,
  accountEmail,
  onChange,
  onHeightChange,
  rewardsBadgeDot,
}: BottomNavProps) => {
  useLanguageRefresh();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onHeightChange || !containerRef.current) return;
    const measure = () => {
      if (!containerRef.current) return;
      onHeightChange(Math.ceil(containerRef.current.getBoundingClientRect().height));
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(containerRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [onHeightChange]);

  return (
    <div ref={containerRef}>
      <nav
        aria-label={STRINGS.nav.ariaLabel}
        className="px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-1"
      >
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            data-testid="bottom-nav-map"
            onClick={() => onChange("map")}
            className={navItemClass(activeSection === "map")}
          >
            <MapIcon active={activeSection === "map"} />
            <span>{STRINGS.nav.map}</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-chatbot"
            onClick={() => onChange("chatbot")}
            className={navItemClass(activeSection === "chatbot")}
          >
            <ChatbotIcon active={activeSection === "chatbot"} />
            <span>{STRINGS.chatbot.title}</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-rewards"
            onClick={() => onChange("rewards")}
            className={navItemClass(activeSection === "rewards")}
          >
            <div className="relative shrink-0">
              <RewardsIcon active={activeSection === "rewards"} />
              {rewardsBadgeDot && activeSection !== "rewards" ? (
                <span
                  className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_1.5px_rgba(251,191,36,0.28),0_0_6px_rgba(251,191,36,0.4)]"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <span>{STRINGS.nav.rewards}</span>
          </button>
          <button
            type="button"
            data-testid="bottom-nav-profile"
            onClick={() => onChange("profile")}
            className={navItemClass(activeSection === "profile")}
          >
            <ProfileIcon active={activeSection === "profile"} />
            <span className="inline-flex items-center gap-1.5">
              <span>{STRINGS.nav.profile}</span>
              {accountEmail ? (
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_0_7px_rgba(16,185,129,0.32)]"
                  aria-hidden="true"
                />
              ) : null}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};

const bottomNavEqual = (prev: BottomNavProps, next: BottomNavProps) =>
  prev.activeSection === next.activeSection &&
  prev.accountEmail === next.accountEmail &&
  prev.onChange === next.onChange &&
  prev.onHeightChange === next.onHeightChange &&
  prev.rewardsBadgeDot === next.rewardsBadgeDot;

const BottomNav = memo(BottomNavComponent, bottomNavEqual);

export default BottomNav;
