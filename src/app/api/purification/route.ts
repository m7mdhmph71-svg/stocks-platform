import { NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/db";
import { sessionUserId } from "@/lib/auth/session";
import {
  computePurification,
  PURIFICATION_NOTES_AR,
  PurificationReport,
} from "@/lib/purification";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// تقرير تطهير المحفظة: يحسب لكل صفقة مغلقة رابحة مبلغ التطهير المستحق
// (الربح × نسبة تطهير السهم) مع إجماليات كلية وسنوية وشهرية.

export interface PurificationResponse extends PurificationReport {
  /** إجماليات بحسب الفترة (بالدولار ثم بالريال) */
  periods: {
    thisMonth: { usd: number; sar: number };
    thisYear: { usd: number; sar: number };
    allTime: { usd: number; sar: number };
  };
  asOf: string;
  notesAr: string[];
}

export async function GET() {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "الحسابات غير مفعّلة على هذا النشر." },
      { status: 503 }
    );
  }
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const trades = await db().trade.findMany({
    where: { userId, status: { not: "OPEN" } },
    orderBy: { closedAt: "desc" },
    take: 500,
  });

  const report = await computePurification(trades);

  // إجماليات الفترات من الصفوف المحسوبة
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const periods = {
    thisMonth: { usd: 0, sar: 0 },
    thisYear: { usd: 0, sar: 0 },
    allTime: { usd: 0, sar: 0 },
  };
  for (const r of report.rows) {
    if (r.amount === null || r.amount <= 0) continue;
    const closed = r.closedAt ? new Date(r.closedAt) : null;
    const key = r.currency === "$" ? "usd" : "sar";
    periods.allTime[key] += r.amount;
    if (closed && closed >= yearStart) periods.thisYear[key] += r.amount;
    if (closed && closed >= monthStart) periods.thisMonth[key] += r.amount;
  }

  const res: PurificationResponse = {
    ...report,
    periods,
    asOf: now.toISOString(),
    notesAr: PURIFICATION_NOTES_AR,
  };
  return NextResponse.json(res);
}
