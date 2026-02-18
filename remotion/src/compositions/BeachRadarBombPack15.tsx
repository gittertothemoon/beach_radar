import React from "react";
import {loadFont as loadInter} from "@remotion/google-fonts/Inter";
import {loadFont as loadSpaceGrotesk} from "@remotion/google-fonts/SpaceGrotesk";
import {
  AbsoluteFill,
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
import {
  BEACH_RADAR_BOMB_FRAMES,
  BEACH_RADAR_BOMB_VARIANTS,
  type BombVariant,
} from "./BeachRadarBombPack15.config";

const {fontFamily: headingFont} = loadSpaceGrotesk("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const {fontFamily: bodyFont} = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const FPS = 30;

const INTRO_FROM = 0;
const INTRO_DURATION = 126;
const VALUE_FROM = 98;
const VALUE_DURATION = 168;
const CTA_FROM = 238;
const CTA_DURATION = 122;

const COLORS = {
  bg: "#020617",
  white: "#F8FAFC",
  textSoft: "#B8C6DC",
  cyan: "#06B6D4",
  live: "#22C55E",
  recent: "#F59E0B",
  pred: "#64748B",
};

type BombProps = {
  variantId?: string;
};

const SAFE = {
  left: 60,
  right: 60,
  top: 92,
  bottom: 98,
};

const safeArea: React.CSSProperties = {
  position: "absolute",
  left: SAFE.left,
  right: SAFE.right,
  top: SAFE.top,
  bottom: SAFE.bottom,
};

const fullCover: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const getVariant = (id?: string): BombVariant => {
  if (!id) {
    return BEACH_RADAR_BOMB_VARIANTS[0];
  }

  return BEACH_RADAR_BOMB_VARIANTS.find((v) => v.id === id) ?? BEACH_RADAR_BOMB_VARIANTS[0];
};

type PinPreset = {
  x: number;
  y: number;
  src: string;
  phase: number;
};

type PanelTheme = {
  background: "sharecard" | "initial" | "videoA" | "videoB";
  footer: string;
};

const PANEL_THEMES: PanelTheme[] = [
  {background: "sharecard", footer: "Dove c'e posto, adesso."},
  {background: "initial", footer: "Scegli la zona migliore ora."},
  {background: "videoA", footer: "Controlla la situazione in un attimo."},
  {background: "videoB", footer: "Mappa aggiornata durante la giornata."},
  {background: "sharecard", footer: "Le segnalazioni cambiano in tempo reale."},
];

const PANEL_PIN_PRESETS: PinPreset[][] = [
  [
    {x: 0.2, y: 0.37, src: "video-kit/pin_beach.png", phase: 5},
    {x: 0.5, y: 0.56, src: "video-kit/pin_beach_affollata.png", phase: 16},
    {x: 0.78, y: 0.34, src: "video-kit/pin_beach_poco_affollata.png", phase: 27},
  ],
  [
    {x: 0.18, y: 0.49, src: "video-kit/pin_beach_affollata.png", phase: 7},
    {x: 0.46, y: 0.33, src: "video-kit/pin_cluster.png", phase: 21},
    {x: 0.76, y: 0.54, src: "video-kit/pin_beach.png", phase: 34},
  ],
  [
    {x: 0.26, y: 0.4, src: "video-kit/pin_beach_poco_affollata.png", phase: 9},
    {x: 0.56, y: 0.6, src: "video-kit/pin_beach.png", phase: 18},
    {x: 0.82, y: 0.42, src: "video-kit/pin_beach_affollata.png", phase: 31},
  ],
  [
    {x: 0.24, y: 0.58, src: "video-kit/pin_cluster.png", phase: 12},
    {x: 0.52, y: 0.42, src: "video-kit/pin_beach_poco_affollata.png", phase: 23},
    {x: 0.78, y: 0.56, src: "video-kit/pin_beach.png", phase: 35},
  ],
  [
    {x: 0.16, y: 0.42, src: "video-kit/pin_beach.png", phase: 8},
    {x: 0.44, y: 0.56, src: "video-kit/pin_beach_affollata.png", phase: 19},
    {x: 0.72, y: 0.36, src: "video-kit/pin_cluster.png", phase: 28},
  ],
];

const Chip: React.FC<{
  label: string;
  color: string;
  compact?: boolean;
}> = ({label, color, compact = false}) => {
  return (
    <div
      style={{
        borderRadius: 999,
        border: `1px solid ${color}`,
        backgroundColor: "rgba(2,6,23,0.72)",
        color,
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: compact ? 18 : 24,
        lineHeight: 1,
        padding: compact ? "8px 12px" : "10px 18px",
      }}
    >
      {label}
    </div>
  );
};

const BrandLockup: React.FC<{
  frame: number;
  width: number;
  accent: string;
  pulse?: boolean;
}> = ({frame, width, accent, pulse = true}) => {
  const iconSize = Math.round(width * 0.42);
  const ringScale = interpolate(frame % 40, [0, 39], [0.86, 1.34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame % 40, [0, 39], [0.28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{display: "flex", flexDirection: "column", alignItems: "center", width}}>
      <div
        style={{
          position: "relative",
          width: iconSize,
          height: iconSize,
          marginBottom: -14,
        }}
      >
        {pulse ? (
          <div
            style={{
              position: "absolute",
              inset: -16,
              borderRadius: "50%",
              border: `2px solid rgba(6,182,212,${ringOpacity})`,
              transform: `scale(${ringScale})`,
            }}
          />
        ) : null}

        <Img
          src={staticFile("video-kit/logo-tight.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: `drop-shadow(0 0 24px ${accent}66)`,
          }}
        />
      </div>

      <Img
        src={staticFile("video-kit/logo-tight.png")}
        style={{
          width,
          height: Math.round(width * 0.47),
          objectFit: "contain",
          marginTop: -18,
          filter: "drop-shadow(0 8px 22px rgba(2,6,23,0.45))",
        }}
      />
    </div>
  );
};

const Backdrop: React.FC<{
  frame: number;
  variant: BombVariant;
}> = ({frame, variant}) => {
  const driftA = interpolate(frame, [0, BEACH_RADAR_BOMB_FRAMES - 1], [0, 56], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftB = interpolate(frame, [0, BEACH_RADAR_BOMB_FRAMES - 1], [26, -34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = interpolate(frame, [0, BEACH_RADAR_BOMB_FRAMES - 1], [0, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <div
        style={{
          position: "absolute",
          inset: -34,
          transform: `translateY(${driftA}px) scale(1.2)`,
          opacity: 0.9,
          filter: `hue-rotate(${variant.hue}deg) saturate(${variant.saturation})`,
        }}
      >
        <OffthreadVideo src={staticFile("video-kit/stock/beach-panorama-1080.mp4")} muted style={fullCover} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: -40,
          transform: `translateY(${driftB}px) scale(1.16)`,
          opacity: 0.3,
          mixBlendMode: "screen",
          filter: `hue-rotate(${variant.hue * -1}deg) saturate(${variant.saturation + 0.08})`,
        }}
      >
        <OffthreadVideo src={staticFile("video-kit/stock/beach-seashore-1080.mp4")} muted style={fullCover} />
      </div>

      <Img src={staticFile("video-kit/initial-bg.png")} style={{...fullCover, opacity: 0.28, mixBlendMode: "screen"}} />

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 760px 520px at 50% 12%, ${variant.accentSoft}, rgba(2,6,23,0) 58%)`,
          opacity: 0.9,
        }}
      />

      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(2,6,23,0.12) 0%, rgba(2,6,23,${variant.darkness * 0.78}) 52%, rgba(2,6,23,${variant.darkness}) 100%)`,
        }}
      />

      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(148,163,184,0.35) 0px, rgba(148,163,184,0.35) 1px, transparent 1px, transparent 3px)",
          backgroundPosition: `0 ${scan}px`,
          mixBlendMode: "soft-light",
        }}
      />
    </AbsoluteFill>
  );
};

