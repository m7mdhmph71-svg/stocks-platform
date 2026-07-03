"use client";

import { useMemo, useState } from "react";
import { Candle } from "@/lib/types";
import { fmtNum, fmtPrice } from "@/lib/format";
import { fmtShortDateAr } from "@/components/ui";

export interface ChartLevel {
  price: number;
  label: string;
  color: string; // hex آمن للوضعين
}

interface PriceChartProps {
  candles: Candle[];
  targets?: { label: string; price: number }[];
  stopLoss?: number | null;
  sma50?: number | null;
  sma200?: number | null;
}

const W = 820;
const H = 320;
const PAD = { top: 16, right: 64, bottom: 28, left: 14 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const COLOR_LINE = "#10b981"; // emerald-500
const COLOR_TARGET = "#10b981";
const COLOR_STOP = "#ef4444"; // red-500
const COLOR_SMA50 = "#0ea5e9"; // sky-500
const COLOR_SMA200 = "#8b5cf6"; // violet-500

export function PriceChart({
  candles,
  targets = [],
  stopLoss = null,
  sma50 = null,
  sma200 = null,
}: PriceChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const model = useMemo(() => {
    if (candles.length < 2) return null;

    const closes = candles.map((c) => c.close);
    let minC = Math.min(...closes);
    let maxC = Math.max(...closes);

    // المستويات الأفقية (تدخل في المدى فقط إذا كانت قريبة منطقياً من السعر)
    const levels: ChartLevel[] = [];
    for (const t of targets) {
      if (isFinite(t.price)) {
        levels.push({ price: t.price, label: t.label, color: COLOR_TARGET });
      }
    }
    if (stopLoss !== null && isFinite(stopLoss)) {
      levels.push({ price: stopLoss, label: "الوقف", color: COLOR_STOP });
    }
    if (sma50 !== null && isFinite(sma50)) {
      levels.push({ price: sma50, label: "SMA50", color: COLOR_SMA50 });
    }
    if (sma200 !== null && isFinite(sma200)) {
      levels.push({ price: sma200, label: "SMA200", color: COLOR_SMA200 });
    }

    for (const lv of levels) {
      if (lv.price >= minC * 0.5 && lv.price <= maxC * 1.6) {
        minC = Math.min(minC, lv.price);
        maxC = Math.max(maxC, lv.price);
      }
    }

    if (maxC === minC) {
      maxC += 1;
      minC = Math.max(0, minC - 1);
    }
    const span = maxC - minC;
    const yMin = Math.max(0, minC - span * 0.06);
    const yMax = maxC + span * 0.06;

    const x = (i: number) =>
      PAD.left + (i / (candles.length - 1)) * PLOT_W;
    const y = (p: number) =>
      PAD.top + (1 - (p - yMin) / (yMax - yMin)) * PLOT_H;

    let line = "";
    for (let i = 0; i < candles.length; i++) {
      line += `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(
        candles[i].close
      ).toFixed(2)}`;
    }
    const area =
      line +
      `L${x(candles.length - 1).toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)}` +
      `L${x(0).toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)}Z`;

    // علامات المحور الرأسي (5 مستويات)
    const yTicks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / 4);
    }

    // علامات المحور الأفقي (~5 تواريخ)
    const xTickIdx: number[] = [];
    const step = Math.max(1, Math.floor((candles.length - 1) / 4));
    for (let i = 0; i < candles.length; i += step) xTickIdx.push(i);
    if (xTickIdx[xTickIdx.length - 1] !== candles.length - 1) {
      xTickIdx.push(candles.length - 1);
    }

    const drawableLevels = levels.filter(
      (lv) => lv.price >= yMin && lv.price <= yMax
    );

    return { x, y, line, area, yTicks, xTickIdx, drawableLevels, yMin, yMax };
  }, [candles, targets, stopLoss, sma50, sma200]);

  if (!model) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        لا تتوفر بيانات سعرية كافية للرسم البياني.
      </div>
    );
  }

  const { x, y, line, area, yTicks, xTickIdx, drawableLevels } = model;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const xView = ((e.clientX - rect.left) / rect.width) * W;
    const raw = ((xView - PAD.left) / PLOT_W) * (candles.length - 1);
    const idx = Math.round(Math.max(0, Math.min(candles.length - 1, raw)));
    setHoverIdx(idx);
  }

  const hover = hoverIdx !== null ? candles[hoverIdx] : null;

  const legend: { label: string; color: string; dashed: boolean }[] = [
    { label: "الإغلاق", color: COLOR_LINE, dashed: false },
  ];
  if (targets.length > 0)
    legend.push({ label: "الأهداف", color: COLOR_TARGET, dashed: true });
  if (stopLoss !== null)
    legend.push({ label: "الوقف", color: COLOR_STOP, dashed: true });
  if (sma50 !== null)
    legend.push({ label: "SMA50", color: COLOR_SMA50, dashed: true });
  if (sma200 !== null)
    legend.push({ label: "SMA200", color: COLOR_SMA200, dashed: true });

  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none text-zinc-500 dark:text-zinc-400"
        role="img"
        aria-label="الرسم البياني لسعر الإغلاق مع مستويات الأهداف والوقف"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_LINE} stopOpacity="0.28" />
            <stop offset="100%" stopColor={COLOR_LINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* شبكة أفقية + قيم المحور الرأسي */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="1"
            />
            <text
              x={W - PAD.right + 8}
              y={y(t) + 4}
              fontSize="11"
              fill="currentColor"
              className="tabular-nums"
            >
              {fmtNum(t, t < 10 ? 2 : t < 1000 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* تواريخ المحور الأفقي */}
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fontSize="11"
            textAnchor="middle"
            fill="currentColor"
          >
            {fmtShortDateAr(candles[i].time)}
          </text>
        ))}

        {/* التظليل والخط */}
        <path d={area} fill="url(#pc-fill)" />
        <path
          d={line}
          fill="none"
          stroke={COLOR_LINE}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* المستويات الأفقية المتقطعة */}
        {drawableLevels.map((lv, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y(lv.price)}
              y2={y(lv.price)}
              stroke={lv.color}
              strokeWidth="1.4"
              strokeDasharray="6 5"
              strokeOpacity="0.9"
            />
            <text
              x={PAD.left + 4}
              y={y(lv.price) - 4}
              fontSize="10.5"
              fill={lv.color}
              className="font-medium"
            >
              {lv.label} {fmtNum(lv.price, lv.price < 10 ? 2 : 1)}
            </text>
          </g>
        ))}

        {/* مؤشر التحويم */}
        {hover && hoverIdx !== null ? (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hoverIdx)}
              cy={y(hover.close)}
              r="4"
              fill={COLOR_LINE}
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        ) : null}
      </svg>

      {/* تلميح التحويم */}
      {hover && hoverIdx !== null ? (
        <div
          dir="rtl"
          className="pointer-events-none absolute z-10 -translate-y-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            left: `${(x(hoverIdx) / W) * 100}%`,
            top: `${(y(hover.close) / H) * 100}%`,
            transform: `translate(${
              hoverIdx > candles.length / 2 ? "-105%" : "5%"
            }, -120%)`,
          }}
        >
          <div className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {fmtPrice(hover.close)}
          </div>
          <div className="text-zinc-500 dark:text-zinc-400">
            {fmtShortDateAr(hover.time)}
          </div>
        </div>
      ) : null}

      {/* مفتاح الألوان */}
      <div
        dir="rtl"
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400"
      >
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 6" className="h-1.5 w-6">
              <line
                x1="0"
                x2="24"
                y1="3"
                y2="3"
                stroke={l.color}
                strokeWidth="3"
                strokeDasharray={l.dashed ? "5 4" : undefined}
              />
            </svg>
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
