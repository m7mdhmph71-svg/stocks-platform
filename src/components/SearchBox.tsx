"use client";

// صندوق بحث الأسهم بالاسم أو الرمز مع اقتراحات فورية.
// variant="nav": مدمج في الشريط العلوي. variant="hero": بارز في الرئيسية
// لفحص شرعية أي سهم مباشرة.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  isUS: boolean;
}

export function SearchBox({ variant }: { variant: "nav" | "hero" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // بحث مؤجل أثناء الكتابة
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: SearchResult[] }) => {
          setResults(d.results ?? []);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const go = useCallback(
    (ticker: string) => {
      setQ("");
      setResults([]);
      setOpen(false);
      router.push(`/stock/${encodeURIComponent(ticker.toUpperCase())}`);
    },
    [router]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" && results.length > 0) {
        e.preventDefault();
        setActive((a) => (a + 1) % results.length);
      } else if (e.key === "ArrowUp" && results.length > 0) {
        e.preventDefault();
        setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Enter") {
        const chosen =
          active >= 0 && active < results.length
            ? results[active].ticker
            : results[0]?.ticker ??
              (/^[A-Za-z0-9.\-]{1,12}$/.test(q.trim()) ? q.trim() : null);
        if (chosen) go(chosen);
      }
    },
    [results, active, q, go]
  );

  const isHero = variant === "hero";

  return (
    <div ref={boxRef} className={"relative " + (isHero ? "w-full" : "")}>
      <label className="relative block">
        <span className="sr-only">ابحث عن سهم بالاسم أو الرمز</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          dir="auto"
          placeholder={
            isHero
              ? "اكتب اسم الشركة أو الرمز… مثل Apple أو AAPL"
              : "بحث: اسم أو رمز…"
          }
          className={
            isHero
              ? "field w-full rounded-2xl px-5 py-3.5 text-base shadow-sm"
              : "field w-40 rounded-full py-1.5 sm:w-56"
          }
          aria-label="ابحث عن سهم بالاسم أو الرمز"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {loading ? (
          <span
            className={
              "absolute top-1/2 -translate-y-1/2 " +
              (isHero ? "end-4" : "end-3")
            }
          >
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </span>
        ) : null}
      </label>

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className={
            "absolute z-50 mt-2 max-h-80 w-full min-w-[18rem] overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 " +
            (isHero ? "" : "end-0")
          }
        >
          {results.map((r, i) => (
            <li key={r.ticker} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r.ticker);
                }}
                onMouseEnter={() => setActive(i)}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors " +
                  (i === active
                    ? "bg-brand-50 dark:bg-brand-950/50"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {r.name}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.exchange}
                    {r.isUS ? "" : " · خارج السوق الأمريكي"}
                  </span>
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {r.ticker}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !loading && results.length === 0 && q.trim().length > 0 ? (
        <div className="absolute z-50 mt-2 w-full min-w-[18rem] rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          لا نتائج — جرّب الرمز مباشرة (مثل AAPL).
        </div>
      ) : null}
    </div>
  );
}
