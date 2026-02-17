import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeachWithStats } from "../lib/types";
import { STRINGS } from "../i18n/it";
import {
  formatConfidenceInline,
  formatDistanceLabel,
  formatMinutesAgo,
  formatReportCount,
  formatStateLabel,
} from "../lib/format";
import { isPerfEnabled, useRenderCounter } from "../lib/perf";

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
};

const PEEK_HEIGHT = 56;
const DRAG_THRESHOLD = 6;
const VELOCITY_THRESHOLD = 0.45;

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
}: BottomSheetProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("BottomSheet", perfEnabled);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const suppressClickRef = useRef(false);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const lastMoveRef = useRef({ y: 0, t: 0 });

  const otherBeaches = useMemo(
    () => beaches.filter((beach) => !favoriteBeachIds.has(beach.id)),
    [beaches, favoriteBeachIds],
  );
  const hasFavorites = favoriteBeaches.length > 0;
  const isFavoritesOpen = favoritesOpen && hasFavorites;
  const favoritesSectionId = "br-favorites-panel";

  const translateY = useMemo(() => {
    if (dragOffset !== null) return dragOffset;
    return isOpen ? 0 : maxTranslate;
  }, [dragOffset, isOpen, maxTranslate]);

  useEffect(() => {
    const update = () => {
      if (!sheetRef.current) return;
      const height = sheetRef.current.getBoundingClientRect().height;
      setMaxTranslate(Math.max(height - PEEK_HEIGHT, 0));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sheetRef.current) {
      observer = new ResizeObserver(update);
      observer.observe(sheetRef.current);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      observer?.disconnect();
    };
  }, []);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startYRef.current = event.clientY;
    startOffsetRef.current = isOpen ? 0 : maxTranslate;
    lastMoveRef.current = { y: event.clientY, t: performance.now() };
    setDragOffset(startOffsetRef.current);
    setIsDragging(true);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isDragging) return;
    const delta = event.clientY - startYRef.current;
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      suppressClickRef.current = true;
    }
    const next = Math.min(
      Math.max(startOffsetRef.current + delta, 0),
      maxTranslate,
    );
    setDragOffset(next);
    lastMoveRef.current = { y: event.clientY, t: performance.now() };
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isDragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);

    const now = performance.now();
    const { y: lastY, t: lastT } = lastMoveRef.current;
    const dt = Math.max(now - lastT, 1);
    const velocity = (event.clientY - lastY) / dt;
    const finalOffset = dragOffset ?? (isOpen ? 0 : maxTranslate);

    let shouldOpen = finalOffset < maxTranslate / 2;
    if (velocity < -VELOCITY_THRESHOLD) shouldOpen = true;
    if (velocity > VELOCITY_THRESHOLD) shouldOpen = false;

    setDragOffset(null);
    if (shouldOpen !== isOpen) {
      onToggle();
    }

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 150);
  };

  const handleToggleFavorites = useCallback(() => {
    if (!hasFavorites) return;
    setFavoritesOpen((prev) => !prev);
  }, [hasFavorites]);

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

  return (
    <div
      data-testid="bottom-sheet"
      className={`fixed bottom-0 left-0 right-0 z-20 ${
        isDragging ? "" : "transition-transform duration-300"
      }`}
      style={{
        transform: `translate3d(0, ${translateY}px, 0)`,
        willChange: "transform",
      }}
    >
      <div
        ref={sheetRef}
        className="mx-auto max-w-screen-sm rounded-t-[22px] contrast-guard"
      >
        <button
          className="br-press flex w-full items-center justify-between px-6 py-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
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
          style={{ touchAction: "none" }}
        >
          <div>
            <div className="text-[15px] font-semibold br-text-primary">
              {STRINGS.labels.nearbyBeaches}
            </div>
            <div className="text-[11px] br-text-tertiary">
              {hasLocation
                ? STRINGS.labels.nearbyWithinRadius(beaches.length, nearbyRadiusKm)
                : STRINGS.labels.enableLocationNearby}
            </div>
          </div>
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </button>
        <div className="max-h-[62vh] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
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
                <div className="mt-2 rounded-xl border border-[color:var(--hairline)] bg-black/15 px-4 py-3 text-[12px] br-text-tertiary">
                  {hasLocation
                    ? STRINGS.labels.noNearbyWithinRadius(nearbyRadiusKm)
                    : STRINGS.labels.enableLocationNearby}
                </div>
              )}
            </section>
          </div>
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
  prev.nearbyRadiusKm === next.nearbyRadiusKm;

const BottomSheet = memo(BottomSheetComponent, bottomSheetEqual);

export default BottomSheet;