const FloatingPin: React.FC<{
  frame: number;
  src: string;
  x: number;
  y: number;
  size: number;
  phase: number;
}> = ({frame, src, x, y, size, phase}) => {
  const bob = Math.sin((frame + phase) / 9) * 6;

  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: size,
        height: size,
        objectFit: "contain",
        transform: `translate(-50%, calc(-50% + ${bob}px))`,
      }}
    />
  );
};

const CrowdPanel: React.FC<{
  frame: number;
  variant: BombVariant;
  compact?: boolean;
}> = ({frame, variant, compact = false}) => {
  const variantSeed = Math.max(1, Number.parseInt(variant.id, 10) || 1);
  const theme = PANEL_THEMES[(variantSeed - 1) % PANEL_THEMES.length];
  const pinPreset = PANEL_PIN_PRESETS[(variantSeed + (compact ? 2 : 0)) % PANEL_PIN_PRESETS.length];
  const panelHeight = compact ? 570 : 900;
  const pinSize = compact ? 88 : 98;

  const panelBackground =
    theme.background === "sharecard" ? (
      <Img
        src={staticFile("video-kit/sharecard-bg.png")}
        style={{
          ...fullCover,
          transform: `translateY(${interpolate(frame, [0, 180], [16, -18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px) scale(1.08)`,
        }}
      />
    ) : null;

  const altImageBackground =
    theme.background === "initial" ? (
      <Img
        src={staticFile("video-kit/initial-bg.png")}
        style={{
          ...fullCover,
          transform: `translateY(${interpolate(frame, [0, 180], [10, -16], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px) scale(1.06)`,
        }}
      />
    ) : null;

  const videoBackground =
    theme.background === "videoA" ? (
      <OffthreadVideo
        src={staticFile("video-kit/stock/beach-panorama-1080.mp4")}
        muted
        style={{...fullCover, transform: "scale(1.08)"}}
      />
    ) : theme.background === "videoB" ? (
      <OffthreadVideo
        src={staticFile("video-kit/stock/beach-seashore-1080.mp4")}
        muted
        style={{...fullCover, transform: "scale(1.08)"}}
      />
    ) : null;

  return (
    <div
      style={{
        height: panelHeight,
        borderRadius: compact ? 34 : 42,
        border: "1px solid rgba(148,163,184,0.25)",
        backgroundColor: "rgba(3,10,28,0.78)",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 20px 70px rgba(2,6,23,0.62)",
      }}
    >
      {panelBackground}
      {altImageBackground}
      {videoBackground}
      <AbsoluteFill style={{backgroundColor: "rgba(2,6,23,0.3)"}} />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          justifyContent: "space-between",
          display: "flex",
        }}
      >
        <div style={{display: "flex", gap: 8}}>
          <Chip label="ORA" color={COLORS.live} compact />
          <Chip label="RECENTE" color={COLORS.recent} compact />
          <Chip label="PREVISIONE" color={COLORS.pred} compact />
        </div>
        <Chip label={`Zona ${((variantSeed - 1) % 6) + 1}`} color={variant.accent} compact />
      </div>

      {pinPreset.map((pin, idx) => (
        <FloatingPin
          key={`${pin.src}-${idx}`}
          frame={frame}
          src={pin.src}
          x={pin.x}
          y={pin.y}
          size={pinSize}
          phase={pin.phase}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 20,
          borderRadius: 22,
          backgroundColor: "rgba(2,6,23,0.72)",
          border: "1px solid rgba(148,163,184,0.22)",
          padding: compact ? "14px 16px" : "17px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: compact ? 28 : 34,
            color: COLORS.white,
          }}
        >
          {theme.footer}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: compact ? 21 : 24,
            color: COLORS.cyan,
          }}
        >
          Aggiornato ora
        </div>
      </div>
    </div>
  );
};

