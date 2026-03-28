import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import type { BeachWithStats } from "../lib/types";
import { STRINGS } from "../i18n/it";
import BottomNav from "./BottomNav";
import {
  formatConfidenceInline,
  formatDistanceLabel,
  formatMinutesAgo,
  formatReportCount,
  formatStateLabel,
} from "../lib/format";
import { askChatbot, type ChatbotMessage } from "../lib/chatbot";
import { isPerfEnabled, useRenderCounter } from "../lib/perf";
import {
  INTEREST_OPTIONS,
  type InterestId,
  type PreferredLanguage,
  readInterests,
  readPreferredLanguage,
  writeInterests,
  writePreferredLanguage,
} from "../lib/accountPreferences";
import ondaAvatarCore from "../assets/chatbot/onda/onda-1.png";
import ondaAvatarHero from "../assets/chatbot/onda/onda-2.png";
import ondaAvatarWelcome from "../assets/chatbot/onda/onda-4.png";
import ondaAvatarThinking from "../assets/chatbot/onda/onda-5.png";

type BottomSheetProps = {
  beaches: BeachWithStats[];
  favoriteBeaches: BeachWithStats[];
  favoriteBeachIds: Set<string>;
  selectedBeachId: string | null;
  onSelectBeach: (beachId: string) => void;
  onToggleFavorite: (beachId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  now: number;
  hasLocation: boolean;
  nearbyRadiusKm: number;
  activeSection: BottomSheetSection;
  onSectionChange: (section: BottomSheetSection) => void;
  onBottomNavHeightChange?: (height: number) => void;
  onDragStateChange?: (active: boolean) => void;
  accountName: string | null;
  accountEmail: string | null;
  onOpenProfile: () => void;
  onOpenSignIn: () => void;
};

const PEEK_HEIGHT = 56;
const DRAG_THRESHOLD = 6;
const VELOCITY_THRESHOLD = 0.45;
const CLOSED_LIFT_PX = 34;
const CLOSED_VISIBLE_HEIGHT = PEEK_HEIGHT + CLOSED_LIFT_PX;
const CONTENT_MAX_VIEWPORT_RATIO = 0.62;
const MIN_CONTENT_DRAG_RANGE_PX = 240;
const DRAG_RANGE_OPEN_TO_CLOSE_PX = 220;
const DRAG_RANGE_CLOSE_TO_OPEN_PX = 290;
const OPEN_SNAP_THRESHOLD = 0.58;
export type BottomSheetSection = "map" | "profile" | "chatbot";

const stateBadge = (state: string) => {
  switch (state) {
    case "LIVE":
      return "bg-emerald-500/30 text-emerald-100 border-emerald-300/60";
    case "RECENT":
      return "bg-amber-400/30 text-amber-100 border-amber-300/60";
    default:
      return "bg-slate-400/25 text-slate-100 border-slate-300/50";
  }
};

type ChatMessageRow = {
  id: string;
  role: "assistant" | "user";
  content: string;
  source: "local" | "openai" | null;
  totalTokens: number | null;
};

const MAX_CHAT_MESSAGES = 12;
const MAX_CHAT_INPUT_CHARS = 420;
const PRIVACY_URL = "/privacy/";
const LANDING_URL = "/landing/";
const SUPPORT_EMAIL = "info@where2beach.com";
const SHARE_APP_URL = "https://where2beach.com/";
const DEFAULT_REVIEW_URL = "https://apps.apple.com/it/search?term=where2beach";
const APP_REVIEW_URL = import.meta.env.VITE_APP_REVIEW_URL?.trim() || DEFAULT_REVIEW_URL;

const ONDA_AVATARS = {
  core: ondaAvatarCore,
  hero: ondaAvatarHero,
  welcome: ondaAvatarWelcome,
  thinking: ondaAvatarThinking,
} as const;

const createMessageId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveOndaHeaderVisual = (
  chatSending: boolean,
  hasConversation: boolean,
) => {
  if (chatSending) {
    return {
      image: ONDA_AVATARS.thinking,
      statusLabel: "Sta scrivendo...",
    };
  }
  if (!hasConversation) {
    return {
      image: ONDA_AVATARS.welcome,
      statusLabel: "Online",
    };
  }
  return {
    image: ONDA_AVATARS.hero,
    statusLabel: "Online",
  };
};

type BeachRowProps = {
  beach: BeachWithStats;
  isSelected: boolean;
  isFavorite: boolean;
  now: number;
  onSelectBeach: (beachId: string) => void;
  onToggleFavorite: (beachId: string) => void;
};

const BeachRowComponent = ({
  beach,
  isSelected,
  isFavorite,
  now,
  onSelectBeach,
  onToggleFavorite,
}: BeachRowProps) => {
  const handleClick = useCallback(() => onSelectBeach(beach.id), [onSelectBeach, beach.id]);
  const handleToggleFavorite = useCallback(
    () => onToggleFavorite(beach.id),
    [beach.id, onToggleFavorite],
  );

  return (
    <div className="flex items-start gap-2 px-4 py-3">
      <button
        onClick={handleClick}
        className={`br-press min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
          isSelected ? "bg-white/5" : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateBadge(
              beach.state,
            )}`}
          >
            {formatStateLabel(beach.state)}
          </span>
          <span className="text-[11px] br-text-tertiary">
            {formatDistanceLabel(beach.distanceM)}
          </span>
        </div>
        <div className="mt-1.5 text-[15px] font-semibold br-text-primary">
          {beach.name}
        </div>
        <div className="text-[12px] br-text-secondary">{beach.region}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] br-text-tertiary">
          <span>{formatConfidenceInline(beach.confidence)}</span>
          <span>{formatMinutesAgo(beach.updatedAt, now)}</span>
          <span>
            {beach.state === "PRED"
              ? STRINGS.reports.noneRecent
              : formatReportCount(beach.reportsCount)}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={handleToggleFavorite}
        aria-label={STRINGS.aria.toggleFavoriteBeach(beach.name, isFavorite)}
        className={`br-press mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
          isFavorite
            ? "border-amber-300/55 bg-amber-400/20 text-amber-100"
            : "border-white/16 bg-black/30 br-text-tertiary"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 2.7l2.8 5.67 6.25.91-4.53 4.42 1.07 6.24L12 17.06 6.4 19.94l1.07-6.24-4.53-4.42 6.25-.91L12 2.7z" />
        </svg>
      </button>
    </div>
  );
};

const beachRowEqual = (prev: BeachRowProps, next: BeachRowProps) => {
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isFavorite !== next.isFavorite) return false;
  if (prev.now !== next.now) return false;
  if (prev.onSelectBeach !== next.onSelectBeach) return false;
  if (prev.onToggleFavorite !== next.onToggleFavorite) return false;
  const a = prev.beach;
  const b = next.beach;
  return (
    a.id === b.id &&
    a.state === b.state &&
    a.distanceM === b.distanceM &&
    a.name === b.name &&
    a.region === b.region &&
    a.confidence === b.confidence &&
    a.updatedAt === b.updatedAt &&
    a.reportsCount === b.reportsCount
  );
};

const BeachRow = memo(BeachRowComponent, beachRowEqual);

type SettingsRowProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: string;
  testId?: string;
};

const SettingsRow = ({ icon, label, onClick, badge, testId }: SettingsRowProps) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className="br-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center br-text-tertiary">
        {icon}
      </span>
      <span className="truncate text-[14px] font-semibold br-text-primary">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100/85">
          {badge}
        </span>
      ) : null}
    </span>
    <span className="shrink-0 br-text-tertiary" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
  </button>
);

const BottomSheetComponent = ({
  beaches,
  favoriteBeaches,
  favoriteBeachIds,
  selectedBeachId,
  onSelectBeach,
  onToggleFavorite,
  isOpen,
  onToggle,
  now,
  hasLocation,
  nearbyRadiusKm,
  activeSection,
  onSectionChange,
  onBottomNavHeightChange,
  onDragStateChange,
  accountName,
  accountEmail,
  onOpenProfile,
  onOpenSignIn,
}: BottomSheetProps) => {
  type SettingsPanel = "language" | "interests" | null;

  const perfEnabled = isPerfEnabled();
  useRenderCounter("BottomSheet", perfEnabled);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contentMaxHeightPx, setContentMaxHeightPx] = useState(() => {
    if (typeof window === "undefined") {
      return 420;
    }
    return Math.max(
      Math.round(window.innerHeight * CONTENT_MAX_VIEWPORT_RATIO),
      MIN_CONTENT_DRAG_RANGE_PX,
    );
  });
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>(() =>
    readPreferredLanguage(),
  );
  const [interestIds, setInterestIds] = useState<InterestId[]>(() => readInterests());
  const suppressClickRef = useRef(false);
  const startYRef = useRef(0);
  const startProgressRef = useRef(0);
  const lastMoveRef = useRef({ y: 0, t: 0 });

  const otherBeaches = useMemo(
    () => beaches.filter((beach) => !favoriteBeachIds.has(beach.id)),
    [beaches, favoriteBeachIds],
  );
  const hasFavorites = favoriteBeaches.length > 0;
  const isFavoritesOpen = favoritesOpen && hasFavorites;
  const favoritesSectionId = "br-favorites-panel";
  const effectiveProgress = dragProgress ?? (isOpen ? 1 : 0);
  const contentVisibleHeightPx = Math.round(contentMaxHeightPx * effectiveProgress);

  useEffect(() => {
    const update = () => {
      setContentMaxHeightPx(
        Math.max(
          Math.round(window.innerHeight * CONTENT_MAX_VIEWPORT_RATIO),
          MIN_CONTENT_DRAG_RANGE_PX,
        ),
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startYRef.current = event.clientY;
    startProgressRef.current = effectiveProgress;
    lastMoveRef.current = { y: event.clientY, t: performance.now() };
    setDragProgress(startProgressRef.current);
    setIsDragging(true);
    onDragStateChange?.(true);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isDragging) return;
    const delta = event.clientY - startYRef.current;
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      suppressClickRef.current = true;
    }
    const dragRangePx = startProgressRef.current >= 0.5
      ? Math.max(Math.min(contentMaxHeightPx, DRAG_RANGE_OPEN_TO_CLOSE_PX), 180)
      : Math.max(Math.min(contentMaxHeightPx, DRAG_RANGE_CLOSE_TO_OPEN_PX), 220);
    const nextProgress = Math.min(
      Math.max(startProgressRef.current - delta / dragRangePx, 0),
      1,
    );
    setDragProgress(nextProgress);
    lastMoveRef.current = { y: event.clientY, t: performance.now() };
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isDragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);

    const now = performance.now();
    const { y: lastY, t: lastT } = lastMoveRef.current;
    const dt = Math.max(now - lastT, 1);
    const velocity = (event.clientY - lastY) / dt;
    const finalProgress = dragProgress ?? (isOpen ? 1 : 0);

    let shouldOpen = finalProgress >= OPEN_SNAP_THRESHOLD;
    if (velocity < -VELOCITY_THRESHOLD) shouldOpen = true;
    if (velocity > VELOCITY_THRESHOLD) shouldOpen = false;

    setDragProgress(null);
    if (shouldOpen !== isOpen) {
      onToggle();
    }
    window.setTimeout(() => {
      onDragStateChange?.(false);
    }, 120);

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 150);
  };

  useEffect(() => {
    return () => {
      onDragStateChange?.(false);
    };
  }, [onDragStateChange]);

  const handleToggleFavorites = useCallback(() => {
    if (!hasFavorites) return;
    setFavoritesOpen((prev) => !prev);
  }, [hasFavorites]);

  const openUrl = useCallback((href: string) => {
    if (!href) return;
    if (href.startsWith("mailto:")) {
      window.location.href = href;
      return;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(href);
  }, []);

  const updatePreferredLanguage = useCallback((nextLanguage: PreferredLanguage) => {
    setPreferredLanguage(nextLanguage);
    writePreferredLanguage(nextLanguage);
  }, []);

  const toggleInterest = useCallback((interestId: InterestId) => {
    setInterestIds((prev) => {
      const exists = prev.includes(interestId);
      const next = exists
        ? prev.filter((item) => item !== interestId)
        : [...prev, interestId];
      writeInterests(next);
      return next;
    });
  }, []);

  const buildLegalUrl = useCallback((basePath: string) => {
    const params = new URLSearchParams();
    params.set("lang", preferredLanguage);
    params.set("from", "app");
    params.set("back", "/app/");
    return `${basePath}?${params.toString()}`;
  }, [preferredLanguage]);

  const businessRequestUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", "app");
    params.set("src", "account");
    params.set("lang", preferredLanguage);
    if (interestIds.length > 0) {
      params.set("interests", interestIds.join(","));
    }
    return `${LANDING_URL}?${params.toString()}#business-request`;
  }, [interestIds, preferredLanguage]);

  const handleOpenSavedBeaches = useCallback(() => {
    setFavoritesOpen(true);
    setSettingsPanel(null);
    onSectionChange("map");
  }, [onSectionChange]);

  const handleOpenLanguageSettings = useCallback(() => {
    setSettingsPanel((prev) => (prev === "language" ? null : "language"));
  }, []);

  const handleOpenInterests = useCallback(() => {
    setSettingsPanel((prev) => (prev === "interests" ? null : "interests"));
  }, []);

  const handleOpenReview = useCallback(() => {
    const isValidHttp = /^https?:\/\//i.test(APP_REVIEW_URL);
    if (isValidHttp) {
      openUrl(APP_REVIEW_URL);
      return;
    }
    openUrl(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Recensione Where2Beach")}`);
  }, [openUrl]);

  const handleOpenSupport = useCallback(() => {
    openUrl(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Supporto Where2Beach")}&body=${encodeURIComponent(
        `Ciao team Where2Beach,%0D%0A`,
      )}`,
    );
  }, [openUrl]);

  const handleShareApp = useCallback(async () => {
    const sharePayload = {
      title: STRINGS.appName,
      text: STRINGS.account.settingsShareText,
      url: SHARE_APP_URL,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        // User cancelled or platform rejected share.
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(SHARE_APP_URL);
      } catch {
        // Clipboard may be unavailable in some browsers or contexts.
      }
    }

    openUrl(SHARE_APP_URL);
  }, [openUrl]);

  const handleToggleBeachFavorite = useCallback(
    (beachId: string) => {
      const isLastFavorite = favoriteBeachIds.has(beachId) && favoriteBeaches.length === 1;
      if (isLastFavorite) {
        setFavoritesOpen(false);
      }
      onToggleFavorite(beachId);
    },
    [favoriteBeachIds, favoriteBeaches.length, onToggleFavorite],
  );

  const handleSelectFavoriteFromProfile = useCallback((beachId: string) => {
    onSelectBeach(beachId);
  }, [onSelectBeach]);

  const profileFavoritesPreview = useMemo(
    () => favoriteBeaches.slice(0, 4),
    [favoriteBeaches],
  );

  const selectedBeach = useMemo(
    () => beaches.find((beach) => beach.id === selectedBeachId) ?? null,
    [beaches, selectedBeachId],
  );

  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>(() => [
    {
      id: createMessageId(),
      role: "assistant",
      content: STRINGS.chatbot.welcome,
      source: "local",
      totalTokens: null,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const trimChatMessage = useCallback(
    (value: string) =>
      value.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_INPUT_CHARS),
    [],
  );

  const chatContext = useMemo(
    () => ({
      selectedBeachName: selectedBeach?.name ?? null,
      selectedBeachRegion: selectedBeach?.region ?? null,
      favoriteCount: favoriteBeaches.length,
      hasAccount: !!accountEmail,
      preferredLanguage,
      interests: interestIds,
    }),
    [accountEmail, favoriteBeaches.length, interestIds, preferredLanguage, selectedBeach],
  );

  useEffect(() => {
    return () => {
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "chatbot") return;
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeSection, chatMessages, chatSending]);

  const pushChatMessage = useCallback((message: ChatMessageRow) => {
    setChatMessages((prev) => [...prev, message].slice(-MAX_CHAT_MESSAGES));
  }, []);

  const mapChatError = useCallback((error: string) => {
    switch (error) {
      case "network":
        return STRINGS.chatbot.errors.network;
      case "timeout":
        return STRINGS.chatbot.errors.timeout;
      case "rate_limited":
        return STRINGS.chatbot.errors.rateLimited;
      case "not_configured":
        return STRINGS.chatbot.errors.notConfigured;
      case "account_required":
        return STRINGS.chatbot.errors.accountRequired;
      case "unavailable":
        return STRINGS.chatbot.errors.unavailable;
      default:
        return STRINGS.chatbot.errors.generic;
    }
  }, []);

  const sendChatMessage = useCallback(async (raw: string) => {
    if (!accountEmail) {
      setChatError(STRINGS.chatbot.errors.accountRequired);
      return;
    }
    if (chatSending) return;
    const question = trimChatMessage(raw);
    if (!question) return;

    const userRow: ChatMessageRow = {
      id: createMessageId(),
      role: "user",
      content: question,
      source: null,
      totalTokens: null,
    };
    pushChatMessage(userRow);
    setChatInput("");
    setChatError(null);
    setChatSending(true);

    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    const controller = new AbortController();
    chatAbortRef.current = controller;

    const historyForApi: ChatbotMessage[] = [...chatMessages, userRow]
      .slice(-8)
      .map((row) => ({
        role: row.role,
        content: row.content,
      }));

    const result = await askChatbot(historyForApi, chatContext, controller.signal);
    if (chatAbortRef.current === controller) {
      chatAbortRef.current = null;
    }
    setChatSending(false);

    if (!result.ok) {
      setChatError(mapChatError(result.error));
      return;
    }

    pushChatMessage({
      id: createMessageId(),
      role: "assistant",
      content: result.reply,
      source: result.source,
      totalTokens: result.usage?.totalTokens ?? null,
    });
  }, [
    accountEmail,
    chatContext,
    chatMessages,
    chatSending,
    mapChatError,
    pushChatMessage,
    trimChatMessage,
  ]);

  const handleChatSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendChatMessage(chatInput);
    },
    [chatInput, sendChatMessage],
  );

  const quickQuestions = useMemo(
    () => [
      STRINGS.chatbot.quickQuestions.report,
      STRINGS.chatbot.quickQuestions.favorites,
      STRINGS.chatbot.quickQuestions.states,
    ],
    [],
  );

  const hasChatConversation = chatMessages.length > 1;
  const hasChatAccess = Boolean(accountEmail);
  const ondaHeaderVisual = useMemo(
    () => resolveOndaHeaderVisual(chatSending, hasChatConversation),
    [chatSending, hasChatConversation],
  );
  const isChatbotSection = activeSection === "chatbot";
  const collapsedHeaderMinHeight = CLOSED_VISIBLE_HEIGHT;

  const sectionTitle = activeSection === "map"
    ? STRINGS.labels.nearbyBeaches
    : activeSection === "profile"
      ? STRINGS.account.profileTitle
      : STRINGS.chatbot.title;
  const sectionSubtitle = activeSection === "map"
    ? (hasLocation
      ? STRINGS.labels.nearbyWithinRadius(beaches.length, nearbyRadiusKm)
      : STRINGS.labels.enableLocationNearby)
    : activeSection === "profile"
      ? (accountEmail
        ? STRINGS.account.signedInAs
        : STRINGS.account.profileHintGuest)
      : `${hasChatAccess ? ondaHeaderVisual.statusLabel : STRINGS.chatbot.lockedStatus} • Tocca per aprire`;

  return (
    <div
      data-testid="bottom-sheet"
      className="fixed bottom-0 left-0 right-0 z-[24]"
    >
      <div
        className="relative mx-auto max-w-screen-sm overflow-hidden rounded-t-[28px] border border-b-0 border-white/22 bg-[linear-gradient(180deg,rgba(20,34,54,0.68),rgba(12,23,41,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[20px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-3 rounded-t-[28px] bg-[rgba(9,18,32,0.34)]"
        />
        <button
          className="relative z-[1] br-press flex w-full items-center justify-between px-6 py-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            onToggle();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-expanded={isOpen}
          aria-label={STRINGS.aria.expandBeaches}
          style={{ touchAction: "none", minHeight: collapsedHeaderMinHeight }}
        >
          <div className={`min-w-0 ${isChatbotSection ? "flex items-center gap-2.5" : ""}`}>
            {isChatbotSection ? (
              <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-300/28 bg-sky-500/12 p-0.5">
                <img
                  src={ONDA_AVATARS.core}
                  alt="ONDA"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-full object-cover object-top"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="text-[15px] font-semibold br-text-primary">
                {sectionTitle}
              </div>
              {sectionSubtitle ? (
                <div className="truncate text-[11px] br-text-tertiary">
                  {sectionSubtitle}
                </div>
              ) : null}
            </div>
          </div>
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </button>
        <div
          className={`overflow-hidden ${isDragging ? "" : "transition-[max-height,opacity] duration-250"} ${
            effectiveProgress > 0 ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            maxHeight: `${contentVisibleHeightPx}px`,
            opacity: effectiveProgress,
            pointerEvents: isDragging ? "none" : effectiveProgress > 0 ? "auto" : "none",
          }}
        >
          <div className="max-h-[62vh] overflow-y-auto px-6 pb-4">
          {activeSection === "map" ? (
            <div className="space-y-4 pb-6">
              <section>
                <button
                  type="button"
                  onClick={handleToggleFavorites}
                  aria-expanded={isFavoritesOpen}
                  aria-controls={favoritesSectionId}
                  disabled={!hasFavorites}
                  className={`br-press flex w-full items-center justify-between rounded-xl px-4 py-2 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
                    !hasFavorites ? "cursor-default opacity-75" : ""
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-amber-100/85">
                    {STRINGS.labels.favorites}
                  </span>
                  <span className="inline-flex items-center gap-2 text-[11px] text-amber-100/80">
                    <span>{favoriteBeaches.length}</span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={`h-4 w-4 transition-transform ${isFavoritesOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <div
                  id={favoritesSectionId}
                  data-testid="favorites-list"
                  className={`${isFavoritesOpen ? "mt-2 divide-y divide-[color:var(--hairline)]" : "hidden"}`}
                >
                  {favoriteBeaches.map((beach) => (
                    <BeachRow
                      key={beach.id}
                      beach={beach}
                      isSelected={beach.id === selectedBeachId}
                      isFavorite={true}
                      now={now}
                      onSelectBeach={onSelectBeach}
                      onToggleFavorite={handleToggleBeachFavorite}
                    />
                  ))}
                </div>
              </section>
              <section>
                <div className="px-4 text-[10px] font-semibold uppercase tracking-[0.11em] br-text-tertiary">
                  {STRINGS.labels.nearbyBeaches}
                </div>
                {otherBeaches.length > 0 ? (
                  <div className="mt-2 divide-y divide-[color:var(--hairline)]">
                    {otherBeaches.map((beach) => (
                      <BeachRow
                        key={beach.id}
                        beach={beach}
                        isSelected={beach.id === selectedBeachId}
                        isFavorite={favoriteBeachIds.has(beach.id)}
                        now={now}
                        onSelectBeach={onSelectBeach}
                        onToggleFavorite={handleToggleBeachFavorite}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl br-surface-soft px-4 py-3 text-[12px] br-text-tertiary">
                    {hasLocation
                      ? STRINGS.labels.noNearbyWithinRadius(nearbyRadiusKm)
                      : STRINGS.labels.enableLocationNearby}
                  </div>
                )}
              </section>
            </div>
          ) : null}
          {activeSection === "profile" ? (
            <div className="space-y-4 pb-6">
              <section>
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.11em] br-text-tertiary">
                  {STRINGS.account.settingsTitle}
                </div>
                <div className="mt-2 overflow-hidden rounded-2xl border border-white/16 bg-white/7 divide-y divide-[color:var(--hairline)] backdrop-blur-md">
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 17v-2a4 4 0 0 1 4-4h5" />
                        <path d="M17 7l2 2-2 2" />
                        <path d="M8 7H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                      </svg>
                    )}
                    label={accountEmail ? STRINGS.account.settingsProfileLabel : STRINGS.account.settingsLoginLabel}
                    onClick={accountEmail ? onOpenProfile : onOpenSignIn}
                    testId="settings-login-row"
                    badge={
                      accountEmail
                        ? (accountName?.trim() || STRINGS.account.settingsLoggedBadge)
                        : undefined
                    }
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-3-7 3V4a1 1 0 0 1 1-1Z" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsSavedLabel}
                    onClick={handleOpenSavedBeaches}
                    testId="settings-saved-row"
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 5h16" />
                        <path d="M4 9h10" />
                        <path d="M4 13h7" />
                        <path d="M4 17h12" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsLanguageLabel}
                    onClick={handleOpenLanguageSettings}
                    testId="settings-language-row"
                    badge={preferredLanguage.toUpperCase()}
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="8" cy="9" r="2.5" />
                        <circle cx="16" cy="8" r="2.5" />
                        <path d="M3.5 18.5a4.5 4.5 0 0 1 9 0" />
                        <path d="M11.5 18.5a4.5 4.5 0 0 1 9 0" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsInterestsLabel}
                    onClick={handleOpenInterests}
                    testId="settings-interests-row"
                    badge={interestIds.length > 0 ? String(interestIds.length) : undefined}
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3l7 4v5c0 5.2-3 8.6-7 9-4-.4-7-3.8-7-9V7l7-4Z" />
                        <path d="M9.5 12.2l1.8 1.8 3.2-3.2" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsPrivacyLabel}
                    onClick={() => openUrl(buildLegalUrl(PRIVACY_URL))}
                    testId="settings-privacy-row"
                  />
                </div>
              </section>

              {settingsPanel === "language" ? (
                <section className="rounded-2xl border border-white/16 bg-white/8 p-3 backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] br-text-tertiary">
                    Lingua comunicazioni
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-testid="settings-language-it"
                      onClick={() => updatePreferredLanguage("it")}
                      className={`br-press rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        preferredLanguage === "it"
                          ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                          : "border-white/18 bg-white/5 br-text-secondary"
                      }`}
                    >
                      Italiano
                    </button>
                    <button
                      type="button"
                      data-testid="settings-language-en"
                      onClick={() => updatePreferredLanguage("en")}
                      className={`br-press rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        preferredLanguage === "en"
                          ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                          : "border-white/18 bg-white/5 br-text-secondary"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </section>
              ) : null}

              {settingsPanel === "interests" ? (
                <section className="rounded-2xl border border-white/16 bg-white/8 p-3 backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] br-text-tertiary">
                    Interessi profilo
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((option) => {
                      const active = interestIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          data-testid={`settings-interest-${option.id}`}
                          onClick={() => toggleInterest(option.id)}
                          className={`br-press rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                            active
                              ? "border-cyan-300/80 bg-cyan-500/20 text-cyan-100"
                              : "border-white/18 bg-white/5 br-text-secondary"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.11em] br-text-tertiary">
                  {STRINGS.account.settingsFeedbackTitle}
                </div>
                <div className="mt-2 overflow-hidden rounded-2xl border border-white/16 bg-white/7 divide-y divide-[color:var(--hairline)] backdrop-blur-md">
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3.2l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5Z" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsReviewLabel}
                    onClick={handleOpenReview}
                    testId="settings-review-row"
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                        <path d="M7.5 12h4" />
                        <path d="M15.5 12h1" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsTalkToUsLabel}
                    onClick={handleOpenSupport}
                    testId="settings-support-row"
                  />
                  <SettingsRow
                    icon={(
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 16V4" />
                        <path d="M8 8l4-4 4 4" />
                        <rect x="5" y="14" width="14" height="6" rx="1.5" />
                      </svg>
                    )}
                    label={STRINGS.account.settingsShareLabel}
                    onClick={() => {
                      void handleShareApp();
                    }}
                    testId="settings-share-row"
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-sky-200/24 bg-[radial-gradient(130%_140%_at_100%_0%,rgba(56,189,248,0.3),transparent_55%),linear-gradient(180deg,#1d4d80,#1e4a77)] px-4 py-3">
                <a
                  href={businessRequestUrl}
                  data-testid="settings-business-cta"
                  onClick={(event) => {
                    event.preventDefault();
                    openUrl(businessRequestUrl);
                  }}
                  className="br-press flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                >
                  <div className="min-w-0">
                    <div className="inline-flex rounded-md bg-emerald-300/24 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-emerald-50">
                      {STRINGS.account.settingsBusinessBadge}
                    </div>
                    <div className="mt-2 text-[26px] leading-none text-sky-100">
                      {STRINGS.account.settingsBusinessEmoji}
                    </div>
                    <div className="mt-2 text-[22px] font-semibold leading-tight text-white">
                      {STRINGS.account.settingsBusinessTitle}
                    </div>
                    <div className="mt-1 text-[13px] font-medium text-sky-100/85">
                      {STRINGS.account.settingsBusinessSubtitle}
                    </div>
                  </div>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200/26 bg-sky-300/14 text-sky-100">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </a>
              </section>

              {accountEmail && profileFavoritesPreview.length > 0 ? (
                <section className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.11em] br-text-tertiary">
                    {STRINGS.account.profileFavoritesTitle}
                  </div>
                  <div className="mt-2 space-y-1">
                    {profileFavoritesPreview.map((beach) => (
                      <button
                        key={beach.id}
                        type="button"
                        onClick={() => handleSelectFavoriteFromProfile(beach.id)}
                        className="br-press flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                      >
                        <span className="text-[12px] br-text-primary">{beach.name}</span>
                        <span className="text-[11px] br-text-tertiary">
                          {formatDistanceLabel(beach.distanceM)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
          {activeSection === "chatbot" ? (
            <div className="space-y-4 pb-6">
              <section className="overflow-hidden rounded-[22px] border border-white/12 bg-[radial-gradient(120%_130%_at_85%_-20%,rgba(56,189,248,0.22),transparent_50%),linear-gradient(180deg,rgba(7,19,34,0.88),rgba(5,15,28,0.94))]">
                <div className="px-4 pb-3 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500/12 p-0.5 shadow-[0_10px_22px_rgba(14,116,144,0.25)]">
                      <img
                        src={ondaHeaderVisual.image}
                        alt="ONDA"
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full rounded-full object-cover object-top ${
                          chatSending ? "animate-pulse" : ""
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold tracking-[0.01em] text-sky-50">
                        ONDA
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-sky-100/82">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            hasChatAccess
                              ? (chatSending ? "bg-sky-200 animate-pulse" : "bg-emerald-300")
                              : "bg-amber-300"
                          }`}
                        />
                        <span>{hasChatAccess ? ondaHeaderVisual.statusLabel : STRINGS.chatbot.lockedStatus}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[12px] leading-relaxed text-slate-200/80">
                    {hasChatAccess
                      ? "Supporto su mappa, meteo, segnalazioni e preferiti."
                      : STRINGS.chatbot.lockedDescription}
                  </div>
                </div>
                <div className="border-t border-white/8 px-3 pb-3 pt-3">
                  {hasChatAccess ? (
                    <>
                      <div
                        ref={chatScrollRef}
                        className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-[rgba(4,12,24,0.62)] p-3"
                      >
                        {chatMessages.map((message) => {
                          const isAssistantMessage = message.role === "assistant";
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isAssistantMessage ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`max-w-[90%] rounded-[18px] px-3 py-2.5 text-[13px] leading-relaxed ${
                                  isAssistantMessage
                                    ? "bg-[rgba(12,32,52,0.84)] text-slate-100"
                                    : "bg-sky-500/26 text-sky-50"
                                }`}
                              >
                                {message.content}
                              </div>
                            </div>
                          );
                        })}
                        {chatSending ? (
                          <div className="flex items-center gap-2 px-1 text-[11px] text-slate-300/85">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-200 animate-pulse" />
                            <span>{STRINGS.chatbot.sending}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                        {quickQuestions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => {
                              void sendChatMessage(question);
                            }}
                            disabled={chatSending}
                            className="br-press shrink-0 rounded-full border border-sky-200/20 bg-sky-500/12 px-3 py-1.5 text-[11px] font-semibold text-sky-100 transition hover:border-sky-200/38 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                      <form onSubmit={handleChatSubmit} className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          maxLength={MAX_CHAT_INPUT_CHARS}
                          placeholder={STRINGS.chatbot.inputPlaceholder}
                          className="h-11 min-w-0 flex-1 rounded-xl border border-white/14 bg-[rgba(8,20,34,0.78)] px-3 text-[13px] br-text-primary placeholder:text-slate-400 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                        />
                        <button
                          type="submit"
                          disabled={chatSending || trimChatMessage(chatInput).length === 0}
                          className="br-press h-11 min-w-[82px] rounded-xl border border-sky-300/35 bg-sky-500/20 px-3 text-[12px] font-semibold text-sky-100 transition hover:bg-sky-500/28 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {STRINGS.chatbot.send}
                        </button>
                      </form>
                      {chatError ? (
                        <div className="mt-2 rounded-lg border border-rose-300/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
                          {chatError}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3">
                      <div className="text-[12px] text-amber-100/88">{STRINGS.chatbot.lockedDescription}</div>
                      <button
                        type="button"
                        onClick={onOpenSignIn}
                        className="br-press mt-3 w-full rounded-xl border border-amber-300/45 bg-amber-500/14 px-3 py-2 text-[12px] font-semibold text-amber-100 transition hover:bg-amber-500/22"
                      >
                        {STRINGS.chatbot.lockedAction}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
          </div>
        </div>
        <div className="bg-transparent">
          <BottomNav
            activeSection={activeSection}
            accountEmail={accountEmail}
            onChange={onSectionChange}
            onHeightChange={onBottomNavHeightChange}
          />
        </div>
      </div>
    </div>
  );
};

const bottomSheetEqual = (prev: BottomSheetProps, next: BottomSheetProps) =>
  prev.beaches === next.beaches &&
  prev.favoriteBeaches === next.favoriteBeaches &&
  prev.favoriteBeachIds === next.favoriteBeachIds &&
  prev.selectedBeachId === next.selectedBeachId &&
  prev.onSelectBeach === next.onSelectBeach &&
  prev.onToggleFavorite === next.onToggleFavorite &&
  prev.isOpen === next.isOpen &&
  prev.onToggle === next.onToggle &&
  prev.now === next.now &&
  prev.hasLocation === next.hasLocation &&
  prev.nearbyRadiusKm === next.nearbyRadiusKm &&
  prev.activeSection === next.activeSection &&
  prev.onSectionChange === next.onSectionChange &&
  prev.onBottomNavHeightChange === next.onBottomNavHeightChange &&
  prev.onDragStateChange === next.onDragStateChange &&
  prev.accountName === next.accountName &&
  prev.accountEmail === next.accountEmail &&
  prev.onOpenProfile === next.onOpenProfile &&
  prev.onOpenSignIn === next.onOpenSignIn;

const BottomSheet = memo(BottomSheetComponent, bottomSheetEqual);

export default BottomSheet;
