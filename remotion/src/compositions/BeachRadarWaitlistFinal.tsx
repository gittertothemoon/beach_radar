import React from "react";
import {loadFont as loadInter} from "@remotion/google-fonts/Inter";
import {loadFont as loadSpaceGrotesk} from "@remotion/google-fonts/SpaceGrotesk";
import {
  AbsoluteFill,
  Easing,
  Img,
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
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FPS = 30;
export const BEACH_RADAR_FINAL_FRAMES = 360;

const INTRO_DURATION = 104;
const VALUE_DURATION = 184;
const CTA_DURATION = 102;
const VALUE_FROM = 88;
const CTA_FROM = 258;

const LOCKUP_SCALE = 1.34;

const COLORS = {
  bg: "#020617",
  text: "#F8FAFC",
  muted: "#94A3B8",
  cyan: "#06B6D4",
  live: "#22C55E",
  recent: "#F59E0B",
  pred: "#64748B",
};

const SAFE = {
  left: 64,
  right: 64,
  top: 112,
  bottom: 136,
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

const BaseBackdrop: React.FC<{frame: number}> = ({frame}) => {
  const drift = interpolate(frame, [0, BEACH_RADAR_FINAL_FRAMES - 1], [0, 70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      <Img src={staticFile("video-kit/initial-bg.png")} style={fillCover} />
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(6,182,212,0.05) 0px, rgba(6,182,212,0.05) 1px, transparent 1px, transparent 34px)",
          backgroundPosition: `0 ${drift}px`,
          opacity: 0.35,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.24) 0%, rgba(2,6,23,0.74) 52%, rgba(2,6,23,0.94) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 760px 420px at 50% 14%, rgba(6,182,212,0.32), rgba(2,6,23,0) 63%)",
        }}
      />
    </>
  );
};

