type TopSearchProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  notice?: string | null;
};

const TopSearch = ({
  value,
  onChange,
  resultCount,
  notice,
}: TopSearchProps) => (
  <div className="fixed left-0 right-0 top-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
    <div className="mx-auto flex max-w-screen-sm items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 px-4 py-3 shadow-lg backdrop-blur">
      <span className="text-sm text-slate-400">Cerca</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Spiagge, localita"
        aria-label="Cerca spiagge"
        className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
      />
      <span className="text-xs text-slate-500">{resultCount}</span>
    </div>
    {notice ? (
      <div className="mx-auto mt-2 max-w-screen-sm rounded-full border border-slate-700/70 bg-slate-950/70 px-4 py-2 text-[11px] text-slate-200 shadow-md backdrop-blur">
        <span className="text-sky-300">Dati live limitati:</span> {notice}
      </div>
    ) : null}
  </div>
);

export default TopSearch;
