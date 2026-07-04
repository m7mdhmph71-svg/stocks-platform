"use client";

// حالة الجلسة المشتركة لكل التطبيق: مزوّد واحد في layout يغذي كل
// المكونات (الشريط، الحساب، القوائم…) — تسجيل الدخول/الخروج في أي
// مكان يحدّث الجميع فوراً عبر refresh().

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface SessionUser {
  email: string;
  name: string | null;
  plan: "FREE" | "PRO";
}

export interface SessionState {
  loading: boolean;
  /** هل الحسابات مفعّلة على هذا النشر (DATABASE_URL مضبوط)؟ */
  enabled: boolean;
  user: SessionUser | null;
  refresh: () => void;
}

const SessionContext = createContext<SessionState>({
  loading: true,
  enabled: false,
  user: null,
  refresh: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false, user: null }))
      .then((d: { enabled?: boolean; user?: SessionUser | null }) => {
        if (!cancelled) {
          setEnabled(!!d.enabled);
          setUser(d.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return (
    <SessionContext.Provider value={{ loading, enabled, user, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