const IntroScene: React.FC<{
  variant: BombVariant;
}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 24,
    config: {damping: 176},
  });

  const sceneOpacity = interpolate(
    frame,
    [0, 8, INTRO_DURATION - 20, INTRO_DURATION - 1],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );

  const rise = interpolate(inSpring, [0, 1], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const sharedText = (
    <>
      <div
        style={{
          fontFamily: headingFont,
          fontWeight: 700,
          fontSize: 94,
          letterSpacing: -2.4,
          lineHeight: 0.92,
          color: COLORS.white,
          textShadow: "0 10px 42px rgba(2,6,23,0.55)",
        }}
      >
        {variant.hookTop}
      </div>
      <div
        style={{
          fontFamily: headingFont,
          fontWeight: 700,
          fontSize: 88,
          letterSpacing: -2.2,
          lineHeight: 0.92,
          color: COLORS.white,
          textShadow: "0 10px 42px rgba(2,6,23,0.55)",
        }}
      >
        {variant.hookBottom}
      </div>
    </>
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <Backdrop frame={frame} variant={variant} />
      <div style={safeArea}>
        {variant.introStyle === 1 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              transform: `translateY(${rise + 14}px)`,
              opacity: inSpring,
              gap: 24,
            }}
          >
            <BrandLockup frame={frame} width={546} accent={variant.accent} />
            {sharedText}
            <Chip label="Mappa in tempo reale" color={variant.accent} />
            <div style={{fontFamily: bodyFont, fontSize: 31, color: COLORS.textSoft, fontWeight: 600}}>{variant.subline}</div>
          </div>
        ) : null}

        {variant.introStyle === 2 ? (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              alignItems: "center",
              transform: `translateY(${rise + 8}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{display: "flex", justifyContent: "center"}}>
              <BrandLockup frame={frame} width={478} accent={variant.accent} />
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 104, lineHeight: 0.9, color: COLORS.white}}>{variant.hookTop}</div>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 80, lineHeight: 0.92, color: COLORS.white, opacity: 0.94}}>{variant.hookBottom}</div>
              <div style={{fontFamily: bodyFont, fontSize: 30, color: COLORS.textSoft, maxWidth: 760}}>{variant.subline}</div>
            </div>
            <div style={{display: "flex", justifyContent: "flex-end"}}>
              <Chip label="Mappa aggiornata" color={variant.accent} />
            </div>
          </div>
        ) : null}

        {variant.introStyle === 3 ? (
          <div
            style={{
              height: "100%",
              position: "relative",
              transform: `translateY(${rise + 12}px)`,
              opacity: inSpring,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 230,
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 148,
                lineHeight: 0.86,
                textAlign: "center",
                color: "rgba(248,250,252,0.12)",
              }}
            >
              BEACH
              <br />
              RADAR
            </div>

            <div style={{position: "absolute", top: 26, left: 0, right: 0, display: "flex", justifyContent: "center"}}>
              <BrandLockup frame={frame} width={520} accent={variant.accent} />
            </div>

            <div style={{position: "absolute", top: 760, left: 0, right: 0, textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 92, lineHeight: 0.91, color: COLORS.white}}>{variant.hookTop}</div>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 74, lineHeight: 0.92, color: COLORS.white}}>{variant.hookBottom}</div>
              <div style={{marginTop: 16, fontFamily: bodyFont, fontSize: 29, color: COLORS.textSoft}}>{variant.subline}</div>
            </div>
          </div>
        ) : null}

        {variant.introStyle === 4 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transform: `translateY(${rise + 8}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{display: "flex", justifyContent: "center"}}>
              <BrandLockup frame={frame} width={470} accent={variant.accent} />
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: 14, textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 96, lineHeight: 0.91, color: COLORS.white}}>{variant.hookTop}</div>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 84, lineHeight: 0.91, color: COLORS.white}}>{variant.hookBottom}</div>
            </div>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
              <div style={{fontFamily: bodyFont, fontSize: 28, color: COLORS.textSoft, maxWidth: 760}}>{variant.subline}</div>
              <Chip label="Scelta immediata" color={variant.accent} compact />
            </div>
          </div>
        ) : null}

        {variant.introStyle === 5 ? (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "auto auto auto",
              justifyItems: "center",
              alignContent: "center",
              gap: 22,
              transform: `translateY(${rise + 14}px)`,
              opacity: inSpring,
            }}
          >
            <Chip label="SPIAGGE AGGIORNATE" color={variant.accent} />
            <BrandLockup frame={frame} width={560} accent={variant.accent} />
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 88, color: COLORS.white, lineHeight: 0.92}}>{variant.hookTop}</div>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 74, color: COLORS.white, lineHeight: 0.92}}>{variant.hookBottom}</div>
              <div style={{marginTop: 12, fontFamily: bodyFont, fontWeight: 600, fontSize: 30, color: COLORS.textSoft}}>{variant.subline}</div>
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const ValueScene: React.FC<{
  variant: BombVariant;
}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 23,
    config: {damping: 184},
  });

  const sceneOpacity = interpolate(
    frame,
    [0, 10, VALUE_DURATION - 20, VALUE_DURATION - 1],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );
  const variantSeed = Math.max(1, Number.parseInt(variant.id, 10) || 1);
  const styleThreePinPreset = PANEL_PIN_PRESETS[(variantSeed + 1) % PANEL_PIN_PRESETS.length];

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <Backdrop frame={frame + 42} variant={variant} />
      <div style={safeArea}>
        {variant.valueStyle === 1 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 26,
              transform: `translateY(${interpolate(inSpring, [0, 1], [20, 8])}px)`,
              opacity: inSpring,
            }}
          >
            <div>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 84, lineHeight: 0.93, color: COLORS.white}}>{variant.valueTitle}</div>
              <div style={{marginTop: 10, fontFamily: bodyFont, fontWeight: 700, fontSize: 38, color: COLORS.textSoft}}>{variant.valueSub}</div>
            </div>
            <CrowdPanel frame={frame} variant={variant} />
            <div style={{textAlign: "center", fontFamily: bodyFont, fontWeight: 600, fontSize: 28, color: COLORS.textSoft}}>Segnalazioni della comunita in tempo reale.</div>
          </div>
        ) : null}

        {variant.valueStyle === 2 ? (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              gap: 24,
              transform: `translateY(${interpolate(inSpring, [0, 1], [24, 8])}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 82, lineHeight: 0.93, color: COLORS.white}}>{variant.valueTitle}</div>
              <div style={{marginTop: 10, fontFamily: bodyFont, fontWeight: 700, fontSize: 36, color: COLORS.textSoft}}>{variant.valueSub}</div>
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 18}}>
              <div style={{display: "flex", flexDirection: "column", gap: 14}}>
                {["Segnale ora ogni minuto", "Andamento recente consolidato", "Previsione nelle prossime ore"].map((t, idx) => (
                  <div
                    key={t}
                    style={{
                      borderRadius: 24,
                      border: `1px solid ${variant.accentSoft}`,
                      backgroundColor: "rgba(3,10,28,0.72)",
                      padding: "18px 18px",
                      transform: `translateY(${Math.sin((frame + idx * 12) / 12) * 3}px)`,
                    }}
                  >
                    <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 20, color: variant.accent}}>0{idx + 1}</div>
                    <div style={{marginTop: 8, fontFamily: bodyFont, fontWeight: 700, fontSize: 28, lineHeight: 1.02, color: COLORS.white}}>{t}</div>
                  </div>
                ))}
              </div>
              <CrowdPanel frame={frame} variant={variant} compact />
            </div>
          </div>
        ) : null}

        {variant.valueStyle === 3 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 22,
              transform: `translateY(${interpolate(inSpring, [0, 1], [26, 10])}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 82, lineHeight: 0.93, color: COLORS.white}}>{variant.valueTitle}</div>
              <div style={{marginTop: 10, fontFamily: bodyFont, fontWeight: 700, fontSize: 36, color: COLORS.textSoft}}>{variant.valueSub}</div>
            </div>

            <div
              style={{
                width: 850,
                height: 860,
                borderRadius: 40,
                border: "1px solid rgba(148,163,184,0.28)",
                backgroundColor: "rgba(3,10,28,0.74)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {[170, 280, 390].map((size) => (
                <div
                  key={size}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: size,
                    height: size,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                    borderRadius: "50%",
                    border: "1px solid rgba(6,182,212,0.22)",
                    transform: `scale(${interpolate((frame + size) % 80, [0, 79], [0.92, 1.08], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })})`,
                  }}
                />
              ))}

              {styleThreePinPreset.map((pin, idx) => (
                <FloatingPin
                  key={`style3-${pin.src}-${idx}`}
                  frame={frame}
                  src={pin.src}
                  x={pin.x}
                  y={pin.y}
                  size={106}
                  phase={pin.phase}
                />
              ))}

              <div
                style={{
                  position: "absolute",
                  left: 24,
                  right: 24,
                  bottom: 24,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Chip label="ORA" color={COLORS.live} />
                <Chip label="RECENTE" color={COLORS.recent} />
                <Chip label="PREVISIONE" color={COLORS.pred} />
              </div>
            </div>
          </div>
        ) : null}

        {variant.valueStyle === 4 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 20,
              transform: `translateY(${interpolate(inSpring, [0, 1], [20, 8])}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{textAlign: "left"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 82, lineHeight: 0.93, color: COLORS.white}}>{variant.valueTitle}</div>
              <div style={{marginTop: 8, fontFamily: bodyFont, fontWeight: 700, fontSize: 35, color: COLORS.textSoft}}>{variant.valueSub}</div>
            </div>

            <div
              style={{
                borderRadius: 34,
                border: "1px solid rgba(148,163,184,0.24)",
                backgroundColor: "rgba(3,10,28,0.78)",
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              {[
                "Porto Est: situazione in aumento",
                "Lido Centrale: situazione stabile",
                "Baia Blu: situazione favorevole tra 20 minuti",
                "Scoglio Sud: situazione in calo",
              ].map((row, idx) => (
                <div
                  key={row}
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(148,163,184,0.22)",
                    backgroundColor: "rgba(2,6,23,0.7)",
                    padding: "16px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transform: `translateX(${interpolate((frame + idx * 6) % 72, [0, 36, 71], [0, 4, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })}px)`,
                  }}
                >
                  <div style={{fontFamily: bodyFont, fontWeight: 700, fontSize: 28, color: COLORS.white}}>{row}</div>
                  <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 20, color: variant.accent}}>Aggiornamento</div>
                </div>
              ))}
            </div>

            <CrowdPanel frame={frame} variant={variant} compact />

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10}}>
              <Chip label="Riepilogo zone" color={variant.accent} />
              <Chip label="Verifica ora" color={variant.accent} />
              <Chip label="Aggiornato ora" color={variant.accent} />
            </div>
          </div>
        ) : null}

        {variant.valueStyle === 5 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
              transform: `translateY(${interpolate(inSpring, [0, 1], [20, 8])}px)`,
              opacity: inSpring,
            }}
          >
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 80, lineHeight: 0.93, color: COLORS.white}}>{variant.valueTitle}</div>
              <div style={{marginTop: 8, fontFamily: bodyFont, fontWeight: 700, fontSize: 34, color: COLORS.textSoft}}>{variant.valueSub}</div>
            </div>

            <div style={{position: "relative", height: 900}}>
              <div
                style={{
                  position: "absolute",
                  left: 34,
                  right: 260,
                  top: 100,
                  bottom: 120,
                  borderRadius: 30,
                  border: "1px solid rgba(148,163,184,0.2)",
                  backgroundColor: "rgba(3,10,28,0.55)",
                  overflow: "hidden",
                  transform: `translateY(${Math.sin(frame / 12) * 5}px) rotate(-4deg)`,
                }}
              >
                <Img src={staticFile("video-kit/initial-bg.png")} style={{...fullCover, opacity: 0.48}} />
              </div>

              <div
                style={{
                  position: "absolute",
                  left: 260,
                  right: 34,
                  top: 122,
                  bottom: 108,
                  borderRadius: 30,
                  border: "1px solid rgba(148,163,184,0.2)",
                  backgroundColor: "rgba(3,10,28,0.55)",
                  overflow: "hidden",
                  transform: `translateY(${Math.sin((frame + 18) / 12) * 5}px) rotate(4deg)`,
                }}
              >
                <Img src={staticFile("video-kit/sharecard-bg.png")} style={{...fullCover, opacity: 0.46}} />
              </div>

              <div
                style={{
                  position: "absolute",
                  left: 70,
                  right: 70,
                  top: 10,
                  bottom: 0,
                  transform: `translateY(${Math.sin((frame + 9) / 14) * 3}px)`,
                }}
              >
                <CrowdPanel frame={frame} variant={variant} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<{
  variant: BombVariant;
}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({
    frame,
    fps,
    durationInFrames: 22,
    config: {damping: 170},
  });

  const buttonSpring = spring({
    frame: frame - 6,
    fps,
    durationInFrames: 20,
    config: {damping: 155},
  });

  const sceneOpacity = interpolate(frame, [0, 10, CTA_DURATION - 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const remaining = Math.round(
    interpolate(frame, [0, CTA_DURATION - 1], [188, 129], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <Backdrop frame={frame + 120} variant={variant} />
      <div style={safeArea}>
        {variant.ctaStyle === 1 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: 16,
              transform: `translateY(${interpolate(inSpring, [0, 1], [20, 12])}px)`,
              opacity: inSpring,
            }}
          >
            <BrandLockup frame={frame} width={560} accent={variant.accent} />
            <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 84, color: COLORS.white, lineHeight: 0.95}}>{variant.ctaTitle}</div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 36, color: variant.accent}}>{variant.ctaLead}</div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 36, color: COLORS.textSoft, backgroundColor: "rgba(2,6,23,0.74)", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.32)"}}>Posti rimanenti {remaining}/1000</div>
            <div
              style={{
                borderRadius: 30,
                background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(239,245,255,1) 100%)",
                color: "#111827",
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 47,
                letterSpacing: 0.1,
                lineHeight: 1,
                padding: "30px 60px",
                transform: `scale(${interpolate(buttonSpring, [0, 1], [0.9, 1])})`,
                boxShadow: "0 22px 62px rgba(248,250,252,0.24)",
              }}
            >
              {variant.ctaButton}
            </div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 30, color: variant.accent}}>where2beach.com</div>
          </div>
        ) : null}

        {variant.ctaStyle === 2 ? (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "auto auto 1fr",
              justifyItems: "center",
              alignContent: "center",
              gap: 18,
              transform: `translateY(${interpolate(inSpring, [0, 1], [22, 10])}px)`,
              opacity: inSpring,
            }}
          >
            <BrandLockup frame={frame} width={520} accent={variant.accent} />
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 78, color: COLORS.white, lineHeight: 0.95}}>{variant.ctaTitle}</div>
              <div style={{marginTop: 8, fontFamily: bodyFont, fontWeight: 800, fontSize: 34, color: variant.accent}}>{variant.ctaLead}</div>
            </div>
            <div style={{width: "100%", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18, alignItems: "center"}}>
              <div style={{borderRadius: 28, border: `1px solid ${variant.accentSoft}`, backgroundColor: "rgba(3,10,28,0.74)", padding: 20}}>
                <div style={{fontFamily: bodyFont, fontSize: 24, color: COLORS.textSoft, fontWeight: 700}}>Disponibilita</div>
                <div style={{marginTop: 8, fontFamily: headingFont, fontWeight: 700, fontSize: 72, color: COLORS.white, lineHeight: 1}}>{remaining}</div>
                <div style={{fontFamily: bodyFont, fontSize: 24, color: COLORS.textSoft, fontWeight: 600}}>posti disponibili</div>
              </div>

              <div
                style={{
                  borderRadius: 30,
                  backgroundColor: COLORS.white,
                  color: "#0f172a",
                  fontFamily: headingFont,
                  fontWeight: 700,
                  fontSize: 44,
                  lineHeight: 1,
                  padding: "34px 38px",
                  textAlign: "center",
                  transform: `scale(${interpolate(buttonSpring, [0, 1], [0.9, 1])})`,
                }}
              >
                {variant.ctaButton}
              </div>
            </div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 30, color: variant.accent}}>where2beach.com</div>
          </div>
        ) : null}

        {variant.ctaStyle === 3 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: 18,
              transform: `translateY(${interpolate(inSpring, [0, 1], [24, 12])}px)`,
              opacity: inSpring,
            }}
          >
            <BrandLockup frame={frame} width={520} accent={variant.accent} />
            <Chip label="LISTA D'ATTESA" color={variant.accent} />
            <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 82, lineHeight: 0.94, color: COLORS.white}}>{variant.ctaTitle}</div>

            <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 170, lineHeight: 0.8, color: COLORS.white}}>{remaining}</div>
            <div style={{marginTop: -12, fontFamily: bodyFont, fontWeight: 700, fontSize: 32, color: COLORS.textSoft}}>posti disponibili</div>

            <div
              style={{
                borderRadius: 30,
                border: `2px solid ${variant.accent}`,
                backgroundColor: "rgba(2,6,23,0.66)",
                color: COLORS.white,
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 44,
                padding: "30px 46px",
                transform: `scale(${interpolate(buttonSpring, [0, 1], [0.9, 1])})`,
              }}
            >
              {variant.ctaButton}
            </div>

            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 30, color: variant.accent}}>where2beach.com</div>
          </div>
        ) : null}

        {variant.ctaStyle === 4 ? (
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateRows: "auto auto auto",
              justifyItems: "center",
              alignContent: "center",
              gap: 20,
              transform: `translateY(${interpolate(inSpring, [0, 1], [20, 10])}px)`,
              opacity: inSpring,
            }}
          >
            <BrandLockup frame={frame} width={500} accent={variant.accent} />
            <div style={{textAlign: "center"}}>
              <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 80, lineHeight: 0.95, color: COLORS.white}}>{variant.ctaTitle}</div>
              <div style={{marginTop: 10, fontFamily: bodyFont, fontWeight: 800, fontSize: 34, color: variant.accent}}>{variant.ctaLead}</div>
            </div>

            <div
              style={{
                width: "100%",
                borderRadius: 32,
                border: "1px solid rgba(148,163,184,0.26)",
                backgroundColor: "rgba(3,10,28,0.78)",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{height: 20, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.18)", overflow: "hidden"}}>
                <div
                  style={{
                    height: "100%",
                    width: `${interpolate(frame, [0, CTA_DURATION - 1], [28, 83], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })}%`,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${variant.accent}, #7dd3fc)`,
                  }}
                />
              </div>

              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <div style={{fontFamily: bodyFont, fontWeight: 700, fontSize: 28, color: COLORS.textSoft}}>iscrizioni ricevute</div>
                <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 42, color: COLORS.white}}>{1000 - remaining}/1000</div>
              </div>

              <div
                style={{
                  borderRadius: 28,
                  backgroundColor: COLORS.white,
                  color: "#0f172a",
                  fontFamily: headingFont,
                  fontWeight: 700,
                  fontSize: 44,
                  textAlign: "center",
                  padding: "30px 28px",
                  transform: `scale(${interpolate(buttonSpring, [0, 1], [0.9, 1])})`,
                }}
              >
                {variant.ctaButton}
              </div>
            </div>
          </div>
        ) : null}

        {variant.ctaStyle === 5 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: 20,
              transform: `translateY(${interpolate(inSpring, [0, 1], [22, 12])}px)`,
              opacity: inSpring,
            }}
          >
            <BrandLockup frame={frame} width={540} accent={variant.accent} />
            <div style={{fontFamily: headingFont, fontWeight: 700, fontSize: 82, lineHeight: 0.95, color: COLORS.white}}>{variant.ctaTitle}</div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 33, color: variant.accent}}>{variant.ctaLead}</div>
            <div style={{display: "flex", alignItems: "center", gap: 16}}>
              <Chip label={`Posti ${remaining}/1000`} color={variant.accent} />
              <Chip label="Aggiornamento continuo" color={variant.accent} />
            </div>
            <div
              style={{
                borderRadius: 30,
                border: "1px solid rgba(148,163,184,0.3)",
                backgroundColor: "rgba(248,250,252,0.95)",
                color: "#0f172a",
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 45,
                padding: "32px 58px",
                boxShadow: "0 22px 64px rgba(248,250,252,0.2)",
                transform: `scale(${interpolate(buttonSpring, [0, 1], [0.9, 1])})`,
              }}
            >
              {variant.ctaButton}
            </div>
            <div style={{fontFamily: bodyFont, fontWeight: 800, fontSize: 30, color: variant.accent}}>where2beach.com</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const BeachRadarBombPack15: React.FC<BombProps> = ({variantId}) => {
  const variant = getVariant(variantId);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <Sequence from={INTRO_FROM} durationInFrames={INTRO_DURATION} premountFor={FPS}>
        <IntroScene variant={variant} />
      </Sequence>

      <Sequence from={VALUE_FROM} durationInFrames={VALUE_DURATION} premountFor={FPS}>
        <ValueScene variant={variant} />
      </Sequence>

      <Sequence from={CTA_FROM} durationInFrames={CTA_DURATION} premountFor={FPS}>
        <CtaScene variant={variant} />
      </Sequence>
    </AbsoluteFill>
  );
};