const BrandLockup: React.FC<{frame: number; scale?: number}> = ({
  frame,
  scale = LOCKUP_SCALE,
}) => {
  const radarPulse = interpolate(frame % 28, [0, 27], [0.86, 1.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const radarOpacity = interpolate(frame % 28, [0, 27], [0.34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: 620,
        height: 470,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 18,
          width: 182,
          height: 182,
          borderRadius: "50%",
          border: `2px solid rgba(6,182,212,${radarOpacity})`,
          transform: `scale(${radarPulse})`,
        }}
      />
      <Img
        src={staticFile("video-kit/logo.png")}
        style={{
          position: "absolute",
          left: 196,
          top: 0,
          width: 230,
          height: 230,
          objectFit: "contain",
          filter: "drop-shadow(0 0 36px rgba(6,182,212,0.55))",
        }}
      />
      <Img
        src={staticFile("video-kit/beach-radar-scritta.png")}
        style={{
          position: "absolute",
          left: 56,
          top: 148,
          width: 508,
          height: 224,
          objectFit: "contain",
        }}
      />
    </div>
  );
};

const StatusChip: React.FC<{label: string; color: string}> = ({label, color}) => (
  <div
    style={{
      borderRadius: 999,
      border: `1px solid ${color}`,
      backgroundColor: "rgba(2,6,23,0.74)",
      color,
      fontFamily: bodyFont,
      fontWeight: 700,
      fontSize: 19,
      lineHeight: 1,
      padding: "9px 13px",
    }}
  >
    {label}
  </div>
);

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 22,
    config: {damping: 180},
  });
  const sceneOpacity = interpolate(
    frame,
    [0, 7, INTRO_DURATION - 14, INTRO_DURATION - 1],
    [1, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, opacity: sceneOpacity}}>
      <BaseBackdrop frame={frame} />
      <div style={safeArea}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "center",
            transform: `translateY(${interpolate(inSpring, [0, 1], [20, 0])}px)`,
            opacity: interpolate(inSpring, [0, 1], [0.5, 1]),
          }}
        >
          <BrandLockup frame={frame} />

          <div>
            <div
              style={{
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 98,
                lineHeight: 0.92,
                letterSpacing: -2.2,
                color: COLORS.text,
              }}
            >
              EVITA LA FOLLA.
            </div>
            <div
              style={{
                marginTop: 7,
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 94,
                lineHeight: 0.92,
                letterSpacing: -2.1,
                color: COLORS.text,
              }}
            >
              SCEGLI MEGLIO.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 11,
            }}
          >
            <div
              style={{
                borderRadius: 999,
                border: "1px solid rgba(6,182,212,0.55)",
                backgroundColor: "rgba(2,6,23,0.65)",
                color: COLORS.cyan,
                fontFamily: bodyFont,
                fontWeight: 700,
                fontSize: 30,
                lineHeight: 1,
                padding: "11px 22px",
              }}
            >
              Riviera + Bologna
            </div>
            <div
              style={{
                fontFamily: bodyFont,
                color: COLORS.muted,
                fontWeight: 600,
                fontSize: 28,
                lineHeight: 1.1,
              }}
            >
              Radar live per scegliere la spiaggia giusta.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ValueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sceneOpacity = interpolate(
    frame,
    [0, 8, VALUE_DURATION - 14, VALUE_DURATION - 1],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 22,
    config: {damping: 180},
  });
  const panelIn = spring({
    frame: frame - 6,
    fps,
    durationInFrames: 22,
    config: {damping: 190},
  });
  const panelShift = interpolate(frame, [0, VALUE_DURATION - 1], [30, -24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, opacity: sceneOpacity}}>
      <BaseBackdrop frame={frame + 35} />
      <div style={safeArea}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transform: `translateY(${interpolate(inSpring, [0, 1], [18, 0])}px)`,
            opacity: inSpring,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 90,
                lineHeight: 0.93,
                letterSpacing: -2.1,
                color: COLORS.text,
              }}
            >
              LIVE, RECENT,
              <br />
              PRED.
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: bodyFont,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.05,
                color: COLORS.muted,
                maxWidth: 920,
              }}
            >
              Affollamento chiaro in tempo reale.
            </div>
          </div>

          <div
            style={{
              height: 860,
              borderRadius: 42,
              border: "1px solid rgba(148,163,184,0.24)",
              backgroundColor: "rgba(11,15,22,0.86)",
              boxShadow: "0 24px 82px rgba(2,6,23,0.58)",
              overflow: "hidden",
              position: "relative",
              transform: `translateY(${interpolate(panelIn, [0, 1], [24, 0])}px)`,
              opacity: panelIn,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${panelShift}px) scale(1.06)`,
              }}
            >
              <Img src={staticFile("video-kit/sharecard-bg.png")} style={fillCover} />
            </div>
            <AbsoluteFill style={{backgroundColor: "rgba(2,6,23,0.34)"}} />

            <div
              style={{
                position: "absolute",
                top: 22,
                left: 22,
                right: 22,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                zIndex: 4,
              }}
            >
              <div style={{display: "flex", gap: 8}}>
                <StatusChip label="LIVE" color={COLORS.live} />
                <StatusChip label="RECENT" color={COLORS.recent} />
                <StatusChip label="PRED" color={COLORS.pred} />
              </div>
              <StatusChip label="Riviera + Bologna" color={COLORS.cyan} />
            </div>

            <Img
              src={staticFile("video-kit/pin_beach.png")}
              style={{
                position: "absolute",
                left: 160,
                top: 280,
                width: 100,
                height: 100,
                objectFit: "contain",
              }}
            />
            <Img
              src={staticFile("video-kit/pin_beach_affollata.png")}
              style={{
                position: "absolute",
                left: 424,
                top: 378,
                width: 100,
                height: 100,
                objectFit: "contain",
              }}
            />
            <Img
              src={staticFile("video-kit/pin_beach_poco_affollata.png")}
              style={{
                position: "absolute",
                left: 642,
                top: 265,
                width: 100,
                height: 100,
                objectFit: "contain",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: 22,
                right: 22,
                bottom: 22,
                borderRadius: 24,
                border: "1px solid rgba(148,163,184,0.2)",
                backgroundColor: "rgba(2,6,23,0.75)",
                padding: "16px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 700,
                  fontSize: 30,
                  lineHeight: 1,
                  color: COLORS.text,
                }}
              >
                Dove c'e posto, adesso.
              </div>
              <div
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 700,
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
              color: COLORS.muted,
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.1,
            }}
          >
            Segnalazioni community in tempo reale.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 20,
    config: {damping: 180},
  });
  const ctaIn = spring({
    frame: frame - 7,
    fps,
    durationInFrames: 18,
    config: {damping: 165},
  });
  const sceneOpacity = interpolate(frame, [0, 7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const remaining = Math.round(
    interpolate(frame, [0, CTA_DURATION - 1], [188, 146], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, opacity: sceneOpacity}}>
      <BaseBackdrop frame={frame + 64} />
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
            transform: `translateY(${interpolate(inSpring, [0, 1], [18, 0])}px)`,
            opacity: inSpring,
          }}
        >
          <BrandLockup frame={frame} />

          <div
            style={{
              fontFamily: headingFont,
              fontWeight: 700,
              fontSize: 78,
              lineHeight: 0.97,
              letterSpacing: -1.7,
              color: COLORS.text,
            }}
          >
            Prima ondata limitata.
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: bodyFont,
                fontWeight: 700,
                fontSize: 30,
                color: COLORS.cyan,
              }}
            >
              ENTRA ORA IN WAITLIST
            </div>
            <div
              style={{
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.35)",
                backgroundColor: "rgba(11,15,22,0.75)",
                color: COLORS.muted,
                fontFamily: bodyFont,
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1,
                padding: "11px 22px",
              }}
            >
              Posti rimanenti {remaining}/1000
            </div>
            <div
              style={{
                borderRadius: 30,
                backgroundColor: COLORS.text,
                color: COLORS.bg,
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 46,
                lineHeight: 1,
                letterSpacing: 0.2,
                padding: "31px 56px",
                transform: `scale(${interpolate(ctaIn, [0, 1], [0.88, 1])})`,
                boxShadow: "0 18px 58px rgba(248,250,252,0.27)",
              }}
            >
              OTTIENI ACCESSO ANTICIPATO
            </div>
          </div>

          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: 30,
              color: COLORS.cyan,
            }}
          >
            beachradar.it/waitlist
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const BeachRadarWaitlistFinal: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <Sequence durationInFrames={INTRO_DURATION} premountFor={FPS}>
        <IntroScene />
      </Sequence>
      <Sequence from={VALUE_FROM} durationInFrames={VALUE_DURATION} premountFor={FPS}>
        <ValueScene />
      </Sequence>
      <Sequence from={CTA_FROM} durationInFrames={CTA_DURATION} premountFor={FPS}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
