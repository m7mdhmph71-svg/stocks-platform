// عميل Yahoo Finance: إدارة الكوكي + crumb تلقائياً، مع إعادة المحاولة.
// Yahoo Finance HTTP client: manages cookie + crumb, retries once on 401.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface Session {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

let session: Session | null = null;
let sessionPromise: Promise<Session> | null = null;

const SESSION_TTL_MS = 25 * 60 * 1000; // جدّد الجلسة كل ٢٥ دقيقة

async function newSession(): Promise<Session> {
  // 1) احصل على كوكي من صفحة ياهو
  const r1 = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "manual",
    cache: "no-store",
  });
  const setCookie = r1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  // 2) احصل على crumb بنفس الكوكي
  const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
    cache: "no-store",
  });
  const crumb = (await r2.text()).trim();
  if (!r2.ok || !crumb || crumb.includes("<")) {
    throw new Error("yahoo: failed to obtain crumb");
  }
  return { cookie, crumb, fetchedAt: Date.now() };
}

export async function getSession(force = false): Promise<Session> {
  if (
    !force &&
    session &&
    Date.now() - session.fetchedAt < SESSION_TTL_MS
  ) {
    return session;
  }
  if (!sessionPromise) {
    sessionPromise = newSession()
      .then((s) => {
        session = s;
        return s;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

export interface YahooFetchOptions {
  /** أضف &crumb= تلقائياً (مطلوب لـ quoteSummary والفرز المخصص) */
  needsCrumb?: boolean;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

/**
 * نداء JSON لواجهات Yahoo مع الكوكي/crumb وإعادة محاولة واحدة عند 401/403.
 */
export async function yahooJson<T = unknown>(
  url: string,
  opts: YahooFetchOptions = {}
): Promise<T> {
  const { needsCrumb = false, method = "GET", body, timeoutMs = 15000 } = opts;

  const attempt = async (forceNew: boolean): Promise<Response> => {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "application/json",
    };
    let finalUrl = url;
    if (needsCrumb) {
      const s = await getSession(forceNew);
      headers.Cookie = s.cookie;
      finalUrl +=
        (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(s.crumb);
    }
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(finalUrl, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(t);
    }
  };

  let res = await attempt(false);
  if ((res.status === 401 || res.status === 403) && needsCrumb) {
    // جلسة منتهية — جدّد وأعد المحاولة مرة واحدة
    res = await attempt(true);
  }
  if (!res.ok) {
    throw new Error(`yahoo: ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}
