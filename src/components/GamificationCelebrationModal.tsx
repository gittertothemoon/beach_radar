import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/strings";
import type { GamificationCelebrationEvent } from "../lib/rewards";
import BadgeIcon from "./BadgeIcon";

const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_report:  "wave",
  reporter_5:    "beach",
  reporter_10:   "eye",
  reporter_25:   "shield",
  reporter_50:   "sun",
};

type Props = {
  event: GamificationCelebrationEvent;
  onClose: () => void;
};

type ConfettiPiece = {
  x: number;
  delay: number;
  color: string;
  size: number;
  duration: number;
  drift: number;
  circle: boolean;
};

const MISSION_CONFETTI: ConfettiPiece[] = [
  { x:  6, delay: 0,    color: "#38bdf8", size: 7, duration: 1.2, drift: -12, circle: false },
  { x: 14, delay: 0.28, color: "#67e8f9", size: 5, duration: 1.5, drift:  8,  circle: true  },
  { x: 22, delay: 0.1,  color: "#34d399", size: 6, duration: 1.1, drift: -6,  circle: false },
  { x: 10, delay: 0.45, color: "#38bdf8", size: 4, duration: 1.4, drift: 14,  circle: true  },
  { x: 32, delay: 0.18, color: "#6ee7b7", size: 8, duration: 1.0, drift: -10, circle: false },
  { x: 40, delay: 0,    color: "#38bdf8", size: 5, duration: 1.3, drift:  6,  circle: true  },
  { x: 28, delay: 0.38, color: "#34d399", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 48, delay: 0.12, color: "#67e8f9", size: 7, duration: 1.1, drift: 10,  circle: true  },
  { x: 55, delay: 0.32, color: "#38bdf8", size: 5, duration: 1.4, drift: -14, circle: false },
  { x: 62, delay: 0.06, color: "#6ee7b7", size: 8, duration: 1.0, drift:  8,  circle: true  },
  { x: 70, delay: 0.22, color: "#34d399", size: 5, duration: 1.3, drift: -6,  circle: false },
  { x: 58, delay: 0.42, color: "#38bdf8", size: 6, duration: 1.2, drift: 12,  circle: true  },
  { x: 78, delay: 0.08, color: "#67e8f9", size: 7, duration: 1.1, drift: -10, circle: false },
  { x: 85, delay: 0.26, color: "#6ee7b7", size: 5, duration: 1.5, drift:  6,  circle: true  },
  { x: 75, delay: 0.4,  color: "#38bdf8", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 92, delay: 0.14, color: "#34d399", size: 4, duration: 1.3, drift: 14,  circle: true  },
  { x: 44, delay: 0.5,  color: "#38bdf8", size: 5, duration: 1.4, drift: -12, circle: false },
  { x: 18, delay: 0.36, color: "#6ee7b7", size: 6, duration: 1.1, drift:  8,  circle: true  },
];

