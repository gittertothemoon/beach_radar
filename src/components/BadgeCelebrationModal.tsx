import { useEffect, useRef } from "react";
import { STRINGS } from "../i18n/it";

type BadgeCelebrationModalProps = {
  isOpen: boolean;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
  onClose: () => void;
};

const CONFETTI_PIECES = [
  { x: 20, delay: 0, color: "#fbbf24", size: 7, duration: 1.1 },
  { x: 45, delay: 0.15, color: "#34d399", size: 5, duration: 1.3 },
  { x: 70, delay: 0.05, color: "#60a5fa", size: 8, duration: 1.0 },
  { x: 30, delay: 0.25, color: "#f472b6", size: 5, duration: 1.2 },
  { x: 60, delay: 0.1, color: "#fbbf24", size: 6, duration: 1.4 },
  { x: 80, delay: 0.2, color: "#a78bfa", size: 7, duration: 1.1 },
  { x: 15, delay: 0.3, color: "#34d399", size: 5, duration: 1.3 },
  { x: 90, delay: 0.08, color: "#f472b6", size: 6, duration: 1.2 },
];

const BADGE_ICONS: Record<string, string> = {
  eye: "👁️",
  shield: "🛡️",
  wave: "🌊",
  beach: "🏖️",
  lighthouse: "⛯",
  sun: "☀️",
};

function badgeEmoji(icon: string): string {
  return BADGE_ICONS[icon] ?? "🏅";
}

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
      <div
        className="absolute inset-0 bg-black/82 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden h-48">
        {CONFETTI_PIECES.map((p, i) => (
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
        aria-label={STRINGS.account.badgeCelebrationTitle}
        className="relative z-10 w-full max-w-[340px] overflow-hidden rounded-[24px] border border-amber-300/30 bg-[rgba(12,10,6,0.97)] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.9)]"
        style={{ animation: "br-celebration-slide-up 320ms 80ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Glow background */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.15) 0%, transparent 65%)",
          }}
        />

        <div className="relative flex flex-col items-center px-6 pb-7 pt-8">
          {/* Badge icon */}
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-300/50 bg-amber-500/15 text-[52px]"
            style={{
              animation: "br-badge-pop 600ms 160ms cubic-bezier(0.34,1.56,0.64,1) both, br-badge-glow 2s 800ms ease-in-out infinite",
            }}
          >
            {badgeEmoji(badgeIcon)}
          </div>

          {/* "Badge sbloccato!" label */}
          <div
            className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300/90"
            style={{ animation: "br-celebration-slide-up 280ms 350ms ease both" }}
          >
            {STRINGS.account.badgeCelebrationTitle}
          </div>

          {/* Badge name */}
          <div
            className="mt-1.5 text-center text-[22px] font-bold leading-tight text-amber-50"
            style={{ animation: "br-celebration-slide-up 280ms 420ms ease both" }}
          >
            {badgeName}
          </div>

          {/* Description */}
          <div
            className="mt-2 text-center text-[13px] leading-relaxed text-slate-300/80"
            style={{ animation: "br-celebration-slide-up 280ms 490ms ease both" }}
          >
            {badgeDescription}
          </div>

          {/* "Badge equipaggiato" hint */}
          <div
            className="mt-4 flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-amber-200/80"
            style={{ animation: "br-celebration-slide-up 280ms 560ms ease both" }}
          >
            <span aria-hidden="true">✨</span>
            {STRINGS.account.badgeCelebrationEquippedHint}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="br-press mt-6 w-full rounded-[14px] border border-amber-300/40 bg-amber-500/20 px-4 py-3 text-[14px] font-bold text-amber-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300/70 focus-visible:outline-offset-1"
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
