"use client";

// شارة حالة السوق الحية: نقطة خضراء/رمادية + «مفتوح، يغلق بعد…» —
// تجيب فوراً عن حيرة «لماذا النتائج قليلة/قديمة؟» خارج ساعات التداول.

import { useEffect, useState } from "react";
import { MarketKey, marketSession } from "@/lib/marketHours";

export function MarketStatusBadge({ market }: { market: MarketKey }) {
  const [session, setSession] = useState(() => marketSession(market));

  useEffect(() => {
    setSession(marketSession(market));
    const id = setInterval(() => setSession(marketSession(market)), 60_000);
    return () => clearInterval(id);
  }, [market]);

  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium " +
        (session.open
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300")
      }
      title={session.detailAr}
    >
      <span
        aria-hidden
        className={
          "h-2 w-2 rounded-full " +
          (session.open ? "animate-pulse bg-emerald-500" : "bg-zinc-400")
        }
      />
      {session.labelAr}
      <span className="text-[11px] opacity-75">· {session.detailAr}</span>
    </span>
  );
}