const ACHIEVEMENT_CONFETTI: ConfettiPiece[] = [
  { x:  6, delay: 0,    color: "#c4b5fd", size: 7, duration: 1.2, drift: -12, circle: false },
  { x: 14, delay: 0.28, color: "#818cf8", size: 5, duration: 1.5, drift:  8,  circle: true  },
  { x: 22, delay: 0.1,  color: "#e879f9", size: 6, duration: 1.1, drift: -6,  circle: false },
  { x: 10, delay: 0.45, color: "#a78bfa", size: 4, duration: 1.4, drift: 14,  circle: true  },
  { x: 32, delay: 0.18, color: "#c4b5fd", size: 8, duration: 1.0, drift: -10, circle: false },
  { x: 40, delay: 0,    color: "#a78bfa", size: 5, duration: 1.3, drift:  6,  circle: true  },
  { x: 28, delay: 0.38, color: "#818cf8", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 48, delay: 0.12, color: "#e879f9", size: 7, duration: 1.1, drift: 10,  circle: true  },
  { x: 55, delay: 0.32, color: "#c4b5fd", size: 5, duration: 1.4, drift: -14, circle: false },
  { x: 62, delay: 0.06, color: "#818cf8", size: 8, duration: 1.0, drift:  8,  circle: true  },
  { x: 70, delay: 0.22, color: "#a78bfa", size: 5, duration: 1.3, drift: -6,  circle: false },
  { x: 58, delay: 0.42, color: "#c4b5fd", size: 6, duration: 1.2, drift: 12,  circle: true  },
  { x: 78, delay: 0.08, color: "#e879f9", size: 7, duration: 1.1, drift: -10, circle: false },
  { x: 85, delay: 0.26, color: "#818cf8", size: 5, duration: 1.5, drift:  6,  circle: true  },
  { x: 75, delay: 0.4,  color: "#c4b5fd", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 92, delay: 0.14, color: "#a78bfa", size: 4, duration: 1.3, drift: 14,  circle: true  },
  { x: 44, delay: 0.5,  color: "#e879f9", size: 5, duration: 1.4, drift: -12, circle: false },
  { x: 18, delay: 0.36, color: "#818cf8", size: 6, duration: 1.1, drift:  8,  circle: true  },
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
  const isDaily = isMission && event.missionType === "daily";
  const confetti = isMission ? MISSION_CONFETTI : ACHIEVEMENT_CONFETTI;

  const ringColor = isMission ? "rgba(56,189,248,0.35)" : "rgba(167,139,250,0.35)";
  const glowAnim = isMission
    ? "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both, br-badge-glow-sky 2.2s 800ms ease-in-out infinite"
    : "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-5"
      style={{ animation: "br-celebration-fade-in 240ms ease both" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        {confetti.map((p, i) => (
          <div
            key={i}
            className="absolute top-0"
            style={{
              left: `${p.x}%`,
              width: p.size,
              height: p.circle ? p.size : p.size * 1.7,
              background: p.color,
              borderRadius: p.circle ? "50%" : 2,
              opacity: 0,
              "--drift": `${p.drift}px`,
              animation: `br-confetti-fall ${p.duration}s ${p.delay}s ease-in 1 forwards`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Card */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 w-full max-w-[340px] overflow-hidden rounded-[26px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)]",
          isMission
            ? "border border-sky-300/25 bg-[rgba(4,9,20,0.98)]"
            : "border border-violet-300/25 bg-[rgba(6,4,20,0.98)]",
        ].join(" ")}
        style={{ animation: "br-celebration-slide-up 380ms 60ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: isMission
              ? "linear-gradient(90deg, transparent, rgba(56,189,248,0.7) 40%, rgba(103,232,249,0.7) 60%, transparent)"
              : "linear-gradient(90deg, transparent, rgba(167,139,250,0.7) 40%, rgba(232,121,249,0.7) 60%, transparent)",
          }}
        />

        {/* Glow background */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px]"
          style={{
            background: isMission
              ? "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.18) 0%, transparent 60%)"
              : "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.18) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex flex-col items-center px-6 pb-7 pt-9">
          {/* Icon with pulsing ring */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulsing ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 136,
                height: 136,
                border: `2px solid ${ringColor}`,
                animation: "br-ring-pulse 2s 700ms ease-out infinite",
              }}
            />
            {/* Second ring, offset */}
            <div
              className="absolute rounded-full"
              style={{
                width: 136,
                height: 136,
                border: `2px solid ${ringColor}`,
                animation: "br-ring-pulse 2s 1300ms ease-out infinite",
              }}
            />
            {/* Icon */}
            {isMission ? (
              <div
                className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-sky-300/50 bg-sky-500/15"
                style={{ animation: glowAnim }}
              >
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-100">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="relative" style={{ animation: "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
                {/* Glow layer — blurred div, no box-shadow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
                  style={{
                    background: "rgba(167,139,250,0.55)",
                    animation: "br-glow-layer 2.2s 800ms ease-in-out infinite",
                  }}
                />
                <div className="relative text-violet-100">
                  <BadgeIcon icon={ACHIEVEMENT_ICONS[event.id] ?? "wave"} size={96} />
                </div>
              </div>
            )}
          </div>

          {/* Eyebrow */}
          <div
            className={[
              "mt-5 text-[11px] font-bold uppercase tracking-[0.14em]",
              isMission ? "text-sky-300/90" : "text-violet-300/90",
            ].join(" ")}
            style={{ animation: "br-celebration-slide-up 280ms 350ms ease both" }}
          >
            {isMission ? STRINGS.account.missionCompletedTitle : STRINGS.account.achievementUnlockedTitle}
          </div>

          {/* Title */}
          <div
            className={[
              "mt-1.5 text-center text-[23px] font-bold leading-tight",
              isMission ? "text-sky-50" : "text-violet-50",
            ].join(" ")}
            style={{ animation: "br-celebration-slide-up 280ms 420ms ease both" }}
          >
            {isMission
              ? (isDaily ? STRINGS.account.missionDailyCompletedName : STRINGS.account.missionCompletedName)
              : event.name}
          </div>

          {/* Description */}
          <div
            className="mt-2 text-center text-[13px] leading-relaxed text-slate-300/75"
            style={{ animation: "br-celebration-slide-up 280ms 490ms ease both" }}
          >
            {isMission
              ? (isDaily ? STRINGS.account.missionDailyRewardHint(event.pointsEarned) : STRINGS.account.missionRewardHint(event.pointsEarned))
              : event.description}
          </div>

          {/* Pill */}
          {isMission ? (
            <div
              className="mt-4 flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-500/12 px-4 py-1.5 text-[13px] font-bold text-sky-200"
              style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
            >
              +{event.pointsEarned} pt
            </div>
          ) : (
            <div
              className="mt-4 flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/12 px-4 py-1.5 text-[11px] font-semibold text-violet-200/80"
              style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
            >
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 0l1.1 3.6H10L6.9 5.8l1.1 3.6L5 7.3l-3 2.1 1.1-3.6L0 3.6h3.9z"/>
              </svg>
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
                ? "border border-sky-300/35 bg-sky-500/18 text-sky-50 focus-visible:outline-sky-300/70"
                : "border border-violet-300/35 bg-violet-500/18 text-violet-50 focus-visible:outline-violet-300/70",
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
