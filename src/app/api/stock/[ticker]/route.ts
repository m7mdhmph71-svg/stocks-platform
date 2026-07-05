import { NextRequest, NextResponse } from "next/server";
import { getStockDetail } from "@/lib/stockDetail";

export const dynamic = "force-dynamic";

// بيانات صفحة السهم — المنطق كله في src/lib/stockDetail.ts (مشترك مع
// التصيير الخادمي للصفحة). هذا المسار تستهلكه الواجهة عند التحديث/الإعادة.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const result = await getStockDetail(ticker);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
