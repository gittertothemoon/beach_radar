import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent as RNKeyboardEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";

type WebSurfaceProps = {
  initialUrl: string;
  blockLandingRedirect?: boolean;
  landingBlockedMessage?: string;
  firstRunTutorialEnabled?: boolean;
  onCompleteFirstRunTutorial?: () => void;
  onRestartTutorial?: () => void;
  onInitialLoadSettled?: () => void;
  /** Expo push token to relay to the WebView so the web app can register it with the API. */
  expoPushToken?: string | null;
};

type TutorialRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TutorialStepId =
  | "intro"
  | "search"
  | "map-overview"
  | "onda"
  | "premi";

type AvatarPose =
  | "idle"
  | "pointSearch"
  | "pointMap"
  | "pointNav"
  | "celebrate";

type AvatarTarget = {
  x: number;
  y: number;
  tilt: number;
};

type TutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
  selector?: string;
  completionMode?: "none" | "search-input" | "target-touch";
  completionSelector?: string;
  interactionHint?: string;
  autoAdvanceOnComplete?: boolean;
  compactCard?: boolean;
  fallback: (
    surfaceWidth: number,
    surfaceHeight: number,
    topInset: number,
    bottomInset: number,
  ) => TutorialRect;
};

type TutorialBridgeMessage = {
  type: "w2b-tour-anchor";
  selector: string;
  found: boolean;
  rect?: TutorialRect;
};

type TutorialReadyBridgeMessage = {
  type: "w2b-tour-ready";
  ready: boolean;
};

type TutorialSearchBridgeMessage = {
  type: "w2b-tour-search";
  selector: string;
  valueLength: number;
};

type TutorialTargetBridgeMessage = {
  type: "w2b-tour-target";
  selector: string;
  activated: boolean;
};

type NativeFirstPaintBridgeMessage = {
  type: "w2b-native-first-paint";
  ready: boolean;
  language?: string;
};

type RestartTutorialBridgeMessage = {
  type: "w2b-restart-tutorial";
  language?: string;
};

type OAuthOpenBridgeMessage = {
  type: "w2b-oauth-open";
  provider: string;
  url: string;
};

type TutorialSpotlightProfile = {
  padX: number;
  padY: number;
  radius: number;
  pulseRadius: number;
  minWidth?: number;
  minHeight?: number;
};

const AUTO_RELOAD_MAX_ATTEMPTS = 2;
const AUTO_RELOAD_DELAY_MS = 700;
const PROD_FALLBACK_ORIGIN = "https://where2beach.com";
const TUTORIAL_HIGHLIGHT_PADDING_X = 12;
const TUTORIAL_HIGHLIGHT_PADDING_Y = 10;
const TUTORIAL_DEFAULT_MIN_WIDTH = 100;
const TUTORIAL_DEFAULT_MIN_HEIGHT = 44;
const TUTORIAL_SPOTLIGHT_RADIUS = 20;
const TUTORIAL_SPOTLIGHT_PULSE_RADIUS = 24;
const TUTORIAL_CARD_TRANSITION_MS = 300;
const TUTORIAL_SPOTLIGHT_TRANSITION_MS = 320;
const TUTORIAL_TRANSITION_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const TUTORIAL_AVATAR_SIZE = 152;
const TUTORIAL_AVATAR_EDGE_GAP = 10;
const TUTORIAL_AVATAR_MOVE_MS = 330;
const TUTORIAL_AVATAR_CROSSFADE_MS = 200;
const TUTORIAL_AUTO_ADVANCE_DELAY_MS = 220;
const TUTORIAL_CARD_TRANSITION_FROM = 0.84;
const TUTORIAL_CARD_ESTIMATED_HEIGHT = 268;
const INITIAL_BOOT_LOGO_SIZE = 408;

const ONDA_POSE_ASSETS: Record<AvatarPose, number> = {
  idle: require("../../assets/tutorial/onda-idle.png"),
  pointSearch: require("../../assets/tutorial/onda-point-search.png"),
  pointMap: require("../../assets/tutorial/onda-point-map.png"),
  pointNav: require("../../assets/tutorial/onda-point-nav.png"),
  celebrate: require("../../assets/tutorial/onda-celebrate.png"),
};

const STEP_AVATAR_POSE: Record<TutorialStepId, AvatarPose> = {
  intro: "idle",
  search: "pointSearch",
  "map-overview": "pointMap",
  onda: "pointNav",
  premi: "pointNav",
};

type TutorialLang = "it" | "en";

const TUTORIAL_STRINGS: Record<TutorialLang, {
  introTitle: string; introBody: string;
  searchTitle: string; searchBody: string; searchHint: string;
  mapTitle: string; mapBody: string;
  ondaTitle: string; ondaBody: string; ondaHint: string;
  premiTitle: string; premiBody: string;
  btnStart: string; btnContinue: string; btnFinish: string;
  stepOf: (current: number, total: number) => string;
  skip: string;
  defaultHint: string;
  completionAutoAdvance: string;
  completionManual: string;
  missionComplete: string;
  celebrationFlag: string;
  celebrationCta: string;
}> = {
  it: {
    introTitle: "Ciao! Sono ONDA, la tua guida.",
    introBody: "In pochi passi ti mostro tutto. Pronti a trovare la spiaggia giusta?",
    searchTitle: "Cerca la tua spiaggia",
    searchBody: "Scrivi il nome nella barra qui sopra — poche lettere bastano.",
    searchHint: "Scrivi almeno 2 lettere nella barra evidenziata, poi premi Continua.",
    mapTitle: "La mappa è il tuo radar",
    mapBody: "Ogni pin è una spiaggia. Toccalo per vedere affollamento, meteo e segnalazioni live.",
    ondaTitle: "Aprimi dal menu in basso!",
    ondaBody: "Tocca ONDA per aprire il chatbot e vedere le segnalazioni in tempo reale.",
    ondaHint: "Tocca ONDA per aprire il chatbot.",
    premiTitle: "Segnala e guadagna punti",
    premiBody: "Ogni segnalazione vale 15 punti. Accumulali per sbloccare badge esclusivi nel tab Premi.",
    btnStart: "Partiamo",
    btnContinue: "Continua",
    btnFinish: "Inizia a esplorare",
    stepOf: (current, total) => `Passo ${current} di ${total}`,
    skip: "Salta per ora",
    defaultHint: "Completa l'azione evidenziata per continuare.",
    completionAutoAdvance: "Perfetto, passo successivo in arrivo.",
    completionManual: "Perfetto. Ora puoi leggere e premere Continua.",
    missionComplete: "Missione completata",
    celebrationFlag: "Tutorial completato",
    celebrationCta: "Vai alla mappa",
  },
  en: {
    introTitle: "Hi! I'm ONDA, your guide.",
    introBody: "In a few steps I'll show you everything. Ready to find the right beach?",
    searchTitle: "Find your beach",
    searchBody: "Type a name in the bar above — a few letters are enough.",
    searchHint: "Type at least 2 letters in the highlighted bar, then press Continue.",
    mapTitle: "The map is your radar",
    mapBody: "Every pin is a beach. Tap it to see crowd level, weather and live reports.",
    ondaTitle: "Open me from the bottom menu!",
    ondaBody: "Tap ONDA to open the chatbot and see live reports.",
    ondaHint: "Tap ONDA to open the chatbot.",
    premiTitle: "Report and earn points",
    premiBody: "Each report earns 15 points. Collect them to unlock exclusive badges in the Rewards tab.",
    btnStart: "Let's go",
    btnContinue: "Continue",
    btnFinish: "Start exploring",
    stepOf: (current, total) => `Step ${current} of ${total}`,
    skip: "Skip for now",
    defaultHint: "Complete the highlighted action to continue.",
    completionAutoAdvance: "Great, next step on its way.",
    completionManual: "Great. Read and press Continue.",
    missionComplete: "Mission complete",
    celebrationFlag: "Tutorial completed",
    celebrationCta: "Go to the map",
  },
};

const getTutorialSteps = (lang: TutorialLang): TutorialStep[] => {
  const s = TUTORIAL_STRINGS[lang];
  return [
    {
      id: "intro",
      title: s.introTitle,
      body: s.introBody,
      fallback: (surfaceWidth, surfaceHeight, _topInset, _bottomInset) => ({
        x: surfaceWidth * 0.18,
        y: surfaceHeight * 0.26,
        width: surfaceWidth * 0.64,
        height: 84,
      }),
    },
    {
      id: "search",
      title: s.searchTitle,
      body: s.searchBody,
      selector: '[data-testid="search-input"]',
      completionMode: "search-input",
      completionSelector: '[data-testid="search-input"]',
      interactionHint: s.searchHint,
      fallback: (surfaceWidth, _surfaceHeight, topInset, _bottomInset) => ({
        x: 16,
        y: topInset + 18,
        width: Math.max(220, surfaceWidth - 32),
        height: 58,
      }),
    },
    {
      id: "map-overview",
      title: s.mapTitle,
      body: s.mapBody,
      selector: '[data-testid="map-container"]',
      fallback: (surfaceWidth, surfaceHeight, topInset, _bottomInset) => ({
        x: 22,
        y: Math.max(topInset + 110, surfaceHeight * 0.28),
        width: Math.max(230, surfaceWidth - 44),
        height: Math.min(250, surfaceHeight * 0.34),
      }),
    },
    {
      id: "onda",
      title: s.ondaTitle,
      body: s.ondaBody,
      selector: '[data-testid="bottom-nav-chatbot"]',
      completionMode: "target-touch",
      completionSelector: '[data-testid="bottom-nav-chatbot"]',
      interactionHint: s.ondaHint,
      fallback: (surfaceWidth, surfaceHeight, _topInset, bottomInset) => {
        const width = Math.min(138, surfaceWidth * 0.34);
        return {
          x: surfaceWidth / 2 - width / 2,
          y: surfaceHeight - bottomInset - 88,
          width,
          height: 52,
        };
      },
    },
    {
      id: "premi",
      title: s.premiTitle,
      body: s.premiBody,
      selector: '[data-testid="bottom-nav-rewards"]',
      fallback: (surfaceWidth, surfaceHeight, _topInset, bottomInset) => {
        const width = Math.min(138, surfaceWidth * 0.34);
        return {
          x: surfaceWidth - width - 16,
          y: surfaceHeight - bottomInset - 88,
          width,
          height: 52,
        };
      },
    },
  ];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isLocalLikeHost = (host: string): boolean => {
  const value = host.toLowerCase();
  if (value === "localhost" || value === "127.0.0.1" || value === "::1") return true;
  if (/^10\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(value);
};

const isNetworkTransientError = (nativeError: {
  code?: number;
  domain?: string;
  description?: string;
}): boolean => {
  const code = typeof nativeError.code === "number" ? nativeError.code : null;
  if (code === -1004 || code === -1001 || code === -1009 || code === -1003) {
    return true;
  }

  const domain = (nativeError.domain ?? "").toLowerCase();
  const description = (nativeError.description ?? "").toLowerCase();
  return (
    domain.includes("nsurlerrordomain") &&
    (description.includes("impossibile connettersi al server") ||
      description.includes("could not connect to the server") ||
      description.includes("offline") ||
      description.includes("timed out"))
  );
};

const withFallbackOrigin = (rawUrl: string, fallbackOrigin: string): string | null => {
  try {
    const current = new URL(rawUrl);
    const fallback = new URL(fallbackOrigin);
    current.protocol = fallback.protocol;
    current.host = fallback.host;
    return current.toString();
  } catch {
    return null;
  }
};

const isTutorialBridgeMessage = (value: unknown): value is TutorialBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "w2b-tour-anchor" &&
    typeof record.selector === "string" &&
    typeof record.found === "boolean"
  );
};

