import beachPng from "../assets/badges/beach.png";
import eyePng from "../assets/badges/eye.png";
import lighthousePng from "../assets/badges/lighthouse.png";
import shieldPng from "../assets/badges/shield.png";
import sunPng from "../assets/badges/sun.png";
import wavePng from "../assets/badges/wave.png";

type BadgeIconProps = {
  icon: string;
  size?: number;
  className?: string;
  forceVector?: boolean;
};

const rasterIcons: Record<string, string> = {
  eye: eyePng,
  shield: shieldPng,
  wave: wavePng,
  beach: beachPng,
  lighthouse: lighthousePng,
  sun: sunPng,
};

const vectorIcons: Record<string, (size: number) => React.ReactElement> = {
  eye: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="10" ry="6.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="var(--bg, #07090d)" stroke="none" />
    </svg>
  ),
  shield: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5L4 6v5c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V6L12 2.5z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  wave: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
      <path d="M2 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
    </svg>
  ),
  beach: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18c4-6 14-6 18 0" />
      <line x1="12" y1="18" x2="12" y2="10" />
      <path d="M7 13c2-4 10-4 12 0" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="8" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  lighthouse: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <path d="M7 20h10" />
      <path d="M10 4V2h4v2" />
      <line x1="9.5" y1="10" x2="14.5" y2="10" />
      <path d="M14.5 7l3-2M9.5 7l-3-2" />
    </svg>
  ),
  sun: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  ),
};

const fallback = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  </svg>
);

const BadgeIcon = ({ icon, size = 24, className, forceVector }: BadgeIconProps) => {
  const rasterSrc = rasterIcons[icon];
  const useRaster = Boolean(rasterSrc) && !forceVector;
  const isMuted = className?.includes("slate-500") || className?.includes("text-slate");
  const filter = isMuted ? "grayscale(1) saturate(0.18) brightness(0.95)" : undefined;
  const mixBlendMode = !isMuted && useRaster ? ("screen" as const) : undefined;
  const opacity = isMuted ? 0.72 : 1;
  const render = vectorIcons[icon] ?? fallback;
  return (
    <span className={className} aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0 }}>
      {useRaster ? (
        <img
          src={rasterSrc}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{
            width: size,
            height: size,
            objectFit: "contain",
            filter,
            opacity,
            mixBlendMode,
          }}
        />
      ) : (
        render(size)
      )}
    </span>
  );
};

export default BadgeIcon;
