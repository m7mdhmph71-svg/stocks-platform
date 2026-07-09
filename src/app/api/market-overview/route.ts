import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { batchQuotes } from "@/lib/yahoo/batchQuotes";

export const dynamic = "force-dynamic";

// نظرة السوق للرئيسية: المؤشرات الرئيسة للسوقين — خفيفة ومخبأة دقيقتين.

const INDICES: Array<{ symbol: string; nameAr: string; market: "us" | "sa" }> = [
  { symbol: "^GSPC", nameAr: "S&P 500", market: "us" },
  { symbol: "^IXIC", nameAr: "ناسداك", market: "us" },
  { symbol: "^TASI.SR", nameAr: "تاسي (تداول)", market: "sa" },
];

export interface MarketOverviewResponse {
  indices: Array<{
    symbol: string;
    nameAr: string;
    market: "us" | "sa";
    price: number | null;
    changePercent: number | null;
  }>;
  asOf: string;
}

export async function GET() {
  const data = await cached("market-overview", 2 * 60_000, async () => {
    const quotes = await batchQuotes(INDICES.map((i) => i.symbol));
    return INDICES.map((i) => {
      const q = quotes.get(i.symbol);
      return {
        symbol: i.symbol,
        nameAr: i.nameAr,
        market: i.market,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
      };
    });
  });

  const res: MarketOverviewResponse = {
    indices: data,
    asOf: new Date().toISOString(),
  };
  return NextResponse.json(res);
}
