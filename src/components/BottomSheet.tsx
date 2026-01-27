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
  selectedBeachId: string | null;
  onSelectBeach: (beachId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  now: number;
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
  now: number;
  onSelectBeach: (beachId: string) => void;
};

const BeachRowComponent = ({ beach, isSelected, now, onSelectBeach }: BeachRowProps) => {
  const handleClick = useCallback(() => onSelectBeach(beach.id), [onSelectBeach, beach.id]);

  return (
    <button
      onClick={handleClick}
      className={`br-press w-full px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 ${
        isSelected ? "bg-white/10" : "bg-transparent"
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
  );
};

const beachRowEqual = (prev: BeachRowProps, next: BeachRowProps) => {
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.now !== next.now) return false;
  if (prev.onSelectBeach !== next.onSelectBeach) return false;
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
  selectedBeachId,
  onSelectBeach,
  isOpen,
  onToggle,
  now,
}: BottomSheetProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("BottomSheet", perfEnabled);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const lastMoveRef = useRef({ y: 0, t: 0 });

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

  return (
    <div
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
              {STRINGS.search.resultsCount(beaches.length)}
            </div>
          </div>
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </button>
        <div className="max-h-[62vh] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="divide-y divide-[color:var(--hairline)] pb-6">
            {beaches.map((beach) => (
              <BeachRow
                key={beach.id}
                beach={beach}
                isSelected={beach.id === selectedBeachId}
                now={now}
                onSelectBeach={onSelectBeach}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const bottomSheetEqual = (prev: BottomSheetProps, next: BottomSheetProps) =>
  prev.beaches === next.beaches &&
  prev.selectedBeachId === next.selectedBeachId &&
  prev.onSelectBeach === next.onSelectBeach &&
  prev.isOpen === next.isOpen &&
  prev.onToggle === next.onToggle &&
  prev.now === next.now;

const BottomSheet = memo(BottomSheetComponent, bottomSheetEqual);

export default BottomSheet;
