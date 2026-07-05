// ============================================================
// المؤشرات الفنية — دوال نقية حتمية على شموع يومية مرتبة تصاعدياً.
// يتطلب ≥ 20 شمعة، وكل حساب يتحقق من كفاية بياناته وإلا يعيد null:
//  - RSI14 و ATR14 بتمهيد Wilder (المتوسط الأول بسيط ثم تمهيد).
//  - SMA من الإغلاقات. النقاط المحورية من آخر شمعة مكتملة.
//  - أداء الأسبوع = آخر إغلاق ÷ إغلاق قبل 5 جلسات، الشهر = قبل 21 جلسة.
//  - قمة/قاع 50 يوماً من آخر 50 جلسة، و52 أسبوعاً من آخر 252 جلسة
//    (تُقبل ≥ 200 جلسة كتقريب لسنة كاملة).
// ============================================================

import { Candle, TechnicalSnapshot } from "@/lib/types";

function emptySnapshot(): TechnicalSnapshot {
  return {
    rsi14: null,
    atr14: null,
    sma20: null,
    sma50: null,
    sma200: null,
    high50d: null,
    low50d: null,
    high52w: null,
    low52w: null,
    pivot: null,
    swingLows: [],
    swingHighs: [],
    weekPerfPercent: null,
    monthPerfPercent: null,
  };
}

/**
 * القيعان/القمم المتأرجحة (fractal بعرض k): قاع أدنى من k شموع على كل جانب
 * (والقمة بعكسه) ضمن آخر window شمعة. تُعاد بترتيب زمني تصاعدي.
 * آخر k شموع لا يمكن تأكيد تأرجحها بعد — وهذا مقصود (لا تسريب مستقبلي).
 */
function findSwings(
  candles: Candle[],
  k = 2,
  window = 120,
  maxCount = 10
): { lows: number[]; highs: number[] } {
  const start = Math.max(k, candles.length - window);
  const lows: number[] = [];
  const highs: number[] = [];
  for (let i = start; i < candles.length - k; i++) {
    let isLow = true;
    let isHigh = true;
    for (let j = 1; j <= k; j++) {
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
      }
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
      }
      if (!isLow && !isHigh) break;
    }
    if (isLow) lows.push(candles[i].low);
    if (isHigh) highs.push(candles[i].high);
  }
  return { lows: lows.slice(-maxCount), highs: highs.slice(-maxCount) };
}

/** RSI بطريقة Wilder: أول متوسط ربح/خسارة بسيط لأول 14 تغيراً ثم تمهيد */
function wilderRsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gainSum += d;
    else lossSum -= d;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** ATR بطريقة Wilder: TR = max(H-L, |H-prevC|, |L-prevC|) */
function wilderAtr(candles: Candle[], period: number): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let atr = 0;
  for (let i = 0; i < period; i++) atr += trs[i];
  atr /= period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

/** متوسط متحرك بسيط لآخر n إغلاق */
function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i];
  return sum / n;
}

/** أعلى قمة وأدنى قاع في آخر window شمعة (يشترط توفر minLen شمعة) */
function windowHighLow(
  candles: Candle[],
  window: number,
  minLen: number
): { high: number | null; low: number | null } {
  if (candles.length < minLen) return { high: null, low: null };
  const slice = candles.slice(-window);
  let high = -Infinity;
  let low = Infinity;
  for (const c of slice) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return { high: null, low: null };
  }
  return { high, low };
}

/** أداء نسبي: آخر إغلاق ÷ إغلاق قبل sessions جلسة */
function perfPercent(closes: number[], sessions: number): number | null {
  const n = closes.length;
  if (n < sessions + 1) return null;
  const prev = closes[n - 1 - sessions];
  if (!(prev > 0)) return null;
  return (closes[n - 1] / prev - 1) * 100;
}

export function computeTechnicals(candles: Candle[]): TechnicalSnapshot {
  // تجاهل الشموع غير الصالحة دفاعياً (وحدة الرسم تتكفل بالتطبيع أصلاً)
  const cs = candles.filter(
    (c) =>
      Number.isFinite(c.close) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      c.close > 0
  );

  if (cs.length < 20) return emptySnapshot();

  const closes = cs.map((c) => c.close);
  const last = cs[cs.length - 1];

  // النقاط المحورية الكلاسيكية من آخر شمعة مكتملة
  const h = last.high;
  const l = last.low;
  const c = last.close;
  const p = (h + l + c) / 3;
  const pivot = {
    p,
    r1: 2 * p - l,
    r2: p + (h - l),
    r3: h + 2 * (p - l),
    s1: 2 * p - h,
    s2: p - (h - l),
    s3: l - 2 * (h - p),
  };

  const fifty = windowHighLow(cs, 50, 50);
  const yearly = windowHighLow(cs, 252, 200);
  const swings = findSwings(cs);

  return {
    rsi14: wilderRsi(closes, 14),
    atr14: wilderAtr(cs, 14),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    high50d: fifty.high,
    low50d: fifty.low,
    high52w: yearly.high,
    low52w: yearly.low,
    pivot,
    swingLows: swings.lows,
    swingHighs: swings.highs,
    weekPerfPercent: perfPercent(closes, 5),
    monthPerfPercent: perfPercent(closes, 21),
  };
}
