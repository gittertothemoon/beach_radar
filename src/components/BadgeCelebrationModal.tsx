import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/strings";
import BadgeIcon from "./BadgeIcon";

type BadgeCelebrationModalProps = {
  isOpen: boolean;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
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

const CONFETTI_PIECES: ConfettiPiece[] = [
  { x:  6, delay: 0,    color: "#fbbf24", size: 7, duration: 1.2, drift: -12, circle: false },
  { x: 14, delay: 0.28, color: "#34d399", size: 5, duration: 1.5, drift:  8,  circle: true  },
  { x: 22, delay: 0.1,  color: "#60a5fa", size: 6, duration: 1.1, drift: -6,  circle: false },
  { x: 10, delay: 0.45, color: "#f472b6", size: 4, duration: 1.4, drift: 14,  circle: true  },
  { x: 32, delay: 0.18, color: "#fbbf24", size: 8, duration: 1.0, drift: -10, circle: false },
  { x: 40, delay: 0,    color: "#a78bfa", size: 5, duration: 1.3, drift:  6,  circle: true  },
  { x: 28, delay: 0.38, color: "#34d399", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 48, delay: 0.12, color: "#fbbf24", size: 7, duration: 1.1, drift: 10,  circle: true  },
  { x: 55, delay: 0.32, color: "#60a5fa", size: 5, duration: 1.4, drift: -14, circle: false },
  { x: 62, delay: 0.06, color: "#f472b6", size: 8, duration: 1.0, drift:  8,  circle: true  },
  { x: 70, delay: 0.22, color: "#fbbf24", size: 5, duration: 1.3, drift: -6,  circle: false },
  { x: 58, delay: 0.42, color: "#a78bfa", size: 6, duration: 1.2, drift: 12,  circle: true  },
  { x: 78, delay: 0.08, color: "#34d399", size: 7, duration: 1.1, drift: -10, circle: false },
  { x: 85, delay: 0.26, color: "#fbbf24", size: 5, duration: 1.5, drift:  6,  circle: true  },
  { x: 75, delay: 0.4,  color: "#60a5fa", size: 6, duration: 1.2, drift: -8,  circle: false },
  { x: 92, delay: 0.14, color: "#f472b6", size: 4, duration: 1.3, drift: 14,  circle: true  },
  { x: 44, delay: 0.5,  color: "#fbbf24", size: 5, duration: 1.4, drift: -12, circle: false },
  { x: 18, delay: 0.36, color: "#a78bfa", size: 6, duration: 1.1, drift:  8,  circle: true  },
];

const BadgeCelebrationModal = ({
  isOpen,
  badgeName,
  badgeDescription,
  badgeIcon,
  onClose,
}: BadgeCelebrationModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-5"
      style={{ animation: "br-celebration-fade-in 240ms ease both" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        {CONFETTI_PIECES.map((p, i) => (
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
        aria-label={STRINGS.account.badgeCelebrationTitle}
        className="relative z-10 w-full max-w-[340px] overflow-hidden rounded-[26px] border border-amber-300/25 bg-[rgba(14,10,4,0.98)] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)]"
        style={{ animation: "br-celebration-slide-up 380ms 60ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.7) 40%, rgba(252,211,77,0.7) 60%, transparent)",
          }}
        />

        {/* Glow background */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px]"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.18) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex flex-col items-center px-6 pb-7 pt-9">
          {/* Icon with pulsing ring */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute rounded-full"
              style={{
                width: 116,
                height: 116,
                border: "2px solid rgba(251,191,36,0.35)",
                animation: "br-ring-pulse 2s 700ms ease-out infinite",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 116,
                height: 116,
                border: "2px solid rgba(251,191,36,0.35)",
                animation: "br-ring-pulse 2s 1300ms ease-out infinite",
              }}
            />
            <div
              className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-amber-300/50 bg-amber-500/15 text-amber-100"
              style={{
                animation: "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both, br-badge-glow 2.2s 800ms ease-in-out infinite",
              }}
            >
              <BadgeIcon icon={badgeIcon} size={48} />
            </div>
          </div>

          {/* Eyebrow */}
          <div
            className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/90"
            style={{ animation: "br-celebration-slide-up 280ms 350ms ease both" }}
          >
            {STRINGS.account.badgeCelebrationTitle}
          </div>

          {/* Badge name */}
          <div
            className="mt-1.5 text-center text-[23px] font-bold leading-tight text-amber-50"
            style={{ animation: "br-celebration-slide-up 280ms 420ms ease both" }}
          >
            {badgeName}
          </div>

          {/* Description */}
          <div
            className="mt-2 text-center text-[13px] leading-relaxed text-slate-300/75"
            style={{ animation: "br-celebration-slide-up 280ms 490ms ease both" }}
          >
            {badgeDescription}
          </div>

          {/* Pill */}
          <div
            className="mt-4 flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-500/12 px-4 py-1.5 text-[11px] font-semibold text-amber-200/80"
            style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
          >
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M5 0l1.1 3.6H10L6.9 5.8l1.1 3.6L5 7.3l-3 2.1 1.1-3.6L0 3.6h3.9z"/>
            </svg>
            {STRINGS.account.badgeCelebrationEquippedHint}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="br-press mt-6 w-full rounded-[14px] border border-amber-300/35 bg-amber-500/18 px-4 py-3 text-[14px] font-bold text-amber-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300/70 focus-visible:outline-offset-1"
            style={{ animation: "br-celebration-slide-up 280ms 620ms ease both" }}
          >
            {STRINGS.account.badgeCelebrationClose}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BadgeCelebrationModal;
