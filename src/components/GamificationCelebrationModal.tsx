import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/strings";
import type { GamificationCelebrationEvent } from "../lib/rewards";

type Props = {
  event: GamificationCelebrationEvent;
  onClose: () => void;
};

const MISSION_CONFETTI = [
  { x: 20, delay: 0,    color: "#38bdf8", size: 7, duration: 1.1 },
  { x: 45, delay: 0.15, color: "#34d399", size: 5, duration: 1.3 },
  { x: 70, delay: 0.05, color: "#60a5fa", size: 8, duration: 1.0 },
  { x: 30, delay: 0.25, color: "#6ee7b7", size: 5, duration: 1.2 },
  { x: 60, delay: 0.1,  color: "#38bdf8", size: 6, duration: 1.4 },
  { x: 80, delay: 0.2,  color: "#67e8f9", size: 7, duration: 1.1 },
  { x: 15, delay: 0.3,  color: "#34d399", size: 5, duration: 1.3 },
  { x: 90, delay: 0.08, color: "#6ee7b7", size: 6, duration: 1.2 },
];

const ACHIEVEMENT_CONFETTI = [
  { x: 20, delay: 0,    color: "#c4b5fd", size: 7, duration: 1.1 },
  { x: 45, delay: 0.15, color: "#a78bfa", size: 5, duration: 1.3 },
  { x: 70, delay: 0.05, color: "#818cf8", size: 8, duration: 1.0 },
  { x: 30, delay: 0.25, color: "#c4b5fd", size: 5, duration: 1.2 },
  { x: 60, delay: 0.1,  color: "#a78bfa", size: 6, duration: 1.4 },
  { x: 80, delay: 0.2,  color: "#e879f9", size: 7, duration: 1.1 },
  { x: 15, delay: 0.3,  color: "#818cf8", size: 5, duration: 1.3 },
  { x: 90, delay: 0.08, color: "#c4b5fd", size: 6, duration: 1.2 },
];

const GamificationCelebrationModal = ({ event, onClose }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isMission = event.type === "mission";
  const confetti = isMission ? MISSION_CONFETTI : ACHIEVEMENT_CONFETTI;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-5"
      style={{ animation: "br-celebration-fade-in 240ms ease both" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/82 backdrop-blur-sm" onClick={onClose} />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden">
        {confetti.map((p, i) => (
          <div
            key={i}
            className="absolute top-0 rounded-sm"
            style={{
              left: `${p.x}%`,
              width: p.size,
              height: p.size * 1.6,
              background: p.color,
              opacity: 0,
              animation: `br-confetti-fall ${p.duration}s ${p.delay}s ease-in 1 forwards`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 w-full max-w-[340px] overflow-hidden rounded-[24px] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.9)]",
          isMission
            ? "border border-sky-300/30 bg-[rgba(6,10,18,0.97)]"
            : "border border-violet-300/30 bg-[rgba(8,6,18,0.97)]",
        ].join(" ")}
        style={{ animation: "br-celebration-slide-up 320ms 80ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          style={{
            background: isMission
              ? "radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.15) 0%, transparent 65%)"
              : "radial-gradient(ellipse at 50% 30%, rgba(167,139,250,0.15) 0%, transparent 65%)",
          }}
        />

        <div className="relative flex flex-col items-center px-6 pb-7 pt-8">
          {/* Icon */}
          {isMission ? (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-sky-300/50 bg-sky-500/15"
              style={{ animation: "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both, br-badge-glow 2s 800ms ease-in-out infinite" }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-100">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-violet-300/50 bg-violet-500/15"
              style={{ animation: "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both, br-badge-glow 2s 800ms ease-in-out infinite" }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-100">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </div>
          )}

          {/* Eyebrow label */}
          <div
            className={[
              "mt-5 text-[11px] font-bold uppercase tracking-[0.12em]",
              isMission ? "text-sky-300/90" : "text-violet-300/90",
            ].join(" ")}
            style={{ animation: "br-celebration-slide-up 280ms 350ms ease both" }}
          >
            {isMission ? STRINGS.account.missionCompletedTitle : STRINGS.account.achievementUnlockedTitle}
          </div>

          {/* Main text */}
          <div
            className={[
              "mt-1.5 text-center text-[22px] font-bold leading-tight",
              isMission ? "text-sky-50" : "text-violet-50",
            ].join(" ")}
            style={{ animation: "br-celebration-slide-up 280ms 420ms ease both" }}
          >
            {isMission
              ? STRINGS.account.missionCompletedName
              : event.name}
          </div>

          {/* Sub-text */}
          <div
            className="mt-2 text-center text-[13px] leading-relaxed text-slate-300/80"
            style={{ animation: "br-celebration-slide-up 280ms 490ms ease both" }}
          >
            {isMission ? STRINGS.account.missionRewardHint(event.pointsEarned) : event.description}
          </div>

          {/* Points pill (mission only) */}
          {isMission ? (
            <div
              className="mt-4 flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-500/10 px-3.5 py-1.5 text-[13px] font-bold text-sky-200"
              style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
            >
              +{event.pointsEarned} pt
            </div>
          ) : (
            <div
              className="mt-4 flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-violet-200/80"
              style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
            >
              <span aria-hidden="true">✦</span>
              {STRINGS.account.achievementUnlockedHint}
            </div>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className={[
              "br-press mt-6 w-full rounded-[14px] px-4 py-3 text-[14px] font-bold focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1",
              isMission
                ? "border border-sky-300/40 bg-sky-500/20 text-sky-50 focus-visible:outline-sky-300/70"
                : "border border-violet-300/40 bg-violet-500/20 text-violet-50 focus-visible:outline-violet-300/70",
            ].join(" ")}
            style={{ animation: "br-celebration-slide-up 280ms 620ms ease both" }}
          >
            {STRINGS.account.badgeCelebrationClose}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamificationCelebrationModal;
