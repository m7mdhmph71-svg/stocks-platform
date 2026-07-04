"use client";

// خطاف الجلسة: حالة الحسابات (مفعّلة؟) والمستخدم الحالي — يُستهلك في الواجهة

import { useCallback, useEffect, useState } from "react";

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

export function useSession(): SessionState {
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
  return { loading, enabled, user, refresh };
}
