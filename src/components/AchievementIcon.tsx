import firstReportPng from "../assets/achievements/first_report.png";
import reporter10Png from "../assets/achievements/reporter_10.png";
import reporter25Png from "../assets/achievements/reporter_25.png";
import reporter50Png from "../assets/achievements/reporter_50.png";
import reporter5Png from "../assets/achievements/reporter_5.png";

type AchievementIconProps = {
  id: string;
  unlocked: boolean;
  size?: number;
  className?: string;
};

const icons: Record<string, string> = {
  first_report: firstReportPng,
  reporter_5: reporter5Png,
  reporter_10: reporter10Png,
  reporter_25: reporter25Png,
  reporter_50: reporter50Png,
};

const fallback = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2.4 15.2 9 22 9.9 17 14.7 18.2 21.6 12 18.3 5.8 21.6 7 14.7 2 9.9 8.8 9" />
  </svg>
);

const AchievementIcon = ({ id, unlocked, size = 32, className }: AchievementIconProps) => {
  const src = icons[id];
  const filter = unlocked ? undefined : "grayscale(1) saturate(0.1) brightness(0.9)";
  const opacity = unlocked ? 1 : 0.72;
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {src ? (
        <img
          src={src}
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
          }}
        />
      ) : (
        fallback(size)
      )}
    </span>
  );
};

export default AchievementIcon;
