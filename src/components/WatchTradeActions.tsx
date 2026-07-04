"use client";

// زرا «تابِع» و«دخلت الصفقة» في صفحة السهم — يظهران عند تفعيل الحسابات

import { useEffect, useState } from "react";
import Link from "next/link";
import { TargetsResult } from "@/lib/types";
import { useSession } from "@/components/useSession";
import { fmtPrice } from "@/lib/format";

export function WatchTradeActions({
  ticker,
  price,
  targets,
}: {
  ticker: string;
  price: number;
  targets: TargetsResult;
}) {
  const session = useSession();
  const [watched, setWatched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session.user) return;
    let cancelled = false;
    fetch("/api/watchlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows?: Array<{ ticker: string }> }) => {
        if (!cancelled) setWatched(!!d.rows?.some((x) => x.ticker === ticker));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.user, ticker]);

  if (session.loading || !session.enabled) return null;

  if (!session.user) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/account" className="font-bold text-brand-700 underline dark:text-brand-400">
          سجّل الدخول
        </Link>{" "}
        لتتابع السهم أو توثّق صفقتك عليه.
      </p>
    );
  }

  const t1 = targets.targets[0]?.price ?? null;
  const stop = targets.stopLoss;
  const canTrade = t1 !== null && stop !== null && t1 > price && stop < price;

  async function toggleWatch() {
    setBusy(true);
    try {
      if (watched) {
        await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, {
          method: "DELETE",
        });
        setWatched(false);
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        setWatched(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openTrade() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          strategy: targets.strategy,
          entryPrice: price,
          target: t1,
          stop,
          qty: qty.trim() ? Number(qty) : undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setMsg("✅ وُثّقت الصفقة — تابعها في «سجل صفقاتي».");
        setOpenForm(false);
      } else {
        setMsg(d.error ?? "تعذّر توثيق الصفقة.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleWatch}
          disabled={busy}
          className={
            "rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 " +
            (watched
              ? "border border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/50 dark:text-brand-300"
              : "bg-brand-600 text-white hover:bg-brand-700")
          }
        >
          {watched ? "★ في قائمتك — إزالة" : "☆ تابِع السهم"}
        </button>
        {canTrade ? (
          <button
            type="button"
            onClick={() => setOpenForm((v) => !v)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            📒 دخلت الصفقة
          </button>
        ) : null}
        <Link
          href="/watchlist"
          className="text-xs text-zinc-500 underline dark:text-zinc-400"
        >
          قائمتي
        </Link>
      </div>

      {openForm && canTrade ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
          <p className="text-zinc-600 dark:text-zinc-300">
            توثيق صفقة «{targets.strategyAr}»: دخول {fmtPrice(price)} · هدف{" "}
            <b className="text-emerald-700 dark:text-emerald-400">{fmtPrice(t1)}</b> · وقف{" "}
            <b className="text-red-700 dark:text-red-400">{fmtPrice(stop)}</b>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              type="number"
              min="1"
              placeholder="الكمية (اختياري)"
              className="field w-36 py-1.5 text-sm"
              dir="ltr"
            />
            <button
              type="button"
              onClick={openTrade}
              disabled={busy}
              className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {busy ? "لحظة…" : "وثّق الصفقة"}
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{msg}</p>
      ) : null}
    </div>
  );
}
