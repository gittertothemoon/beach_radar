import React from "react";
import {loadFont as loadInter} from "@remotion/google-fonts/Inter";
import {loadFont as loadSpaceGrotesk} from "@remotion/google-fonts/SpaceGrotesk";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const {fontFamily: headingFont} = loadSpaceGrotesk("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const {fontFamily: bodyFont} = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const FPS = 30;
export const BEACH_RADAR_FINAL_FRAMES = 360;

const INTRO_FROM = 0;
const INTRO_DURATION = 132;

const VALUE_FROM = 108;
const VALUE_DURATION = 168;

const CTA_FROM = 240;
const CTA_DURATION = 120;

const COLORS = {
  bg: "#020617",
  white: "#F8FAFC",
  muted: "#A7B7CF",
  cyan: "#06B6D4",
  live: "#22C55E",
  recent: "#F59E0B",
  pred: "#64748B",
  panel: "rgba(3, 10, 28, 0.78)",
};

const SAFE = {
  left: 66,
  right: 66,
  top: 98,
  bottom: 106,
};

const safeArea: React.CSSProperties = {
  position: "absolute",
  left: SAFE.left,
  right: SAFE.right,
  top: SAFE.top,
  bottom: SAFE.bottom,
};

const fillCover: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const BrandLockup: React.FC<{frame: number; width?: number; pulse?: boolean}> = ({
  frame,
  width = 512,
  pulse = true,
}) => {
  const logoSize = Math.round(width * 0.86);
  const pulseScale = interpolate(frame % 36, [0, 35], [0.9, 1.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulseOpacity = interpolate(frame % 36, [0, 35], [0.28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
      }}
    >
      <div
        style={{
          position: "relative",
          width: logoSize,
          height: logoSize,
        }}
      >
        {pulse ? (
          <div
            style={{
              position: "absolute",
              inset: -18,
              borderRadius: "50%",
              border: `2px solid rgba(6,182,212,${pulseOpacity})`,
              transform: `scale(${pulseScale})`,
            }}
          />
        ) : null}
        <Img
          src={staticFile("video-kit/logo.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 0 26px rgba(6,182,212,0.48))",
          }}
        />
      </div>
    </div>
  );
};

const StatusChip: React.FC<{
  label: string;
  color: string;
  small?: boolean;
}> = ({label, color, small = false}) => (
  <div
    style={{
      borderRadius: 999,
      border: `1px solid ${color}`,
      backgroundColor: "rgba(2,6,23,0.7)",
      color,
      fontFamily: bodyFont,
      fontWeight: 700,
      fontSize: small ? 20 : 22,
      lineHeight: 1,
      padding: small ? "9px 14px" : "10px 16px",
    }}
  >
    {label}
  </div>
);

const CinematicBackground: React.FC<{frame: number}> = ({frame}) => {
  const travelA = interpolate(frame, [0, BEACH_RADAR_FINAL_FRAMES - 1], [0, 42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const travelB = interpolate(frame, [0, BEACH_RADAR_FINAL_FRAMES - 1], [20, -28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const noiseOffset = interpolate(frame, [0, BEACH_RADAR_FINAL_FRAMES - 1], [0, 190], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <div
        style={{
          position: "absolute",
          inset: -36,
          transform: `translateY(${travelA}px) scale(1.22)`,
          opacity: 0.9,
        }}
      >
        <OffthreadVideo
          src={staticFile("video-kit/stock/beach-panorama-1080.mp4")}
          muted
          style={fillCover}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: -44,
          transform: `translateY(${travelB}px) scale(1.2)`,
          opacity: 0.34,
          mixBlendMode: "screen",
        }}
      >
        <OffthreadVideo
          src={staticFile("video-kit/stock/beach-seashore-1080.mp4")}
          muted
          style={fillCover}
        />
      </div>

      <Img
        src={staticFile("video-kit/initial-bg.png")}
        style={{
          ...fillCover,
          opacity: 0.32,
          mixBlendMode: "screen",
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 760px 460px at 50% 11%, rgba(6,182,212,0.36), rgba(3,9,24,0.0) 62%)",
          opacity: 0.68,
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.12) 0%, rgba(2,6,23,0.42) 46%, rgba(2,6,23,0.8) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          opacity: 0.11,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(148,163,184,0.4) 0px, rgba(148,163,184,0.4) 1px, transparent 1px, transparent 3px)",
          backgroundPosition: `0 ${noiseOffset}px`,
          mixBlendMode: "soft-light",
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 54%, rgba(2,6,23,0) 28%, rgba(2,6,23,0.24) 72%, rgba(2,6,23,0.52) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const IntroScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 26,
    config: {damping: 170},
  });

  const sceneOpacity = interpolate(
    frame,
    [0, 12, duration - 22, duration - 1],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const rise = interpolate(inSpring, [0, 1], [34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <CinematicBackground frame={frame} />

      <div style={safeArea}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            transform: `translateY(${rise + 24}px)`,
            opacity: interpolate(inSpring, [0, 1], [0.4, 1]),
            gap: 26,
          }}
        >
          <BrandLockup frame={frame} width={556} />

          <div
            style={{
              fontFamily: headingFont,
              color: COLORS.white,
              fontWeight: 700,
              fontSize: 98,
              letterSpacing: -2.6,
              lineHeight: 0.92,
              textShadow: "0 10px 42px rgba(2,6,23,0.55)",
            }}
          >
            EVITA LA FOLLA.
            <br />
            SCEGLI MEGLIO.
          </div>

          <StatusChip label="Where2Beach LIVE" color={COLORS.cyan} />

          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 31,
              lineHeight: 1.08,
              color: COLORS.muted,
              fontWeight: 600,
              maxWidth: 900,
            }}
          >
            Radar live per trovare la spiaggia giusta, adesso.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ValueScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const sceneOpacity = interpolate(
    frame,
    [0, 12, duration - 20, duration - 1],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 24,
    config: {damping: 182},
  });

  const panelIn = spring({
    frame: frame - 8,
    fps,
    durationInFrames: 24,
    config: {damping: 192},
  });

  const panelDrift = interpolate(frame, [0, duration - 1], [20, -24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <CinematicBackground frame={frame + 70} />

      <div style={safeArea}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            transform: `translateY(${interpolate(inSpring, [0, 1], [24, 8])}px)`,
            opacity: inSpring,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: headingFont,
                color: COLORS.white,
                fontWeight: 700,
                fontSize: 86,
                lineHeight: 0.94,
                letterSpacing: -2,
                textShadow: "0 10px 42px rgba(2,6,23,0.55)",
              }}
            >
              LIVE, RECENT,
              <br />
              PRED.
            </div>

            <div
              style={{
                marginTop: 12,
                fontFamily: bodyFont,
                color: COLORS.muted,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.04,
              }}
            >
              Affollamento chiaro in tempo reale.
            </div>
          </div>

          <div
            style={{
              height: 950,
              borderRadius: 42,
              border: "1px solid rgba(148,163,184,0.28)",
              boxShadow: "0 22px 78px rgba(2,6,23,0.64)",
              backgroundColor: COLORS.panel,
              overflow: "hidden",
              position: "relative",
              transform: `translateY(${interpolate(panelIn, [0, 1], [22, 0])}px) scale(${interpolate(panelIn, [0, 1], [0.97, 1])})`,
              opacity: panelIn,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${panelDrift}px) scale(1.06)`,
              }}
            >
              <Img src={staticFile("video-kit/sharecard-bg.png")} style={fillCover} />
            </div>

            <AbsoluteFill style={{backgroundColor: "rgba(2,6,23,0.26)"}} />

            <div
              style={{
                position: "absolute",
                top: 24,
                left: 24,
                right: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                zIndex: 3,
              }}
            >
              <div style={{display: "flex", gap: 8}}>
                <StatusChip label="LIVE" color={COLORS.live} small />
                <StatusChip label="RECENT" color={COLORS.recent} small />
                <StatusChip label="PRED" color={COLORS.pred} small />
              </div>
              <StatusChip label="Comunita LIVE" color={COLORS.cyan} small />
            </div>

            <Img
              src={staticFile("video-kit/pin_beach.png")}
              style={{
                position: "absolute",
                left: 180,
                top: 340,
                width: 102,
                height: 102,
                objectFit: "contain",
                transform: `translateY(${interpolate(frame % 60, [0, 30, 59], [0, -8, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            />

            <Img
              src={staticFile("video-kit/pin_beach_affollata.png")}
              style={{
                position: "absolute",
                left: 444,
                top: 462,
                width: 102,
                height: 102,
                objectFit: "contain",
                transform: `translateY(${interpolate((frame + 18) % 60, [0, 30, 59], [0, -9, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            />

            <Img
              src={staticFile("video-kit/pin_beach_poco_affollata.png")}
              style={{
                position: "absolute",
                left: 690,
                top: 320,
                width: 102,
                height: 102,
                objectFit: "contain",
                transform: `translateY(${interpolate((frame + 36) % 60, [0, 30, 59], [0, -8, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            />

            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: 24,
                borderRadius: 24,
                border: "1px solid rgba(148,163,184,0.2)",
                backgroundColor: "rgba(2,6,23,0.72)",
                padding: "18px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 800,
                  fontSize: 34,
                  lineHeight: 1,
                  color: COLORS.white,
                }}
              >
                Dove c'e posto, adesso.
              </div>
              <div
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 800,
                  fontSize: 24,
                  lineHeight: 1,
                  color: COLORS.cyan,
                }}
              >
                Early Access
              </div>
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontFamily: bodyFont,
              color: COLORS.muted,
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.05,
            }}
          >
            Segnalazioni community in tempo reale.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 24,
    config: {damping: 175},
  });

  const ctaSpring = spring({
    frame: frame - 8,
    fps,
    durationInFrames: 22,
    config: {damping: 160},
  });

  const sceneOpacity = interpolate(frame, [0, 12, duration - 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const remaining = Math.round(
    interpolate(frame, [0, duration - 1], [162, 145], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <CinematicBackground frame={frame + 118} />

      <div style={safeArea}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
            transform: `translateY(${interpolate(inSpring, [0, 1], [24, 18])}px)`,
            opacity: inSpring,
          }}
        >
          <BrandLockup frame={frame} width={560} />

          <div
            style={{
              fontFamily: headingFont,
              color: COLORS.white,
              fontWeight: 700,
              fontSize: 86,
              letterSpacing: -2.2,
              lineHeight: 0.95,
            }}
          >
            Prima ondata limitata.
          </div>

          <div
            style={{
              fontFamily: bodyFont,
              color: COLORS.cyan,
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1,
            }}
          >
            ENTRA ORA IN WAITLIST
          </div>

          <div
            style={{
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.32)",
              backgroundColor: "rgba(2,6,23,0.74)",
              color: COLORS.muted,
              fontFamily: bodyFont,
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1,
              padding: "12px 24px",
            }}
          >
            Posti rimanenti {remaining}/1000
          </div>

          <div
            style={{
              borderRadius: 30,
              background:
                "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(239,245,255,1) 100%)",
              color: "#111827",
              fontFamily: headingFont,
              fontWeight: 700,
              fontSize: 48,
              letterSpacing: 0.2,
              lineHeight: 1,
              padding: "32px 64px",
              transform: `scale(${interpolate(ctaSpring, [0, 1], [0.88, 1])})`,
              boxShadow:
                "0 22px 65px rgba(248,250,252,0.24), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(17,24,39,0.08)",
            }}
          >
            OTTIENI ACCESSO ANTICIPATO
          </div>

          <div
            style={{
              fontFamily: bodyFont,
              color: COLORS.cyan,
              fontWeight: 800,
              fontSize: 32,
            }}
          >
            where2beach.com/waitlist
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const BeachRadarWaitlistFinal: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <Audio
        src={staticFile("video-kit/audio/our-world-preview.mp3")}
        volume={(f) => {
          if (f < 18) {
            return interpolate(f, [0, 18], [0, 0.28], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          }

          if (f > BEACH_RADAR_FINAL_FRAMES - 28) {
            return interpolate(
              f,
              [BEACH_RADAR_FINAL_FRAMES - 28, BEACH_RADAR_FINAL_FRAMES - 1],
              [0.28, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
          }

          return 0.28;
        }}
      />

      <Sequence from={INTRO_FROM} durationInFrames={INTRO_DURATION} premountFor={FPS}>
        <IntroScene duration={INTRO_DURATION} />
      </Sequence>

      <Sequence from={VALUE_FROM} durationInFrames={VALUE_DURATION} premountFor={FPS}>
        <ValueScene duration={VALUE_DURATION} />
      </Sequence>

      <Sequence from={CTA_FROM} durationInFrames={CTA_DURATION} premountFor={FPS}>
        <CtaScene duration={CTA_DURATION} />
      </Sequence>
    </AbsoluteFill>
  );
};
