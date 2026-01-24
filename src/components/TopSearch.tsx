import { useEffect, useMemo, useRef, useState } from "react";
import { STRINGS } from "../i18n/it";

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
};

const MAX_SUGGESTIONS = 12;

const TopSearch = ({
  value,
  onChange,
  resultCount,
  notice,
  beaches,
  onSelectSuggestion,
}: TopSearchProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const normalized = value.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalized) return [];
    const hasExactCity = beaches.some(
      (beach) => beach.region.toLowerCase() === normalized,
    );
    const matches = beaches
      .map((beach) => {
        const name = beach.name.toLowerCase();
        const city = beach.region.toLowerCase();
        let rank: number | null = null;

        if (name.startsWith(normalized)) rank = 1;
        else if (city.startsWith(normalized)) rank = 2;
        else if (name.includes(normalized)) rank = 3;
        else if (city.includes(normalized)) rank = 4;

        if (rank === null) return null;
        return {
          beach,
          rank,
          exactCityMatch: hasExactCity && city === normalized,
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
  }, [beaches, normalized]);

  useEffect(() => {
    if (!normalized) setOpen(false);
  }, [normalized]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const handleSelect = (beachId: string) => {
    onSelectSuggestion(beachId);
    setOpen(false);
  };

  return (
    <div className="fixed left-0 right-0 top-0 z-40 px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div ref={containerRef} className="mx-auto max-w-screen-sm">
        <div className="relative">
          <div className="br-radius-m br-surface-strong flex h-12 items-center gap-2.5 px-4 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/20">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                if (normalized && suggestions.length > 0) setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }
                if (event.key === "Enter" && open && suggestions.length > 0) {
                  event.preventDefault();
                  handleSelect(suggestions[0].id);
                }
              }}
              placeholder={STRINGS.search.placeholder}
              aria-label={STRINGS.aria.searchBeaches}
              aria-expanded={open}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-100 placeholder:text-slate-500/80 focus:outline-none"
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
                className="br-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-900/50 text-[12px] font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
              >
                {STRINGS.actions.clearSymbol}
              </button>
            ) : null}
            <span className="text-[11px] text-slate-500">
              {STRINGS.search.resultsCount(resultCount)}
            </span>
          </div>
          {open && suggestions.length > 0 ? (
            <div className="br-radius-m br-surface absolute left-0 right-0 z-50 mt-2 overflow-hidden">
              <div className="max-h-72 divide-y divide-white/10 overflow-y-auto py-1.5">
                {suggestions.map((beach) => (
                  <button
                    key={beach.id}
                    type="button"
                    onClick={() => handleSelect(beach.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-slate-100 transition-colors hover:bg-slate-900/40 focus-visible:bg-slate-900/50 focus-visible:outline-none"
                  >
                    <span className="truncate font-semibold tracking-[-0.01em]">
                      {beach.name}
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 bg-slate-900/40 px-2 py-0.5 text-[11px] text-slate-400">
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
          <div className="br-press w-[70vw] whitespace-nowrap rounded-full border border-slate-700/60 bg-slate-950/60 px-3 py-1.5 text-[10px] tracking-tight text-slate-200 backdrop-blur sm:w-auto sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-normal">
            {notice}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TopSearch;