const isTutorialReadyBridgeMessage = (value: unknown): value is TutorialReadyBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "w2b-tour-ready" && typeof record.ready === "boolean";
};

const isTutorialSearchBridgeMessage = (value: unknown): value is TutorialSearchBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "w2b-tour-search" &&
    typeof record.selector === "string" &&
    typeof record.valueLength === "number"
  );
};

const isTutorialTargetBridgeMessage = (value: unknown): value is TutorialTargetBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "w2b-tour-target" &&
    typeof record.selector === "string" &&
    typeof record.activated === "boolean"
  );
};

const isNativeFirstPaintBridgeMessage = (
  value: unknown,
): value is NativeFirstPaintBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "w2b-native-first-paint" &&
    typeof record.ready === "boolean"
  );
};

const isRestartTutorialBridgeMessage = (value: unknown): value is RestartTutorialBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>).type === "w2b-restart-tutorial";
};

const isOAuthOpenBridgeMessage = (value: unknown): value is OAuthOpenBridgeMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "w2b-oauth-open" &&
    typeof record.url === "string" &&
    (record.url as string).length > 0
  );
};

const getTutorialSpotlightProfile = (
  stepId: TutorialStepId | null | undefined,
): TutorialSpotlightProfile => {
  switch (stepId) {
    case "search":
      return { padX: 8, padY: 7, radius: TUTORIAL_SPOTLIGHT_RADIUS, pulseRadius: TUTORIAL_SPOTLIGHT_PULSE_RADIUS };
    case "map-overview":
      return { padX: 14, padY: 14, radius: TUTORIAL_SPOTLIGHT_RADIUS, pulseRadius: TUTORIAL_SPOTLIGHT_PULSE_RADIUS };
    case "onda":
      return { padX: 9, padY: 6, radius: TUTORIAL_SPOTLIGHT_RADIUS, pulseRadius: TUTORIAL_SPOTLIGHT_PULSE_RADIUS };
    case "premi":
      return { padX: 9, padY: 6, radius: TUTORIAL_SPOTLIGHT_RADIUS, pulseRadius: TUTORIAL_SPOTLIGHT_PULSE_RADIUS };
    default:
      return {
        padX: TUTORIAL_HIGHLIGHT_PADDING_X,
        padY: TUTORIAL_HIGHLIGHT_PADDING_Y,
        radius: TUTORIAL_SPOTLIGHT_RADIUS,
        pulseRadius: TUTORIAL_SPOTLIGHT_PULSE_RADIUS,
      };
  }
};

const normalizeTutorialRect = (
  rect: TutorialRect,
  surfaceWidth: number,
  surfaceHeight: number,
  options?: {
    minWidth?: number;
    minHeight?: number;
  },
): TutorialRect => {
  const minWidth = options?.minWidth ?? TUTORIAL_DEFAULT_MIN_WIDTH;
  const minHeight = options?.minHeight ?? TUTORIAL_DEFAULT_MIN_HEIGHT;
  const width = clamp(rect.width, minWidth, Math.max(minWidth, surfaceWidth - 20));
  const height = clamp(
    rect.height,
    minHeight,
    Math.max(minHeight, surfaceHeight - 20),
  );
  const x = clamp(rect.x, 10, Math.max(10, surfaceWidth - width - 10));
  const y = clamp(rect.y, 10, Math.max(10, surfaceHeight - height - 10));
  return { x, y, width, height };
};

const prepareAnchorRect = (
  stepId: TutorialStepId,
  rect: TutorialRect,
  surfaceWidth: number,
  surfaceHeight: number,
): TutorialRect => {
  const spotlightProfile = getTutorialSpotlightProfile(stepId);
  const expanded: TutorialRect = {
    x: rect.x - spotlightProfile.padX,
    y: rect.y - spotlightProfile.padY,
    width: rect.width + spotlightProfile.padX * 2,
    height: rect.height + spotlightProfile.padY * 2,
  };

  if (stepId === "map-overview") {
    const focusHeight = Math.min(260, surfaceHeight * 0.36);
    const mapRect: TutorialRect = {
      x: expanded.x + 12,
      y: expanded.y + expanded.height * 0.25,
      width: expanded.width - 24,
      height: focusHeight,
    };
    return normalizeTutorialRect(mapRect, surfaceWidth, surfaceHeight, {
      minWidth: spotlightProfile.minWidth,
      minHeight: spotlightProfile.minHeight,
    });
  }

  return normalizeTutorialRect(expanded, surfaceWidth, surfaceHeight, {
    minWidth: spotlightProfile.minWidth,
    minHeight: spotlightProfile.minHeight,
  });
};

const intersects = (a: TutorialRect, b: TutorialRect): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const estimateTutorialCardRect = (
  surfaceWidth: number,
  surfaceHeight: number,
  topInset: number,
  bottomInset: number,
  cardAtTop: boolean,
): TutorialRect => {
  const width = Math.max(220, surfaceWidth - 28);
  const x = 14;
  const y = cardAtTop
    ? Math.max(topInset + 14, 20)
    : surfaceHeight - Math.max(bottomInset + 16, 18) - TUTORIAL_CARD_ESTIMATED_HEIGHT;
  return { x, y, width, height: TUTORIAL_CARD_ESTIMATED_HEIGHT };
};

const resolveAvatarTarget = (
  step: TutorialStep | null,
  spotlightRect: TutorialRect | null,
  cardRect: TutorialRect,
  surfaceWidth: number,
  surfaceHeight: number,
  topInset: number,
  bottomInset: number,
): AvatarTarget => {
  const topSafe = Math.max(8, topInset + 4);
  const bottomSafe = Math.max(8, bottomInset + 8);
  const minX = TUTORIAL_AVATAR_EDGE_GAP;
  const maxX = Math.max(
    TUTORIAL_AVATAR_EDGE_GAP,
    surfaceWidth - TUTORIAL_AVATAR_SIZE - TUTORIAL_AVATAR_EDGE_GAP,
  );
  const minY = topSafe;
  const maxY = Math.max(topSafe, surfaceHeight - TUTORIAL_AVATAR_SIZE - bottomSafe);

  if (!step || !spotlightRect) {
    const fallbackX = clamp(surfaceWidth - TUTORIAL_AVATAR_SIZE - 18, minX, maxX);
    const fallbackY = clamp(cardRect.y - TUTORIAL_AVATAR_SIZE - 18, minY, maxY);
    return { x: fallbackX, y: fallbackY, tilt: -0.3 };
  }

  const candidates: AvatarTarget[] = [
    { x: spotlightRect.x - TUTORIAL_AVATAR_SIZE * 0.82, y: spotlightRect.y - 24, tilt: -0.7 },
    {
      x: spotlightRect.x + spotlightRect.width - TUTORIAL_AVATAR_SIZE * 0.18,
      y: spotlightRect.y - 24,
      tilt: 0.7,
    },
    {
      x: spotlightRect.x + spotlightRect.width - TUTORIAL_AVATAR_SIZE * 0.25,
      y: spotlightRect.y + spotlightRect.height + 12,
      tilt: 0.45,
    },
    {
      x: spotlightRect.x - TUTORIAL_AVATAR_SIZE * 0.75,
      y: spotlightRect.y + spotlightRect.height + 12,
      tilt: -0.45,
    },
  ].map((target) => ({
    ...target,
    x: clamp(target.x, minX, maxX),
    y: clamp(target.y, minY, maxY),
  }));

  let bestTarget = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  const spotlightCenterX = spotlightRect.x + spotlightRect.width / 2;
  const spotlightCenterY = spotlightRect.y + spotlightRect.height / 2;

  for (const candidate of candidates) {
    const candidateRect: TutorialRect = {
      x: candidate.x,
      y: candidate.y,
      width: TUTORIAL_AVATAR_SIZE,
      height: TUTORIAL_AVATAR_SIZE,
    };
    const dx = candidate.x + TUTORIAL_AVATAR_SIZE / 2 - spotlightCenterX;
    const dy = candidate.y + TUTORIAL_AVATAR_SIZE / 2 - spotlightCenterY;
    const distanceScore = Math.sqrt(dx * dx + dy * dy);
    const collisionPenalty = intersects(candidateRect, cardRect) ? 240 : 0;
    const topPenalty = candidate.y < topSafe + 4 ? 40 : 0;
    const score = distanceScore + collisionPenalty + topPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = candidate;
    }
  }

  if (step.id === "search") {
    return {
      x: clamp(surfaceWidth - TUTORIAL_AVATAR_SIZE - 12, minX, maxX),
      y: clamp(cardRect.y - TUTORIAL_AVATAR_SIZE - 14, minY, maxY),
      tilt: 0.22,
    };
  }
  if (step.id === "map-overview") {
    return {
      x: clamp(surfaceWidth - TUTORIAL_AVATAR_SIZE - 14, minX, maxX),
      y: clamp(topSafe + 6, minY, maxY),
      tilt: -0.16,
    };
  }
  if (step.id === "onda") {
    return {
      x: clamp(surfaceWidth * 0.5 - TUTORIAL_AVATAR_SIZE / 2, minX, maxX),
      y: clamp(spotlightRect.y - TUTORIAL_AVATAR_SIZE - 14, minY, maxY),
      tilt: 0,
    };
  }
  if (step.id === "premi") {
    return {
      x: clamp(TUTORIAL_AVATAR_EDGE_GAP, minX, maxX),
      y: clamp(topInset + 8, minY, maxY),
      tilt: 0.18,
    };
  }
  return bestTarget;
};

