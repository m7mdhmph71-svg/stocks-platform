// حالة جلسات السوق (مفتوح/مغلق + الوقت للحدث التالي) — دوال نقية
// تعمل في المتصفح والخادم عبر Intl (تتكفل بالتوقيت الصيفي تلقائياً).
//
// الجلسات الرسمية:
//   الأمريكي: الاثنين-الجمعة 09:30-16:00 بتوقيت نيويورك.
//   تداول:   الأحد-الخميس 10:00-15:10 بتوقيت الرياض.
// لا تُحتسب العطل الرسمية (تحسين لاحق) — التقريب مقبول لشارة حالة.

export type MarketKey = "us" | "sa";

export interface MarketSession {
  open: boolean;
  /** دقائق حتى الحدث التالي (فتح إن كان مغلقاً، إغلاق إن كان مفتوحاً) */
  minutesToChange: number;
  labelAr: string;
  /** نص مساعد: «يفتح بعد ٥س ٢٠د» أو «يغلق بعد ٤٥د» */
  detailAr: string;
}

const CONFIG: Record<
  MarketKey,
  { tz: string; days: number[]; openMin: number; closeMin: number; nameAr: string }
> = {
  us: {
    tz: "America/New_York",
    days: [1, 2, 3, 4, 5],
    openMin: 9 * 60 + 30,
    closeMin: 16 * 60,
    nameAr: "السوق الأمريكي",
  },
  sa: {
    tz: "Asia/Riyadh",
    days: [0, 1, 2, 3, 4],
    openMin: 10 * 60,
    closeMin: 15 * 60 + 10,
    nameAr: "تداول السعودية",
  },
};

/** أجزاء الوقت الحالي في منطقة زمنية معينة */
function partsIn(tz: string, date: Date): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hourRaw = Number(get("hour"));
  return {
    day: dayMap[get("weekday")] ?? 0,
    minutes: (hourRaw === 24 ? 0 : hourRaw) * 60 + Number(get("minute")),
  };
}

function fmtDelta(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 48) return `بعد ${Math.round(h / 24)} أيام`;
  if (h > 0) return `بعد ${h}س ${m}د`;
  return `بعد ${m}د`;
}

export function marketSession(market: MarketKey, now = new Date()): MarketSession {
  const cfg = CONFIG[market];
  const { day, minutes } = partsIn(cfg.tz, now);

  const isTradingDay = cfg.days.includes(day);
  const open = isTradingDay && minutes >= cfg.openMin && minutes < cfg.closeMin;

  if (open) {
    const toClose = cfg.closeMin - minutes;
    return {
      open: true,
      minutesToChange: toClose,
      labelAr: `${cfg.nameAr} مفتوح`,
      detailAr: `يغلق ${fmtDelta(toClose)}`,
    };
  }

  // دقائق حتى الفتح التالي: نمسح الأيام السبعة القادمة
  let toOpen: number;
  if (isTradingDay && minutes < cfg.openMin) {
    toOpen = cfg.openMin - minutes;
  } else {
    // بقية اليوم ثم الأيام التالية حتى أول يوم تداول
    toOpen = 24 * 60 - minutes;
    let d = (day + 1) % 7;
    while (!cfg.days.includes(d)) {
      toOpen += 24 * 60;
      d = (d + 1) % 7;
    }
    toOpen += cfg.openMin;
  }
  return {
    open: false,
    minutesToChange: toOpen,
    labelAr: `${cfg.nameAr} مغلق`,
    detailAr: `يفتح ${fmtDelta(toOpen)}`,
  };
}

/** سوق الرمز: تداول للسعودي (.SR) والأمريكي لسواه */
export function marketOf(ticker: string): MarketKey {
  return ticker.toUpperCase().endsWith(".SR") ? "sa" : "us";
}
