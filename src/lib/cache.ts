// كاش بسيط في الذاكرة مع صلاحية زمنية — يعيش طوال عمر عملية الخادم.
// In-memory TTL cache; survives across requests in a single server process.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // حماية من التضخم: نظّف المفاتيح المنتهية عند تجاوز حد معين
  if (store.size > 2000) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now > v.expiresAt) store.delete(k);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * جلب مع كاش: ينفّذ fn مرة واحدة لكل مفتاح خلال مدة الصلاحية.
 * الطلبات المتزامنة لنفس المفتاح تتشارك نفس الوعد (تمنع الازدواج).
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      if (value !== null && value !== undefined) {
        cacheSet(key, value, ttlMs);
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
