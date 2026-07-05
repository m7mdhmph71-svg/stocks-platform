// حد المحاولات — نافذة منزلقة في الذاكرة (لكل عملية خادم).
// كافٍ لنشر بحاوية واحدة؛ عند التوسع الأفقي انقله إلى مخزن مشترك.

const hits = new Map<string, number[]>();

function recent(key: string, windowMs: number): number[] {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, arr);
  // تنظيف دوري خفيف عند التضخم
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) hits.delete(k);
    }
  }
  return arr;
}

/** هل تجاوز المفتاح الحد؟ (لا يسجّل محاولة — للفحص قبل المعالجة) */
export function tooMany(key: string, max: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= max;
}

/** يسجّل محاولة (فاشلة عادة) على المفتاح */
export function recordAttempt(key: string, windowMs: number): void {
  recent(key, windowMs).push(Date.now());
}

/** فحص وتسجيل معاً — للمسارات التي تُحتسب فيها كل نداءة (تسجيل/استرجاع) */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const arr = recent(key, windowMs);
  if (arr.length >= max) return false;
  arr.push(Date.now());
  return true;
}

/** عنوان الطالب من الترويسات (خلف وكيل عادة) */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}