export const WebSurface = ({
  initialUrl,
  blockLandingRedirect = false,
  landingBlockedMessage,
  firstRunTutorialEnabled = false,
  onCompleteFirstRunTutorial,
  onRestartTutorial,
  onInitialLoadSettled,
  expoPushToken,
}: WebSurfaceProps) => {
  const insets = useSafeAreaInsets();
  const statusBarOverlayHeight = Math.max(28, insets.top + 2);
  const webViewRef = useRef<WebView>(null);
  const retryAttemptRef = useRef(0);
  const pushedTokenRef = useRef<string | null>(null);
  const fallbackAppliedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [initialPresentationReady, setInitialPresentationReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [tutorialAnchorFound, setTutorialAnchorFound] = useState(false);
  const [tutorialAnchorRect, setTutorialAnchorRect] = useState<TutorialRect | null>(null);
  const [tutorialDomReady, setTutorialDomReady] = useState(false);
  const [tutorialCompletionReady, setTutorialCompletionReady] = useState(false);
  const [tutorialSearchValueLength, setTutorialSearchValueLength] = useState(0);
  const [tutorialKeyboardInset, setTutorialKeyboardInset] = useState(0);
  const [tutorialCelebrationVisible, setTutorialCelebrationVisible] = useState(false);
  const [tutorialLanguage, setTutorialLanguage] = useState<TutorialLang>("it");
  const [avatarPose, setAvatarPose] = useState<AvatarPose>("idle");
  const [previousAvatarPose, setPreviousAvatarPose] = useState<AvatarPose | null>(
    null,
  );

  const tutorialSpotlightX = useRef(new Animated.Value(24)).current;
  const tutorialSpotlightY = useRef(new Animated.Value(120)).current;
  const tutorialSpotlightWidth = useRef(new Animated.Value(220)).current;
  const tutorialSpotlightHeight = useRef(new Animated.Value(66)).current;
  const tutorialCardProgress = useRef(new Animated.Value(1)).current;
  const tutorialCelebrationProgress = useRef(new Animated.Value(0)).current;
  const tutorialAvatarFloat = useRef(new Animated.Value(0)).current;
  const tutorialAvatarX = useRef(new Animated.Value(110)).current;
  const tutorialAvatarY = useRef(new Animated.Value(36)).current;
  const tutorialAvatarTilt = useRef(new Animated.Value(0)).current;
  const tutorialAvatarPoseBlend = useRef(new Animated.Value(1)).current;
  const tutorialPulse = useRef(new Animated.Value(0)).current;
  const tutorialAutoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorialAutoAdvanceScheduledKeyRef = useRef<string | null>(null);
  const tutorialAvatarHasPositionRef = useRef(false);
  const tutorialSpotlightHasRectRef = useRef(false);
  const initialLoadSettledRef = useRef(false);
  const initialLoadProbeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const source = useMemo(() => ({ uri: currentUrl }), [currentUrl]);
  const clearInitialLoadProbeTimers = useCallback(() => {
    if (initialLoadProbeTimersRef.current.length === 0) return;
    for (const timer of initialLoadProbeTimersRef.current) {
      clearTimeout(timer);
    }
    initialLoadProbeTimersRef.current = [];
  }, []);
  const notifyInitialLoadSettled = useCallback(() => {
    if (initialLoadSettledRef.current) return;
    initialLoadSettledRef.current = true;
    setInitialPresentationReady(true);
    clearInitialLoadProbeTimers();
    onInitialLoadSettled?.();
  }, [clearInitialLoadProbeTimers, onInitialLoadSettled]);

  // Relay Expo push token to the WebView so the web app can register it with the API.
  useEffect(() => {
    if (!expoPushToken || !hasLoadedOnce) return;
    if (pushedTokenRef.current === expoPushToken) return;
    pushedTokenRef.current = expoPushToken;
    const safeToken = expoPushToken.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const script = `
      (function() {
        try {
          window.dispatchEvent(new CustomEvent('w2b-push-token', { detail: { token: '${safeToken}' } }));
        } catch(e) {}
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, [expoPushToken, hasLoadedOnce]);

  const appOrigin = useMemo(() => {
    try {
      return new URL(currentUrl).origin;
    } catch {
      return null;
    }
  }, [currentUrl]);

  const isLocalSource = useMemo(() => {
    try {
      return isLocalLikeHost(new URL(currentUrl).hostname);
    } catch {
      return false;
    }
  }, [currentUrl]);

  const tutorialActive = firstRunTutorialEnabled && !Boolean(error);
  const tutorialVisible = tutorialActive && hasLoadedOnce && !loading && tutorialDomReady;
  const tutorialSteps = getTutorialSteps(tutorialLanguage);
  const tutorialStepsCount = tutorialSteps.length;
  const safeTutorialStepIndex = clamp(
    tutorialStepIndex,
    0,
    Math.max(0, tutorialStepsCount - 1),
  );
  const tutorialStep = tutorialActive
    ? tutorialSteps[safeTutorialStepIndex]
    : null;
  const tutorialStepOverlayVisible =
    tutorialVisible && Boolean(tutorialStep) && !tutorialCelebrationVisible;
  const tutorialCompletionMode = tutorialStep?.completionMode ?? "none";
  const tutorialActiveSelector = tutorialStep?.selector ?? null;
  const tutorialActiveCompletionSelector =
    tutorialCompletionMode === "search-input" || tutorialCompletionMode === "target-touch"
      ? tutorialStep?.completionSelector ?? null
      : null;
  const tutorialStepRequiresInteraction = tutorialCompletionMode !== "none";
  const tutorialCanAdvance =
    tutorialCompletionMode === "none"
      ? true
      : tutorialCompletionMode === "search-input"
        ? tutorialSearchValueLength >= 2
        : tutorialCompletionReady;
  const tutorialStepCompleted = tutorialStepRequiresInteraction && tutorialCanAdvance;
  const tutorialAutoAdvanceOnComplete = tutorialStep?.autoAdvanceOnComplete === true;
  const tutorialCompactCard = tutorialStep?.compactCard === true;
  const tutorialShouldForceOndaPanelOpen =
    tutorialStep?.id === "onda" && tutorialStepCompleted;
  const tutorialOndaPanelPriority = tutorialShouldForceOndaPanelOpen;
  const ts = TUTORIAL_STRINGS[tutorialLanguage];
  const tutorialInteractionHintText =
    tutorialStep?.interactionHint ?? ts.defaultHint;
  const tutorialBodyText = tutorialStep?.body ?? "";
  const tutorialIsDoneStep = false;
  const tutorialUsesSyntheticTargetTap =
    tutorialCompletionMode === "target-touch";

  const tutorialFallbackRect = useMemo(() => {
    if (!tutorialActiveSelector || !tutorialStep) return null;
    const width = surfaceSize.width > 0 ? surfaceSize.width : 390;
    const height = surfaceSize.height > 0 ? surfaceSize.height : 844;
    return normalizeTutorialRect(
      tutorialStep.fallback(width, height, statusBarOverlayHeight, insets.bottom),
      width,
      height,
    );
  }, [
    tutorialActiveSelector,
    insets.bottom,
    statusBarOverlayHeight,
    surfaceSize.height,
    surfaceSize.width,
    tutorialStep,
  ]);

  const tutorialSpotlightRect = useMemo(() => {
    if (!tutorialActiveSelector || !tutorialStep) return null;
    const width = surfaceSize.width > 0 ? surfaceSize.width : 390;
    const height = surfaceSize.height > 0 ? surfaceSize.height : 844;

    if (tutorialAnchorFound && tutorialAnchorRect) {
      return prepareAnchorRect(tutorialStep.id, tutorialAnchorRect, width, height);
    }

    return tutorialFallbackRect;
  }, [
    surfaceSize.height,
    surfaceSize.width,
    tutorialActiveSelector,
    tutorialAnchorFound,
    tutorialAnchorRect,
    tutorialFallbackRect,
    tutorialStep,
  ]);

  const tutorialSpotlightVisible = Boolean(tutorialActiveSelector && tutorialSpotlightRect);
  const tutorialSpotlightProfile = useMemo(
    () => getTutorialSpotlightProfile(tutorialStep?.id ?? null),
    [tutorialStep?.id],
  );
  const tutorialCardAtTop = Boolean(
    tutorialStep?.id === "onda" ||
      (tutorialActiveSelector &&
        tutorialSpotlightRect &&
        tutorialSpotlightRect.y > (surfaceSize.height > 0 ? surfaceSize.height : 844) * 0.55),
  );
  const tutorialCardRect = useMemo(() => {
    const width = surfaceSize.width > 0 ? surfaceSize.width : 390;
    const height = surfaceSize.height > 0 ? surfaceSize.height : 844;
    return estimateTutorialCardRect(
      width,
      height,
      statusBarOverlayHeight,
      insets.bottom,
      tutorialCardAtTop,
    );
  }, [
    insets.bottom,
    statusBarOverlayHeight,
    surfaceSize.height,
    surfaceSize.width,
    tutorialCardAtTop,
  ]);
  const tutorialAvatarTarget = useMemo(() => {
    const width = surfaceSize.width > 0 ? surfaceSize.width : 390;
    const height = surfaceSize.height > 0 ? surfaceSize.height : 844;
    return resolveAvatarTarget(
      tutorialStep,
      tutorialSpotlightRect,
      tutorialCardRect,
      width,
      height,
      statusBarOverlayHeight,
      insets.bottom,
    );
  }, [
    insets.bottom,
    statusBarOverlayHeight,
    surfaceSize.height,
    surfaceSize.width,
    tutorialCardRect,
    tutorialSpotlightRect,
    tutorialStep,
  ]);
  const effectiveAvatarPose = tutorialStep ? STEP_AVATAR_POSE[tutorialStep.id] : "idle";
  const currentAvatarAsset = ONDA_POSE_ASSETS[avatarPose];

  const tutorialPrimaryLabel =
    safeTutorialStepIndex === 0
      ? ts.btnStart
      : safeTutorialStepIndex === tutorialStepsCount - 1
        ? ts.btnFinish
        : ts.btnContinue;
  const tutorialCardBottomOffset = useMemo(() => {
    const baseOffset = Math.max(insets.bottom + 16, 18);
    if (tutorialStep?.id !== "search" || tutorialKeyboardInset <= 0) {
      return baseOffset;
    }
    return baseOffset + tutorialKeyboardInset + 8;
  }, [insets.bottom, tutorialKeyboardInset, tutorialStep?.id]);

  const resetConnectionState = useCallback(() => {
    retryAttemptRef.current = 0;
    fallbackAppliedRef.current = false;
    setError(null);
    setHasLoadedOnce(false);
    setLoading(true);
  }, []);

  const applySourceUrl = useCallback(
    (nextUrl: string) => {
      resetConnectionState();
      setCurrentUrl(nextUrl);
    },
    [resetConnectionState],
  );

  const handleReload = useCallback(() => {
    setError(null);
    retryAttemptRef.current = 0;
    webViewRef.current?.reload();
  }, []);

  const openExternalUrl = useCallback((rawUrl: string) => {
    setLoading(false);
    setError(null);
    void Linking.openURL(rawUrl).catch(() => {
      setError("Impossibile aprire il link esterno.");
    });
  }, []);

  const probeTutorialAnchor = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var selector = ${selectorLiteral};
          var element = document.querySelector(selector);
          var payload = { type: "w2b-tour-anchor", selector: selector, found: Boolean(element) };
          var isOndaCloseSelector =
            selector.indexOf("bottom-sheet-chat-close") !== -1 ||
            selector.indexOf("bottom-sheet-header-toggle") !== -1;
          if (!element && isOndaCloseSelector) {
            var headerToggle =
              document.querySelector('[data-testid="bottom-sheet-header-toggle"][aria-expanded="true"]') ||
              document.querySelector('[data-testid="bottom-sheet"] > div > button[aria-expanded="true"]');
            if (headerToggle) {
              var headerRect = headerToggle.getBoundingClientRect();
              payload.found = true;
              payload.rect = {
                x: headerRect.left + 10,
                y: headerRect.top + 2,
                width: Math.max(80, headerRect.width - 20),
                height: Math.max(32, headerRect.height - 4)
              };
            }
          }
          if (element) {
            var rect = element.getBoundingClientRect();
            payload.rect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          }
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const ensureTutorialAnchorVisible = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var element = document.querySelector(${selectorLiteral});
          if (!element || typeof element.scrollIntoView !== "function") return;
          var rect = element.getBoundingClientRect();
          var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
          var margin = 96;
          var needsScroll = rect.top < margin || rect.bottom > (viewportHeight - margin);
          if (needsScroll) {
            element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const armTutorialSearchProgress = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var selector = ${selectorLiteral};
          var element = document.querySelector(selector);
          if (!element) return;
          var post = function() {
            var value = "";
            if (typeof element.value === "string") value = element.value;
            var length = value.trim().length;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "w2b-tour-search",
                selector: selector,
                valueLength: length
              }));
            }
          };
          post();
          if (element.__w2bTourSearchArmed) return;
          element.__w2bTourSearchArmed = true;
          element.addEventListener("input", post, { passive: true });
          element.addEventListener("change", post, { passive: true });
          element.addEventListener("keyup", post, { passive: true });
          element.addEventListener("focus", post, { passive: true });
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const armTutorialTargetProgress = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var selector = ${selectorLiteral};
          var element = document.querySelector(selector);
          if (!element) return;
          element.__w2bTourTargetDone = false;
          var notify = function() {
            if (element.__w2bTourTargetDone) return;
            var isNavTarget = selector.indexOf("bottom-nav-") !== -1;
            var isActivated = true;
            if (isNavTarget) {
              var className = typeof element.className === "string" ? element.className : "";
              isActivated =
                className.indexOf("border-white/38") !== -1 ||
                element.getAttribute("aria-pressed") === "true" ||
                element.getAttribute("aria-current") === "page";
            }
            if (!isActivated) return;
            element.__w2bTourTargetDone = true;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "w2b-tour-target",
                selector: selector,
                activated: true
              }));
            }
          };
          if (element.__w2bTourTargetArmed) return;
          element.__w2bTourTargetArmed = true;
          element.addEventListener("click", function() {
            setTimeout(notify, 90);
          }, { passive: true });
          element.addEventListener("keydown", function(event) {
            if (event && (event.key === "Enter" || event.key === " ")) {
              setTimeout(notify, 90);
            }
          });
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const probeTutorialReady = useCallback(() => {
    const script = `
      (function() {
        try {
          var selectors = [
            '[data-testid="search-input"]',
            '[data-testid="map-container"]',
            '[data-testid="bottom-nav-map"]',
            '[data-testid="bottom-nav-chatbot"]',
            '[data-testid="bottom-nav-profile"]'
          ];
          var domReady = document.readyState === "interactive" || document.readyState === "complete";
          var hasAnchor = selectors.some(function(selector) {
            return Boolean(document.querySelector(selector));
          });
          var payload = { type: "w2b-tour-ready", ready: Boolean(domReady && hasAnchor) };
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const armInitialLoadSettlementProbe = useCallback(() => {
    if (initialLoadSettledRef.current) return;
    clearInitialLoadProbeTimers();
    const runProbe = () => {
      const script = `
        (function() {
          try {
            var htmlReady =
              document.documentElement &&
              document.documentElement.getAttribute("data-native-app-ready") === "1";
            var runtimeReady = window.__W2B_NATIVE_APP_READY === true;
            var payload = {
              type: "w2b-native-first-paint",
              ready: Boolean(htmlReady || runtimeReady)
            };
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          } catch (_error) {
            // Ignore bridge probe errors.
          }
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
    };
    runProbe();
    initialLoadProbeTimersRef.current = [
      setTimeout(runProbe, 180),
      setTimeout(runProbe, 700),
      setTimeout(() => {
        notifyInitialLoadSettled();
      }, 4500),
    ];
  }, [clearInitialLoadProbeTimers, notifyInitialLoadSettled]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; isTopFrame?: boolean }) => {
      const isTopFrameRequest = request.isTopFrame !== false;
      const isLandingRequest = /\/landing(\/|$)/i.test(request.url);
      // Guard only the initial app-access handshake redirect.
      if (blockLandingRedirect && !hasLoadedOnce && isTopFrameRequest && isLandingRequest) {
        setLoading(false);
        setError(
          landingBlockedMessage ??
            "Accesso app non autorizzato. Configura la chiave app e riprova.",
        );
        notifyInitialLoadSettled();
        return false;
      }

      if (request.isTopFrame === false) {
        return true;
      }

      const rawUrl = request.url?.trim();
      if (!rawUrl) return true;

      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        parsedUrl = null;
      }

      const isHttp = parsedUrl?.protocol === "http:" || parsedUrl?.protocol === "https:";
      const isExternalHttp =
        isHttp && appOrigin ? parsedUrl?.origin !== appOrigin : false;

      if (!isHttp || isExternalHttp) {
        openExternalUrl(rawUrl);
        return false;
      }
      return true;
    },
    [
      appOrigin,
      blockLandingRedirect,
      hasLoadedOnce,
      landingBlockedMessage,
      notifyInitialLoadSettled,
      openExternalUrl,
    ],
  );

  const handleWebError = useCallback(
    (event: {
      nativeEvent: {
        code?: number;
        domain?: string;
        description?: string;
      };
    }) => {
      const nativeError = event.nativeEvent ?? {};
      const transientNetworkError = isNetworkTransientError(nativeError);

      if (transientNetworkError && retryAttemptRef.current < AUTO_RELOAD_MAX_ATTEMPTS) {
        retryAttemptRef.current += 1;
        setError(null);
        setLoading(true);
        const waitMs = AUTO_RELOAD_DELAY_MS * retryAttemptRef.current;
        setTimeout(() => {
          webViewRef.current?.reload();
        }, waitMs);
        return;
      }

      if (transientNetworkError && isLocalSource && !fallbackAppliedRef.current) {
        const fallbackUrl = withFallbackOrigin(currentUrl, PROD_FALLBACK_ORIGIN);
        if (fallbackUrl && fallbackUrl !== currentUrl) {
          fallbackAppliedRef.current = true;
          setError(null);
          setLoading(true);
          setCurrentUrl(fallbackUrl);
          return;
        }
      }

      setLoading(false);
      setHasLoadedOnce(true);
      setError(nativeError.description || "Errore sconosciuto");
      notifyInitialLoadSettled();
    },
    [currentUrl, isLocalSource, notifyInitialLoadSettled],
  );

  const handleWebHttpError = useCallback(
    (event: {
      nativeEvent: {
        statusCode: number;
        description?: string;
        url?: string;
      };
    }) => {
      const nativeEvent = event.nativeEvent;
      const statusCode = nativeEvent?.statusCode;
      const description = nativeEvent?.description;
      const rawUrl = nativeEvent?.url ?? "";

      let pathname = "";
      try {
        pathname = rawUrl ? new URL(rawUrl).pathname : "";
      } catch {
        pathname = "";
      }

      if (statusCode >= 500 && pathname === "/api/app-access") {
        setError(
          "Configurazione accesso app mancante sul backend (APP_ACCESS_KEY / APP_ACCESS_KEY_HASH).",
        );
      } else if (statusCode >= 400) {
        setError(description || `Errore server (${statusCode})`);
      }

      setLoading(false);
      setHasLoadedOnce(true);
      setTutorialDomReady(false);
      notifyInitialLoadSettled();
    },
    [notifyInitialLoadSettled],
  );

  const handleWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (isOAuthOpenBridgeMessage(parsed)) {
        const oauthUrl = parsed.url;
        void (async () => {
          const dispatchCancelled = () => {
            webViewRef.current?.injectJavaScript(
              "window.dispatchEvent(new CustomEvent('w2b-oauth-cancelled')); true;",
            );
          };
          try {
            const result = await WebBrowser.openAuthSessionAsync(
              oauthUrl,
              "where2beach://",
            );
            if (result.type !== "success" || !result.url) {
              dispatchCancelled();
              return;
            }
            // Callback shape: where2beach://auth/callback?code=... (or with # for some providers).
            const rawUrl = result.url;
            const queryIdx = rawUrl.indexOf("?");
            const hashIdx = rawUrl.indexOf("#");
            let paramsString = "";
            if (queryIdx !== -1) {
              paramsString =
                hashIdx !== -1 && hashIdx > queryIdx
                  ? rawUrl.slice(queryIdx + 1, hashIdx)
                  : rawUrl.slice(queryIdx + 1);
            } else if (hashIdx !== -1) {
              paramsString = rawUrl.slice(hashIdx + 1);
            }
            const params = new URLSearchParams(paramsString);
            const code = params.get("code");
            if (!code) {
              dispatchCancelled();
              return;
            }
            const target = new URL("/register/", appOrigin ?? "https://where2beach.com");
            target.searchParams.set("mode", "login");
            target.searchParams.set("code", code);
            target.searchParams.set("returnTo", "/app/?native_shell=1");
            // react-native-webview's source prop update is unreliable when the
            // pathname stays the same and only the query string changes, so we
            // force the navigation via window.location inside the WebView.
            const targetUrl = target.toString();
            webViewRef.current?.injectJavaScript(
              "window.location.replace(" + JSON.stringify(targetUrl) + "); true;",
            );
          } catch {
            dispatchCancelled();
          }
        })();
        return;
      }

      if (isTutorialReadyBridgeMessage(parsed)) {
        setTutorialDomReady(parsed.ready);
        return;
      }

      if (isNativeFirstPaintBridgeMessage(parsed)) {
        if (parsed.language === "en" || parsed.language === "it") {
          setTutorialLanguage(parsed.language);
        }
        if (parsed.ready) notifyInitialLoadSettled();
        return;
      }

      if (isRestartTutorialBridgeMessage(parsed)) {
        if (parsed.language === "en" || parsed.language === "it") {
          setTutorialLanguage(parsed.language);
        }
        onRestartTutorial?.();
        return;
      }

      if (
        isTutorialSearchBridgeMessage(parsed) &&
        tutorialVisible &&
        tutorialCompletionMode === "search-input" &&
        tutorialActiveCompletionSelector &&
        parsed.selector === tutorialActiveCompletionSelector
      ) {
        setTutorialSearchValueLength(parsed.valueLength);
        return;
      }

      if (
        isTutorialTargetBridgeMessage(parsed) &&
        tutorialVisible &&
        parsed.activated
      ) {
        if (
          tutorialCompletionMode === "target-touch" &&
          tutorialActiveCompletionSelector &&
          parsed.selector === tutorialActiveCompletionSelector
        ) {
          setTutorialCompletionReady(true);
          return;
        }
        return;
      }

      if (!tutorialVisible || !tutorialActiveSelector) return;

      if (!isTutorialBridgeMessage(parsed)) return;
      if (parsed.selector !== tutorialActiveSelector) return;

      if (!parsed.found || !parsed.rect) {
        setTutorialAnchorFound(false);
        setTutorialAnchorRect(null);
        return;
      }

      const rect = parsed.rect;
      const normalizedRect: TutorialRect = {
        x: typeof rect.x === "number" ? rect.x : 0,
        y: typeof rect.y === "number" ? rect.y : 0,
        width: typeof rect.width === "number" ? rect.width : 0,
        height: typeof rect.height === "number" ? rect.height : 0,
      };

      if (normalizedRect.width <= 0 || normalizedRect.height <= 0) {
        setTutorialAnchorFound(false);
        setTutorialAnchorRect(null);
        return;
      }

      setTutorialAnchorFound(true);
      setTutorialAnchorRect(normalizedRect);
    },
    [
      appOrigin,
      applySourceUrl,
      notifyInitialLoadSettled,
      onRestartTutorial,
      tutorialActiveCompletionSelector,
      tutorialActiveSelector,
      tutorialCompletionMode,
      tutorialVisible,
    ],
  );

  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSurfaceSize({ width, height });
  }, []);

  const showTutorialCelebration = useCallback(() => {
    setTutorialCelebrationVisible(true);
    setTutorialAnchorFound(false);
    setTutorialAnchorRect(null);
    setTutorialCompletionReady(false);
    setTutorialSearchValueLength(0);
  }, []);

  const dismissTutorialSearchDropdown = useCallback(() => {
    const script = `
      (function() {
        try {
          var input = document.querySelector('[data-testid="search-input"]');
          if (input) {
            var descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement && window.HTMLInputElement.prototype, "value");
            if (descriptor && typeof descriptor.set === "function") {
              descriptor.set.call(input, "");
            } else {
              input.value = "";
            }
            if (typeof Event === "function") {
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
          var evtInit = { bubbles: true, cancelable: true };
          if (input && typeof KeyboardEvent === "function") {
            input.dispatchEvent(new KeyboardEvent("keydown", Object.assign({ key: "Escape", code: "Escape" }, evtInit)));
            input.dispatchEvent(new KeyboardEvent("keyup", Object.assign({ key: "Escape", code: "Escape" }, evtInit)));
          }
          if (input && typeof input.blur === "function") {
            input.blur();
          }
          var active = document.activeElement;
          if (active && active !== document.body && typeof active.blur === "function") {
            active.blur();
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const triggerTutorialTargetTap = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var selector = ${selectorLiteral};
          var element = document.querySelector(selector);
          if (
            !element &&
            (selector.indexOf("bottom-sheet-chat-close") !== -1 ||
              selector.indexOf("bottom-sheet-header-toggle") !== -1)
          ) {
            var headerToggle =
              document.querySelector('[data-testid="bottom-sheet-header-toggle"][aria-expanded="true"]') ||
              document.querySelector('[data-testid="bottom-sheet"] > div > button[aria-expanded="true"]');
            if (headerToggle && typeof headerToggle.click === "function") {
              headerToggle.click();
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: "w2b-tour-target",
                  selector: selector,
                  activated: true
                }));
              }
            }
            return;
          }
          if (!element) return;
          if (typeof element.focus === "function") {
            element.focus();
          }
          if (typeof element.click === "function") {
            element.click();
            return;
          }
          if (typeof MouseEvent === "function" && typeof element.dispatchEvent === "function") {
            element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const ensureNavTabActive = useCallback((selector: string) => {
    const selectorLiteral = JSON.stringify(selector);
    const script = `
      (function() {
        try {
          var nav = document.querySelector(${selectorLiteral});
          var cls = nav && typeof nav.className === "string" ? nav.className : "";
          if (nav && cls.indexOf("border-white/38") === -1 && typeof nav.click === "function") {
            nav.click();
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const handleFinishTutorial = useCallback(() => {
    ensureNavTabActive('[data-testid="bottom-nav-map"]');
    setTutorialCelebrationVisible(false);
    onCompleteFirstRunTutorial?.();
  }, [ensureNavTabActive, onCompleteFirstRunTutorial]);

  const ensureTutorialOndaPanelVisible = useCallback(() => {
    const script = `
      (function() {
        try {
          var chatbotNav = document.querySelector('[data-testid="bottom-nav-chatbot"]');
          var chatbotClass = chatbotNav && typeof chatbotNav.className === "string" ? chatbotNav.className : "";
          var chatbotActive = chatbotClass.indexOf("border-white/38") !== -1;
          if (chatbotNav && !chatbotActive && typeof chatbotNav.click === "function") {
            chatbotNav.click();
          }
          var headerToggle = document.querySelector('[data-testid="bottom-sheet"] > div > button[aria-expanded]');
          if (headerToggle && headerToggle.getAttribute("aria-expanded") !== "true" && typeof headerToggle.click === "function") {
            headerToggle.click();
          }
        } catch (_error) {
          // Ignore DOM bridge errors.
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const advanceTutorialStep = useCallback(() => {
    setTutorialStepIndex((prev) => clamp(prev + 1, 0, tutorialStepsCount - 1));
    setTutorialAnchorFound(false);
    setTutorialAnchorRect(null);
  }, [tutorialStepsCount]);

  const handleNextTutorialStep = useCallback(() => {
    if (!tutorialActive) return;
    if (tutorialCelebrationVisible) return;
    if (!tutorialCanAdvance) return;
    if (safeTutorialStepIndex >= tutorialStepsCount - 1) {
      showTutorialCelebration();
      return;
    }
    if (tutorialStep?.id === "search") {
      dismissTutorialSearchDropdown();
    }
    advanceTutorialStep();
  }, [
    advanceTutorialStep,
    dismissTutorialSearchDropdown,
    safeTutorialStepIndex,
    tutorialActive,
    tutorialCanAdvance,
    tutorialCelebrationVisible,
    tutorialStep,
    tutorialStepsCount,
    showTutorialCelebration,
  ]);

  const handlePrevTutorialStep = useCallback(() => {
    if (!tutorialActive) return;
    if (tutorialCelebrationVisible) return;
    setTutorialStepIndex((prev) => clamp(prev - 1, 0, tutorialStepsCount - 1));
    setTutorialAnchorFound(false);
    setTutorialAnchorRect(null);
  }, [tutorialActive, tutorialCelebrationVisible, tutorialStepsCount]);

  useEffect(() => {
    if (initialUrl === currentUrl) return;
    applySourceUrl(initialUrl);
  }, [applySourceUrl, currentUrl, initialUrl]);

  useEffect(() => {
    if (!tutorialVisible) {
      setTutorialKeyboardInset(0);
      return;
    }

    const updateKeyboardInset = (event?: RNKeyboardEvent) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 0;
      const adjustedInset = Math.max(0, keyboardHeight - insets.bottom);
      setTutorialKeyboardInset(adjustedInset);
    };

    const handleHide = () => {
      setTutorialKeyboardInset(0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const changeFrameEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : undefined;

    const showSub = Keyboard.addListener(showEvent, updateKeyboardInset);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);
    const frameSub = changeFrameEvent
      ? Keyboard.addListener(changeFrameEvent, updateKeyboardInset)
      : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [insets.bottom, tutorialVisible]);

  useEffect(() => {
    if (!tutorialVisible) return;
    setTutorialStepIndex(0);
    setTutorialAnchorFound(false);
    setTutorialAnchorRect(null);
    setTutorialCompletionReady(false);
    setTutorialSearchValueLength(0);
    setTutorialCelebrationVisible(false);
    setPreviousAvatarPose(null);
    setAvatarPose("idle");
    tutorialAvatarPoseBlend.setValue(1);
    tutorialAvatarHasPositionRef.current = false;
    tutorialSpotlightHasRectRef.current = false;
  }, [tutorialAvatarPoseBlend, tutorialVisible]);

  useEffect(() => {
    if (!tutorialVisible) return;
    setTutorialCompletionReady(false);
    setTutorialSearchValueLength(0);
  }, [safeTutorialStepIndex, tutorialVisible]);

  useEffect(() => {
    if (
      !tutorialVisible ||
      tutorialCelebrationVisible ||
      !tutorialStep ||
      !tutorialAutoAdvanceOnComplete
    ) {
      tutorialAutoAdvanceScheduledKeyRef.current = null;
      if (tutorialAutoAdvanceTimerRef.current) {
        clearTimeout(tutorialAutoAdvanceTimerRef.current);
        tutorialAutoAdvanceTimerRef.current = null;
      }
      return;
    }
    const stepKey = `${safeTutorialStepIndex}:${tutorialStep.id}`;
    if (!tutorialCanAdvance) {
      if (tutorialAutoAdvanceScheduledKeyRef.current === stepKey) {
        tutorialAutoAdvanceScheduledKeyRef.current = null;
      }
      if (tutorialAutoAdvanceTimerRef.current) {
        clearTimeout(tutorialAutoAdvanceTimerRef.current);
        tutorialAutoAdvanceTimerRef.current = null;
      }
      return;
    }
    if (tutorialAutoAdvanceScheduledKeyRef.current === stepKey) {
      return;
    }
    tutorialAutoAdvanceScheduledKeyRef.current = stepKey;
    if (tutorialAutoAdvanceTimerRef.current) {
      clearTimeout(tutorialAutoAdvanceTimerRef.current);
      tutorialAutoAdvanceTimerRef.current = null;
    }
    tutorialAutoAdvanceTimerRef.current = setTimeout(() => {
      tutorialAutoAdvanceTimerRef.current = null;
      tutorialAutoAdvanceScheduledKeyRef.current = null;
      if (safeTutorialStepIndex >= tutorialStepsCount - 1) {
        showTutorialCelebration();
        return;
      }
      if (tutorialStep.id === "search") {
        dismissTutorialSearchDropdown();
      }
      advanceTutorialStep();
    }, TUTORIAL_AUTO_ADVANCE_DELAY_MS);
  }, [
    advanceTutorialStep,
    dismissTutorialSearchDropdown,
    safeTutorialStepIndex,
    tutorialAutoAdvanceOnComplete,
    tutorialCanAdvance,
    tutorialCelebrationVisible,
    tutorialStep,
    tutorialStepsCount,
    tutorialVisible,
    showTutorialCelebration,
  ]);

  useEffect(() => {
    return () => {
      if (tutorialAutoAdvanceTimerRef.current) {
        clearTimeout(tutorialAutoAdvanceTimerRef.current);
        tutorialAutoAdvanceTimerRef.current = null;
      }
      tutorialAutoAdvanceScheduledKeyRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearInitialLoadProbeTimers();
    };
  }, [clearInitialLoadProbeTimers]);

  useEffect(() => {
    if (!tutorialActive || !hasLoadedOnce || loading || Boolean(error)) return;
    probeTutorialReady();
    const firstProbe = setTimeout(() => probeTutorialReady(), 180);
    const secondProbe = setTimeout(() => probeTutorialReady(), 700);
    const readyFallback = setTimeout(() => {
      setTutorialDomReady(true);
    }, 2200);
    return () => {
      clearTimeout(firstProbe);
      clearTimeout(secondProbe);
      clearTimeout(readyFallback);
    };
  }, [currentUrl, error, hasLoadedOnce, loading, probeTutorialReady, tutorialActive]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible || !tutorialActiveSelector) return;
    ensureTutorialAnchorVisible(tutorialActiveSelector);
    probeTutorialAnchor(tutorialActiveSelector);
    const firstProbe = setTimeout(() => {
      probeTutorialAnchor(tutorialActiveSelector);
    }, 120);
    const secondProbe = setTimeout(() => {
      probeTutorialAnchor(tutorialActiveSelector);
    }, 460);
    const lateProbe = setTimeout(() => {
      probeTutorialAnchor(tutorialActiveSelector);
    }, 980);
    return () => {
      clearTimeout(firstProbe);
      clearTimeout(secondProbe);
      clearTimeout(lateProbe);
    };
  }, [
    ensureTutorialAnchorVisible,
    hasLoadedOnce,
    probeTutorialAnchor,
    tutorialActiveSelector,
    tutorialStepOverlayVisible,
    currentUrl,
  ]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible) return;
    if (tutorialCompletionMode === "search-input" && tutorialActiveCompletionSelector) {
      armTutorialSearchProgress(tutorialActiveCompletionSelector);
      const retry = setTimeout(() => {
        armTutorialSearchProgress(tutorialActiveCompletionSelector);
      }, 360);
      return () => {
        clearTimeout(retry);
      };
    }
    if (tutorialCompletionMode === "target-touch" && tutorialActiveCompletionSelector) {
      armTutorialTargetProgress(tutorialActiveCompletionSelector);
      const retry = setTimeout(() => {
        armTutorialTargetProgress(tutorialActiveCompletionSelector);
      }, 360);
      const lateRetry = setTimeout(() => {
        armTutorialTargetProgress(tutorialActiveCompletionSelector);
      }, 980);
      return () => {
        clearTimeout(retry);
        clearTimeout(lateRetry);
      };
    }
    return;
  }, [
    armTutorialSearchProgress,
    armTutorialTargetProgress,
    tutorialActiveCompletionSelector,
    tutorialCompletionMode,
    tutorialStepOverlayVisible,
  ]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible) return;
    if (!tutorialShouldForceOndaPanelOpen) return;
    ensureTutorialOndaPanelVisible();
    const retry = setTimeout(() => {
      ensureTutorialOndaPanelVisible();
    }, 200);
    return () => {
      clearTimeout(retry);
    };
  }, [
    ensureTutorialOndaPanelVisible,
    tutorialShouldForceOndaPanelOpen,
    tutorialStepOverlayVisible,
  ]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible || tutorialStep?.id !== "premi") return;
    ensureNavTabActive('[data-testid="bottom-nav-rewards"]');
    const retry = setTimeout(() => {
      ensureNavTabActive('[data-testid="bottom-nav-rewards"]');
    }, 280);
    return () => {
      clearTimeout(retry);
    };
  // tutorialStepOverlayVisible intentionally omitted: kept as early-return guard only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureNavTabActive, tutorialStep?.id]);

  useEffect(() => {
    const id = tutorialStep?.id;
    if (!tutorialStepOverlayVisible || id === "onda" || id === "premi") return;
    // Reset to map tab whenever a non-navigation step is active (handles back-navigation).
    ensureNavTabActive('[data-testid="bottom-nav-map"]');
  // tutorialStepOverlayVisible intentionally omitted: early-return only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureNavTabActive, tutorialStep?.id]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    tutorialCardProgress.stopAnimation((currentValue) => {
      if (cancelled) return;
      const fromValue = clamp(
        currentValue * 0.9,
        TUTORIAL_CARD_TRANSITION_FROM,
        1,
      );
      tutorialCardProgress.setValue(fromValue);
      animation = Animated.timing(tutorialCardProgress, {
        toValue: 1,
        duration: TUTORIAL_CARD_TRANSITION_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      cancelled = true;
      if (animation) {
        animation.stop();
      }
    };
  }, [safeTutorialStepIndex, tutorialCardProgress, tutorialStepOverlayVisible]);

  useEffect(() => {
    if (!tutorialVisible || !tutorialCelebrationVisible) {
      tutorialCelebrationProgress.setValue(0);
      return;
    }
    tutorialCelebrationProgress.setValue(0);
    const animation = Animated.timing(tutorialCelebrationProgress, {
      toValue: 1,
      duration: TUTORIAL_CARD_TRANSITION_MS,
      easing: TUTORIAL_TRANSITION_EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [tutorialCelebrationProgress, tutorialCelebrationVisible, tutorialVisible]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible || effectiveAvatarPose === avatarPose) return;
    setPreviousAvatarPose(avatarPose);
    setAvatarPose(effectiveAvatarPose);
    tutorialAvatarPoseBlend.setValue(0);
    const animation = Animated.timing(tutorialAvatarPoseBlend, {
      toValue: 1,
      duration: TUTORIAL_AVATAR_CROSSFADE_MS,
      easing: TUTORIAL_TRANSITION_EASING,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setPreviousAvatarPose(null);
      }
    });
    return () => {
      animation.stop();
    };
  }, [
    avatarPose,
    effectiveAvatarPose,
    tutorialStepOverlayVisible,
    tutorialAvatarPoseBlend,
  ]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible) return;
    const shouldHoldForAnchor = Boolean(tutorialActiveSelector) && !tutorialAnchorFound;
    if (!tutorialAvatarHasPositionRef.current) {
      tutorialAvatarX.setValue(tutorialAvatarTarget.x);
      tutorialAvatarY.setValue(tutorialAvatarTarget.y);
      tutorialAvatarTilt.setValue(tutorialAvatarTarget.tilt);
      tutorialAvatarHasPositionRef.current = true;
      return;
    }
    if (shouldHoldForAnchor) return;
    const animation = Animated.parallel([
      Animated.timing(tutorialAvatarX, {
        toValue: tutorialAvatarTarget.x,
        duration: TUTORIAL_AVATAR_MOVE_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(tutorialAvatarY, {
        toValue: tutorialAvatarTarget.y,
        duration: TUTORIAL_AVATAR_MOVE_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(tutorialAvatarTilt, {
        toValue: tutorialAvatarTarget.tilt,
        duration: TUTORIAL_AVATAR_MOVE_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [
    tutorialActiveSelector,
    tutorialAnchorFound,
    tutorialStepOverlayVisible,
    tutorialAvatarTarget,
    tutorialAvatarTilt,
    tutorialAvatarX,
    tutorialAvatarY,
  ]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(tutorialAvatarFloat, {
          toValue: -2.6,
          duration: 1550,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tutorialAvatarFloat, {
          toValue: 0,
          duration: 1650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [tutorialAvatarFloat, tutorialStepOverlayVisible]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible || !tutorialSpotlightVisible) return;
    tutorialPulse.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(tutorialPulse, {
          toValue: 1,
          duration: 1120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(tutorialPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [tutorialPulse, tutorialSpotlightVisible, tutorialStepOverlayVisible]);

  useEffect(() => {
    if (!tutorialStepOverlayVisible || !tutorialSpotlightVisible || !tutorialSpotlightRect) {
      tutorialSpotlightHasRectRef.current = false;
      return;
    }
    const shouldHoldForAnchor = Boolean(tutorialActiveSelector) && !tutorialAnchorFound;
    if (!tutorialSpotlightHasRectRef.current) {
      tutorialSpotlightX.setValue(tutorialSpotlightRect.x);
      tutorialSpotlightY.setValue(tutorialSpotlightRect.y);
      tutorialSpotlightWidth.setValue(tutorialSpotlightRect.width);
      tutorialSpotlightHeight.setValue(tutorialSpotlightRect.height);
      tutorialSpotlightHasRectRef.current = true;
      return;
    }
    if (shouldHoldForAnchor) return;
    const animation = Animated.parallel([
      Animated.timing(tutorialSpotlightX, {
        toValue: tutorialSpotlightRect.x,
        duration: TUTORIAL_SPOTLIGHT_TRANSITION_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: false,
      }),
      Animated.timing(tutorialSpotlightY, {
        toValue: tutorialSpotlightRect.y,
        duration: TUTORIAL_SPOTLIGHT_TRANSITION_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: false,
      }),
      Animated.timing(tutorialSpotlightWidth, {
        toValue: tutorialSpotlightRect.width,
        duration: TUTORIAL_SPOTLIGHT_TRANSITION_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: false,
      }),
      Animated.timing(tutorialSpotlightHeight, {
        toValue: tutorialSpotlightRect.height,
        duration: TUTORIAL_SPOTLIGHT_TRANSITION_MS,
        easing: TUTORIAL_TRANSITION_EASING,
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [
    tutorialActiveSelector,
    tutorialAnchorFound,
    tutorialSpotlightHeight,
    tutorialSpotlightRect,
    tutorialStepOverlayVisible,
    tutorialSpotlightVisible,
    tutorialSpotlightWidth,
    tutorialSpotlightX,
    tutorialSpotlightY,
  ]);

  const tutorialCardTransform = {
    opacity: tutorialCardProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1],
    }),
    transform: [
      {
        translateY: tutorialCardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: tutorialCardProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.995, 1],
        }),
      },
    ],
  };
  const tutorialCelebrationCardTransform = {
    opacity: tutorialCelebrationProgress,
    transform: [
      {
        translateY: tutorialCelebrationProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
      {
        scale: tutorialCelebrationProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const tutorialPulseStyle = {
    opacity: tutorialPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0],
    }),
    transform: [
      {
        scale: tutorialPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.07],
        }),
      },
    ],
  };
  const tutorialAvatarRotate = tutorialAvatarTilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-4deg", "4deg"],
  });
  const tutorialAvatarTranslateY = useMemo(
    () => Animated.add(tutorialAvatarY, tutorialAvatarFloat),
    [tutorialAvatarFloat, tutorialAvatarY],
  );
  const tutorialAvatarCurrentOpacity = previousAvatarPose
    ? tutorialAvatarPoseBlend
    : 1;
  const tutorialAvatarPreviousOpacity = tutorialAvatarPoseBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const tutorialOverlayWidth = surfaceSize.width > 0 ? surfaceSize.width : 390;
  const tutorialOverlayHeight = surfaceSize.height > 0 ? surfaceSize.height : 844;
  const tutorialHoleRect =
    tutorialSpotlightVisible && tutorialSpotlightRect
      ? {
          x: clamp(tutorialSpotlightRect.x, 0, tutorialOverlayWidth),
          y: clamp(tutorialSpotlightRect.y, 0, tutorialOverlayHeight),
          width: clamp(tutorialSpotlightRect.width, 0, tutorialOverlayWidth),
          height: clamp(tutorialSpotlightRect.height, 0, tutorialOverlayHeight),
        }
      : null;
  const tutorialSpotlightCornerRadius = tutorialHoleRect
    ? clamp(
        tutorialSpotlightProfile.radius,
        0,
        Math.min(tutorialHoleRect.width, tutorialHoleRect.height) / 2,
      )
    : tutorialSpotlightProfile.radius;
  const tutorialSpotlightPulseCornerRadius = tutorialHoleRect
    ? clamp(
        tutorialSpotlightProfile.pulseRadius,
        0,
        Math.min(tutorialHoleRect.width, tutorialHoleRect.height) / 2,
      )
    : tutorialSpotlightProfile.pulseRadius;
  const tutorialBackdropSegments = useMemo(() => {
    if (!tutorialHoleRect) return null;
    const holeLeft = tutorialHoleRect.x;
    const holeTop = tutorialHoleRect.y;
    const holeRight = clamp(
      tutorialHoleRect.x + tutorialHoleRect.width,
      0,
      tutorialOverlayWidth,
    );
    const holeBottom = clamp(
      tutorialHoleRect.y + tutorialHoleRect.height,
      0,
      tutorialOverlayHeight,
    );
    return [
      { key: "top", left: 0, top: 0, width: tutorialOverlayWidth, height: Math.max(0, holeTop) },
      {
        key: "left",
        left: 0,
        top: holeTop,
        width: Math.max(0, holeLeft),
        height: Math.max(0, holeBottom - holeTop),
      },
      {
        key: "right",
        left: holeRight,
        top: holeTop,
        width: Math.max(0, tutorialOverlayWidth - holeRight),
        height: Math.max(0, holeBottom - holeTop),
      },
      {
        key: "bottom",
        left: 0,
        top: holeBottom,
        width: tutorialOverlayWidth,
        height: Math.max(0, tutorialOverlayHeight - holeBottom),
      },
    ];
  }, [tutorialHoleRect, tutorialOverlayHeight, tutorialOverlayWidth]);
  const tutorialBackdropVisualSegments = useMemo(() => {
    if (!tutorialHoleRect) return null;
    // Pixel-align backdrop geometry to avoid seam lines from fractional coordinates.
    const holeLeft = Math.round(tutorialHoleRect.x);
    const holeTop = Math.round(tutorialHoleRect.y);
    const holeRight = Math.round(tutorialHoleRect.x + tutorialHoleRect.width);
    const holeBottom = Math.round(tutorialHoleRect.y + tutorialHoleRect.height);
    const holeWidth = Math.max(0, holeRight - holeLeft);
    const holeHeight = Math.max(0, holeBottom - holeTop);

    if (holeWidth <= 0 || holeHeight <= 0) return null;

    const maxRadius = Math.min(tutorialSpotlightCornerRadius, holeWidth / 2, holeHeight / 2);
    const cornerRadius = Math.round(clamp(maxRadius, 0, Math.min(holeWidth, holeHeight) / 2));
    const bandTop = holeTop + cornerRadius;
    const bandBottom = holeBottom - cornerRadius;
    const segments: Array<{ key: string; left: number; top: number; width: number; height: number }> = [
      { key: "top", left: 0, top: 0, width: tutorialOverlayWidth, height: Math.max(0, holeTop) },
      {
        key: "bottom",
        left: 0,
        top: holeBottom,
        width: tutorialOverlayWidth,
        height: Math.max(0, tutorialOverlayHeight - holeBottom),
      },
    ];

    if (cornerRadius <= 0) {
      segments.push(
        {
          key: "left",
          left: 0,
          top: holeTop,
          width: Math.max(0, holeLeft),
          height: Math.max(0, holeBottom - holeTop),
        },
        {
          key: "right",
          left: holeRight,
          top: holeTop,
          width: Math.max(0, tutorialOverlayWidth - holeRight),
          height: Math.max(0, holeBottom - holeTop),
        },
      );
      return segments;
    }

    if (bandBottom > bandTop) {
      segments.push(
        {
          key: "left-mid",
          left: 0,
          top: bandTop,
          width: Math.max(0, holeLeft),
          height: Math.max(0, bandBottom - bandTop),
        },
        {
          key: "right-mid",
          left: holeRight,
          top: bandTop,
          width: Math.max(0, tutorialOverlayWidth - holeRight),
          height: Math.max(0, bandBottom - bandTop),
        },
      );
    }

    const arcSlices = Math.max(8, Math.min(24, cornerRadius));
    for (let i = 0; i < arcSlices; i += 1) {
      const rowTop = Math.round(holeTop + (i * cornerRadius) / arcSlices);
      const rowBottom = Math.round(holeTop + ((i + 1) * cornerRadius) / arcSlices);
      const rowHeight = Math.max(0, rowBottom - rowTop);
      if (rowHeight <= 0) continue;

      const localY = (i + 0.5) * (cornerRadius / arcSlices);
      const verticalDistance = cornerRadius - localY;
      const inset = cornerRadius - Math.sqrt(Math.max(0, cornerRadius ** 2 - verticalDistance ** 2));
      const leftBoundary = Math.round(holeLeft + inset);
      const rightBoundary = Math.round(holeRight - inset);
      const bottomRowTop = holeBottom - (rowTop - holeTop) - rowHeight;

      segments.push(
        {
          key: `top-left-${i}`,
          left: 0,
          top: rowTop,
          width: Math.max(0, leftBoundary),
          height: rowHeight,
        },
        {
          key: `top-right-${i}`,
          left: rightBoundary,
          top: rowTop,
          width: Math.max(0, tutorialOverlayWidth - rightBoundary),
          height: rowHeight,
        },
      );

      if (bottomRowTop >= bandBottom && rowHeight > 0) {
        segments.push(
          {
            key: `bottom-left-${i}`,
            left: 0,
            top: bottomRowTop,
            width: Math.max(0, leftBoundary),
            height: rowHeight,
          },
          {
            key: `bottom-right-${i}`,
            left: rightBoundary,
            top: bottomRowTop,
            width: Math.max(0, tutorialOverlayWidth - rightBoundary),
            height: rowHeight,
          },
        );
      }
    }

    return segments;
  }, [
    tutorialHoleRect,
    tutorialOverlayHeight,
    tutorialOverlayWidth,
    tutorialSpotlightCornerRadius,
  ]);
  const tutorialAllowsSpotlightInteraction =
    tutorialStepRequiresInteraction && Boolean(tutorialHoleRect && tutorialBackdropSegments);
  const showBlockingInitialBootLayer = !initialPresentationReady && !error;
  const showInlineLoadingBadge =
    loading && hasLoadedOnce && !error && initialPresentationReady;

  return (
    <View style={styles.container} onLayout={handleSurfaceLayout}>
      <View
        pointerEvents="none"
        style={[
          styles.statusBarScrim,
          { height: statusBarOverlayHeight },
        ]}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Connessione non disponibile</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={handleReload}>
            <Text style={styles.primaryButtonLabel}>Riprova</Text>
          </Pressable>
        </View>
      ) : null}

      <WebView
        ref={webViewRef}
        source={source}
        injectedJavaScriptBeforeContentLoaded={"window.__W2B_NATIVE_SHELL = true; true;"}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
          setTutorialDomReady(false);
        }}
        onLoadEnd={() => {
          setLoading(false);
          setHasLoadedOnce(true);
          retryAttemptRef.current = 0;
          if (!initialLoadSettledRef.current) {
            armInitialLoadSettlementProbe();
            return;
          }
          notifyInitialLoadSettled();
        }}
        onError={handleWebError}
        onHttpError={handleWebHttpError}
        onMessage={handleWebMessage}
        onOpenWindow={(event) => {
          const targetUrl = event.nativeEvent.targetUrl?.trim();
          if (!targetUrl) return;
          openExternalUrl(targetUrl);
        }}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        style={styles.webview}
      />

      {showBlockingInitialBootLayer ? (
        <View style={styles.initialBootLayer} pointerEvents="none">
          <Image
            source={require("../../assets/splash-icon.png")}
            style={styles.initialBootLogo}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {showInlineLoadingBadge ? (
        <View style={styles.loadingInlineWrap} pointerEvents="none">
          <View style={styles.loadingInlineBadge}>
            <Image
              source={require("../../assets/android-icon-foreground.png")}
              style={styles.loadingInlineLogo}
              resizeMode="contain"
            />
            <Text style={styles.loadingInlineLabel}>Aggiornamento…</Text>
          </View>
        </View>
      ) : null}

      {tutorialVisible ? (
        <View style={styles.tutorialOverlay} pointerEvents="box-none">
          {tutorialCelebrationVisible ? (
            <>
              <Pressable style={styles.tutorialBackdropTouch} onPress={() => undefined} />
              <View style={styles.tutorialBackdropLayer} pointerEvents="none">
                <View style={styles.tutorialBackdropFallback} />
              </View>
              <View style={styles.tutorialCelebrationContent} pointerEvents="box-none">
                <Animated.View
                  style={[styles.tutorialCelebrationCard, tutorialCelebrationCardTransform]}
                >
                  <View style={styles.tutorialCelebrationFlag}>
                    <Text style={styles.tutorialCelebrationFlagLabel}>{ts.celebrationFlag}</Text>
                  </View>
                  <Image
                    source={ONDA_POSE_ASSETS.celebrate}
                    style={styles.tutorialCelebrationMascot}
                    resizeMode="contain"
                  />
                  <Text style={styles.tutorialCelebrationTitle}>
                    Fatto! Sei pronto a esplorare.
                  </Text>
                  <Text style={styles.tutorialCelebrationBody}>
                    Cerca la spiaggia giusta, segnala l'affollamento e guadagna punti nel tab Premi. Buona spiaggia!
                  </Text>
                  <Pressable
                    style={styles.tutorialCelebrationButton}
                    onPress={handleFinishTutorial}
                  >
                    <Text style={styles.tutorialCelebrationButtonLabel}>{ts.celebrationCta}</Text>
                  </Pressable>
                </Animated.View>
              </View>
            </>
          ) : tutorialStep ? (
            <>
              {tutorialAllowsSpotlightInteraction && tutorialBackdropSegments ? (
                tutorialBackdropSegments.map((segment) => (
                  <Pressable
                    key={`touch-${segment.key}`}
                    style={[
                      styles.tutorialTouchGuardSegment,
                      {
                        left: segment.left,
                        top: segment.top,
                        width: segment.width,
                        height: segment.height,
                      },
                    ]}
                    onPress={() => undefined}
                  />
                ))
              ) : (
                <Pressable style={styles.tutorialBackdropTouch} onPress={() => undefined} />
              )}
              <View style={styles.tutorialBackdropLayer} pointerEvents="none">
                {tutorialBackdropVisualSegments ? (
                  tutorialBackdropVisualSegments.map((segment) => (
                    <View
                      key={segment.key}
                      style={[
                        styles.tutorialBackdropSegment,
                        tutorialOndaPanelPriority ? styles.tutorialBackdropSegmentSoft : null,
                        {
                          left: segment.left,
                          top: segment.top,
                          width: segment.width,
                          height: segment.height,
                        },
                      ]}
                    />
                  ))
                ) : (
                      <View
                        style={[
                          styles.tutorialBackdropFallback,
                          tutorialOndaPanelPriority ? styles.tutorialBackdropFallbackExtraSoft : null,
                          !tutorialSpotlightVisible ? styles.tutorialBackdropFallbackSoft : null,
                        ]}
                  />
                )}
              </View>
              {tutorialUsesSyntheticTargetTap &&
              tutorialActiveCompletionSelector &&
              tutorialHoleRect ? (
                <Pressable
                  style={[
                    styles.tutorialSpotlightTapTarget,
                    { borderRadius: tutorialSpotlightCornerRadius },
                    {
                      left: tutorialHoleRect.x,
                      top: tutorialHoleRect.y,
                      width: tutorialHoleRect.width,
                      height: tutorialHoleRect.height,
                    },
                  ]}
                  hitSlop={6}
                  onPress={() => {
                    triggerTutorialTargetTap(tutorialActiveCompletionSelector);
                  }}
                />
              ) : null}

              {tutorialSpotlightVisible ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.tutorialSpotlightPulse,
                      tutorialPulseStyle,
                      { borderRadius: tutorialSpotlightPulseCornerRadius },
                      {
                        left: tutorialSpotlightX,
                        top: tutorialSpotlightY,
                        width: tutorialSpotlightWidth,
                        height: tutorialSpotlightHeight,
                      },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.tutorialSpotlight,
                      { borderRadius: tutorialSpotlightCornerRadius },
                      {
                        left: tutorialSpotlightX,
                        top: tutorialSpotlightY,
                        width: tutorialSpotlightWidth,
                        height: tutorialSpotlightHeight,
                      },
                    ]}
                  />
                </>
              ) : null}

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tutorialAvatarWrap,
                  tutorialOndaPanelPriority ? styles.tutorialAvatarWrapDimmed : null,
                  {
                    transform: [
                      { translateX: tutorialAvatarX },
                      { translateY: tutorialAvatarTranslateY },
                      { rotate: tutorialAvatarRotate },
                    ],
                  },
                ]}
              >
                {previousAvatarPose ? (
                  <Animated.Image
                    source={ONDA_POSE_ASSETS[previousAvatarPose]}
                    style={[styles.tutorialAvatar, { opacity: tutorialAvatarPreviousOpacity }]}
                    resizeMode="contain"
                  />
                ) : null}
                <Animated.Image
                  source={currentAvatarAsset}
                  style={[styles.tutorialAvatar, { opacity: tutorialAvatarCurrentOpacity }]}
                  resizeMode="contain"
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.tutorialCard,
                  tutorialCompactCard ? styles.tutorialCardCompact : null,
                  tutorialIsDoneStep ? styles.tutorialCardFinal : null,
                  tutorialCardTransform,
                  tutorialCardAtTop
                    ? { top: Math.max(statusBarOverlayHeight + 14, 20) }
                    : { bottom: tutorialCardBottomOffset },
                ]}
              >
                {tutorialIsDoneStep ? (
                  <View style={styles.tutorialFinalBadge}>
                    <Text style={styles.tutorialFinalBadgeLabel}>{ts.missionComplete}</Text>
                  </View>
                ) : null}
                <Text style={styles.tutorialEyebrow}>
                  {ts.stepOf(safeTutorialStepIndex + 1, tutorialStepsCount)}
                </Text>
                <Text style={[styles.tutorialTitle, tutorialCompactCard ? styles.tutorialTitleCompact : null]}>
                  {tutorialStep.title}
                </Text>
                <Text style={[styles.tutorialBody, tutorialCompactCard ? styles.tutorialBodyCompact : null]}>
                  {tutorialBodyText}
                </Text>

                {!tutorialCompactCard ? (
                  <View style={styles.tutorialDots}>
                    {tutorialSteps.map((step, index) => (
                      <View
                        key={step.id}
                        style={[
                          styles.tutorialDot,
                          index === safeTutorialStepIndex ? styles.tutorialDotActive : null,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}

                {tutorialStepRequiresInteraction ? (
                  <Text
                    style={[
                      styles.tutorialInteractionHint,
                      tutorialStepCompleted ? styles.tutorialInteractionHintDone : null,
                    ]}
                  >
                    {tutorialStepCompleted
                      ? tutorialAutoAdvanceOnComplete
                        ? ts.completionAutoAdvance
                        : ts.completionManual
                      : tutorialInteractionHintText}
                  </Text>
                ) : null}

                {tutorialAutoAdvanceOnComplete ? (
                  <Text style={styles.tutorialAutoAdvanceHint}>
                    {tutorialCanAdvance ? "Azione rilevata, proseguo..." : "Esegui il tap indicato per proseguire."}
                  </Text>
                ) : (
                  <View style={styles.tutorialButtonsRow}>
                    {safeTutorialStepIndex > 0 ? (
                      <Pressable style={styles.tutorialGhostButton} onPress={handlePrevTutorialStep}>
                        <Text style={styles.tutorialGhostButtonLabel}>Indietro</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.tutorialGhostButtonPlaceholder} />
                    )}
                    <Pressable
                      style={[
                        styles.tutorialPrimaryButton,
                        !tutorialCanAdvance && !tutorialIsDoneStep ? styles.tutorialPrimaryButtonDisabled : null,
                      ]}
                      onPress={handleNextTutorialStep}
                      disabled={!tutorialCanAdvance && !tutorialIsDoneStep}
                    >
                      <Text style={styles.tutorialPrimaryButtonLabel}>{tutorialPrimaryLabel}</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable style={styles.tutorialSkipButton} onPress={handleFinishTutorial}>
                  <Text style={styles.tutorialSkipButtonLabel}>{ts.skip}</Text>
                </Pressable>
              </Animated.View>
            </>
          ) : (
            <Pressable
              style={styles.tutorialBackdropTouch}
              onPress={() => undefined}
            />
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  statusBarScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(2, 6, 23, 0.52)",
    zIndex: 5,
  },
  webview: {
    flex: 1,
    backgroundColor: "#020617",
  },
  initialBootLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    zIndex: 12,
  },
  initialBootLogo: {
    width: INITIAL_BOOT_LOGO_SIZE,
    height: INITIAL_BOOT_LOGO_SIZE,
  },
  loadingInlineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
    zIndex: 9,
  },
  loadingInlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(2, 6, 23, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  loadingInlineLogo: {
    width: 22,
    height: 22,
  },
  loadingInlineLabel: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBox: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: "#fecaca",
    fontWeight: "700",
    fontSize: 14,
  },
  errorBody: {
    color: "#fee2e2",
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  tutorialBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  tutorialTouchGuardSegment: {
    position: "absolute",
  },
  tutorialBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tutorialBackdropSegment: {
    position: "absolute",
    backgroundColor: "rgba(2, 6, 23, 0.4)",
  },
  tutorialBackdropSegmentSoft: {
    backgroundColor: "rgba(2, 6, 23, 0.16)",
  },
  tutorialBackdropFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.34)",
  },
  tutorialBackdropFallbackExtraSoft: {
    backgroundColor: "rgba(2, 6, 23, 0.14)",
  },
  tutorialBackdropFallbackSoft: {
    backgroundColor: "rgba(2, 6, 23, 0.24)",
  },
  tutorialSpotlight: {
    position: "absolute",
    borderWidth: 2.4,
    borderColor: "rgba(56, 189, 248, 0.96)",
    backgroundColor: "rgba(56, 189, 248, 0.07)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tutorialSpotlightPulse: {
    position: "absolute",
    borderWidth: 2.2,
    borderColor: "rgba(125, 211, 252, 0.92)",
    backgroundColor: "transparent",
  },
  tutorialSpotlightTapTarget: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  tutorialAvatarWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    width: TUTORIAL_AVATAR_SIZE,
    height: TUTORIAL_AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialAvatarWrapDimmed: {
    opacity: 0.08,
  },
  tutorialAvatar: {
    position: "absolute",
    width: TUTORIAL_AVATAR_SIZE,
    height: TUTORIAL_AVATAR_SIZE,
  },
  tutorialCelebrationContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  tutorialCelebrationCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.54)",
    backgroundColor: "rgba(4, 24, 39, 0.95)",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#020617",
    shadowOpacity: 0.62,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  tutorialCelebrationFlag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.72)",
    backgroundColor: "rgba(45, 212, 191, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tutorialCelebrationFlagLabel: {
    color: "#99f6e4",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  tutorialCelebrationMascot: {
    width: 178,
    height: 178,
    marginTop: -2,
    marginBottom: -4,
  },
  tutorialCelebrationTitle: {
    color: "#f0f9ff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.35,
    textAlign: "center",
    lineHeight: 30,
  },
  tutorialCelebrationBody: {
    color: "#a5f3fc",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
  },
  tutorialCelebrationButton: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#14b8a6",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  tutorialCelebrationButtonLabel: {
    color: "#042f2e",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  tutorialCard: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.35)",
    backgroundColor: "rgba(7, 20, 38, 0.92)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: "#020617",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    gap: 10,
  },
  tutorialCardCompact: {
    left: 18,
    right: 18,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
    backgroundColor: "rgba(7, 20, 38, 0.82)",
  },
  tutorialCardFinal: {
    borderColor: "rgba(45, 212, 191, 0.5)",
    backgroundColor: "rgba(4, 22, 34, 0.94)",
  },
  tutorialFinalBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.6)",
    backgroundColor: "rgba(45, 212, 191, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tutorialFinalBadgeLabel: {
    color: "#99f6e4",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  tutorialEyebrow: {
    color: "rgba(165, 243, 252, 0.95)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  tutorialTitle: {
    color: "#f0f9ff",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  tutorialTitleCompact: {
    fontSize: 17,
    letterSpacing: -0.15,
  },
  tutorialBody: {
    color: "#bae6fd",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  tutorialBodyCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  tutorialDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  tutorialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(186, 230, 253, 0.28)",
  },
  tutorialDotActive: {
    width: 18,
    borderRadius: 5,
    backgroundColor: "#22d3ee",
  },
  tutorialInteractionHint: {
    color: "#67e8f9",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: -1,
  },
  tutorialInteractionHintDone: {
    color: "#5eead4",
  },
  tutorialAutoAdvanceHint: {
    color: "#67e8f9",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  tutorialButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  tutorialGhostButtonPlaceholder: {
    flex: 1,
  },
  tutorialGhostButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialGhostButtonLabel: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  tutorialPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#06b6d4",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialPrimaryButtonDisabled: {
    backgroundColor: "rgba(8, 145, 178, 0.38)",
  },
  tutorialPrimaryButtonLabel: {
    color: "#042f2e",
    fontSize: 13,
    fontWeight: "800",
  },
  tutorialSkipButton: {
    marginTop: 1,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tutorialSkipButtonLabel: {
    color: "rgba(191, 219, 254, 0.88)",
    fontSize: 12,
    fontWeight: "600",
  },
});
