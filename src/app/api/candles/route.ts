import { NextRequest, NextResponse } from "next/server";
import { Candle } from "@/lib/types";
import {
  ChartRange,
  fetchCandles,
  isChartRange,
  isIntradayRange,
} from "@/lib/yahoo/chart";
import { demoCandles, isDemoTicker } from "@/lib/demo/dataset";

export const dynamic = "force-dynamic";

// شموع الرسم البياني بفترة يختارها المستخدم — تُستدعى من صفحة السهم
// عند تبديل الفترة (الفترة الافتراضية «سنة» تأتي ضمن استجابة السهم نفسها).

export interface CandlesResponse {
  ticker: string;
  range: ChartRange;
  /** فترة لحظية: تُعرض أوقات الشموع بالساعة بدل التاريخ */
  intraday: boolean;
  candles: Candle[];
  asOf: string;
  notesAr: string[];
}

/** تقريب الفترة على مجموعة البيانات التجريبية (شموع يومية لسنة واحدة) */
const DEMO_SESSIONS: Partial<Record<ChartRange, number>> = {
  "1d": 1,
  "5d": 5,
  "1mo": 22,
  "3mo": 63,
  "6mo": 126,
  ytd: 126,
  "1y": 260,
};

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "")
    .trim()
    .toUpperCase();
  const rangeRaw = request.nextUrl.searchParams.get("range") ?? "1y";

  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "رمز سهم غير صالح." }, { status: 400 });
  }
  if (!isChartRange(rangeRaw)) {
    return NextResponse.json({ error: "فترة غير مدعومة." }, { status: 400 });
  }
  const range: ChartRange = rangeRaw;
  const notesAr: string[] = [];

  let candles: Candle[];
  if (isDemoTicker(ticker)) {
    const all = demoCandles(ticker);
    const take = DEMO_SESSIONS[range];
    candles = take !== undefined ? all.slice(-take) : all;
    notesAr.push("بيانات تجريبية — الفترات تقريبية على شموع يومية.");
  } else {
    candles = await fetchCandles(ticker, range);
  }

  if (candles.length === 0) {
    return NextResponse.json(
      { error: "تعذّر جلب بيانات الفترة المطلوبة — حاول مجدداً." },
      { status: 502 }
    );
  }

  const res: CandlesResponse = {
    ticker,
    range,
    intraday: isIntradayRange(range) && !isDemoTicker(ticker),
    candles,
    asOf: new Date().toISOString(),
    notesAr,
  };
  return NextResponse.json(res);
}
