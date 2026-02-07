import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { STRINGS } from "../i18n/it";
import { isPerfEnabled, useRenderCounter } from "../lib/perf";
import { normalizeSearchText, useDebouncedValue } from "../lib/search";

type SearchBeach = {
  id: string;
  name: string;
  region: string;
};

type TopSearchProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  notice?: string | null;
  beaches: SearchBeach[];
  onSelectSuggestion: (beachId: string) => void;
  accountEmail?: string | null;
  accountName?: string | null;
  onSignIn?: () => void;
  onOpenProfile?: () => void;
  onSignOut?: () => void;
};

const MAX_SUGGESTIONS = 12;

type IndexedBeach = SearchBeach & {
  nameNorm: string;
  regionNorm: string;
};

const DEBOUNCE_MS = 100;

const TopSearchComponent = ({
  value,
  onChange,
  resultCount,
  notice,
  beaches,
  onSelectSuggestion,
  accountEmail = null,
  accountName = null,
  onSignIn,
  onOpenProfile,
  onSignOut,
}: TopSearchProps) => {
  const perfEnabled = isPerfEnabled();
  useRenderCounter("TopSearch", perfEnabled);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const normalized = useMemo(() => normalizeSearchText(value), [value]);
  const debouncedNormalized = useDebouncedValue(normalized, DEBOUNCE_MS);
  const effectiveOpen = open && debouncedNormalized.length > 0;

  const indexedBeaches = useMemo<IndexedBeach[]>(
    () =>
      beaches.map((beach) => ({
        ...beach,
        nameNorm: normalizeSearchText(beach.name),
        regionNorm: normalizeSearchText(beach.region),
      })),
    [beaches],
  );

  const suggestions = useMemo(() => {
    if (!debouncedNormalized) return [];
    const hasExactCity = indexedBeaches.some(
      (beach) => beach.regionNorm === debouncedNormalized,
    );
    const matches = indexedBeaches
      .map((beach) => {
        const name = beach.nameNorm;
        const city = beach.regionNorm;
        let rank: number | null = null;

        if (name.startsWith(debouncedNormalized)) rank = 1;
        else if (city.startsWith(debouncedNormalized)) rank = 2;
        else if (name.includes(debouncedNormalized)) rank = 3;
        else if (city.includes(debouncedNormalized)) rank = 4;

        if (rank === null) return null;
        return {
          beach,
          rank,
          exactCityMatch: hasExactCity && city === debouncedNormalized,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.exactCityMatch !== b.exactCityMatch) {
          return a.exactCityMatch ? -1 : 1;
        }
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.beach.name.localeCompare(b.beach.name);
      })
      .slice(0, MAX_SUGGESTIONS)
      .map((item) => item.beach);

    return matches;
  }, [debouncedNormalized, indexedBeaches]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const handleSelect = useCallback(
    (beachId: string) => {
      onSelectSuggestion(beachId);
      setOpen(false);
      setProfileOpen(false);
    },
    [onSelectSuggestion],
  );

  return (
    <div className="fixed left-0 right-0 top-0 z-40 px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div ref={containerRef} className="mx-auto max-w-screen-sm">
        <div className="relative">
          <div className="contrast-guard br-radius-m flex h-12 items-center gap-2.5 px-4 focus-within:outline focus-within:outline-1 focus-within:outline-[color:var(--focus-ring)] focus-within:outline-offset-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] br-text-tertiary">
              {STRINGS.search.label}
            </span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                onChange(nextValue);
                if (nextValue.trim()) setOpen(true);
              }}
              onFocus={() => {
                setProfileOpen(false);
                if (normalized && suggestions.length > 0) setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setProfileOpen(false);
                  return;
                }
                if (
                  event.key === "Enter" &&
                  effectiveOpen &&
                  suggestions.length > 0
                ) {
                  event.preventDefault();
                  handleSelect(suggestions[0].id);
                }
              }}
              placeholder={STRINGS.search.placeholder}
              aria-label={STRINGS.aria.searchBeaches}
              aria-expanded={effectiveOpen}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                aria-label={STRINGS.aria.clearSearch}
                className="br-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[12px] font-semibold text-[color:var(--text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {STRINGS.actions.clearSymbol}
              </button>
            ) : null}
            {!accountEmail ? (
              <button
                type="button"
                onClick={() => onSignIn?.()}
                className="br-press rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {STRINGS.account.signInAction}
              </button>
            ) : null}
            {accountEmail ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen((prev) => !prev);
                }}
                aria-label={STRINGS.account.profileTitle}
                aria-expanded={profileOpen}
                className="br-press inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/22 bg-black/40 px-2 text-[11px] font-semibold text-[color:var(--text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {(accountName?.trim() || accountEmail).slice(0, 1).toUpperCase()}
              </button>
            ) : null}
            <span className="hidden text-[11px] br-text-tertiary min-[420px]:inline">
              {STRINGS.search.resultsCount(resultCount)}
            </span>
          </div>
          {profileOpen && accountEmail ? (
            <div className="br-radius-m br-surface absolute right-0 z-50 mt-2 w-[min(88vw,280px)] overflow-hidden">
              <div className="border-b border-[color:var(--hairline)] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] br-text-tertiary">
                  {STRINGS.account.signedInAs}
                </div>
                {accountName ? (
                  <div className="mt-1 truncate text-[13px] font-semibold br-text-primary">
                    {accountName}
                  </div>
                ) : null}
                <div className="truncate text-[12px] br-text-secondary">
                  {accountEmail}
                </div>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenProfile?.();
                  }}
                  className="br-press mb-2 flex w-full items-center justify-center rounded-[10px] border border-white/20 bg-black/35 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                >
                  {STRINGS.account.profileAction}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onSignOut?.();
                  }}
                  className="br-press flex w-full items-center justify-center rounded-[10px] border border-white/20 bg-black/35 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                >
                  {STRINGS.account.signOutAction}
                </button>
              </div>
            </div>
          ) : null}
          {effectiveOpen && suggestions.length > 0 ? (
            <div className="br-radius-m br-surface absolute left-0 right-0 z-50 mt-2 overflow-hidden">
              <div className="max-h-56 divide-y divide-[color:var(--hairline)] overflow-y-auto py-1">
                {suggestions.map((beach) => (
                  <button
                    key={beach.id}
                    type="button"
                    onClick={() => handleSelect(beach.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] text-[color:var(--text-primary)] transition-colors hover:bg-black/25 focus-visible:bg-black/30 focus-visible:outline-none"
                  >
                    <span className="truncate font-semibold tracking-[-0.01em]">
                      {beach.name}
                    </span>
                    <span className="shrink-0 rounded-full border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.02em] text-[color:var(--text-secondary)]">
                      {beach.region}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {notice ? (
        <div className="mx-auto mt-2 max-w-screen-sm">
          <div className="br-press br-surface-soft w-[70vw] whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] tracking-tight br-text-primary sm:w-auto sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-normal">
            {notice}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const areEqual = (prev: TopSearchProps, next: TopSearchProps) =>
  prev.value === next.value &&
  prev.resultCount === next.resultCount &&
  prev.notice === next.notice &&
  prev.beaches === next.beaches &&
  prev.onChange === next.onChange &&
  prev.onSelectSuggestion === next.onSelectSuggestion &&
  prev.accountEmail === next.accountEmail &&
  prev.accountName === next.accountName &&
  prev.onSignIn === next.onSignIn &&
  prev.onOpenProfile === next.onOpenProfile &&
  prev.onSignOut === next.onSignOut;

const TopSearch = memo(TopSearchComponent, areEqual);

export default TopSearch;
