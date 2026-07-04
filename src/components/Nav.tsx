"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import { useSession } from "@/components/useSession";

const baseLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/screener", label: "الفرز" },
];

const memberLinks = [
  { href: "/watchlist", label: "قائمتي" },
  { href: "/trades", label: "صفقاتي" },
];

export function Nav() {
  const pathname = usePathname();
  const session = useSession();

  const links = [
    ...baseLinks,
    ...(session.enabled && session.user ? memberLinks : []),
    ...(session.enabled
      ? [{ href: "/account", label: session.user ? "حسابي" : "دخول" }]
      : []),
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
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <SearchBox variant="nav" />
        </div>
      </div>

      {/* روابط الجوال */}
      <nav
        className="flex items-center gap-1 border-t border-zinc-100 px-4 py-1.5 sm:hidden dark:border-zinc-900"
        aria-label="التنقل للجوال"
      >
        {links.map((l) => {
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
