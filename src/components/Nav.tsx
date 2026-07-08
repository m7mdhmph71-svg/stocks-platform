"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import { useSession } from "@/components/useSession";

const baseLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/screener", label: "الفرز" },
  { href: "/backtest", label: "الاختبار" },
  { href: "/pricing", label: "الخطط" },
];

/** أدوات المستخدم المسجّل — تُجمع تحت «محفظتي» في سطح المكتب */
const portfolioLinks = [
  { href: "/watchlist", label: "قائمة المتابعة" },
  { href: "/trades", label: "سجل الصفقات" },
  { href: "/purification", label: "تطهير المحفظة" },
  { href: "/whatsapp", label: "تنبيهات واتساب" },
];

function linkCls(active: boolean): string {
  return (
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
    (active
      ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50")
  );
}

/** قائمة «محفظتي» المنسدلة — تُغلق بالنقر خارجها أو بالهروب */
function PortfolioMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = portfolioLinks.some((l) => pathname.startsWith(l.href));

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // إغلاق عند تغيّر الصفحة
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={linkCls(active) + " inline-flex items-center gap-1"}
      >
        محفظتي
        <span aria-hidden className="text-[10px]">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {portfolioLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              className={
                "block px-4 py-2 text-sm transition-colors " +
                (pathname.startsWith(l.href)
                  ? "bg-brand-50 font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800")
              }
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const session = useSession();

  const accountLink = session.enabled
    ? { href: "/account", label: session.user ? "حسابي" : "دخول" }
    : null;

  // الجوال: قائمة مسطحة قابلة للتمرير (المنسدلة غير عملية هناك)
  const mobileLinks = [
    ...baseLinks,
    ...(session.enabled && session.user ? portfolioLinks : []),
    ...(accountLink ? [accountLink] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">
            س
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            سهم سكرينر
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="التنقل الرئيسي">
          {baseLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkCls(
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)
              )}
            >
              {l.label}
            </Link>
          ))}
          {session.enabled && session.user ? (
            <PortfolioMenu pathname={pathname} />
          ) : null}
          {accountLink ? (
            <Link
              href={accountLink.href}
              className={linkCls(pathname.startsWith("/account"))}
            >
              {accountLink.label}
            </Link>
          ) : null}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <SearchBox variant="nav" />
        </div>
      </div>

      {/* روابط الجوال */}
      <nav
        className="flex items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-zinc-100 px-4 py-1.5 sm:hidden dark:border-zinc-900"
        aria-label="التنقل للجوال"
      >
        {mobileLinks.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                "rounded-lg px-3 py-1 text-sm font-medium " +
                (active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "text-zinc-600 dark:text-zinc-300")
              }
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
